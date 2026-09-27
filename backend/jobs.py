"""Database-backed job queue: QUEUED -> RUNNING -> COMPLETED | FAILED (| CANCELLED).

No Redis needed: workers claim jobs with a conditional UPDATE (``WHERE status='QUEUED'``), which is atomic on
SQLite and PostgreSQL alike, so several workers can share one database. Development runs an inline worker
thread inside the API process (``ECO_INLINE_WORKER=1``, default); deployments run ``python -m backend.worker``.
"""
from __future__ import annotations

import os
import socket
import threading
import traceback
import uuid
from datetime import timedelta
from typing import Callable, Optional

from sqlalchemy import update

from .db import Job, SessionLocal, audit, utcnow

LOG_MAX_CHARS = 20_000
STALE_AFTER = timedelta(minutes=int(os.environ.get("ECO_JOB_STALE_MIN", "30")))

Handler = Callable[["JobContext", dict], dict]
HANDLERS: dict[str, Handler] = {}


def handler(name: str):
    def deco(fn: Handler) -> Handler:
        HANDLERS[name] = fn
        return fn
    return deco


class JobCancelled(Exception):
    pass


class JobContext:
    """Passed to handlers: report progress / append log lines (each call commits in its own session)."""

    def __init__(self, job_id: str, user_id: Optional[int]):
        self.job_id, self.user_id = job_id, user_id

    def progress(self, fraction: float, stage: str | None = None, log: str | None = None) -> None:
        with SessionLocal() as db:
            j = db.get(Job, self.job_id)
            if j.status == "CANCELLED":
                raise JobCancelled()
            j.progress = max(0.0, min(1.0, float(fraction)))
            j.stage = stage or j.stage
            j.heartbeat_at = utcnow()
            if log:
                j.log = ((j.log or "") + log.rstrip() + "\n")[-LOG_MAX_CHARS:]
            db.commit()


def enqueue(db, job_type: str, params: dict, user=None, study_area_id: str | None = None) -> Job:
    if job_type not in HANDLERS:
        raise ValueError(f"unknown job type {job_type!r}")
    j = Job(id=uuid.uuid4().hex, type=job_type, status="QUEUED", progress=0.0, stage="queued", params=params,
            study_area_id=study_area_id, created_by=getattr(user, "id", None))
    db.add(j); db.flush()
    audit(db, user, "enqueue_job", "job", j.id, new={"type": job_type, "params": params})
    db.commit()
    return j


def _claim(worker: str) -> Optional[str]:
    with SessionLocal() as db:
        for (jid,) in db.query(Job.id).filter(Job.status == "QUEUED").order_by(Job.created_at).limit(5).all():
            now = utcnow()
            won = db.execute(update(Job).where(Job.id == jid, Job.status == "QUEUED")
                             .values(status="RUNNING", started_at=now, heartbeat_at=now, worker=worker,
                                     stage="starting")).rowcount
            db.commit()
            if won == 1:
                return jid
    return None


def run_job(job_id: str) -> None:
    with SessionLocal() as db:
        j = db.get(Job, job_id)
        fn, params, user_id = HANDLERS.get(j.type), dict(j.params or {}), j.created_by
    ctx = JobContext(job_id, user_id)
    status, result, error = "COMPLETED", None, None
    try:
        if fn is None:
            raise ValueError(f"no handler for job type {j.type!r}")
        result = fn(ctx, params)
    except JobCancelled:
        status, error = "CANCELLED", "cancelled"
    except Exception as e:                                  # the job fails, the worker survives
        status, error = "FAILED", f"{type(e).__name__}: {e}"
        ctx_log = traceback.format_exc()[-4000:]
        with SessionLocal() as db:
            jj = db.get(Job, job_id)
            jj.log = ((jj.log or "") + ctx_log)[-LOG_MAX_CHARS:]
            db.commit()
    with SessionLocal() as db:
        jj = db.get(Job, job_id)
        jj.status, jj.result, jj.error, jj.finished_at = status, result, error, utcnow()
        if status == "COMPLETED":
            jj.progress, jj.stage = 1.0, "done"
        db.commit()


def fail_stale() -> int:
    """RUNNING jobs whose worker stopped sending heartbeats are marked FAILED (never silently retried)."""
    with SessionLocal() as db:
        n = db.execute(update(Job).where(Job.status == "RUNNING", Job.heartbeat_at < utcnow() - STALE_AFTER)
                       .values(status="FAILED", error="worker lost (no heartbeat)", finished_at=utcnow())).rowcount
        db.commit()
        return n


def work_once(worker: str | None = None) -> bool:
    jid = _claim(worker or f"{socket.gethostname()}:{os.getpid()}")
    if jid:
        run_job(jid)
    return jid is not None


def worker_loop(stop: threading.Event, poll_s: float = 1.0, name: str | None = None) -> None:
    name = name or f"{socket.gethostname()}:{os.getpid()}:{threading.get_ident()}"
    fail_stale()
    while not stop.is_set():
        try:
            if not work_once(name):
                stop.wait(poll_s)
        except Exception:                                    # DB hiccup: back off, keep serving
            traceback.print_exc()
            stop.wait(5 * poll_s)


_inline: tuple[threading.Thread, threading.Event] | None = None


def start_inline_worker() -> None:
    global _inline
    if os.environ.get("ECO_INLINE_WORKER", "1") == "0" or _inline is not None:
        return
    stop = threading.Event()
    t = threading.Thread(target=worker_loop, args=(stop,), kwargs={"name": "inline"}, daemon=True)
    t.start()
    _inline = (t, stop)


def stop_inline_worker() -> None:
    global _inline
    if _inline:
        _inline[1].set()
        _inline[0].join(timeout=5)
        _inline = None
