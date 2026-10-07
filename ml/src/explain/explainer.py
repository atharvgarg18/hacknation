"""Explainer: SHAP for tree model, GNNExplainer for graph model, template-based reason codes.

SHAP on 1 row is fast for trees (native TreeSHAP). If too slow for the hot path,
run asynchronously — the score returns in ms and the reason attaches a moment later.
"""
from __future__ import annotations

import numpy as np

from ..features.tabular import FEATURES


# ── Tree model → native TreeSHAP (built into LightGBM) ─────────

def shap_explain(model, X_row: np.ndarray, top_k: int = 3) -> list[dict]:
    """Top-k SHAP features for one row (uses LightGBM's native pred_contrib)."""
    from ..models.risk_scorer import contributions

    sv = contributions(model, X_row.reshape(1, -1))[0]
    # sv has F+1 entries; last is bias
    vals = sv[:-1]
    idx = np.argsort(-np.abs(vals))[:top_k]
    return [{"feature": FEATURES[i], "shap_value": float(vals[i]),
             "direction": "up" if vals[i] > 0 else "down"} for i in idx]


# ── Graph model → GNNExplainer (PyG) ──────────────────────────

def gnn_explain(model, data, edge_idx: int, epochs: int = 100):
    """Run GNNExplainer on one edge in a snapshot. Returns top-k neighbor edge indices."""
    try:
        from torch_geometric.explain import Explainer, GNNExplainer as _GNNExp
    except ImportError:
        return {"error": "torch_geometric.explain not available"}
    explainer = Explainer(
        model=model,
        algorithm=_GNNExp(epochs=epochs),
        explanation_type="model",
        edge_mask_type="object",
        node_mask_type="attributes",
        model_config=dict(mode="binary_classification", task_level="edge", return_type="raw"),
    )
    exp = explainer(data.x, data.edge_index, edge_attr=data.edge_attr, index=edge_idx)
    mask = exp.edge_mask.detach().cpu().numpy() if hasattr(exp, "edge_mask") and exp.edge_mask is not None else None
    if mask is None:
        return {"top_edges": [], "note": "no edge mask returned"}
    top = np.argsort(-mask)[:5]
    return {"top_edges": top.tolist(), "edge_weights": mask[top].tolist()}


# ── Template-based reason codes ────────────────────────────────

TEMPLATES = {
    "fanout": "{n} new accounts received funds within {mins} minutes and forwarded {pct:.0f}%.",
    "new_payee_large": "First payment to this payee, {mult:.1f}x larger than your usual transfer.",
    "rapid_passthrough": "Receiving account forwarded {pct:.0f}% of funds within {mins} minutes.",
    "velocity": "{n} transfers in the last hour vs a typical {typ}.",
    "cross_bank_new": "Cross-bank transfer to a {age_d}-day-old account.",
    "round_amount": "Round-number amount ₹{amt:,.0f} to a new payee.",
    "high_score": "Combined risk score {score:.0f}/100 based on multiple indicators.",
}


def reason_codes(shap_top: list[dict], score: float, tx_meta: dict | None = None) -> list[str]:
    """Map SHAP features + transaction context to human-readable templates."""
    codes = []
    meta = tx_meta or {}
    for s in shap_top:
        feat = s["feature"]
        if s["direction"] != "up":
            continue
        if "new_payee" in feat:
            mult = meta.get("amt_ratio_src_mean", 1.0)
            codes.append(TEMPLATES["new_payee_large"].format(mult=mult))
        elif "passthrough" in feat:
            codes.append(TEMPLATES["rapid_passthrough"].format(pct=meta.get("pt_pct", 90), mins=meta.get("pt_mins", 5)))
        elif "out_cnt" in feat and "1h" in feat:
            codes.append(TEMPLATES["velocity"].format(n=meta.get("out_cnt_1h", "many"), typ=meta.get("typical", "2-3")))
        elif "cross_bank" in feat or "new_dst_bank" in feat:
            codes.append(TEMPLATES["cross_bank_new"].format(age_d=meta.get("dst_age_d", "unknown")))
    if not codes:
        codes.append(TEMPLATES["high_score"].format(score=score * 100))
    return codes


def fidelity_test(model, X_row: np.ndarray, top_k: int = 3) -> dict:
    """Remove top-SHAP features and check score drops. If it doesn't, explanation isn't faithful."""
    from ..models.risk_scorer import contributions, predict

    sv = contributions(model, X_row.reshape(1, -1))[0]
    vals = sv[:-1]
    idx = np.argsort(-np.abs(vals))[:top_k]
    baseline = predict(model, X_row.reshape(1, -1))[0]
    perturbed = X_row.copy()
    perturbed[idx] = 0.0  # zero out top features
    new_score = predict(model, perturbed.reshape(1, -1))[0]
    drop = float(baseline - new_score)
    return {"baseline": float(baseline), "perturbed": float(new_score), "drop": drop,
            "faithful": drop > 0.05, "zeroed_features": [FEATURES[i] for i in idx]}
