"""Calibration (isotonic / Platt), ECE + reliability, and 3-band thresholds."""
from __future__ import annotations

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class Calibrator:
    """Serializable as a lookup table (x->y) so the edge needs only numpy."""

    def __init__(self, method: str = "isotonic"):
        self.method = method
        self.x = None
        self.y = None
        self.a = None
        self.b = None

    def fit(self, scores, labels):
        scores = np.asarray(scores, float)
        labels = np.asarray(labels, int)
        method = self.method
        if method == "isotonic" and labels.sum() < 200:
            method = "platt"           # too few positives for isotonic
        self.method = method
        if method == "isotonic":
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(scores, labels)
            self.x = iso.X_thresholds_.astype(float)
            self.y = iso.y_thresholds_.astype(float)
        else:
            lg = LogisticRegression(C=1e4).fit(_logit(scores).reshape(-1, 1), labels)
            self.a, self.b = float(lg.coef_[0, 0]), float(lg.intercept_[0])
        return self

    def transform(self, scores):
        scores = np.asarray(scores, float)
        if self.method == "isotonic":
            return np.interp(scores, self.x, self.y)
        return 1.0 / (1.0 + np.exp(-(self.a * _logit(scores) + self.b)))

    def to_dict(self):
        return {"method": self.method, "x": None if self.x is None else self.x.tolist(),
                "y": None if self.y is None else self.y.tolist(), "a": self.a, "b": self.b}

    @staticmethod
    def from_dict(d):
        c = Calibrator(d["method"])
        c.x = None if d.get("x") is None else np.asarray(d["x"])
        c.y = None if d.get("y") is None else np.asarray(d["y"])
        c.a, c.b = d.get("a"), d.get("b")
        return c


def _logit(p):
    p = np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def reliability(probs, labels, n_bins: int = 10):
    probs, labels = np.asarray(probs), np.asarray(labels)
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(probs, bins) - 1, 0, n_bins - 1)
    rows, ece = [], 0.0
    for b in range(n_bins):
        m = idx == b
        if not m.any():
            continue
        conf, acc = probs[m].mean(), labels[m].mean()
        ece += m.mean() * abs(conf - acc)
        rows.append({"bin": b, "conf": float(conf), "acc": float(acc), "n": int(m.sum())})
    return {"ece": float(ece), "bins": rows}


def choose_thresholds(probs, labels, target_fpr_high=0.001, hold_budget_rate=0.01):
    """t_high: block at target FPR on benign. t_low: hold queue <= budget share of traffic."""
    probs, labels = np.asarray(probs), np.asarray(labels)
    neg = np.sort(probs[labels == 0])
    t_high = float(np.quantile(neg, 1 - target_fpr_high)) if len(neg) else 0.9
    t_low = float(np.quantile(probs, 1 - hold_budget_rate))
    t_low = min(t_low, t_high)
    t_high = max(t_high, t_low + 1e-6)
    return {"t_low": t_low, "t_high": t_high}


def band(score, th):
    if score >= th["t_high"]:
        return "block"
    if score >= th["t_low"]:
        return "hold"
    return "pass"


def bands(scores, th):
    s = np.asarray(scores)
    return np.where(s >= th["t_high"], 2, np.where(s >= th["t_low"], 1, 0))
