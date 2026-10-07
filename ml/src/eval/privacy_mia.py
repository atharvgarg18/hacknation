"""Privacy evaluation: membership inference attack (MIA) on model updates.

Train a simple loss-threshold attack to distinguish training members from non-members.
Report attack AUC with and without DP/SecAgg. Expect AUC ≈ 0.5 only with meaningful noise.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import roc_auc_score


def loss_threshold_mia(model_predict_fn, X_members: np.ndarray, y_members: np.ndarray,
                       X_non: np.ndarray, y_non: np.ndarray) -> dict:
    """Simple loss-based MIA: members tend to have lower loss than non-members."""
    def bce(p, y):
        p = np.clip(p, 1e-7, 1 - 1e-7)
        return -(y * np.log(p) + (1 - y) * np.log(1 - p))

    pm = model_predict_fn(X_members)
    pn = model_predict_fn(X_non)
    loss_m = bce(pm, y_members)
    loss_n = bce(pn, y_non)
    # lower loss → more likely member → label=1
    scores = np.concatenate([-loss_m, -loss_n])
    labels = np.concatenate([np.ones(len(loss_m)), np.zeros(len(loss_n))])
    auc = float(roc_auc_score(labels, scores)) if len(np.unique(labels)) > 1 else 0.5
    return {
        "mia_auc": auc,
        "n_members": len(X_members),
        "n_non_members": len(X_non),
        "mean_loss_members": float(loss_m.mean()),
        "mean_loss_non_members": float(loss_n.mean()),
        "interpretation": "AUC close to 0.5 means good privacy; AUC >> 0.5 means leakage.",
    }


def run_mia(model_predict_fn, X_train, y_train, X_heldout, y_heldout, n_sample=2000,
            seed=0) -> dict:
    """Sample from train (members) and held-out (non-members) and run MIA."""
    rng = np.random.default_rng(seed)
    n_m = min(n_sample, len(X_train))
    n_n = min(n_sample, len(X_heldout))
    idx_m = rng.choice(len(X_train), n_m, replace=False)
    idx_n = rng.choice(len(X_heldout), n_n, replace=False)
    return loss_threshold_mia(model_predict_fn, X_train[idx_m], y_train[idx_m],
                              X_heldout[idx_n], y_heldout[idx_n])
