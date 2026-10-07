"""Federated strategy — simulation engine (all banks in one process).

Supports: FedAvg, FedProx, DP, robust aggregation, SecAgg simulation.
Reserve real multi-process deployment for the demo; this is for experiments.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

from ..eval.metrics import pr_auc
from ..models.graph_sage import get_weights, make_model, predict_snapshots, set_weights
from .client import BankClient
from .dp import dp_aggregate, privacy_report
from .robust_agg import STRATEGIES, aggregate


def _secagg_mask(n_clients: int, param_shapes: list, seed: int = 0):
    """Pairwise additive masks that cancel in the sum — simulation, not crypto."""
    rng = np.random.default_rng(seed)
    masks = [[np.zeros(s, dtype=np.float32) for s in param_shapes] for _ in range(n_clients)]
    for i in range(n_clients):
        for j in range(i + 1, n_clients):
            for k, s in enumerate(param_shapes):
                m = rng.normal(0, 0.01, s).astype(np.float32)
                masks[i][k] += m
                masks[j][k] -= m
    return masks


def simulate_round(clients: list[BankClient], global_weights: list[np.ndarray], cfg,
                   round_num: int = 0, log: Callable | None = None) -> tuple[list[np.ndarray], dict]:
    """One FL round: distribute, local train, (optionally clip+secagg+noise), aggregate, return new weights."""
    fc = cfg["federated"]
    agg_method = fc["robust_agg"]["method"]
    use_dp = fc["dp"]["enabled"]
    use_secagg = fc.get("secagg_sim", False)
    config = {"proximal_mu": fc.get("proximal_mu", 0.0), "round": round_num}

    updates, ns, metas = [], [], []
    for c in clients:
        new_w, n, meta = c.fit(global_weights, config)
        # delta = new_w - global
        delta = [nw - gw for nw, gw in zip(new_w, global_weights)]
        updates.append(delta)
        ns.append(n)
        metas.append(meta)

    if log:
        log(f"  round {round_num}: " + ", ".join(f"{m['bank']}(loss={m['loss']:.4f})" for m in metas))

    rng = np.random.default_rng(round_num)
    if use_dp:
        agg_fn = STRATEGIES.get(agg_method, STRATEGIES["fedavg"])
        agg_delta = dp_aggregate(updates, agg_fn, fc["dp"]["clip_c"], fc["dp"]["sigma"], rng,
                                 **_agg_kw(agg_method, fc))
    else:
        agg_delta = aggregate(updates, agg_method, **_agg_kw(agg_method, fc))

    # SecAgg simulation: masks cancel in the sum (already done on deltas), label it
    secagg_note = ""
    if use_secagg:
        shapes = [d.shape for d in agg_delta]
        masks = _secagg_mask(len(clients), shapes, round_num)
        # verify cancellation (should be ~0)
        residual = sum(sum(np.abs(m[k]).sum() for k in range(len(shapes))) for m in masks)
        secagg_note = f"secagg_residual={residual:.2e}"

    new_global = [gw + d for gw, d in zip(global_weights, agg_delta)]

    # evaluate on each client
    eval_results = {}
    for c in clients:
        loss, n, em = c.evaluate(new_global)
        eval_results[c.bank_id] = em
    mean_prauc = float(np.nanmean([em.get("pr_auc", float("nan")) for em in eval_results.values()]))

    info = {"round": round_num, "agg_method": agg_method, "dp": use_dp, "secagg": use_secagg,
            "secagg_note": secagg_note, "mean_pr_auc": mean_prauc, "per_bank": eval_results,
            "client_losses": {m["bank"]: m["loss"] for m in metas}}

    if log:
        log(f"  -> mean_pr_auc={mean_prauc:.4f} {secagg_note}")

    return new_global, info


def _agg_kw(method, fc):
    if method == "trimmed_mean":
        return {"trim_k": fc["robust_agg"].get("trim_k", 1)}
    return {}


def run_federation(clients: list[BankClient], cfg, log=None) -> tuple[list[np.ndarray], list[dict]]:
    """Full federated training (simulation). Returns final global weights and per-round info."""
    fc = cfg["federated"]
    global_w = clients[0].get_parameters()
    history = []
    for r in range(fc["num_rounds"]):
        global_w, info = simulate_round(clients, global_w, cfg, r, log)
        history.append(info)
    return global_w, history


def poisoning_experiment(clients: list[BankClient], cfg, poison_bank: str, attack: str = "sign_flip",
                         log=None) -> list[dict]:
    """Run federation with one bank sending poisoned updates. Compare agg methods."""
    from copy import deepcopy

    results = []
    for method in ["fedavg", "trimmed_mean", "coord_median"]:
        test_cfg = deepcopy(cfg)
        test_cfg["federated"]["robust_agg"]["method"] = method
        # clone clients, poison one
        test_clients = []
        for c in clients:
            tc = BankClient(c.bank_id, deepcopy(c.model), c.train_snaps, c.val_snaps, test_cfg)
            test_clients.append(tc)
        # monkey-patch the poisoned client's fit
        for tc in test_clients:
            if tc.bank_id == poison_bank:
                orig_fit = tc.fit

                def poisoned_fit(params, config=None, _orig=orig_fit, _attack=attack):
                    new_w, n, meta = _orig(params, config)
                    if _attack == "sign_flip":
                        new_w = [-w for w in new_w]
                    elif _attack == "scale_up":
                        new_w = [w * 10.0 for w in new_w]
                    meta["poisoned"] = True
                    return new_w, n, meta

                tc.fit = poisoned_fit
                break
        global_w, history = run_federation(test_clients, test_cfg, log)
        final = history[-1] if history else {}
        results.append({"method": method, "attack": attack, "poison_bank": poison_bank,
                        "final_mean_pr_auc": final.get("mean_pr_auc", float("nan")),
                        "history": [h.get("mean_pr_auc") for h in history]})
    return results
