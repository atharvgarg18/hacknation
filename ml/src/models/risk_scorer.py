"""Model 1: fast edge risk scorer (LightGBM -> ONNX)."""
from __future__ import annotations

import time
from pathlib import Path

import lightgbm as lgb
import numpy as np

from ..features.tabular import FEATURES


def train_risk_scorer(Xtr, ytr, Xva, yva, cfg, seed=42, scale_pos=False, init_model=None,
                      num_boost_round=None):
    c = cfg["models"]["risk_scorer"]
    params = dict(objective="binary", learning_rate=c["learning_rate"], num_leaves=c["num_leaves"],
                  min_data_in_leaf=c["min_data_in_leaf"], feature_fraction=c["feature_fraction"],
                  bagging_fraction=c["bagging_fraction"], bagging_freq=1, verbose=-1, seed=seed,
                  num_threads=0, deterministic=True, force_col_wise=True)
    if scale_pos:
        pos = max(1, int(np.sum(ytr)))
        params["scale_pos_weight"] = float(np.sqrt((len(ytr) - pos) / pos))
    dtr = lgb.Dataset(np.asarray(Xtr, np.float32), np.asarray(ytr), feature_name=FEATURES,
                      categorical_feature=["fmt_code"], free_raw_data=False)
    dva = lgb.Dataset(np.asarray(Xva, np.float32), np.asarray(yva), reference=dtr)
    model = lgb.train(params, dtr, num_boost_round or c["n_estimators"], valid_sets=[dva],
                      init_model=init_model,
                      callbacks=[lgb.early_stopping(c["early_stopping_rounds"], verbose=False)])
    return model


def predict(model, X) -> np.ndarray:
    return model.predict(np.asarray(X, np.float32), num_iteration=model.best_iteration or None)


def contributions(model, X) -> np.ndarray:
    """Exact TreeSHAP contributions (LightGBM native) -> [n, F+1] (last col = bias)."""
    return model.predict(np.asarray(X, np.float32), pred_contrib=True,
                         num_iteration=model.best_iteration or None)


def export_onnx(model, path) -> Path:
    from onnxmltools import convert_lightgbm
    from onnxmltools.convert.common.data_types import FloatTensorType

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # trim to best iteration so ONNX == native predict
    booster = model
    if model.best_iteration:
        booster = lgb.Booster(model_str=model.model_to_string(num_iteration=model.best_iteration))
    onx = convert_lightgbm(booster, initial_types=[("X", FloatTensorType([None, len(FEATURES)]))],
                           zipmap=False, target_opset=15)
    path.write_bytes(onx.SerializeToString())
    return path


def onnx_session(path, threads=1):
    import onnxruntime as ort

    so = ort.SessionOptions()
    so.intra_op_num_threads = threads
    so.inter_op_num_threads = 1
    return ort.InferenceSession(str(path), sess_options=so, providers=["CPUExecutionProvider"])


def onnx_predict(sess, X) -> np.ndarray:
    out = sess.run(None, {"X": np.asarray(X, np.float32)})
    probs = out[1]
    return np.asarray(probs)[:, 1]


def parity_check(model, sess, X, tol=1e-5) -> dict:
    a = predict(model, X)
    b = onnx_predict(sess, X)
    diff = float(np.max(np.abs(a - b)))
    return {"max_abs_diff": diff, "ok": diff <= tol, "n": int(len(X))}


def latency_benchmark(sess, X, n_single=5000, batch=256, n_batch=200) -> dict:
    X = np.asarray(X, np.float32)
    x1 = X[:1]
    for _ in range(200):
        sess.run(None, {"X": x1})
    lat = np.empty(n_single)
    for i in range(n_single):
        t = time.perf_counter()
        sess.run(None, {"X": X[i % len(X): i % len(X) + 1]})
        lat[i] = time.perf_counter() - t
    xb = X[:batch] if len(X) >= batch else np.repeat(X, batch // len(X) + 1, 0)[:batch]
    bl = np.empty(n_batch)
    for i in range(n_batch):
        t = time.perf_counter()
        sess.run(None, {"X": xb})
        bl[i] = time.perf_counter() - t
    p = np.percentile(lat, [50, 95, 99]) * 1000
    return {"single_p50_ms": float(p[0]), "single_p95_ms": float(p[1]), "single_p99_ms": float(p[2]),
            "single_throughput_tps": float(1.0 / lat.mean()),
            "batch_size": batch, "batch_p50_ms": float(np.percentile(bl, 50) * 1000),
            "batch_throughput_tps": float(batch / bl.mean()), "threads": 1}
