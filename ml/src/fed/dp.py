"""Differential privacy: per-client clip + server-side Gaussian noise.

With only 3 clients, formal ε guarantees are weak. This is presented as
"mechanism implemented and measured," not "privacy solved."

Privacy accounting uses the simple Gaussian mechanism bound.
"""
from __future__ import annotations

import math

import numpy as np


def clip_update(update: list[np.ndarray], clip_c: float) -> list[np.ndarray]:
    flat = np.concatenate([u.ravel() for u in update])
    norm = float(np.linalg.norm(flat))
    scale = min(1.0, clip_c / (norm + 1e-12))
    return [u * scale for u in update]


def add_noise(aggregated: list[np.ndarray], sigma: float, clip_c: float, n_clients: int,
              rng: np.random.Generator | None = None) -> list[np.ndarray]:
    """Server-side Gaussian noise on the aggregate. std = sigma * C / n_clients."""
    rng = rng or np.random.default_rng()
    std = sigma * clip_c / n_clients
    return [a + rng.normal(0, std, a.shape).astype(a.dtype) for a in aggregated]


def sanitize_updates(updates: list[list[np.ndarray]], clip_c: float) -> list[list[np.ndarray]]:
    return [clip_update(u, clip_c) for u in updates]


def dp_aggregate(updates: list[list[np.ndarray]], agg_fn, clip_c: float, sigma: float,
                 rng=None, **agg_kw) -> list[np.ndarray]:
    """Clip all updates, aggregate, then add noise."""
    clipped = sanitize_updates(updates, clip_c)
    agg = agg_fn(clipped, **agg_kw)
    if sigma > 0:
        agg = add_noise(agg, sigma, clip_c, len(updates), rng)
    return agg


# ── Privacy accounting (Gaussian mechanism) ──

def gaussian_epsilon(sigma: float, delta: float = 1e-5, sensitivity: float = 1.0) -> float:
    """Single-round ε for (ε,δ)-DP via the analytic Gaussian mechanism."""
    if sigma <= 0:
        return float("inf")
    return sensitivity / sigma * math.sqrt(2 * math.log(1.25 / delta))


def compose_epsilon(single_eps: float, n_rounds: int, delta: float = 1e-5) -> float:
    """Advanced composition theorem: total ε over `n_rounds` rounds."""
    if math.isinf(single_eps):
        return float("inf")
    return single_eps * math.sqrt(2 * n_rounds * math.log(1 / delta)) + n_rounds * single_eps * (math.exp(single_eps) - 1)


def privacy_report(sigma: float, clip_c: float, n_clients: int, n_rounds: int, delta: float = 1e-5) -> dict:
    sens = clip_c / n_clients
    eps1 = gaussian_epsilon(sigma, delta, sens)
    eps_total = compose_epsilon(eps1, n_rounds, delta)
    return {
        "sigma": sigma, "clip_c": clip_c, "n_clients": n_clients, "n_rounds": n_rounds,
        "delta": delta, "epsilon_per_round": round(eps1, 4), "epsilon_total": round(eps_total, 4),
        "caveat": "With only 3 clients, formal guarantees are weak. Presented as mechanism + measurement."
    }
