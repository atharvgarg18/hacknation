"""Assemble the full dataset: base traffic (synthetic or IBM) + stress cases + rings.

Training families (A-C) are injected across the whole timeline; the held-out family D
(layered) is injected ONLY in the test period with seeds >= heldout_seed_base.
"""
from __future__ import annotations

import pickle
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from ..config import ML_ROOT, bank_ids
from ..schema import conform
from .ibm_loader import attach_ibm_patterns, find_ibm_files, load_ibm
from .ring_generator import RingResult, generate_ring, random_params
from .splits import Boundaries, add_label_delay, assign_splits, time_boundaries
from .traffic_sim import make_accounts, normal_traffic, stress_cases


@dataclass
class Dataset:
    tx: pd.DataFrame
    accounts: pd.DataFrame
    rings: dict = field(default_factory=dict)      # ring_id -> meta dict
    boundaries: Boundaries | None = None
    source: str = "synthetic"

    def split(self, name: str) -> pd.DataFrame:
        return self.tx[self.tx.split == name]

    def save(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def load(path) -> "Dataset":
        with open(path, "rb") as f:
            return pickle.load(f)


def ring_meta(r: RingResult, split: str, heldout: bool) -> dict:
    tx = r.transactions
    max_hop = int(tx.hop.max())
    return {
        "ring_id": r.ring_id, "family": r.family, "split": split, "heldout": heldout,
        "edges": r.ground_truth_edges, "nodes": r.ground_truth_nodes, "mules": r.mule_nodes,
        "hop_ts": r.per_hop_timestamps, "start_ts": tx.ts.min(), "end_ts": tx.ts.max(),
        "total_amount": float(tx.loc[tx.hop == 0, "amount"].sum()),
        "final_hop_amount": float(tx.loc[tx.dst_acct.isin(tx.dst_acct[tx.hop == max_hop]) & (tx.hop == max_hop), "amount"].sum()),
        "banks": sorted(set(tx.src_bank) | set(tx.dst_bank)),
        "cross_bank": bool((tx.src_bank != tx.dst_bank).any()),
        "params": r.params,
    }


def inject_rings(cfg, accounts, start, end, families, n, seed_base, rng, warm_pool):
    banks = bank_ids(cfg)
    results = []
    for i in range(n):
        fam = families[i % len(families)]
        seed = seed_base + i
        p = random_params(fam, seed, banks)
        t0_ns = rng.integers(start.value, end.value)
        r = generate_ring(p, pd.Timestamp(t0_ns).floor("s"), warmup_pool=warm_pool)
        results.append(r)
    return results


def build_dataset(cfg, seed: int | None = None, use_ibm: bool | None = None) -> Dataset:
    seed = int(cfg["seed"] if seed is None else seed)
    rng = np.random.default_rng(seed)
    banks = bank_ids(cfg)
    raw_dir = ML_ROOT / cfg["data"]["raw_dir"]
    trans_p, pat_p = find_ibm_files(raw_dir)
    use_ibm = (trans_p is not None) if use_ibm is None else use_ibm

    if use_ibm and trans_p is not None:
        base, accounts = load_ibm(trans_p, banks, max_rows=cfg["data"].get("ibm_max_rows"))
        base = attach_ibm_patterns(base, pat_p)
        source = f"ibm:{trans_p.name}"
        start, end = base.ts.min(), base.ts.max()
    else:
        accounts = make_accounts(cfg, rng)
        base = normal_traffic(cfg, accounts, rng)
        source = "synthetic"
        start, end = pd.Timestamp(cfg["data"]["start_date"]), pd.Timestamp(cfg["data"]["end_date"])

    stress, stress_acc = stress_cases(cfg, accounts, rng) if source == "synthetic" else (conform(pd.DataFrame()), None)
    if stress_acc is not None:
        accounts = pd.concat([accounts, stress_acc], ignore_index=True)

    tr = cfg["data"]["temporal_splits"]
    span = end - start
    train_end = start + span * tr["train_ratio"]
    val_end = start + span * (tr["train_ratio"] + tr["val_ratio"])

    warm_pool = accounts[(accounts.kind == "normal") & (accounts.open_ts <= start)][["acct_id", "bank"]]
    if warm_pool.empty:
        warm_pool = accounts[["acct_id", "bank"]]
    rc = cfg["rings"]

    # Adapt margins to overall span (accommodates multi-month synthetic or multi-day IBM data)
    r_margin = min(pd.Timedelta(days=2), span * 0.05)
    r_start = start + r_margin
    r_end = max(r_start + pd.Timedelta(minutes=30), end - r_margin)

    h_span = max(end - val_end, pd.Timedelta(hours=2))
    h_start = val_end + min(pd.Timedelta(hours=6), h_span * 0.1)
    h_end = max(h_start + pd.Timedelta(minutes=30), end - min(pd.Timedelta(days=1), h_span * 0.1))

    train_rings = inject_rings(cfg, accounts, r_start, r_end,
                               rc["train_families"], rc["train_rings_count"], seed * 1000 + 1, rng, warm_pool)
    held = inject_rings(cfg, accounts, h_start, h_end,
                        [rc["heldout_family"]], rc["heldout_rings_count"], rc["heldout_seed_base"] + seed * 1000,
                        rng, warm_pool)

    parts = [base, stress]
    acc_parts = [accounts]
    for r in train_rings + held:
        parts += [r.transactions, r.warmup]
        acc_parts.append(r.accounts)
    tx = pd.concat([p for p in parts if len(p)], ignore_index=True)
    tx = conform(tx).sort_values("ts", kind="stable").reset_index(drop=True)
    missing = tx.tx_id.isin(["", "nan"])
    tx.loc[missing, "tx_id"] = [f"tx_{i}" for i in np.where(missing)[0]]
    accounts = pd.concat(acc_parts, ignore_index=True).drop_duplicates("acct_id")

    b = Boundaries(start, train_end, val_end, end)
    tx = assign_splits(tx, b)
    ld = cfg["data"]["label_delay_days"]
    tx = add_label_delay(tx, ld["median_days"], ld["sigma"], ld["enabled"], seed)

    rings = {}
    for r in train_rings:
        s = tx.loc[tx.ring_id == r.ring_id, "split"].iloc[0]
        rings[r.ring_id] = ring_meta(r, s, False)
    for r in held:
        rings[r.ring_id] = ring_meta(r, "test", True)
    # IBM rings (if loaded) - meta without generator params
    if source != "synthetic":
        for rid, g in tx[(tx.ring_id.str.startswith("ibm_ring"))].groupby("ring_id"):
            rings[rid] = {"ring_id": rid, "family": g.family.iloc[0], "split": g.split.iloc[0], "heldout": False,
                          "edges": g.tx_id.tolist(), "nodes": sorted(set(g.src_acct) | set(g.dst_acct)),
                          "mules": [], "hop_ts": {0: g.ts.min()}, "start_ts": g.ts.min(), "end_ts": g.ts.max(),
                          "total_amount": float(g.amount.max()), "final_hop_amount": float(g.amount.iloc[-1]),
                          "banks": sorted(set(g.src_bank) | set(g.dst_bank)),
                          "cross_bank": bool((g.src_bank != g.dst_bank).any()), "params": {}}
    return Dataset(tx=tx, accounts=accounts.reset_index(drop=True), rings=rings, boundaries=b, source=source)
