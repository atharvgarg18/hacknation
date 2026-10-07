"""Streaming, edge-computable tabular features.

The SAME `FeatureState` class is used offline (training) and online (edge node), so
there is no train/serve skew. Every feature for an event uses only state built from
events with ts < event_ts (strict); events sharing a timestamp are featurized
before any of them updates state.
"""
from __future__ import annotations

import math
from collections import deque

import numpy as np
import pandas as pd

from ..schema import EXTERNAL_BANK, FMT_CODE

H1, H24, D7 = 3600.0, 86400.0, 7 * 86400.0

FEATURES = [
    "log_amount", "amt_z_src", "amt_ratio_src_mean", "is_round", "fmt_code",
    "hour_sin", "hour_cos", "is_weekend",
    "is_new_payee", "payee_age_days_log", "dst_in_degree_24h", "dst_in_cnt_24h",
    "src_out_cnt_1h", "src_out_sum_1h_log", "src_out_cnt_24h", "src_out_sum_24h_log", "src_out_cnt_7d",
    "src_in_cnt_1h", "src_in_sum_1h_log", "src_in_sum_24h_log",
    "dst_in_cnt_1h", "dst_in_sum_1h_log", "dst_out_over_in_1h",
    "src_passthrough_1h", "src_passthrough_24h", "src_secs_since_last_in_log",
    "is_new_dst_bank", "cross_bank", "src_xbank_share",
    "src_acct_age_log", "dst_acct_age_log", "src_tx_total_log", "src_dormant_days_log",
]
N_FEATURES = len(FEATURES)


class _Acct:
    __slots__ = ("out", "inn", "ew_mu", "ew_var", "ew_n", "payees", "banks", "last_ts", "last_in_ts",
                 "n_total", "xb_share")

    def __init__(self):
        self.out: deque = deque()     # (ts, amt, cpty)
        self.inn: deque = deque()
        self.ew_mu = 0.0
        self.ew_var = 1.0
        self.ew_n = 0
        self.payees: dict = {}
        self.banks: set = set()
        self.last_ts = None
        self.last_in_ts = None
        self.n_total = 0
        self.xb_share = 0.0


def _trim(dq: deque, now: float, horizon: float = D7):
    while dq and dq[0][0] < now - horizon:
        dq.popleft()


def _win(dq: deque, now: float, w: float):
    c, s = 0, 0.0
    for t, a, _ in reversed(dq):
        if t < now - w:
            break
        c += 1
        s += a
    return c, s


def _distinct(dq: deque, now: float, w: float):
    seen = set()
    for t, _, cp in reversed(dq):
        if t < now - w:
            break
        seen.add(cp)
    return len(seen)


class FeatureState:
    """Per-bank streaming state store. `acct_open` maps *own* accounts -> open time (epoch s)."""

    def __init__(self, bank: str | None = None, acct_open: dict | None = None, alpha: float = 0.1):
        self.bank = bank
        self.acct_open = acct_open or {}
        self.alpha = alpha
        self.accts: dict[str, _Acct] = {}

    def _get(self, a: str) -> _Acct:
        s = self.accts.get(a)
        if s is None:
            s = _Acct()
            self.accts[a] = s
        return s

    # ------------------------------------------------------------------
    def featurize(self, ts: float, src: str, dst: str, src_bank: str, dst_bank: str,
                  amount: float, fmt: str, hour: int, weekday: int) -> list[float]:
        S, D = self._get(src), self._get(dst)
        _trim(S.out, ts); _trim(S.inn, ts); _trim(D.out, ts); _trim(D.inn, ts)
        la = math.log1p(amount)
        std = math.sqrt(max(S.ew_var, 1e-6))
        z = (la - S.ew_mu) / std if S.ew_n >= 3 else 0.0
        ratio = amount / math.expm1(S.ew_mu) if S.ew_n >= 3 and S.ew_mu > 0 else 1.0
        first = S.payees.get(dst)
        new_payee = 1.0 if first is None else 0.0
        payee_age = 0.0 if first is None else math.log1p((ts - first) / 86400.0)
        so1c, so1s = _win(S.out, ts, H1)
        so24c, so24s = _win(S.out, ts, H24)
        so7c, _ = _win(S.out, ts, D7)
        si1c, si1s = _win(S.inn, ts, H1)
        _, si24s = _win(S.inn, ts, H24)
        di1c, di1s = _win(D.inn, ts, H1)
        di24c, _ = _win(D.inn, ts, H24)
        _, do1s = _win(D.out, ts, H1)
        pt1 = min(5.0, (so1s + amount) / (si1s + 1.0)) if si1s > 0 else 0.0
        pt24 = min(5.0, (so24s + amount) / (si24s + 1.0)) if si24s > 0 else 0.0
        since_in = math.log1p(ts - S.last_in_ts) if S.last_in_ts is not None else 16.0
        dormant = math.log1p((ts - S.last_ts) / 86400.0) if S.last_ts is not None else -1.0
        cross = 1.0 if (src_bank != dst_bank and dst_bank != EXTERNAL_BANK) else 0.0
        so = self.acct_open.get(src)
        do = self.acct_open.get(dst)
        src_age = math.log1p(max(0.0, (ts - so) / 86400.0)) if so is not None else -1.0
        dst_age = math.log1p(max(0.0, (ts - do) / 86400.0)) if do is not None else -1.0
        ang = 2 * math.pi * hour / 24.0
        return [
            la, max(-8.0, min(8.0, z)), min(50.0, ratio), 1.0 if amount % 100 == 0 else 0.0,
            float(FMT_CODE.get(fmt, 0)), math.sin(ang), math.cos(ang), 1.0 if weekday >= 5 else 0.0,
            new_payee, payee_age, float(_distinct(D.inn, ts, H24)), float(di24c),
            float(so1c), math.log1p(so1s), float(so24c), math.log1p(so24s), float(so7c),
            float(si1c), math.log1p(si1s), math.log1p(si24s),
            float(di1c), math.log1p(di1s), min(5.0, do1s / (di1s + 1.0)) if di1s > 0 else 0.0,
            pt1, pt24, since_in,
            0.0 if dst_bank in S.banks else 1.0, cross, S.xb_share,
            src_age, dst_age, math.log1p(S.n_total), dormant,
        ]

    def update(self, ts: float, src: str, dst: str, src_bank: str, dst_bank: str, amount: float):
        S, D = self._get(src), self._get(dst)
        la = math.log1p(amount)
        a = self.alpha if S.ew_n >= 3 else 1.0 / (S.ew_n + 1)
        d = la - S.ew_mu
        S.ew_mu += a * d
        S.ew_var = (1 - a) * (S.ew_var + a * d * d) if S.ew_n >= 1 else 1.0
        S.ew_n += 1
        S.out.append((ts, amount, dst))
        S.payees.setdefault(dst, ts)
        S.banks.add(dst_bank)
        cross = 1.0 if (src_bank != dst_bank and dst_bank != EXTERNAL_BANK) else 0.0
        S.xb_share = 0.9 * S.xb_share + 0.1 * cross
        S.last_ts = ts
        S.n_total += 1
        D.inn.append((ts, amount, src))
        D.last_in_ts = ts
        D.last_ts = ts
        D.n_total += 1

    def process(self, ts: float, src, dst, src_bank, dst_bank, amount, fmt, hour, weekday, update=True):
        f = self.featurize(ts, src, dst, src_bank, dst_bank, amount, fmt, hour, weekday)
        if update:
            self.update(ts, src, dst, src_bank, dst_bank, amount)
        return f


