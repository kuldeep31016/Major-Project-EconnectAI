"""Reproducibility fingerprints recorded in every run manifest and training record."""
from __future__ import annotations

import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Optional

from .config import REPO_ROOT


@lru_cache(maxsize=1)
def code_version() -> dict:
    """Git commit of the code that produced a result (None outside a git checkout, e.g. a Docker image)."""
    def git(*args: str) -> Optional[str]:
        try:
            r = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
            return r.stdout.strip() if r.returncode == 0 else None
        except (OSError, subprocess.SubprocessError):
            return None
    commit = git("rev-parse", "HEAD")
    dirty = git("status", "--porcelain", "--untracked-files=no")
    return {"git_commit": commit, "git_dirty": bool(dirty) if dirty is not None else None}


def config_sha256(cfg: dict) -> str:
    """Hash of the canonical JSON of a configuration (key order independent)."""
    return hashlib.sha256(json.dumps(cfg, sort_keys=True, default=str).encode()).hexdigest()


def file_sha256(path: str | Path | None, chunk: int = 1 << 20) -> Optional[str]:
    if not path:
        return None
    p = Path(path)
    if not p.is_absolute():
        p = REPO_ROOT / p
    if not p.is_file():
        return None
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()
