"""YAML config loading with environment-variable overrides.

Any leaf key can be overridden with ECO_<SECTION>__<KEY>=value (e.g. ECO_GRAPH__TAU_KM=3).
A ``.env`` file at the repo root is read if present (no external dependency).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = REPO_ROOT / "configs"
OUTPUTS_DIR = Path(os.environ.get("ECO_OUTPUTS_DIR", REPO_ROOT / "outputs"))


def load_dotenv(path: Path = REPO_ROOT / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _coerce(v: str) -> Any:
    low = v.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "none", ""):
        return None
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        return v


def _apply_env_overrides(cfg: dict, prefix: str = "ECO_") -> dict:
    for key, val in os.environ.items():
        if not key.startswith(prefix) or "__" not in key:
            continue
        section, leaf = key[len(prefix):].lower().split("__", 1)
        if section in cfg and isinstance(cfg[section], dict):
            cfg[section][leaf] = _coerce(val)
    return cfg


def load_config(name_or_path: str | Path) -> dict:
    """Load ``configs/<name>.yaml`` (or an explicit path) and apply overrides."""
    load_dotenv()
    p = Path(name_or_path)
    if not p.exists():
        p = CONFIG_DIR / (p.name if p.suffix else f"{p.name}.yaml")
    with p.open() as f:
        cfg = yaml.safe_load(f) or {}
    return _apply_env_overrides(cfg)


def load_study_areas() -> dict:
    return load_config("study_areas")["study_areas"]


def portable_path(p) -> str:
    """Path as stored in artefacts: relative to the repository when inside it (portable provenance,
    no machine-specific prefixes), absolute otherwise."""
    pp = Path(p).resolve()
    root = REPO_ROOT.resolve()
    return str(pp.relative_to(root)) if pp.is_relative_to(root) else str(pp)
