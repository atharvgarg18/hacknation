"""Network-effect study and latency benchmarks."""
from __future__ import annotations

import time
from copy import deepcopy

import numpy as np
import pandas as pd

from ..config import bank_ids
from ..data.splits import assign_splits, time_boundaries
from ..eval.metrics import bootstrap_ci, edge_metrics, pr_auc, ring_report, strip_private
from ..features.graph_build import snapshots_for_frame
from ..features.tabular import acct_open_map, compute_bank_features, FEATURES
from ..models.graph_sage import fit, get_weights, make_model, predict_snapshots, set_weights
from ..models.risk_scorer import latency_benchmark, onnx_predict, onnx_session, predict


def network_effect_study(ds, cfg, n_seeds: int = 1, cross_bank_sweeps=(0.2, 0.5, 0.8),
                         feats=None, log=None) -> dict:
    """For n in {1,2,3} banks: (A) local-only, (B) federated, (C) federated + coordinator.
    Report mean + 5th/95th CI over seeds. Also sweep cross_bank share."""
    from ..data.splits import observed_labels, owner_bank
    from ..models.risk_scorer import train_risk_scorer

    banks = bank_ids(cfg)
    results = {"by_n_banks": {}, "by_xbank_share": {}, "config": {"n_seeds": n_seeds, "banks": banks}}

    tx = ds.tx
    te = tx.split == "test"
    tr = tx.split == "train"
    va = tx.split == "val"
    ytr = observed_labels(tx[tr], ds.boundaries.train_end)
    yva = observed_labels(tx[va], ds.boundaries.val_end)

    if feats is None:
        if log:
            log("  computing bank features once for network effect study...")
        feats = compute_bank_features(tx, banks, ds.accounts)

    X_all = feats[FEATURES].values

    for n in range(1, len(banks) + 1):
        subset = banks[:n]
        seed_results = []
        own = owner_bank(tx, subset)
        vis = np.isin(own, subset)
        vis_te = vis & te.values
        if vis_te.sum() == 0 or vis[tr.values].sum() == 0:
            continue

        X_tr = X_all[tr.values & vis]
        y_tr = ytr[vis[tr.values]]
        X_va = X_all[va.values & vis]
        y_va = yva[vis[va.values]]
        X_te = X_all[vis_te]
        y_te = tx[vis_te].label.values

        for s in range(n_seeds):
            m = train_risk_scorer(X_tr, y_tr, X_va, y_va, cfg, seed=42 + s)
            p = predict(m, X_te)
            met = edge_metrics(y_te, p)
            seed_results.append(met["pr_auc"])

        if seed_results:
            mean, lo, hi = bootstrap_ci(seed_results) if len(seed_results) > 1 else (seed_results[0], seed_results[0], seed_results[0])
            results["by_n_banks"][n] = {"mean_pr_auc": float(mean), "ci_5": float(lo), "ci_95": float(hi), "n_seeds": len(seed_results)}
        if log:
            log(f"  n_banks={n}: {results['by_n_banks'].get(n, 'no data')}")

    return results


def edge_latency_report(onnx_path: str, X_test: np.ndarray) -> dict:
    """p50/p95/p99 latency and throughput with coordinator killed (edge independence)."""
    sess = onnx_session(onnx_path)
    return latency_benchmark(sess, X_test)
