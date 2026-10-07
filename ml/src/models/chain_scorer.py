"""Model 3: Chain scorer — runs at the coordinator on alert records only.

The coordinator never sees raw transactions. It receives *alert records* from banks:
hashed account tokens, amount bucket, time, score, bank ID, reason codes.
This module links alerts into chains and scores candidate rings.
"""
from __future__ import annotations

from collections import defaultdict

import numpy as np
import pandas as pd


def alerts_from_scores(tx: pd.DataFrame, scores: np.ndarray, threshold: float,
                       banks: list[str]) -> pd.DataFrame:
    """Convert flagged edges to alert records the coordinator can see."""
    mask = scores >= threshold
    if not mask.any():
        return pd.DataFrame()
    a = tx[mask].copy()
    a["score"] = scores[mask]
    a["src_token"] = a["src_acct"].apply(lambda x: x[:6] + "…")
    a["dst_token"] = a["dst_acct"].apply(lambda x: x[:6] + "…")
    a["amount_bucket"] = pd.cut(a["amount"], [0, 10e3, 50e3, 1e5, 5e5, 1e6, np.inf],
                                labels=["0-10K", "10K-50K", "50K-1L", "1L-5L", "5L-10L", "10L+"])
    return a[["tx_id", "ts", "src_token", "dst_token", "src_bank", "dst_bank",
              "amount_bucket", "score", "src_acct", "dst_acct", "amount"]].reset_index(drop=True)


# ── Alert linking ──────────────────────────────────────────────

