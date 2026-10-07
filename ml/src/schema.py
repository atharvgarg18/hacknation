"""Single Transaction schema shared by every component (prevents schema drift).

Columns
-------
tx_id       str   unique id
ts          datetime64[ns]
src_bank    str   one of the federation banks or "ext"
src_acct    str   globally unique account id, e.g. "axis_000123"
dst_bank    str
dst_acct    str
amount      float INR
currency    str   "INR"
fmt         str   UPI | IMPS | NEFT | RTGS
label       int   1 = laundering (ground truth)
ring_id     str   "" for benign
stress_type str   "" or payroll|merchant|rent|remittance|sweep
family      str   ring topology family ("" for benign)
hop         int   hop index inside ring (-1 benign)
"""
from __future__ import annotations

import pandas as pd

TX_COLUMNS = [
    "tx_id", "ts", "src_bank", "src_acct", "dst_bank", "dst_acct", "amount",
    "currency", "fmt", "label", "ring_id", "stress_type", "family", "hop",
]
CHANNELS = ["UPI", "IMPS", "NEFT", "RTGS"]
FMT_CODE = {c: i for i, c in enumerate(CHANNELS)}
EXTERNAL_BANK = "ext"

# Mapping from shared/types.ts AttackPattern -> generator topology
ATTACK_PATTERN_TO_TOPOLOGY = {
    "fan-out-fan-in": "scatter_gather",
    "chain": "fanout_chain",
    "cycle": "cycle",
    "rapid-pass-through": "fanout_chain",
    "layered": "layered",
}


def empty_tx_frame() -> pd.DataFrame:
    return conform(pd.DataFrame(columns=TX_COLUMNS))


def conform(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce a frame to the canonical schema / dtypes."""
    df = df.copy()
    defaults = {"currency": "INR", "label": 0, "ring_id": "", "stress_type": "",
                "family": "", "hop": -1}
    for c in TX_COLUMNS:
        if c not in df.columns:
            df[c] = defaults.get(c, "")
    df["ts"] = pd.to_datetime(df["ts"])
    df["amount"] = df["amount"].astype(float)
    df["label"] = df["label"].astype(int)
    df["hop"] = df["hop"].astype(int)
    for c in ["tx_id", "src_bank", "src_acct", "dst_bank", "dst_acct", "currency",
              "fmt", "ring_id", "stress_type", "family"]:
        df[c] = df[c].astype(str)
    return df[TX_COLUMNS + [c for c in df.columns if c not in TX_COLUMNS]]


def channel_for_amount(amount: float, rng) -> str:
    """Realistic Indian rail choice by amount."""
    if amount >= 200_000:
        return "RTGS" if rng.random() < 0.7 else "NEFT"
    if amount >= 100_000:
        return rng.choice(["NEFT", "IMPS"])
    if amount >= 20_000:
        return rng.choice(["IMPS", "UPI", "NEFT"], p=[0.45, 0.35, 0.2])
    return "UPI" if rng.random() < 0.8 else "IMPS"
