"""Loader for IBM 'Transactions for Anti Money Laundering' (HI/LI-Small/Medium/Large).

Maps the IBM bank universe onto SATARK's 3 federation banks: the 3 largest banks by
volume become axis/icici/hdfc, all others become the external world ("ext").
Payment formats are mapped to Indian rails. Amounts are kept numerically (treated
as INR for modelling purposes).
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

from ..schema import EXTERNAL_BANK, conform

FMT_MAP = {"ACH": "NEFT", "Wire": "RTGS", "Credit Card": "UPI", "Cheque": "NEFT",
           "Cash": "IMPS", "Reinvestment": "NEFT", "Bitcoin": "IMPS"}


def find_ibm_files(raw_dir: Path) -> tuple[Path | None, Path | None]:
    raw_dir = Path(raw_dir)
    if not raw_dir.exists():
        return None, None
    trans = sorted(raw_dir.glob("*_Trans.csv")) or sorted(raw_dir.glob("*Trans*.csv"))
    pats = sorted(raw_dir.glob("*_Patterns.txt"))
    return (trans[0] if trans else None), (pats[0] if pats else None)


def load_ibm(path, banks: list[str], max_rows: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(path, nrows=max_rows)
    df.columns = ["ts", "src_bank_raw", "src_acct_raw", "dst_bank_raw", "dst_acct_raw",
                  "amt_recv", "cur_recv", "amt_paid", "cur_paid", "fmt_raw", "label"]
    df["ts"] = pd.to_datetime(df["ts"], format="%Y/%m/%d %H:%M")
    vol = pd.concat([df.src_bank_raw, df.dst_bank_raw]).value_counts()
    top = list(vol.index[: len(banks)])
    bmap = {raw: banks[i] for i, raw in enumerate(top)}

    def map_bank(s):
        return s.map(bmap).fillna(EXTERNAL_BANK)

    df["src_bank"] = map_bank(df.src_bank_raw)
    df["dst_bank"] = map_bank(df.dst_bank_raw)
    # globally unique account ids; external accounts are hashed
    df["src_acct"] = df["src_bank"] + "_" + df.src_bank_raw.astype(str) + "x" + df.src_acct_raw.astype(str)
    df["dst_acct"] = df["dst_bank"] + "_" + df.dst_bank_raw.astype(str) + "x" + df.dst_acct_raw.astype(str)
    df = df[~((df.src_bank == EXTERNAL_BANK) & (df.dst_bank == EXTERNAL_BANK))].copy()
    df["amount"] = df["amt_paid"].astype(float)
    df["currency"] = df["cur_paid"].astype(str)
    df["fmt"] = df["fmt_raw"].map(FMT_MAP).fillna("NEFT")
    df = df.sort_values("ts").reset_index(drop=True)
    df["tx_id"] = [f"ibm_{i}" for i in range(len(df))]
    df["family"] = np.where(df.label == 1, "ibm", "")
    df["ring_id"] = ""
    out = conform(df)

    accts = pd.concat([
        out[["src_acct", "src_bank", "ts"]].rename(columns={"src_acct": "acct_id", "src_bank": "bank"}),
        out[["dst_acct", "dst_bank", "ts"]].rename(columns={"dst_acct": "acct_id", "dst_bank": "bank"}),
    ]).groupby(["acct_id", "bank"], as_index=False)["ts"].min()
    accts = accts.rename(columns={"ts": "open_ts"})
    accts["kind"] = "normal"
    accts["mean_log_amt"] = np.log(5000)
    accts["activity"] = 1.0
    return out, accts


_BLOCK = re.compile(r"BEGIN LAUNDERING ATTEMPT - (.+?)(?::|$)")


def attach_ibm_patterns(tx: pd.DataFrame, patterns_path) -> pd.DataFrame:
    """Assign ring_id/family for IBM laundering rows from the *_Patterns.txt file."""
    if patterns_path is None or not Path(patterns_path).exists():
        return tx
    key_to_ring = {}
    ring_family = {}
    cur, k = None, 0
    with open(patterns_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("BEGIN"):
                m = _BLOCK.search(line)
                fam = (m.group(1).strip().lower().replace(" ", "_") if m else "ibm")
                cur = f"ibm_ring_{k}"
                ring_family[cur] = fam
                k += 1
            elif line.startswith("END"):
                cur = None
            elif cur and line:
                p = line.split(",")
                if len(p) >= 8:
                    try:
                        amt = f"{float(p[7]):.2f}"
                    except ValueError:
                        continue
                    key_to_ring[(p[1].strip().lstrip("0") or "0", p[2].strip(),
                                 p[3].strip().lstrip("0") or "0", p[4].strip(), amt)] = cur
    if not key_to_ring:
        return tx
    tx = tx.copy()
    keys = list(zip(tx.src_acct.str.split("_", n=1).str[1].str.split("x").str[0],
                    tx.src_acct.str.split("x").str[-1],
                    tx.dst_acct.str.split("_", n=1).str[1].str.split("x").str[0],
                    tx.dst_acct.str.split("x").str[-1],
                    tx.amount.map(lambda a: f"{a:.2f}")))
    rid = [key_to_ring.get(k5, "") for k5 in keys]
    tx["ring_id"] = np.where(tx.label == 1, rid, "")
    tx["family"] = [ring_family.get(r, f) for r, f in zip(tx.ring_id, tx.family)]
    return tx
