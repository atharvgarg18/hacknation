"""Frozen evaluation metrics used everywhere.

Definitions (FROZEN):
- edge "flagged"   : calibrated score >= t_low  (hold or block)
- ring detected    : >= RING_EDGE_FRAC of the ring's edges flagged OR >= RING_MIN_EDGES flagged
                     OR covered (>= CHAIN_COVER_FRAC) by a coordinator chain whose score >= chain threshold
- chain completeness: |ring edges in best chain| / |ring edges|
- funds intercepted : amount on the ring's last-hop edges at/after the first flag / total last-hop amount
- time to detect    : first flag ts - first ring tx ts
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_fscore_support, roc_auc_score

RING_EDGE_FRAC = 0.5
RING_MIN_EDGES = 3
CHAIN_COVER_FRAC = 0.3


def pr_auc(y, s):
    y = np.asarray(y)
    return float(average_precision_score(y, s)) if y.sum() > 0 and y.sum() < len(y) else float("nan")


def roc_auc(y, s):
    y = np.asarray(y)
    return float(roc_auc_score(y, s)) if 0 < y.sum() < len(y) else float("nan")


def recall_at_fpr(y, s, fpr=0.01):
    y, s = np.asarray(y), np.asarray(s)
    neg = s[y == 0]
    if len(neg) == 0 or y.sum() == 0:
        return float("nan")
    th = np.quantile(neg, 1 - fpr)
    return float((s[y == 1] > th).mean())


def edge_metrics(y, s, flagged=None):
    out = {"pr_auc": pr_auc(y, s), "roc_auc": roc_auc(y, s), "recall@1%fpr": recall_at_fpr(y, s, 0.01),
           "recall@0.1%fpr": recall_at_fpr(y, s, 0.001), "n": int(len(y)), "n_pos": int(np.sum(y))}
    if flagged is not None:
        p, r, f, _ = precision_recall_fscore_support(y, flagged, average="binary", zero_division=0)
        out.update({"precision": float(p), "recall": float(r), "f1": float(f)})
    return out


def fpr_report(tx: pd.DataFrame, flagged: np.ndarray, holds=None) -> dict:
    ben = tx.label.values == 0
    flagged = np.asarray(flagged).astype(bool)
    out = {"fpr_overall": float(flagged[ben].mean()) if ben.any() else float("nan")}
    st_arr = tx.stress_type.values
    for st in np.unique(st_arr[ben]):
        m = ben & (st_arr == st)
        out[f"fpr_{st or 'normal'}"] = float(flagged[m].mean())
    if holds is not None:
        out["holds_per_10k"] = float(10_000 * np.mean(holds))
    return out


def ring_report(tx: pd.DataFrame, flagged: np.ndarray, rings: dict, chains: list | None = None,
                ring_ids=None) -> dict:
    """Ring-level metrics. `chains` = list of dicts with 'edge_ids' and 'detected' (bool)."""
    tx = tx.reset_index(drop=True)
    flag_by_id = dict(zip(tx.tx_id.values, flagged.astype(bool)))
    ts_by_id = dict(zip(tx.tx_id.values, tx.ts.values))
    amt_by_id = dict(zip(tx.tx_id.values, tx.amount.values))
    hop_by_id = dict(zip(tx.tx_id.values, tx.hop.values))
    chain_sets = [(set(c["edge_ids"]), bool(c.get("detected", True))) for c in (chains or [])]
    rows = []
    for rid, meta in rings.items():
        if ring_ids is not None and rid not in ring_ids:
            continue
        edges = [e for e in meta["edges"] if e in flag_by_id]
        if not edges:
            continue
        f = np.array([flag_by_id[e] for e in edges])
        es = set(edges)
        best_cov, chain_hit = 0.0, False
        for cs, det in chain_sets:
            inter = len(es & cs)
            if inter:
                cov = inter / len(es)
                best_cov = max(best_cov, cov)
                if det and cov >= CHAIN_COVER_FRAC:
                    chain_hit = True
        edge_hit = f.mean() >= RING_EDGE_FRAC or f.sum() >= min(RING_MIN_EDGES, len(edges))
        detected = bool(edge_hit or chain_hit)
        ets = np.array([ts_by_id[e] for e in edges])
        first_ts = ets.min()
        ttd = intercepted = np.nan
        if f.any():
            first_flag = ets[f].min()
            ttd = (first_flag - first_ts) / np.timedelta64(1, "s")
            hops = np.array([hop_by_id[e] for e in edges])
            last = hops == hops.max()
            amts = np.array([amt_by_id[e] for e in edges])
            tot = amts[last].sum()
            intercepted = float(amts[last & (ets >= first_flag)].sum() / tot) if tot > 0 else 0.0
        elif not detected:
            intercepted = 0.0
        rows.append({"ring_id": rid, "family": meta["family"], "heldout": meta.get("heldout", False),
                     "cross_bank": meta.get("cross_bank", False), "n_edges": len(edges),
                     "flag_frac": float(f.mean()), "detected": detected, "edge_hit": bool(edge_hit),
                     "chain_hit": chain_hit, "completeness": best_cov, "ttd_s": ttd,
                     "intercepted": intercepted if detected else 0.0})
    df = pd.DataFrame(rows)
    if df.empty:
        return {"n_rings": 0}
    out = {
        "n_rings": int(len(df)), "ring_recall": float(df.detected.mean()),
        "ring_recall_edge_only": float(df.edge_hit.mean()),
        "chain_completeness_mean": float(df.completeness.mean()),
        "funds_intercepted_frac": float(df.intercepted.mean()),
        "median_ttd_s": float(np.nanmedian(df.ttd_s)) if df.ttd_s.notna().any() else float("nan"),
        "cross_bank_share": float(df.cross_bank.mean()),
        "by_family": df.groupby("family").detected.mean().round(4).to_dict(),
    }
    if df.heldout.any():
        out["heldout_recall"] = float(df[df.heldout].detected.mean())
    out["_rows"] = df
    return out


def strip_private(d: dict) -> dict:
    return {k: v for k, v in d.items() if not k.startswith("_")}


def bootstrap_ci(values, n=1000, q=(5, 95), seed=0):
    v = np.asarray(values, float)
    v = v[~np.isnan(v)]
    if len(v) == 0:
        return (float("nan"),) * 3
    rng = np.random.default_rng(seed)
    bs = rng.choice(v, (n, len(v))).mean(1)
    return float(v.mean()), float(np.percentile(bs, q[0])), float(np.percentile(bs, q[1]))
