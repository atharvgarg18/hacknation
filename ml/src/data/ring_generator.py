"""Seeded laundering-ring generator with ground truth.

Families
--------
A fanout_chain    source -> W parallel mule chains -> sink   (W=1 => plain chain)
B cycle           source -> mules -> ... -> back to source
C scatter_gather  source -> N mules -> gather -> (chain) -> sink
D layered         source -> random bipartite layers -> sink, randomized timing
                  (HELD OUT: never used in training / replay)
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from ..schema import EXTERNAL_BANK, channel_for_amount, conform

TOPOLOGIES = ["fanout_chain", "cycle", "scatter_gather", "layered"]


@dataclass
class RingParams:
    topology: str = "fanout_chain"
    n_hops: int = 4                       # path length source -> sink
    n_mules: int = 6
    split_ratio: Optional[tuple] = None   # None => Dirichlet(alpha=split_alpha)
    total_amount: float = 1_000_000.0
    time_gap_s: tuple = (60, 1800)        # delay between hops
    cross_bank_prob: float = 0.6
    mule_age_days: tuple = (0, 30)
    pass_through_frac: float = 0.95
    seed: int = 0
    banks: tuple = ("axis", "icici", "hdfc")
    sink_ext_prob: float = 0.2
    split_alpha: float = 3.0
    warmup: bool = True

    def to_dict(self):
        return asdict(self)


@dataclass
class RingResult:
    ring_id: str
    family: str
    transactions: pd.DataFrame
    accounts: pd.DataFrame                # mule/source/sink accounts
    warmup: pd.DataFrame                  # benign-looking pre-activity of mules (label 0)
    ground_truth_edges: list = field(default_factory=list)   # tx_ids
    ground_truth_nodes: list = field(default_factory=list)   # acct_ids
    mule_nodes: list = field(default_factory=list)
    per_hop_timestamps: dict = field(default_factory=dict)
    params: dict = field(default_factory=dict)


def _ring_hash(p: RingParams) -> str:
    return hashlib.sha1(f"{p.topology}-{p.seed}-{p.n_hops}-{p.n_mules}".encode()).hexdigest()[:6]


def _build_structure(p: RingParams, rng) -> tuple[list[list[str]], list[tuple[str, str]], dict]:
    """Return layers (list of node-name lists) and directed edges between node names.
    Node 'S' = source, 'T' = sink, 'S*' = source receiving funds back (cycle)."""
    h = max(2, int(p.n_hops))
    m = max(1, int(p.n_mules))
    edges: list[tuple[str, str]] = []
    alias: dict[str, str] = {}
    if p.topology == "fanout_chain":
        length = h - 1
        width = max(1, m // length)
        for w in range(width):
            prev = "S"
            for k in range(length):
                nm = f"M{w}_{k}"
                edges.append((prev, nm))
                prev = nm
            edges.append((prev, "T"))
    elif p.topology == "cycle":
        length = h - 1
        width = max(1, m // length)
        for w in range(width):
            prev = "S"
            for k in range(length):
                nm = f"M{w}_{k}"
                edges.append((prev, nm))
                prev = nm
            edges.append((prev, "S*"))
        alias["S*"] = "S"
    elif p.topology == "scatter_gather":
        for i in range(m):
            edges.append(("S", f"M{i}"))
            edges.append((f"M{i}", "G"))
        edges.append(("G", "T"))
    elif p.topology == "layered":
        L = h - 1
        sizes = np.maximum(1, rng.multinomial(max(m - L, 0), [1 / L] * L) + 1)
        layers = [[f"L{i}_{j}" for j in range(sizes[i])] for i in range(L)]
        for nm in layers[0]:
            edges.append(("S", nm))
        for i in range(L - 1):
            nxt = layers[i + 1]
            covered = set()
            for nm in layers[i]:
                k = int(rng.integers(1, min(3, len(nxt)) + 1))
                for d in rng.choice(nxt, k, replace=False):
                    edges.append((nm, str(d)))
                    covered.add(str(d))
            for d in nxt:                     # every node must receive something
                if d not in covered:
                    edges.append((str(rng.choice(layers[i])), d))
        for nm in layers[-1]:
            edges.append((nm, "T"))
    else:
        raise ValueError(f"unknown topology {p.topology}")
    return edges, alias


def generate_ring(p: RingParams, start_ts: pd.Timestamp,
                  warmup_pool: Optional[pd.DataFrame] = None) -> RingResult:
    rng = np.random.default_rng(p.seed)
    edges, alias = _build_structure(p, rng)
    rid = f"ring_{p.topology}_{p.seed}_{_ring_hash(p)}"
    banks = list(p.banks)

    # adjacency + topo order (structure is a DAG once S* is treated separately)
    outs: dict[str, list[str]] = {}
    indeg: dict[str, int] = {}
    nodes = set()
    for a, b in edges:
        outs.setdefault(a, []).append(b)
        indeg[b] = indeg.get(b, 0) + 1
        nodes.update([a, b])
    order, queue = [], [n for n in nodes if indeg.get(n, 0) == 0]
    while queue:
        n = queue.pop(0)
        order.append(n)
        for d in outs.get(n, []):
            indeg[d] -= 1
            if indeg[d] == 0:
                queue.append(d)

    # banks: children inherit parent bank unless crossing
    bank_of: dict[str, str] = {"S": str(rng.choice(banks))}
    for n in order:
        for d in outs.get(n, []):
            if d in bank_of or d in alias:
                continue
            if d == "T" and rng.random() < p.sink_ext_prob:
                bank_of[d] = EXTERNAL_BANK
            elif rng.random() < p.cross_bank_prob and len(banks) > 1:
                bank_of[d] = str(rng.choice([b for b in banks if b != bank_of[n]]))
            else:
                bank_of[d] = bank_of[n]
    acct_of = {}
    tag = _ring_hash(p)
    acc_rows = []
    for n in order:
        if n in alias:
            continue
        b = bank_of[n]
        aid = f"{b}_r{tag}{p.seed % 100000:05d}_{n}"
        acct_of[n] = aid
        if n == "S":
            age = int(rng.integers(200, 2000))
            kind = "ring_source"
        elif n == "T":
            age = int(rng.integers(30, 1000))
            kind = "ring_sink"
        elif n == "G":
            age = int(rng.integers(60, 500))
            kind = "collector"
        else:
            age = int(rng.integers(p.mule_age_days[0], max(p.mule_age_days[0] + 1, p.mule_age_days[1] + 1)))
            kind = "mule"
        acc_rows.append((aid, b, start_ts - pd.Timedelta(days=age), kind))
    for a, real in alias.items():
        acct_of[a] = acct_of[real]

    # money flow
    amt_in = {n: 0.0 for n in nodes}
    ready = {n: start_ts for n in nodes}
    depth = {"S": 0}
    amt_in["S"] = float(p.total_amount)
    rows = []
    lo, hi = float(p.time_gap_s[0]), float(max(p.time_gap_s[1], p.time_gap_s[0] + 1))

    if p.topology == "scatter_gather":
        mules = [n for n in order if n.startswith("M")]
        m_count = len(mules)

        # Stage 1: Fan-out from Starting Node S to intermediate mules below reporting thresholds
        w = rng.dirichlet([22.0] * m_count)
        s_amts = [round(float(p.total_amount * wi), 2) for wi in w]
        s_amts[-1] = round(float(p.total_amount - sum(s_amts[:-1])), 2)

        m_in_ts = {}
        for i, m_node in enumerate(mules):
            # Sequential fan-out bursts (15-30 seconds apart)
            t_out = start_ts + pd.Timedelta(seconds=15 + i * int(rng.integers(15, 30)))
            amt_out = s_amts[i]
            rows.append((t_out, bank_of["S"], acct_of["S"], bank_of[m_node], acct_of[m_node], amt_out, 0))
            amt_in[m_node] = amt_out

            # Stage 2: Rapid pass-through fan-in from M_i to single Gatherer G (hold 2-10 min)
            hold_sec = float(rng.uniform(120, 600))
            t_in = t_out + pd.Timedelta(seconds=hold_sec)
            m_in_ts[m_node] = t_in

            # Mule pass-through (95-98%)
            mule_cut = float(rng.uniform(0.95, 0.98))
            amt_in_g = round(float(amt_out * mule_cut), 2)
            rows.append((t_in, bank_of[m_node], acct_of[m_node], bank_of["G"], acct_of["G"], amt_in_g, 1))
            amt_in["G"] += amt_in_g

        # Stage 3: Convergence & Final Laundering hop from Collector G to Final Sink T
        # Aggregated within 15 minutes, executed 2-4 minutes after last mule transfer
        t_final = max(m_in_ts.values()) + pd.Timedelta(seconds=float(rng.uniform(120, 240)))
        final_amt = round(float(amt_in["G"] * rng.uniform(0.97, 0.99)), 2)
        rows.append((t_final, bank_of["G"], acct_of["G"], bank_of["T"], acct_of["T"], final_amt, 2))
        amt_in["T"] = final_amt
    else:
        for n in order:
            ds = outs.get(n, [])
            if not ds:
                continue
            avail = amt_in[n] * (1.0 if n == "S" else p.pass_through_frac)
            if p.split_ratio is not None and len(p.split_ratio) == len(ds):
                w = np.asarray(p.split_ratio, float)
                w = w / w.sum()
            else:
                w = rng.dirichlet([p.split_alpha] * len(ds))
            for d, wi in zip(ds, w):
                if p.topology == "layered":
                    gap = float(rng.exponential((lo + hi) / 2))
                else:
                    gap = float(rng.uniform(lo, hi))
                t = ready[n] + pd.Timedelta(seconds=gap)
                a = round(float(avail * wi * rng.uniform(0.985, 1.0)), 2)
                rows.append((t, bank_of[n], acct_of[n], bank_of.get(d, bank_of.get(alias.get(d, ""), "")),
                             acct_of[d], a, depth.get(n, 0)))
                amt_in[d] += a
                ready[d] = max(ready[d], t)
                depth[d] = max(depth.get(d, 0), depth.get(n, 0) + 1)

    tx = pd.DataFrame(rows, columns=["ts", "src_bank", "src_acct", "dst_bank", "dst_acct", "amount", "hop"])
    tx = tx.sort_values("ts").reset_index(drop=True)
    tx["tx_id"] = [f"{rid}_e{i}" for i in range(len(tx))]
    tx["fmt"] = [channel_for_amount(a, rng) for a in tx["amount"].values]
    tx["label"] = 1
    tx["ring_id"] = rid
    tx["family"] = p.topology
    tx = conform(tx)

    accounts = pd.DataFrame(acc_rows, columns=["acct_id", "bank", "open_ts", "kind"])
    accounts["mean_log_amt"] = np.log(5000)
    accounts["activity"] = 0.2

    # mule warm-up: a few small round-number credits from unrelated accounts
    warm_rows = []
    if p.warmup and warmup_pool is not None and len(warmup_pool):
        for _, r in accounts[accounts.kind == "mule"].iterrows():
            lo_t = r.open_ts
            if lo_t >= start_ts - pd.Timedelta(hours=2):
                continue
            span = (start_ts - lo_t).total_seconds()
            for _ in range(int(rng.integers(1, 5))):
                src = warmup_pool.iloc[int(rng.integers(len(warmup_pool)))]
                t = lo_t + pd.Timedelta(seconds=float(rng.uniform(0, span * 0.6)))
                warm_rows.append((t, src.bank, src.acct_id, r.bank, r.acct_id,
                                  float(rng.choice([500, 1000, 2000, 5000]))))
    warm = pd.DataFrame(warm_rows, columns=["ts", "src_bank", "src_acct", "dst_bank", "dst_acct", "amount"])
    if len(warm):
        warm["fmt"] = "UPI"
        warm["tx_id"] = [f"{rid}_w{i}" for i in range(len(warm))]
    warm = conform(warm)

    hop_ts = tx.groupby("hop")["ts"].min().to_dict()
    return RingResult(
        ring_id=rid, family=p.topology, transactions=tx, accounts=accounts, warmup=warm,
        ground_truth_edges=tx["tx_id"].tolist(),
        ground_truth_nodes=sorted(set(acct_of.values())),
        mule_nodes=accounts.loc[accounts.kind == "mule", "acct_id"].tolist(),
        per_hop_timestamps={int(k): v for k, v in hop_ts.items()},
        params=p.to_dict(),
    )


def random_params(family: str, seed: int, banks, rng=None) -> RingParams:
    """Sample a realistic ring of a given family (used for train/test/held-out sets)."""
    rng = rng or np.random.default_rng(seed)
    hops = int(rng.integers(2 if family == "scatter_gather" else 3, 7))
    gmin = int(rng.integers(30, 900))
    return RingParams(
        topology=family,
        n_hops=hops,
        n_mules=int(rng.integers(3, 16)),
        total_amount=float(np.exp(rng.uniform(np.log(2e5), np.log(5e6)))),
        time_gap_s=(gmin, gmin + int(rng.integers(300, 7200 if family != "layered" else 30000))),
        cross_bank_prob=float(rng.uniform(0.3, 0.9)),
        mule_age_days=(0, int(rng.integers(5, 90))),
        pass_through_frac=float(rng.uniform(0.85, 0.99)),
        seed=int(seed),
        banks=tuple(banks),
    )
