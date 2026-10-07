"""Temporal splits, ring-level split enforcement, per-bank visibility and label delay."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..schema import EXTERNAL_BANK


@dataclass
class Boundaries:
    start: pd.Timestamp
    train_end: pd.Timestamp
    val_end: pd.Timestamp
    end: pd.Timestamp

    def to_dict(self):
        return {k: str(v) for k, v in self.__dict__.items()}


def time_boundaries(tx: pd.DataFrame, train_ratio=0.6, val_ratio=0.2) -> Boundaries:
    start, end = tx.ts.min(), tx.ts.max()
    span = end - start
    return Boundaries(start, start + span * train_ratio, start + span * (train_ratio + val_ratio), end)


def assign_splits(tx: pd.DataFrame, b: Boundaries) -> pd.DataFrame:
    """Split by time. All edges of a ring go to the split of the ring's first edge."""
    tx = tx.copy()
    split = np.where(tx.ts < b.train_end, "train", np.where(tx.ts < b.val_end, "val", "test"))
    tx["split"] = split
    ring = tx[tx.ring_id != ""]
    if len(ring):
        first = ring.groupby("ring_id")["ts"].min()
        rsplit = np.where(first < b.train_end, "train", np.where(first < b.val_end, "val", "test"))
        m = dict(zip(first.index, rsplit))
        mask = tx.ring_id != ""
        tx.loc[mask, "split"] = tx.loc[mask, "ring_id"].map(m)
    return tx


def add_label_delay(tx: pd.DataFrame, median_days: float, sigma: float, enabled: bool, seed: int) -> pd.DataFrame:
    """label_visible_at = ts + lognormal delay (median `median_days`). Rings are confirmed as a unit."""
    tx = tx.copy()
    if not enabled or median_days <= 0:
        tx["label_visible_at"] = tx["ts"]
        return tx
    rng = np.random.default_rng(seed)
    tx["label_visible_at"] = pd.NaT
    pos = tx.label == 1
    if pos.any():
        rings = tx.loc[pos, "ring_id"].replace("", np.nan).fillna(tx.loc[pos, "tx_id"])
        uniq = rings.unique()
        delays = rng.lognormal(np.log(median_days), sigma, len(uniq))
        dmap = dict(zip(uniq, delays))
        last_ts = tx.loc[pos].groupby(rings)["ts"].transform("max")
        tx.loc[pos, "label_visible_at"] = last_ts + pd.to_timedelta(rings.map(dmap).values, unit="D")
    tx.loc[~pos, "label_visible_at"] = tx.loc[~pos, "ts"]
    return tx


def observed_labels(tx: pd.DataFrame, as_of: pd.Timestamp) -> np.ndarray:
    """Labels known at time `as_of`. Unconfirmed positives look benign (realistic noise)."""
    return ((tx.label.values == 1) & (tx.label_visible_at.values <= np.datetime64(as_of))).astype(int)


def bank_view(tx: pd.DataFrame, bank: str) -> pd.DataFrame:
    """Edges visible to `bank`: it sees outgoing (src in bank) and incoming (dst in bank)."""
    return tx[(tx.src_bank == bank) | (tx.dst_bank == bank)]


def owner_bank(tx: pd.DataFrame, banks: list[str]) -> np.ndarray:
    """Which bank scores the edge: the sending bank, or the receiving bank for inbound-from-outside."""
    src_in = tx.src_bank.isin(banks).values
    return np.where(src_in, tx.src_bank.values, tx.dst_bank.values)


def visible_to_participants(tx: pd.DataFrame, participants: list[str]) -> np.ndarray:
    return (tx.src_bank.isin(participants) | tx.dst_bank.isin(participants)).values


def is_cross_bank(tx: pd.DataFrame) -> np.ndarray:
    return (tx.src_bank.values != tx.dst_bank.values) & (tx.dst_bank.values != EXTERNAL_BANK)
