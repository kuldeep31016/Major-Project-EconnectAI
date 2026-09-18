"""Isolate tests from the developer's real outputs/ and database: point both at a temp directory
BEFORE any backend module is imported."""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="ecoconnect_test_"))
os.environ.setdefault("ECO_OUTPUTS_DIR", str(_TMP / "outputs"))
os.environ.setdefault("ECO_DATABASE_URL", f"sqlite:///{(_TMP / 'test.db').as_posix()}")
os.environ.setdefault("ECO_DEMO_PASSWORD", "testpass")
os.environ.setdefault("ECO_JWT_SECRET", "test-secret")
