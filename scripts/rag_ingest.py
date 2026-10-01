"""Run the RAG ingestion pipeline from the command line (same code as the background job).

    .venv/bin/python scripts/rag_ingest.py               # incremental: only changed documents are re-chunked/re-embedded
    .venv/bin/python scripts/rag_ingest.py --force       # re-index everything (embeddings still come from the cache)
    .venv/bin/python scripts/rag_ingest.py --status      # documents by status, chunks, embedder; marks STALE sources
Uses ECO_DATABASE_URL / .env like the API.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--status", action="store_true")
    a = ap.parse_args()
    from backend.db import SessionLocal, init_db
    from backend.rag.embeddings import embedder_status
    from backend.rag.ingest import detect_stale, index_status, ingest
    from backend.registry import sync_all
    init_db()
    with SessionLocal() as db:
        if a.status:
            stale = detect_stale(db)
            print(json.dumps({**index_status(db), "stale_detected_now": stale, "embedder": embedder_status()}, indent=1, default=str))
            return 0
        sync_all(db)                      # model registry rows are a source
        print(json.dumps(ingest(db, force=a.force, progress=lambda f, s: print(f"  {f:5.0%} {s}", flush=True)), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
