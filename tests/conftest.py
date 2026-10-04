"""Isolate tests from the developer's real outputs/ and database: point both at a temp directory
BEFORE any backend module is imported."""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="ecoconnect_test_"))
# remove the temp outputs/database when the test session ends (129 leftover dirs = ~1 GB had piled up by 2026-10-04)
import atexit  # noqa: E402
import shutil  # noqa: E402
atexit.register(shutil.rmtree, _TMP, ignore_errors=True)
# Forced, not setdefault: with .env loaded in the shell, setdefault pointed the suite at the developer's real database
# (2026-10-03: it re-embedded the local index with the test embedder and wrote test alerts/artifacts/audit rows).
# A dedicated test database can still be chosen explicitly with ECO_TEST_DATABASE_URL.
os.environ["ECO_OUTPUTS_DIR"] = str(_TMP / "outputs")
os.environ["ECO_DATABASE_URL"] = os.environ.get("ECO_TEST_DATABASE_URL") or f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ.setdefault("ECO_DEMO_PASSWORD", "testpass")
os.environ.setdefault("ECO_JWT_SECRET", "test-secret")
os.environ.setdefault("ECO_INLINE_WORKER", "0")
os.environ.setdefault("RAG_INGEST_ON_START", "0")      # tests drive ingestion explicitly
os.environ.setdefault("ECO_ANON_ASK_PER_HOUR", "100000") # rate limiter has its own unit test
os.environ.setdefault("EMBEDDING_PROVIDER", "hashing")   # deterministic, no model download; real model tested in scripts/rag_eval.py
os.environ.setdefault("LLM_ENABLED", "1")                 # tests inject a stub provider; no network
os.environ.pop("ANTHROPIC_API_KEY", None)                 # never call the real API from tests   # tests drive jobs deterministically via backend.jobs.work_once