def acct_open_map(accounts: pd.DataFrame, bank: str | None) -> dict:
    a = accounts if bank is None else accounts[accounts.bank == bank]
    return dict(zip(a.acct_id.values, a.open_ts.values.astype("datetime64[ns]").astype(np.int64) / 1e9))


def featurize_stream(tx: pd.DataFrame, state: FeatureState, emit_mask: np.ndarray | None = None) -> np.ndarray:
    """Featurize a time-sorted stream with strict ts< semantics. Returns [n, F] (NaN where not emitted)."""
    n = len(tx)
    out = np.full((n, N_FEATURES), np.nan, dtype=np.float32)
    if n == 0:
        return out
    ts = tx.ts.values.astype("datetime64[ns]").astype(np.int64) / 1e9
    hours = tx.ts.dt.hour.values
    wd = tx.ts.dt.weekday.values
    src, dst = tx.src_acct.values, tx.dst_acct.values
    sb, db = tx.src_bank.values, tx.dst_bank.values
    amt, fmt = tx.amount.values, tx.fmt.values
    emit = np.ones(n, bool) if emit_mask is None else emit_mask
    i = 0
    while i < n:
        j = i
        while j + 1 < n and ts[j + 1] == ts[i]:
            j += 1
        for k in range(i, j + 1):              # featurize the whole tie group first
            if emit[k]:
                out[k] = state.featurize(ts[k], src[k], dst[k], sb[k], db[k], amt[k], fmt[k], hours[k], wd[k])
        for k in range(i, j + 1):
            state.update(ts[k], src[k], dst[k], sb[k], db[k], amt[k])
        i = j + 1
    return out


def compute_bank_features(tx: pd.DataFrame, banks: list[str], accounts: pd.DataFrame,
                          return_states: bool = False):
    """Each bank featurizes its local view and emits features for the edges it owns."""
    from ..data.splits import owner_bank

    tx = tx.sort_values("ts", kind="stable")
    owner = owner_bank(tx, banks)
    X = np.full((len(tx), N_FEATURES), np.nan, dtype=np.float32)
    states = {}
    for b in banks:
        vis = ((tx.src_bank.values == b) | (tx.dst_bank.values == b))
        idx = np.where(vis)[0]
        st = FeatureState(b, acct_open_map(accounts, b))
        f = featurize_stream(tx.iloc[idx], st, emit_mask=(owner[idx] == b))
        own = owner[idx] == b
        X[idx[own]] = f[own]
        states[b] = st
    feats = pd.DataFrame(X, columns=FEATURES, index=tx.index)
    feats["owner_bank"] = owner
    feats = feats.loc[tx.index]
    return (feats, states) if return_states else feats
