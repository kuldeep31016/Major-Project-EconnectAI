"""Request IDs, structured JSON logs and lightweight in-process metrics (Phase 7).

Every request gets an ``X-Request-ID`` (the caller's, if it sent a sane one, else a new one) that is echoed in the
response and attached to each log line. Metrics are kept per route template in memory - enough for a single API
instance and the admin health page; a multi-instance deployment would export them to its platform's metrics
service instead (the numbers here reset on restart and say so).
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from collections import defaultdict, deque
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

request_id: ContextVar[str] = ContextVar("request_id", default="-")
_RID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
STARTED = time.time()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + "Z", "level": record.levelname,
               "logger": record.name, "msg": record.getMessage(), "request_id": request_id.get()}
        for k in ("method", "path", "status", "ms", "route", "job_id", "user"):
            if hasattr(record, k):
                out[k] = getattr(record, k)
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)[-2000:]
        return json.dumps(out, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> logging.Logger:
    log = logging.getLogger("ecoconnect")
    if not any(isinstance(h.formatter, JsonFormatter) for h in log.handlers):
        h = logging.StreamHandler()
        h.setFormatter(JsonFormatter())
        log.addHandler(h)
        log.setLevel(level)
        log.propagate = False
    return log


class Metrics:
    """Per-route request counts, 5xx counts and a rolling window of latencies (last 500 per route)."""

    def __init__(self):
        self._lock = threading.Lock()
        self.count: dict[str, int] = defaultdict(int)
        self.errors: dict[str, int] = defaultdict(int)
        self.lat: dict[str, deque] = defaultdict(lambda: deque(maxlen=500))
        self.recent_errors: deque = deque(maxlen=50)

    def record(self, route: str, status: int, ms: float, rid: str) -> None:
        with self._lock:
            self.count[route] += 1
            self.lat[route].append(ms)
            if status >= 500:
                self.errors[route] += 1
                self.recent_errors.append({"route": route, "status": status, "request_id": rid,
                                           "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})

    def snapshot(self) -> dict:
        def pct(v: list, q: float) -> float:
            if not v:
                return 0.0
            s = sorted(v)
            return round(s[min(len(s) - 1, int(q * len(s)))], 1)
        with self._lock:
            routes = [{"route": r, "requests": n, "errors_5xx": self.errors.get(r, 0),
                       "p50_ms": pct(list(self.lat[r]), 0.5), "p95_ms": pct(list(self.lat[r]), 0.95)}
                      for r, n in self.count.items()]
            return {"uptime_s": round(time.time() - STARTED), "since_restart_only": True,
                    "total_requests": sum(self.count.values()), "total_5xx": sum(self.errors.values()),
                    "routes": sorted(routes, key=lambda x: -x["requests"])[:40], "recent_errors": list(self.recent_errors)}


METRICS = Metrics()
log = configure_logging()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("X-Request-ID", "")
        rid = incoming if _RID.match(incoming) else uuid.uuid4().hex[:16]
        token = request_id.set(rid)
        t0 = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = rid
            return response
        except Exception:
            log.exception("unhandled error", extra={"method": request.method, "path": request.url.path})
            raise
        finally:
            ms = (time.perf_counter() - t0) * 1000
            route = getattr(request.scope.get("route"), "path", None) or "unmatched"
            METRICS.record(f"{request.method} {route}", status, ms, rid)
            if status >= 500 or ms > 5000:
                log.warning("slow or failed request", extra={"method": request.method, "path": request.url.path,
                                                             "route": route, "status": status, "ms": round(ms, 1)})
            request_id.reset(token)
