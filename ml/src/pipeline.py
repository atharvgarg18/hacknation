"""Main pipeline — orchestrates the full SATARK ML detection system.

Usage:
    python -m src.pipeline                    # default config
    python -m src.pipeline configs/fast.yaml  # override config
    python -m src.pipeline --phase 1          # run only phase 1
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from .calibration import Calibrator, choose_thresholds, reliability
from .config import ARTIFACTS, EXPERIMENTS, ML_ROOT, bank_ids, load_config, save_json, seed_everything
from .data.build_dataset import Dataset, build_dataset
from .data.splits import observed_labels, owner_bank
from .eval.metrics import edge_metrics, fpr_report, ring_report, strip_private
from .features.tabular import FEATURES, acct_open_map, compute_bank_features
from .models import risk_scorer as rs


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def phase1_data(cfg) -> Dataset:
    """Phase 1: Build dataset (synthetic or IBM), splits, label delay."""
    log("Phase 1: Building dataset...")
    ds = build_dataset(cfg)
    log(f"  source={ds.source}  rows={len(ds.tx)}  accounts={len(ds.accounts)}  rings={len(ds.rings)}")
    log(f"  splits: {ds.tx.split.value_counts().to_dict()}")
    log(f"  illicit rate: {ds.tx.label.mean():.4f}")
    log(f"  families: {ds.tx[ds.tx.label==1].family.value_counts().to_dict()}")
    return ds


def phase2_risk_scorer(ds: Dataset, cfg) -> dict:
    """Phase 2: LightGBM risk scorer + ONNX export + calibration + latency."""
    log("Phase 2: Tabular features + LightGBM risk scorer...")
    banks = bank_ids(cfg)
    tx = ds.tx
    b = ds.boundaries

    t0 = time.time()
    feats = compute_bank_features(tx, banks, ds.accounts)
    log(f"  features computed in {time.time()-t0:.1f}s")

    X = feats[FEATURES].values.astype(np.float32)
    tr = (tx.split == "train").values
    va = (tx.split == "val").values
    te = (tx.split == "test").values
    ytr = observed_labels(tx[tr], b.train_end)
    yva = observed_labels(tx[va], b.val_end)
    yte = tx[te].label.values

    log(f"  train: {tr.sum()} rows, {ytr.sum()} observed pos (true={tx[tr].label.sum()})")
    model = rs.train_risk_scorer(X[tr], ytr, X[va], yva, cfg)
    log(f"  best iteration: {model.best_iteration}")

    # Scores
    p_va = rs.predict(model, X[va])
    p_te = rs.predict(model, X[te])

    # Calibration
    cal = Calibrator(cfg["calibration"]["method"]).fit(p_va, tx[va].label.values)
    cp_te = cal.transform(p_te)
    rel = reliability(cp_te, yte)
    th = choose_thresholds(cp_te, yte, cfg["calibration"]["target_fpr_high"], cfg["calibration"]["hold_budget_rate"])
    log(f"  calibration ECE={rel['ece']:.4f}  thresholds: {th}")

    flagged = cp_te >= th["t_low"]
    met = edge_metrics(yte, cp_te, flagged)
    fpr = fpr_report(tx[te], flagged)
    log(f"  test edge metrics: PR-AUC={met['pr_auc']:.4f} recall@1%FPR={met['recall@1%fpr']:.4f}")
    log(f"  FPR: {fpr}")

    # Ring-level
    test_rings = {k: v for k, v in ds.rings.items() if v["split"] == "test"}
    rr = ring_report(tx[te].reset_index(drop=True), flagged, test_rings)
    log(f"  ring recall={rr.get('ring_recall', 'N/A')}  by_family={rr.get('by_family', {})}")

    # ONNX export
    onnx_path = ARTIFACTS / "risk_scorer.onnx"
    rs.export_onnx(model, onnx_path)
    sess = rs.onnx_session(onnx_path)
    parity = rs.parity_check(model, sess, X[te][:2000])
    log(f"  ONNX parity: {parity}")
    bench = rs.latency_benchmark(sess, X[te])
    log(f"  latency: p50={bench['single_p50_ms']:.3f}ms p95={bench['single_p95_ms']:.3f}ms "
        f"p99={bench['single_p99_ms']:.3f}ms  throughput={bench['single_throughput_tps']:.0f} tps")

    return {"model": model, "feats": feats, "calibrator": cal, "thresholds": th,
            "metrics": met, "fpr": fpr, "ring_report": strip_private(rr),
            "parity": parity, "latency": bench, "reliability": rel}


def phase3_gnn(ds: Dataset, cfg) -> dict:
    """Phase 3: GraphSAGE local baseline per bank."""
    log("Phase 3: GraphSAGE local baselines...")
    from .features.graph_build import snapshots_for_frame
    from .models.graph_sage import fit, make_model, predict_snapshots

    banks = bank_ids(cfg)
    tx = ds.tx.reset_index(drop=True)
    b = ds.boundaries
    y_obs = observed_labels(tx, b.val_end)
    ts = lambda t: t.value / 1e9

    results = {}
    all_pos, all_prob = [], []
    for bank in banks:
        ao = acct_open_map(ds.accounts, bank)
        tr_snaps = snapshots_for_frame(tx, bank, banks, ao, 6, 7, y_obs,
                                       ts(b.start), ts(b.train_end))
        va_snaps = snapshots_for_frame(tx, bank, banks, ao, 6, 7, tx.label.values,
                                       ts(b.train_end), ts(b.val_end))
        te_snaps = snapshots_for_frame(tx, bank, banks, ao, 6, 7, tx.label.values,
                                       ts(b.val_end), ts(b.end) + 1)
        log(f"  {bank}: train={len(tr_snaps)} val={len(va_snaps)} test={len(te_snaps)} snapshots")
        if not tr_snaps:
            continue
        model = make_model(cfg)
        fit(model, tr_snaps, va_snaps, cfg, log=lambda m: log(f"    {bank} {m}"))
        pos, prob = predict_snapshots(model, te_snaps)
        met = edge_metrics(tx.label.values[pos], prob) if len(pos) else {}
        log(f"  {bank} test: {met}")
        results[bank] = {"model": model, "metrics": met, "test_snaps": te_snaps}
        all_pos.append(pos)
        all_prob.append(prob)

    # combined
    if all_pos:
        apos = np.concatenate(all_pos)
        aprob = np.concatenate(all_prob)
        # dedupe (same edge may be scored by 2 banks if cross-bank)
        uniq, idx = np.unique(apos, return_index=True)
        combined = edge_metrics(tx.label.values[uniq], aprob[idx])
        log(f"  combined GNN test: {combined}")
        results["combined"] = combined
    return results


def phase4_federation(ds: Dataset, cfg, gnn_results: dict) -> dict:
    """Phase 4: Flower-style federated learning (simulation)."""
    log("Phase 4: Federated learning (simulation)...")
    from .features.graph_build import snapshots_for_frame
    from .fed.client import BankClient
    from .fed.dp import privacy_report
    from .fed.strategy import run_federation
    from .models.graph_sage import make_model, set_weights

    banks = bank_ids(cfg)
    tx = ds.tx.reset_index(drop=True)
    b = ds.boundaries
    y_obs = observed_labels(tx, b.val_end)
    ts = lambda t: t.value / 1e9

    clients = []
    for bank in banks:
        ao = acct_open_map(ds.accounts, bank)
        tr = snapshots_for_frame(tx, bank, banks, ao, 6, 7, y_obs, ts(b.start), ts(b.train_end))
        va = snapshots_for_frame(tx, bank, banks, ao, 6, 7, tx.label.values, ts(b.train_end), ts(b.val_end))
        model = make_model(cfg)
        clients.append(BankClient(bank, model, tr, va, cfg))

    global_w, history = run_federation(clients, cfg, log=log)
    fc = cfg["federated"]
    dp_info = privacy_report(fc["dp"]["sigma"], fc["dp"]["clip_c"], len(banks),
                             fc["num_rounds"]) if fc["dp"]["enabled"] else {"dp": "disabled"}
    log(f"  DP report: {dp_info}")
    return {"history": history, "dp": dp_info, "final_weights": global_w}


def phase5_explainer(ds, cfg, lgb_model, feats) -> dict:
    """Phase 5: SHAP + template reason codes + fidelity test."""
    log("Phase 5: Explainer...")
    from .explain.explainer import fidelity_test, reason_codes, shap_explain

    tx = ds.tx
    te = tx.split == "test"
    pos_idx = np.where(te.values & (tx.label.values == 1))[0]
    if len(pos_idx) == 0:
        log("  no positive test samples")
        return {}
    sample = pos_idx[:5]
    X = feats[FEATURES].values.astype(np.float32)
    explanations = []
    for i in sample:
        top = shap_explain(lgb_model, X[i])
        codes = reason_codes(top, rs.predict(lgb_model, X[i:i+1])[0])
        fid = fidelity_test(lgb_model, X[i])
        explanations.append({"tx_id": tx.iloc[i].tx_id, "shap": top, "reasons": codes, "fidelity": fid})
        log(f"  {tx.iloc[i].tx_id}: {codes[0][:60]}... faithful={fid['faithful']}")
    return {"explanations": explanations}


def phase6_chain_scorer(ds, cfg, lgb_model, feats) -> dict:
    """Phase 6: Alert linking + chain scoring at the coordinator."""
    log("Phase 6: Chain scorer...")
    from .models.chain_scorer import alerts_from_scores, chain_report, link_alerts

    banks = bank_ids(cfg)
    tx = ds.tx
    te = tx.split == "test"
    X = feats[FEATURES].values.astype(np.float32)
    scores = rs.predict(lgb_model, X[te])
    threshold = cfg["models"]["chain_scorer"]["high_risk_edge_threshold"]
    alerts = alerts_from_scores(tx[te].reset_index(drop=True), scores, threshold, banks)
    log(f"  alerts generated: {len(alerts)}")
    if alerts.empty:
        return {"n_chains": 0}
    chains = link_alerts(alerts, cfg)
    report = chain_report(chains)
    log(f"  chains: {report}")

    # Ring-level with chains
    test_rings = {k: v for k, v in ds.rings.items() if v["split"] == "test"}
    flagged = scores >= threshold
    rr = ring_report(tx[te].reset_index(drop=True), flagged, test_rings, chains)
    log(f"  ring recall (edge+chain): {rr.get('ring_recall', 'N/A')}")
    return {"chain_report": report, "ring_report": strip_private(rr), "n_chains": len(chains)}


def phase7_network_effect(ds, cfg, feats=None) -> dict:
    """Phase 7: Network-effect study."""
    log("Phase 7: Network-effect study...")
    from .eval.network_effect import network_effect_study
    return network_effect_study(ds, cfg, n_seeds=1, feats=feats, log=log)


def phase8_mule(ds, cfg) -> dict:
    """Phase 9: Mule early-warning."""
    log("Phase 8: Mule early-warning...")
    from .models.mule import build_mule_dataset, predict_mule, train_mule_scorer

    X, y, ids = build_mule_dataset(ds.tx, ds.accounts, ds.rings)
    if len(X) == 0 or y.sum() == 0:
        log("  no mule data")
        return {}
    log(f"  mule dataset: {len(X)} accounts, {y.sum()} positives")
    model = train_mule_scorer(X, y)
    p = predict_mule(model, X)
    from .eval.metrics import pr_auc
    pa = pr_auc(y, p)
    log(f"  mule PR-AUC (in-sample): {pa:.4f}")
    return {"n_accounts": len(X), "n_mules": int(y.sum()), "pr_auc": pa}


def run_pipeline(config_path=None, phases=None):
    cfg = load_config(config_path)
    seed_everything(cfg["seed"])
    run_id = f"run_{int(time.time())}"
    run_dir = EXPERIMENTS / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    log(f"Run: {run_id}")

    all_phases = [1, 2, 3, 4, 5, 6, 7, 8]
    phases = phases or all_phases
    results = {}

    # Phase 1
    ds = phase1_data(cfg)
    ds.save(run_dir / "dataset.pkl")

    if 2 in phases:
        r2 = phase2_risk_scorer(ds, cfg)
        results["risk_scorer"] = {k: v for k, v in r2.items() if k not in ("model", "feats", "calibrator")}
        save_json(r2["calibrator"].to_dict(), run_dir / "calibrator.json")
        save_json(r2["thresholds"], run_dir / "thresholds.json")
    else:
        r2 = None

    if 3 in phases:
        r3 = phase3_gnn(ds, cfg)
        results["gnn"] = {k: v for k, v in r3.items() if k != "model" and not isinstance(v, dict) or
                          (isinstance(v, dict) and "model" not in v)}
    else:
        r3 = None

    if 4 in phases:
        r4 = phase4_federation(ds, cfg, r3 or {})
        results["federation"] = {k: v for k, v in r4.items() if k != "final_weights"}

    if r2 and 5 in phases:
        r5 = phase5_explainer(ds, cfg, r2["model"], r2["feats"])
        results["explainer"] = r5

    if r2 and 6 in phases:
        r6 = phase6_chain_scorer(ds, cfg, r2["model"], r2["feats"])
        results["chain_scorer"] = r6

    if 7 in phases:
        r7 = phase7_network_effect(ds, cfg, r2["feats"] if r2 else None)
        results["network_effect"] = r7

    if 8 in phases:
        r8 = phase8_mule(ds, cfg)
        results["mule"] = r8

    save_json(results, run_dir / "results.json")
    log(f"Results saved to {run_dir / 'results.json'}")
    return results


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else None
    phases = None
    if "--phase" in sys.argv:
        idx = sys.argv.index("--phase")
        phases = [int(sys.argv[idx + 1])]
    run_pipeline(path, phases)
