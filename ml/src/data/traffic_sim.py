"""Normal-traffic simulator + false-positive stress cases.

Produces benign INR traffic between accounts at the federation banks (axis/icici/hdfc)
plus an "ext" outside world. Stress cases are legitimate patterns that *look*
suspicious (payroll fan-out, merchant fan-in, rent collection, remittance, sweeps)
and are labelled label=0, stress_type=<name>.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..schema import EXTERNAL_BANK, channel_for_amount, conform

DIURNAL = np.array([1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2, 4, 6, 7, 7, 7, 7, 6.5, 6, 6, 6,
                    5.5, 5, 4, 3, 2.5, 1.5], dtype=float)
DIURNAL = DIURNAL / DIURNAL.sum()


def _rand_times(rng, lo: pd.Timestamp, hi: pd.Timestamp, n: int) -> pd.DatetimeIndex:
    lo_ns, hi_ns = lo.value, hi.value
    days = rng.integers(0, max(1, (hi_ns - lo_ns) // 86_400_000_000_000) + 1, n)
    hours = rng.choice(24, n, p=DIURNAL)
    secs = rng.integers(0, 3600, n)
    ns = lo_ns + days * 86_400_000_000_000 + hours * 3_600_000_000_000 + secs * 1_000_000_000
    ns = np.clip(ns, lo_ns, hi_ns)
    return pd.to_datetime(ns)


def make_accounts(cfg, rng) -> pd.DataFrame:
    banks = [b["id"] for b in cfg["banks"]]
    start = pd.Timestamp(cfg["data"]["start_date"])
    end = pd.Timestamp(cfg["data"]["end_date"])
    n_per = int(cfg["data"].get("accounts_per_bank", 1200))
    n_ext = int(cfg["data"].get("external_accounts", 400))
    rows = []
    for b in banks + [EXTERNAL_BANK]:
        n = n_ext if b == EXTERNAL_BANK else n_per
        new_mask = rng.random(n) < float(cfg["data"].get("new_account_frac", 0.12))
        age_days = rng.integers(60, 3000, n)
        open_ts = start - pd.to_timedelta(age_days, unit="D")
        new_open = _rand_times(rng, start, end - pd.Timedelta(days=10), n)
        open_ts = np.where(new_mask, new_open.values, open_ts.values)
        for i in range(n):
            rows.append((f"{b}_{i:06d}", b, pd.Timestamp(open_ts[i]), "normal"))
    acc = pd.DataFrame(rows, columns=["acct_id", "bank", "open_ts", "kind"])
    acc["mean_log_amt"] = rng.normal(np.log(3500), 0.9, len(acc))
    acc["activity"] = rng.lognormal(0, 0.8, len(acc))
    return acc


def normal_traffic(cfg, accounts: pd.DataFrame, rng) -> pd.DataFrame:
    start = pd.Timestamp(cfg["data"]["start_date"])
    end = pd.Timestamp(cfg["data"]["end_date"])
    n = int(cfg["data"]["normal_tx_count"])
    acc = accounts[accounts.kind == "normal"].reset_index(drop=True)
    n_acc = len(acc)
    # stable payee lists (each account has 3..8 regular counterparties)
    payees = [rng.choice(n_acc, rng.integers(3, 9), replace=False) for _ in range(n_acc)]

    w = acc["activity"].values / acc["activity"].values.sum()
    snd = rng.choice(n_acc, n, p=w)
    open_ns = acc["open_ts"].values.astype("datetime64[ns]").astype(np.int64)
    lo = np.maximum(open_ns[snd], start.value)
    # date uniform in [lo,end], hour diurnal
    span_days = np.maximum(1, (end.value - lo) // 86_400_000_000_000)
    day = (rng.random(n) * span_days).astype(np.int64)
    hours = rng.choice(24, n, p=DIURNAL)
    secs = rng.integers(0, 3600, n)
    base_day = (lo // 86_400_000_000_000) * 86_400_000_000_000
    ts_ns = base_day + day * 86_400_000_000_000 + hours * 3_600_000_000_000 + secs * 1_000_000_000
    ts_ns = np.clip(np.maximum(ts_ns, lo), start.value, end.value)

    rcv = np.empty(n, dtype=np.int64)
    use_payee = rng.random(n) < 0.85
    for i in range(n):
        rcv[i] = rng.choice(payees[snd[i]]) if use_payee[i] else rng.integers(n_acc)
    same = rcv == snd
    rcv[same] = (rcv[same] + 1) % n_acc
    # receiver must be open
    rcv_open = open_ns[rcv]
    bad = rcv_open > ts_ns
    rcv[bad] = rng.choice(np.where(open_ns < start.value)[0], bad.sum())

    amt = np.exp(rng.normal(acc["mean_log_amt"].values[snd], 0.6))
    round_mask = rng.random(n) < 0.25
    amt = np.where(round_mask, np.maximum(100, np.round(amt, -2)), np.round(amt, 2))

    df = pd.DataFrame({
        "ts": pd.to_datetime(ts_ns),
        "src_bank": acc["bank"].values[snd],
        "src_acct": acc["acct_id"].values[snd],
        "dst_bank": acc["bank"].values[rcv],
        "dst_acct": acc["acct_id"].values[rcv],
        "amount": amt,
    })
    # ext->ext traffic is invisible to everyone, drop it
    df = df[~((df.src_bank == EXTERNAL_BANK) & (df.dst_bank == EXTERNAL_BANK))]
    df["fmt"] = [channel_for_amount(a, rng) for a in df["amount"].values]
    return conform(df)


# ---------------------------------------------------------------------------
# Stress cases (label=0)
# ---------------------------------------------------------------------------

def _new_acct(accounts_rows, bank, tag, i, open_ts):
    aid = f"{bank}_{tag}{i:04d}"
    accounts_rows.append((aid, bank, open_ts, tag))
    return aid


def stress_cases(cfg, accounts: pd.DataFrame, rng) -> tuple[pd.DataFrame, pd.DataFrame]:
    sc = cfg["data"]["stress_cases"]
    banks = [b["id"] for b in cfg["banks"]]
    start = pd.Timestamp(cfg["data"]["start_date"])
    end = pd.Timestamp(cfg["data"]["end_date"])
    old = accounts[(accounts.kind == "normal") & (accounts.open_ts < start)]
    pool = old["acct_id"].values
    bank_of = dict(zip(accounts.acct_id, accounts.bank))
    new_acc_rows: list = []
    rows: list = []
    old_open = start - pd.Timedelta(days=900)

    def add(ts, s, d, amt, st):
        rows.append((ts, bank_of.get(s, s.split("_")[0]), s, bank_of.get(d, d.split("_")[0]), d,
                     float(amt), st))

    months = pd.date_range(start, end, freq="MS")
    if sc.get("payroll"):
        for e in range(6):
            emp = _new_acct(new_acc_rows, rng.choice(banks), "payroll", e, old_open)
            bank_of[emp] = emp.split("_")[0]
            staff = rng.choice(pool, rng.integers(50, 300), replace=False)
            salaries = np.round(rng.lognormal(np.log(35000), 0.3, len(staff)), -2)
            for m in months:
                day = m + pd.Timedelta(days=int(rng.integers(0, 3)), hours=10)
                for k, s in enumerate(staff):
                    add(day + pd.Timedelta(seconds=int(rng.integers(0, 900))), emp, s, salaries[k], "payroll")
    if sc.get("merchant"):
        for e in range(6):
            mer = _new_acct(new_acc_rows, rng.choice(banks), "merchant", e, old_open)
            own = _new_acct(new_acc_rows, bank_of.get(mer, mer.split("_")[0]), "merchown", e, old_open)
            bank_of[mer] = mer.split("_")[0]
            bank_of[own] = own.split("_")[0]
            custs = rng.choice(pool, 400, replace=False)
            n_sales = int(rng.integers(300, 700))
            ts = _rand_times(rng, start, end, n_sales).sort_values()
            for t in ts:
                add(t, rng.choice(custs), mer, round(float(rng.lognormal(np.log(900), 0.7)), 2), "merchant")
            for w in pd.date_range(start, end, freq="W-MON"):
                tot = rng.uniform(1e5, 6e5)
                add(w + pd.Timedelta(hours=18), mer, own, round(tot, 2), "merchant")
    if sc.get("rent"):
        for e in range(8):
            ll = _new_acct(new_acc_rows, rng.choice(banks), "landlord", e, old_open)
            bank_of[ll] = ll.split("_")[0]
            tenants = rng.choice(pool, rng.integers(10, 40), replace=False)
            rents = np.round(rng.uniform(8000, 45000, len(tenants)), -3)
            for m in months:
                for k, tnt in enumerate(tenants):
                    add(m + pd.Timedelta(days=int(rng.integers(0, 5)), hours=int(rng.integers(8, 22))),
                        tnt, ll, rents[k], "rent")
    if sc.get("remittance"):
        for _ in range(150):
            s, d = rng.choice(pool, 2, replace=False)
            t = _rand_times(rng, start, end, 1)[0]
            add(t, s, d, round(float(rng.uniform(1.5e5, 9e5)), -3), "remittance")
    if sc.get("sweep"):
        for e in range(10):
            b1, b2 = rng.choice(banks, 2, replace=False)
            a = _new_acct(new_acc_rows, b1, "sweepA", e, old_open)
            b = _new_acct(new_acc_rows, b2, "sweepB", e, old_open)
            c = _new_acct(new_acc_rows, b2, "sweepC", e, old_open)
            for x in (a, b, c):
                bank_of[x] = x.split("_")[0]
            for day in pd.date_range(start, end, freq="B"):
                if rng.random() < 0.5:
                    continue
                amt = round(float(rng.uniform(2e5, 2e6)), -3)
                t0 = day + pd.Timedelta(hours=int(rng.integers(10, 16)))
                add(t0, a, b, amt, "sweep")
                add(t0 + pd.Timedelta(minutes=int(rng.integers(5, 90))), b, c, round(amt * rng.uniform(0.9, 1.0), -3), "sweep")

    df = pd.DataFrame(rows, columns=["ts", "src_bank", "src_acct", "dst_bank", "dst_acct", "amount", "stress_type"])
    df["fmt"] = [channel_for_amount(a, rng) for a in df["amount"].values]
    new_acc = pd.DataFrame(new_acc_rows, columns=["acct_id", "bank", "open_ts", "kind"])
    new_acc["mean_log_amt"] = np.log(30000)
    new_acc["activity"] = 1.0
    return conform(df), new_acc
