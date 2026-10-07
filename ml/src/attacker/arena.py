"""Model 6: Adaptive attacker (simulation only).

Treats the full defense as a black box returning blocked/passed.
Uses Optuna TPE to search RingParams space. The attacker sees ONLY
blocked/passed per ring — nothing else.
"""
from __future__ import annotations

import math
from typing import Callable

import numpy as np

from ..data.ring_generator import RingParams, generate_ring, random_params

ATTACKER_TOPOLOGIES = ["fanout_chain", "cycle", "scatter_gather", "layered"]


def attacker_cost(p: RingParams, weights: dict | None = None) -> float:
    """More hops, delay, mules, aging → higher cost for the attacker."""
    w = weights or {"hop_cost": 0.05, "delay_cost": 0.02, "mule_cost": 0.03}
    c = 0.0
    c += w["hop_cost"] * p.n_hops
    c += w["delay_cost"] * math.log1p(p.time_gap_s[0]) / 10
    c += w["mule_cost"] * p.n_mules
    return c


def run_optuna_attack(defense_fn: Callable, cfg, banks, n_trials: int = 30,
                      eval_seeds: int = 5, lam: float = 0.1, start_ts=None,
                      warmup_pool=None, log=None) -> dict:
    """Optuna loop: maximize evasion - λ·cost. defense_fn(rings) -> detection_rate."""
    import optuna
    import pandas as pd

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    cost_w = cfg.get("attacker", {}).get("cost_weights",
                                        {"hop_cost": 0.05, "delay_cost": 0.02, "mule_cost": 0.03})
    start = start_ts or pd.Timestamp("2024-03-01")

    def objective(trial):
        p = RingParams(
            topology=trial.suggest_categorical("topology", ATTACKER_TOPOLOGIES),
            n_hops=trial.suggest_int("n_hops", 2, 8),
            n_mules=trial.suggest_int("n_mules", 3, 25),
            total_amount=trial.suggest_float("amt", 5e4, 5e6, log=True),
            time_gap_s=(trial.suggest_int("gap_min", 30, 3600),
                        trial.suggest_int("gap_max", 3600, 86400)),
            cross_bank_prob=trial.suggest_float("xbank", 0.0, 1.0),
            mule_age_days=(trial.suggest_int("age_min", 0, 30), 90),
            pass_through_frac=trial.suggest_float("pt", 0.5, 0.99),
            seed=trial.number * 1000,
            banks=tuple(banks),
        )
        rings = []
        for s in range(eval_seeds):
            p2 = RingParams(**{**p.to_dict(), "seed": trial.number * 1000 + s})
            rings.append(generate_ring(p2, start + pd.Timedelta(hours=int(s * 6)),
                                       warmup_pool=warmup_pool))
        evade_rate = 1 - defense_fn(rings)
        cost = attacker_cost(p, cost_w)
        return evade_rate - lam * cost

    study = optuna.create_study(direction="maximize",
                                sampler=optuna.samplers.TPESampler(seed=0))
    study.optimize(objective, n_trials=n_trials)

    best = study.best_trial
    if log:
        log(f"  best trial: evasion-cost={best.value:.3f}, params={best.params}")

    return {
        "best_value": float(best.value),
        "best_params": best.params,
        "n_trials": n_trials,
        "all_values": [t.value for t in study.trials],
    }


def arena_loop(defense_update_fn, defense_eval_fn, cfg, banks, n_rounds: int = 5,
               trials_per_round: int = 30, log=None) -> list[dict]:
    """§8 continual defense updates: attacker optimizes, defense re-trains, repeat.

    defense_update_fn(new_rings) — fine-tunes the defense on newly discovered rings.
    defense_eval_fn(rings) -> detection_rate — black box.
    """
    import pandas as pd

    history = []
    start = pd.Timestamp("2024-03-01")
    all_old_rings = []
    warmup_pool = None  # could pass real pool here

    for r in range(n_rounds):
        if log:
            log(f"Arena round {r + 1}/{n_rounds}")
        result = run_optuna_attack(defense_eval_fn, cfg, banks, n_trials=trials_per_round,
                                   start_ts=start + pd.Timedelta(days=r * 7),
                                   warmup_pool=warmup_pool, log=log)
        # Generate the best variants to use as new training data
        best = result["best_params"]
        new_rings = []
        for s in range(5):
            p = RingParams(
                topology=best.get("topology", "fanout_chain"),
                n_hops=best.get("n_hops", 4),
                n_mules=best.get("n_mules", 6),
                total_amount=best.get("amt", 1e6),
                time_gap_s=(best.get("gap_min", 300), best.get("gap_max", 7200)),
                cross_bank_prob=best.get("xbank", 0.5),
                mule_age_days=(best.get("age_min", 5), 90),
                pass_through_frac=best.get("pt", 0.9),
                seed=r * 10000 + s,
                banks=tuple(banks),
            )
            new_rings.append(generate_ring(p, start + pd.Timedelta(days=r * 7, hours=s * 3)))

        pre_detect = defense_eval_fn(new_rings)
        defense_update_fn(new_rings)
        post_detect = defense_eval_fn(new_rings)
        # Also check backward transfer on older rings
        backward = defense_eval_fn(all_old_rings) if all_old_rings else float("nan")
        all_old_rings.extend(new_rings)

        info = {
            "round": r, "best_evasion_cost": result["best_value"],
            "best_params": result["best_params"],
            "pre_retrain_detect": float(pre_detect), "post_retrain_detect": float(post_detect),
            "backward_transfer": float(backward),
            "cost": float(attacker_cost(RingParams(**{k: v for k, v in best.items()
                                                      if k in RingParams.__dataclass_fields__},
                                                   seed=0, banks=tuple(banks)), cost_w)),
        }
        history.append(info)
        if log:
            log(f"  detect: {pre_detect:.3f} -> {post_detect:.3f}, backward={backward:.3f}")
    return history
