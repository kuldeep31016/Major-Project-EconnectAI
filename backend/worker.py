"""Standalone job worker: ``python -m backend.worker`` (containers / separate host with torch for inference)."""
from __future__ import annotations

import signal
import threading

from . import job_handlers  # noqa: F401  (registers job types)
from .satellite import service as _satellite  # noqa: F401  (registers satellite_analyze)
from .db import init_db
from .jobs import worker_loop


def main() -> None:
    init_db()
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    print("[worker] polling for jobs")
    worker_loop(stop)


if __name__ == "__main__":
    main()
