#!/usr/bin/env python
"""One automatic-monitoring check (for cron / a system timer instead of SATELLITE_MONITOR_HOURS):

    python scripts/satellite_monitor.py            # new passes -> alerts; analyses queued where the model can run
    python scripts/satellite_monitor.py --no-analyse

Queued analyses are run by the API's inline worker or `python -m backend.worker`. Prints the per-area report as JSON.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.pipeline.config import load_dotenv  # noqa: E402

load_dotenv()
from backend.db import SessionLocal, init_db  # noqa: E402
from backend.satellite import monitor  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-analyse", action="store_true", help="only report new passes (alerts), queue no analyses")
    a = ap.parse_args()
    init_db()
    with SessionLocal() as db:
        print(json.dumps(monitor.check(db, analyse=False if a.no_analyse else None), indent=1, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
