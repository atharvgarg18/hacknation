"""Model 7: Mule early-warning scorer.

Flags accounts before their first laundering transaction. The model outputs a *risk
modifier* that lowers thresholds on that account's future transactions, NOT a standalone
block (too many FPs on legitimately new accounts).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MULE_FEATURES = [
    "acct_age_days", "first_tx_delay_days", "n_distinct_cpty_7d", "cpty_novelty_share",
    "in_out_ratio_7d", "dormant_then_burst", "round_amount_share", "xbank_cpty_share",
    "n_tx_first_7d", "mean_amt_first_7d_log", "max_amt_first_7d_log",
    "in_cnt_7d", "out_cnt_7d",
]


def mule_features(acct_row, tx_acct: pd.DataFrame) -> dict | None:
    """Features from the first 7 days of an account's transactional life."""
    if tx_acct.empty:
        return None
    first_ts = tx_acct.ts.min()
    acct_open = acct_row.open_ts if hasattr(acct_row, "open_ts") else first_ts
    window = tx_acct[tx_acct.ts <= first_ts + pd.Timedelta(days=7)]
    if window.empty:
        return None
    out = window[window.src_acct == acct_row.acct_id]
    inn = window[window.dst_acct == acct_row.acct_id]
    cpty = set(out.dst_acct) | set(inn.src_acct)
    amts = window.amount.values
    return {
        "acct_age_days": max(0, (first_ts - acct_open).total_seconds() / 86400) if pd.notna(acct_open) else 0,
        "first_tx_delay_days": max(0, (first_ts - acct_open).total_seconds() / 86400) if pd.notna(acct_open) else 0,
        "n_distinct_cpty_7d": len(cpty),
        "cpty_novelty_share": 1.0,  # all counterparties are new in first 7d
        "in_out_ratio_7d": float(len(inn) / max(len(out), 1)),
        "dormant_then_burst": 0.0,
        "round_amount_share": float(np.mean(amts % 100 == 0)) if len(amts) else 0,
        "xbank_cpty_share": float(((window.src_bank != window.dst_bank).sum()) / max(len(window), 1)),
        "n_tx_first_7d": len(window),
        "mean_amt_first_7d_log": float(np.log1p(amts.mean())) if len(amts) else 0,
        "max_amt_first_7d_log": float(np.log1p(amts.max())) if len(amts) else 0,
        "in_cnt_7d": len(inn),
        "out_cnt_7d": len(out),
    }


def build_mule_dataset(tx: pd.DataFrame, accounts: pd.DataFrame, rings: dict,
                       max_age_days: int = 30) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Build mule feature matrix from confirmed ring mule accounts and young benign accounts."""
    mule_accts = set()
    for r in rings.values():
        mule_accts.update(r.get("mules", []))

    young = accounts[accounts.open_ts >= tx.ts.min() - pd.Timedelta(days=max_age_days)]
    mule_young = young[young.acct_id.isin(mule_accts)]
    benign_young = young[~young.acct_id.isin(mule_accts)]
    if len(benign_young) > 2000:
        benign_young = benign_young.sample(2000, random_state=42)
    selected_accounts = pd.concat([mule_young, benign_young], ignore_index=True)

    # Pre-index transactions by source and destination for O(1) retrieval
    tx_src = dict(tuple(tx.groupby("src_acct")))
    tx_dst = dict(tuple(tx.groupby("dst_acct")))

    rows, labels, acct_ids = [], [], []
    for _, acc in selected_accounts.iterrows():
        aid = acc.acct_id
        parts = []
        if aid in tx_src:
            parts.append(tx_src[aid])
        if aid in tx_dst:
            parts.append(tx_dst[aid])
        if not parts:
            continue
        tx_a = pd.concat(parts).drop_duplicates(subset=["tx_id"]) if len(parts) > 1 else parts[0]
        f = mule_features(acc, tx_a)
        if f is None:
            continue
        rows.append([f[k] for k in MULE_FEATURES])
        labels.append(1 if aid in mule_accts else 0)
        acct_ids.append(aid)
    return np.array(rows, dtype=np.float32), np.array(labels), acct_ids


def train_mule_scorer(X, y, cfg=None):
    """Simple LightGBM scorer. Returns the model."""
    import lightgbm as lgb

    pos = max(1, int(y.sum()))
    params = dict(objective="binary", learning_rate=0.05, num_leaves=31,
                  min_data_in_leaf=5, scale_pos_weight=float(np.sqrt((len(y) - pos) / pos)),
                  verbose=-1, n_estimators=200, seed=42)
    model = lgb.LGBMClassifier(**params)
    model.fit(X, y)
    return model


def predict_mule(model, X) -> np.ndarray:
    return model.predict_proba(X)[:, 1]
