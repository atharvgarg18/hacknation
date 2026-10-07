"""Federated learning client — wraps the GNN for Flower FL rounds.

Also usable standalone (without Flower) via `simulate_round()`.
"""
from __future__ import annotations

import numpy as np

from ..models.graph_sage import (EdgeGNN, eval_loss, get_weights, make_model,
                                 predict_snapshots, set_weights, train_local)


class BankClient:
    """NumPy-weight FL client for one bank's GNN."""

    def __init__(self, bank_id: str, model: EdgeGNN, train_snaps: list, val_snaps: list, cfg):
        self.bank_id = bank_id
        self.model = model
        self.train_snaps = train_snaps
        self.val_snaps = val_snaps
        self.cfg = cfg

    def get_parameters(self) -> list[np.ndarray]:
        return get_weights(self.model)

    def set_parameters(self, params: list[np.ndarray]):
        set_weights(self.model, params)

    def fit(self, params: list[np.ndarray], config: dict | None = None) -> tuple[list[np.ndarray], int, dict]:
        config = config or {}
        self.set_parameters(params)
        c = self.cfg["federated"]
        gc = self.cfg["models"]["graph_sage"]
        mu = config.get("proximal_mu", c.get("proximal_mu", 0.0))
        global_params = [p.copy() for p in params] if mu > 0 else None
        loss = train_local(self.model, self.train_snaps, epochs=c["local_epochs"],
                           lr=gc["lr"], pos_weight=gc["pos_weight"], mu=mu, global_params=global_params)
        n = sum(len(d.y) for d in self.train_snaps)
        return self.get_parameters(), n, {"bank": self.bank_id, "loss": float(loss)}

    def evaluate(self, params: list[np.ndarray]) -> tuple[float, int, dict]:
        self.set_parameters(params)
        from ..eval.metrics import pr_auc
        loss = eval_loss(self.model, self.val_snaps, self.cfg["models"]["graph_sage"]["pos_weight"])
        pos, prob = predict_snapshots(self.model, self.val_snaps)
        y = np.concatenate([d.y.numpy() for d in self.val_snaps]) if self.val_snaps else np.array([])
        pa = pr_auc(y, prob) if len(y) and y.sum() > 0 else float("nan")
        n = sum(len(d.y) for d in self.val_snaps)
        return float(loss), n, {"pr_auc": pa, "bank": self.bank_id}
