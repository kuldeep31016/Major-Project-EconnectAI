"""Request hardening shared by every router: path-parameter validation, path containment, login throttling."""
from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import HTTPException, Request

# Study-area ids, run ids and experiment ids are plain slugs (e.g. kerala-coast_20260920T182222Z).
_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_PATH_PARAMS = ("study_area", "run_id", "experiment_id", "object_type", "object_id")


def is_slug(value: str) -> bool:
    return bool(_SLUG.match(value)) and ".." not in value


def validate_path_params(request: Request) -> None:
    """App-level dependency: reject traversal attempts (``..``, ``/``, encoded separators) in id-like path params."""
    for key in _PATH_PARAMS:
        v = request.path_params.get(key)
        if isinstance(v, str) and not is_slug(v):
            raise HTTPException(400, f"invalid {key}")


def contained(path: Path, root: Path) -> Path:
    """Resolve ``path`` and require it to stay inside ``root``; 404 otherwise (never reveal what exists outside)."""
    p = path.resolve()
    if not p.is_relative_to(root.resolve()):
        raise HTTPException(404, "not found")
    return p


class LoginThrottle:
    """In-process sliding-window limit on failed logins per (client, username). Good enough for one API worker;
    a shared store (Redis) replaces it when the API scales out."""

    def __init__(self, max_failures: int = 10, window_s: float = 300.0):
        self.max_failures, self.window_s = max_failures, window_s
        self._fails: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _key(self, request: Request, username: str) -> str:
        return f"{request.client.host if request.client else '?'}|{username.lower()}"

    def _prune(self, q: deque, now: float) -> None:
        while q and now - q[0] > self.window_s:
            q.popleft()

    def check(self, request: Request, username: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._fails[self._key(request, username)]
            self._prune(q, now)
            if len(q) >= self.max_failures:
                raise HTTPException(429, "too many failed login attempts - try again later")

    def fail(self, request: Request, username: str) -> None:
        with self._lock:
            self._fails[self._key(request, username)].append(time.monotonic())

    def reset(self, request: Request, username: str) -> None:
        with self._lock:
            self._fails.pop(self._key(request, username), None)


login_throttle = LoginThrottle()
