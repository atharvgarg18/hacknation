"""Per-bank temporal graph snapshots (local view) for the GNN.

Bank b sees only edges touching its own accounts. Remote endpoints become *external*
nodes whose features are derived only from locally visible edges (no account age,
no bank-internal metadata). Snapshots are built per time window [t0, t1): the graph
contains visible edges with ts in [t1 - lookback, t1); targets are window edges owned
by b. GNN scores are therefore available at window close (micro-batch, <= window size
delay) — the ONNX scorer covers the real-time path.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import torch
from torch_geometric.data import Data

from ..schema import EXTERNAL_BANK, FMT_CODE

NODE_FEATURES = ["is_local", "bank_axis", "bank_icici", "bank_hdfc", "log_in_deg", "log_out_deg",
                 "log_in_sum", "log_out_sum", "out_in_ratio", "log_age_days", "age_unknown",
                 "log_in_to_out_delay", "log_distinct_in", "log_distinct_out", "xbank_share", "recent_1h_share"]
EDGE_FEATURES = ["log_amt", "fmt", "cross_bank", "hour_sin", "hour_cos", "weekend",
                 "log_dt_since_src_in", "is_new_pair"]
IN_NODE, IN_EDGE = len(NODE_FEATURES), len(EDGE_FEATURES)


@dataclass
class BankStream:
    bank: str
    pos: np.ndarray        # positions into the global tx frame
    ts: np.ndarray         # epoch seconds
    src: np.ndarray
    dst: np.ndarray
    sb: np.ndarray
    db: np.ndarray
    amt: np.ndarray
    fmt: np.ndarray
    hour: np.ndarray
    wd: np.ndarray
    owned: np.ndarray      # bool, edge scored by this bank


def bank_stream(tx: pd.DataFrame, bank: str, banks: list[str]) -> BankStream:
    """`tx` must be time-sorted with a RangeIndex."""
    m = (tx.src_bank.values == bank) | (tx.dst_bank.values == bank)
    pos = np.where(m)[0]
    t = tx.iloc[pos]
    src_in = np.isin(t.src_bank.values, banks)
    owner = np.where(src_in, t.src_bank.values, t.dst_bank.values)
    return BankStream(bank, pos, t.ts.values.astype("datetime64[ns]").astype(np.int64) / 1e9,
                      t.src_acct.values, t.dst_acct.values, t.src_bank.values, t.dst_bank.values,
                      t.amount.values.astype(float), np.array([FMT_CODE.get(f, 0) for f in t.fmt.values]),
                      t.ts.dt.hour.values, t.ts.dt.weekday.values, owner == bank)


def build_snapshot(bs: BankStream, lo: int, hi: int, t0: float, t1: float, acct_open: dict,
                   y_global: np.ndarray | None = None) -> Data | None:
    """Graph over stream rows [lo, hi) (context); targets = rows with ts>=t0 and owned."""
    if hi <= lo:
        return None
    sl = slice(lo, hi)
    ts, src, dst = bs.ts[sl], bs.src[sl], bs.dst[sl]
    tgt = (ts >= t0) & bs.owned[sl]
    if not tgt.any():
        return None
    names, inv = np.unique(np.concatenate([src, dst]), return_inverse=True)
    n_e = len(src)
    s_idx, d_idx = inv[:n_e], inv[n_e:]
    N = len(names)
    amt = bs.amt[sl]
    sb, db = bs.sb[sl], bs.db[sl]
    xb = ((sb != db) & (db != EXTERNAL_BANK)).astype(float)

    in_deg = np.bincount(d_idx, minlength=N)
    out_deg = np.bincount(s_idx, minlength=N)
    in_sum = np.bincount(d_idx, amt, N)
    out_sum = np.bincount(s_idx, amt, N)
    deg = in_deg + out_deg
    xb_share = (np.bincount(s_idx, xb, N) + np.bincount(d_idx, xb, N)) / np.maximum(deg, 1)
    recent = ts >= t1 - 3600
    rec = np.bincount(s_idx, recent, N) + np.bincount(d_idx, recent, N)
    first_in = np.full(N, np.inf); np.minimum.at(first_in, d_idx, ts)
    first_out = np.full(N, np.inf); np.minimum.at(first_out, s_idx, ts)
    delay = np.where(np.isfinite(first_in) & np.isfinite(first_out) & (first_out >= first_in),
                     np.log1p(np.maximum(0, first_out - first_in)) / 12.0, 0.0)
    pairs_in = np.unique(np.stack([d_idx, s_idx], 1), axis=0)
    pairs_out = np.unique(np.stack([s_idx, d_idx], 1), axis=0)
    dist_in = np.bincount(pairs_in[:, 0], minlength=N)
    dist_out = np.bincount(pairs_out[:, 0], minlength=N)

    node_bank = np.empty(N, dtype=object)
    node_bank[s_idx] = sb
    node_bank[d_idx] = db
    is_local = (node_bank == bs.bank).astype(float)
    age = np.array([acct_open.get(nm, np.nan) if loc else np.nan for nm, loc in zip(names, is_local)], float)
    age_days = np.where(np.isnan(age), 0.0, np.log1p(np.maximum(0, t1 - np.nan_to_num(age)) / 86400.0) / 8.0)
    x = np.stack([
        is_local, (node_bank == "axis").astype(float), (node_bank == "icici").astype(float),
        (node_bank == "hdfc").astype(float), np.log1p(in_deg) / 5, np.log1p(out_deg) / 5,
        np.log1p(in_sum) / 15, np.log1p(out_sum) / 15,
        np.clip(out_sum / np.maximum(in_sum, 1.0), 0, 5) * (in_sum > 0) / 5,
        age_days, np.isnan(age).astype(float), delay, np.log1p(dist_in) / 5, np.log1p(dist_out) / 5,
        xb_share, rec / np.maximum(deg, 1),
    ], 1).astype(np.float32)

    # edge features
    order = np.argsort(ts, kind="stable")
    last_in = {}
    dt_in = np.zeros(n_e)
    seen_pair = set()
    new_pair = np.zeros(n_e)
    for k in order:
        li = last_in.get(s_idx[k])
        dt_in[k] = np.log1p(ts[k] - li) / 12.0 if li is not None else 1.5
        last_in[d_idx[k]] = ts[k]
        pr = (s_idx[k], d_idx[k])
        if pr not in seen_pair:
            new_pair[k] = 1.0
            seen_pair.add(pr)
    ang = 2 * np.pi * bs.hour[sl] / 24.0
    ea = np.stack([np.log1p(amt) / 15, bs.fmt[sl] / 3.0, xb, np.sin(ang), np.cos(ang),
                   (bs.wd[sl] >= 5).astype(float), dt_in, new_pair], 1).astype(np.float32)

    d = Data(x=torch.from_numpy(x), edge_index=torch.from_numpy(np.stack([s_idx, d_idx]).astype(np.int64)),
             edge_attr=torch.from_numpy(ea))
    d.target_mask = torch.from_numpy(tgt)
    d.target_pos = torch.from_numpy(bs.pos[sl][tgt].astype(np.int64))
    if y_global is not None:
        d.y = torch.from_numpy(y_global[bs.pos[sl][tgt]].astype(np.float32))
    d.t1 = t1
    return d


def build_snapshots(bs: BankStream, t_start: float, t_end: float, window_h: float, lookback_d: float,
                    acct_open: dict, y_global: np.ndarray | None = None) -> list[Data]:
    out = []
    w, lb = window_h * 3600.0, lookback_d * 86400.0
    t0 = t_start
    while t0 < t_end:
        t1 = min(t0 + w, t_end)
        lo = int(np.searchsorted(bs.ts, t1 - lb, "left"))
        hi = int(np.searchsorted(bs.ts, t1, "left"))
        d = build_snapshot(bs, lo, hi, t0, t1, acct_open, y_global)
        if d is not None:
            out.append(d)
        t0 = t1
    return out


def snapshots_for_frame(tx: pd.DataFrame, bank: str, banks: list[str], acct_open: dict, window_h=6.0,
                        lookback_d=7.0, y=None, t_start=None, t_end=None) -> list[Data]:
    """Convenience: snapshots over an arbitrary (sorted, RangeIndex) frame."""
    bs = bank_stream(tx, bank, banks)
    if len(bs.ts) == 0:
        return []
    ts0 = bs.ts.min() if t_start is None else t_start
    ts1 = bs.ts.max() + 1 if t_end is None else t_end
    return build_snapshots(bs, ts0, ts1, window_h, lookback_d, acct_open, y)
