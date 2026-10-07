"""Serving layer: exposes ML models to the edge-node and backend.

- `EdgeScorer`: loads ONNX risk scorer + calibrator → single-tx scoring in <5ms
- `CoordinatorScorer`: runs chain scorer on alert batches
- `detect_attack`: end-to-end attack simulation → returns full detection report
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from ..calibration import Calibrator, band, bands
from ..config import ARTIFACTS, ML_ROOT, bank_ids, load_config
from ..features.tabular import FEATURES, FeatureState, acct_open_map
from ..models.chain_scorer import alerts_from_scores, chain_report, link_alerts
from ..models.risk_scorer import onnx_predict, onnx_session
from ..schema import FMT_CODE, conform


class EdgeScorer:
    """Per-bank edge scorer. Loads ONNX model + calibrator + thresholds."""

    def __init__(self, bank: str, onnx_path=None, calibrator_path=None, thresholds_path=None):
        self.bank = bank
        onnx_path = onnx_path or ARTIFACTS / "risk_scorer.onnx"
        self.sess = onnx_session(str(onnx_path))
        cal_path = calibrator_path or (ML_ROOT / "experiments" / "calibrator.json")
        th_path = thresholds_path or (ML_ROOT / "experiments" / "thresholds.json")
        if Path(cal_path).exists():
            with open(cal_path) as f:
                self.calibrator = Calibrator.from_dict(json.load(f))
        else:
            self.calibrator = None
        if Path(th_path).exists():
            with open(th_path) as f:
                self.thresholds = json.load(f)
        else:
            self.thresholds = {"t_low": 0.5, "t_high": 0.8}
        self.state = FeatureState(bank)

    def score_transaction(self, ts_epoch: float, src_acct: str, dst_acct: str,
                          src_bank: str, dst_bank: str, amount: float, fmt: str) -> dict:
        """Score a single transaction. Returns score, band, reason."""
        hour = int((ts_epoch % 86400) / 3600)
        weekday = pd.Timestamp(ts_epoch, unit="s").weekday()
        feats = self.state.process(ts_epoch, src_acct, dst_acct, src_bank, dst_bank,
                                   amount, fmt, hour, weekday, update=True)
        X = np.array([feats], dtype=np.float32)
        raw = float(onnx_predict(self.sess, X)[0])
        cal = float(self.calibrator.transform(np.array([raw]))[0]) if self.calibrator else raw
        b = band(cal, self.thresholds)
        return {"raw_score": raw, "calibrated_score": cal, "band": b,
                "threshold_low": self.thresholds["t_low"], "threshold_high": self.thresholds["t_high"]}

    def score_batch(self, tx: pd.DataFrame) -> pd.DataFrame:
        """Score a batch of transactions (must be time-sorted)."""
        from ..features.tabular import featurize_stream
        X = featurize_stream(tx, self.state)
        raw = onnx_predict(self.sess, X)
        cal = self.calibrator.transform(raw) if self.calibrator else raw
        tx = tx.copy()
        tx["raw_score"] = raw
        tx["calibrated_score"] = cal
        tx["band"] = [band(s, self.thresholds) for s in cal]
        return tx


class CoordinatorScorer:
    """Runs at the coordinator: links alerts into chains and scores them."""

    def __init__(self, cfg=None):
        self.cfg = cfg or load_config()

    def process_alerts(self, alerts: pd.DataFrame) -> list[dict]:
        return link_alerts(alerts, self.cfg)


def detect_attack(attack_tx: pd.DataFrame, cfg=None, onnx_path=None) -> dict:
    """End-to-end: score attack transactions → flag → link chains → report.

    This is what the backend calls during attack simulation.
    """
    cfg = cfg or load_config()
    banks = bank_ids(cfg)
    attack_tx = conform(attack_tx).sort_values("ts").reset_index(drop=True)

    # Score per bank
    from ..features.tabular import compute_bank_features
    feats = compute_bank_features(attack_tx, banks, pd.DataFrame(columns=["acct_id", "bank", "open_ts"]))
    X = feats[FEATURES].values.astype(np.float32)
    # handle NaNs from external-only edges
    X = np.nan_to_num(X, 0.0)

    onnx_path = onnx_path or ARTIFACTS / "risk_scorer.onnx"
    if not Path(onnx_path).exists():
        return {"error": f"ONNX model not found at {onnx_path}. Run the pipeline first."}
    sess = onnx_session(str(onnx_path))
    scores = onnx_predict(sess, X)

    # Calibrate if available
    cal_files = sorted((ML_ROOT / "experiments").glob("*/calibrator.json"))
    if cal_files:
        with open(cal_files[-1]) as f:
            cal = Calibrator.from_dict(json.load(f))
        scores = cal.transform(scores)

    th_files = sorted((ML_ROOT / "experiments").glob("*/thresholds.json"))
    if th_files:
        with open(th_files[-1]) as f:
            th = json.load(f)
    else:
        th = {"t_low": 0.5, "t_high": 0.8}

    flagged = scores >= th["t_low"]
    blocked = scores >= th["t_high"]

    # Chain scoring
    alerts = alerts_from_scores(attack_tx, scores, th["t_low"], banks)
    chains = link_alerts(alerts, cfg) if not alerts.empty else []

    # Build per-tx results
    tx_results = []
    for i, row in attack_tx.iterrows():
        tx_results.append({
            "tx_id": row.tx_id, "src_acct": row.src_acct, "dst_acct": row.dst_acct,
            "amount": float(row.amount), "score": float(scores[i]),
            "flagged": bool(flagged[i]), "blocked": bool(blocked[i]),
            "band": "block" if blocked[i] else ("hold" if flagged[i] else "pass"),
        })

    return {
        "n_transactions": len(attack_tx),
        "n_flagged": int(flagged.sum()),
        "n_blocked": int(blocked.sum()),
        "detection_rate": float(flagged.mean()),
        "block_rate": float(blocked.mean()),
        "n_chains": len(chains),
        "chains": [{k: v for k, v in c.items() if k != "edge_indices"} for c in chains],
        "transactions": tx_results,
        "thresholds": th,
    }
