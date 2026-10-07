"""Config loading + global seeding. Every experiment is config-driven and seeded."""
from __future__ import annotations

import copy
import json
import os
import random
from pathlib import Path
from typing import Any

import numpy as np
import yaml

ML_ROOT = Path(__file__).resolve().parents[1]          # hacknation/ml
REPO_ROOT = ML_ROOT.parent                              # hacknation/
ARTIFACTS = ML_ROOT / "artifacts"
EXPERIMENTS = ML_ROOT / "experiments"


class Cfg(dict):
    """dict with attribute access (recursive)."""

    def __getattr__(self, k):
        try:
            v = self[k]
        except KeyError as e:
            raise AttributeError(k) from e
        return Cfg(v) if isinstance(v, dict) and not isinstance(v, Cfg) else v

    def __setattr__(self, k, v):
        self[k] = v


def _deep_update(base: dict, upd: dict) -> dict:
    for k, v in upd.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_update(base[k], v)
        else:
            base[k] = v
    return base


def load_config(path: str | os.PathLike | None = None, overrides: dict | None = None) -> Cfg:
    default = ML_ROOT / "configs" / "default.yaml"
    with open(default, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if path and Path(path).resolve() != default.resolve():
        with open(path, "r", encoding="utf-8") as f:
            _deep_update(cfg, yaml.safe_load(f) or {})
    if overrides:
        _deep_update(cfg, copy.deepcopy(overrides))
    return _wrap(cfg)


def _wrap(d):
    if isinstance(d, dict):
        return Cfg({k: _wrap(v) for k, v in d.items()})
    if isinstance(d, list):
        return [_wrap(x) for x in d]
    return d


def bank_ids(cfg) -> list[str]:
    return [b["id"] for b in cfg["banks"]]


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import torch

        torch.manual_seed(seed)
    except ImportError:
        pass


def save_json(obj: Any, path: str | os.PathLike) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=_json_default)


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)
