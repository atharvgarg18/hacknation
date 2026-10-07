"""Robust aggregation strategies: FedAvg, trimmed mean, coordinate median, Krum.

With only N=3 banks, Krum needs n >= 2f+3, so f=0 — trimmed mean (trim_k=1) and
median are the practical choices. This is stated explicitly in evaluation output.
"""
from __future__ import annotations

import numpy as np


def fedavg(updates: list[list[np.ndarray]], weights: list[int] | None = None) -> list[np.ndarray]:
    if weights is None:
        weights = [1] * len(updates)
    total = sum(weights)
    return [sum(w * u[i] for w, u in zip(weights, updates)) / total for i in range(len(updates[0]))]


def trimmed_mean(updates: list[list[np.ndarray]], trim_k: int = 1) -> list[np.ndarray]:
    n = len(updates)
    if n <= 2 * trim_k:
        return fedavg(updates)
    result = []
    for i in range(len(updates[0])):
        A = np.stack([u[i] for u in updates])
        A.sort(axis=0)
        result.append(A[trim_k: n - trim_k].mean(axis=0))
    return result


def coord_median(updates: list[list[np.ndarray]]) -> list[np.ndarray]:
    return [np.median(np.stack([u[i] for u in updates]), axis=0) for i in range(len(updates[0]))]


def krum(updates: list[list[np.ndarray]], f: int = 0) -> list[np.ndarray]:
    """Multi-Krum. With n=3 banks and f=0, this just picks the update closest to the others."""
    n = len(updates)
    flat = [np.concatenate([u.ravel() for u in upd]) for upd in updates]
    A = np.stack(flat)
    d = ((A[:, None] - A[None]) ** 2).sum(-1)
    k = max(1, n - f - 2)
    scores = [np.sort(d[i])[1: 1 + k].sum() for i in range(n)]
    best = int(np.argmin(scores))
    return updates[best]


STRATEGIES = {"fedavg": fedavg, "trimmed_mean": trimmed_mean, "coord_median": coord_median, "krum": krum}


def aggregate(updates, method="trimmed_mean", **kw):
    fn = STRATEGIES[method]
    return fn(updates, **kw)