def link_alerts(alerts: pd.DataFrame, cfg) -> list[dict]:
    """Link alert A -> B when A.dst_token == B.src_token, plausible time, plausible amount."""
    if alerts.empty:
        return []
    c = cfg["models"]["chain_scorer"]
    max_dt = c["max_hop_delay_hours"] * 3600
    lo_ratio, hi_ratio = c["amount_ratio_min"], c["amount_ratio_max"]

    # build dst_token -> list of alert indices
    by_dst: dict[str, list[int]] = defaultdict(list)
    by_src: dict[str, list[int]] = defaultdict(list)
    ts = alerts["ts"].values.astype("datetime64[ns]").astype(np.int64) / 1e9
    amts = alerts["amount"].values.astype(float)
    src_tok = alerts["src_acct"].values
    dst_tok = alerts["dst_acct"].values

    for i in range(len(alerts)):
        by_src[src_tok[i]].append(i)
        by_dst[dst_tok[i]].append(i)

    # Flow edges: A.dst == B.src, 0 < dt < max_dt, structuring ratio in bounds
    flow_adj: dict[int, list[int]] = defaultdict(list)
    comp_adj: dict[int, set[int]] = defaultdict(set)

    # 1. Forward hop connections (A -> B)
    for token, dst_list in by_dst.items():
        src_list = by_src.get(token, [])
        for a in dst_list:
            for b in src_list:
                dt = ts[b] - ts[a]
                if 0 < dt < max_dt:
                    ratio = amts[b] / max(amts[a], 1.0)
                    # Support 1-to-1 hops, fan-out smurfing (ratio >= 0.04), and fan-in gathering (ratio <= 15.0)
                    if 0.04 <= ratio <= 15.0:
                        flow_adj[a].append(b)
                        comp_adj[a].add(b)
                        comp_adj[b].add(a)

    # 2. Co-source branches (fan-out from the same source node within time window)
    for token, src_list in by_src.items():
        if len(src_list) > 1:
            for a in src_list:
                for b in src_list:
                    if a != b and abs(ts[b] - ts[a]) < max_dt:
                        comp_adj[a].add(b)
                        comp_adj[b].add(a)

    # 3. Co-destination branches (fan-in into the same sink node within time window)
    for token, dst_list in by_dst.items():
        if len(dst_list) > 1:
            for a in dst_list:
                for b in dst_list:
                    if a != b and abs(ts[b] - ts[a]) < max_dt:
                        comp_adj[a].add(b)
                        comp_adj[b].add(a)

    # Connected components
    visited = set()
    chains = []
    for start in range(len(alerts)):
        if start in visited:
            continue
        component = set()
        queue = [start]
        while queue:
            n = queue.pop()
            if n in component:
                continue
            component.add(n)
            for nb in comp_adj.get(n, ()):
                if nb not in component:
                    queue.append(nb)
        visited.update(component)
        if len(component) >= cfg["models"]["chain_scorer"]["min_alerts_in_chain"]:
            chains.append(sorted(component))

    # score each chain
    results = []
    for comp in chains:
        idx = np.array(comp)
        chain_ts = ts[idx]
        chain_amt = amts[idx]
        chain_scores = alerts["score"].values[idx]
        # topology
        chain_src = set(src_tok[idx])
        chain_dst = set(dst_tok[idx])
        chain_banks = set(alerts["src_bank"].values[idx]) | set(alerts["dst_bank"].values[idx])
        # depth = longest path in DAG
        depth = _longest_path(flow_adj, comp)
        # amount conservation
        inflow = sum(amts[i] for i in comp if src_tok[i] not in chain_dst)
        outflow = sum(amts[i] for i in comp if dst_tok[i] not in chain_src)
        conservation = outflow / max(inflow, 1.0)
        # hop delays
        hop_delays = []
        for a in comp:
            for b in flow_adj.get(a, []):
                if b in comp:
                    hop_delays.append(ts[b] - ts[a])
        has_cycle = len(chain_src & chain_dst) > 0

        feats = {
            "n_alerts": len(comp),
            "n_banks": len(chain_banks),
            "depth": depth,
            "mean_edge_score": float(chain_scores.mean()),
            "min_edge_score": float(chain_scores.min()),
            "amount_conservation": float(np.clip(conservation, 0, 2)),
            "time_span_s": float(chain_ts.max() - chain_ts.min()),
            "median_hop_delay_s": float(np.median(hop_delays)) if hop_delays else 0.0,
            "has_cycle": int(has_cycle),
            "branching_factor": float(sum(len(flow_adj.get(i, [])) for i in comp) / max(len(comp), 1)),
        }
        # rule-based score
        score = _rule_score(feats, c)
        results.append({
            "chain_id": f"chain_{comp[0]}",
            "edge_ids": alerts["tx_id"].values[idx].tolist(),
            "edge_indices": comp,
            "features": feats,
            "score": score,
            "detected": score >= 0.5,
            "n_alerts": feats["n_alerts"],
            "n_banks": feats["n_banks"],
        })
    return results


def _longest_path(adj, nodes):
    memo = {}
    node_set = set(nodes)

    def dp(n):
        if n in memo:
            return memo[n]
        best = 0
        for nb in adj.get(n, []):
            if nb in node_set:
                best = max(best, 1 + dp(nb))
        memo[n] = best
        return best

    return max((dp(n) for n in nodes), default=0)


def _rule_score(f, c):
    s = 0.0
    if f["n_banks"] >= 2:
        s += 0.15
    if f["amount_conservation"] > 0.8:
        s += 0.2
    if f["median_hop_delay_s"] > 0 and f["median_hop_delay_s"] < 3600:
        s += 0.15
    if f["depth"] >= 2:
        s += 0.1
    if f["mean_edge_score"] > 0.7:
        s += 0.2
    if f["n_alerts"] >= 4:
        s += 0.1
    if f["has_cycle"]:
        s += 0.1
    return float(np.clip(s, 0, 1))


def chain_report(chains: list[dict]) -> dict:
    if not chains:
        return {"n_chains": 0}
    df = pd.DataFrame([{**c["features"], "score": c["score"], "detected": c["detected"]}
                        for c in chains])
    return {
        "n_chains": len(df),
        "n_detected": int(df.detected.sum()),
        "mean_score": float(df.score.mean()),
        "mean_depth": float(df.depth.mean()),
        "mean_banks": float(df.n_banks.mean()),
    }
