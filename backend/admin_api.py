"""Admin system view: health, schema readiness, jobs, request metrics, store sizes (Phase 7)."""
from __future__ import annotations

import os
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ecoconnect import __version__

from .auth import require
from .db import AnalysisVersion, Artifact, AuditLog, Job, Model, User, get_db, utcnow
from .observability import METRICS

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/system")
def system(user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory
    from .assistant_llm import llm_available
    from .db import engine
    from .jobs import _inline
    from .migrate import _config
    from .storage import get_storage

    with engine.connect() as c:
        current = MigrationContext.configure(c).get_current_revision()
    head = ScriptDirectory.from_config(_config()).get_current_head()
    since = utcnow() - timedelta(hours=24)
    by_status = dict(db.query(Job.status, func.count(Job.id)).group_by(Job.status).all())
    failed = db.query(Job).filter(Job.status == "FAILED", Job.created_at >= since).order_by(Job.created_at.desc()).limit(10).all()
    return {
        "version": __version__, "database": engine.dialect.name, "schema": {"current": current, "head": head, "ok": current == head},
        "storage": get_storage().name, "inline_worker": _inline is not None,
        "assistant": "claude" if llm_available() else "template (no Anthropic credentials)",
        "jobs": {"by_status": by_status, "failed_24h": [{"id": j.id, "type": j.type, "error": j.error, "at": j.created_at.isoformat() if j.created_at else None} for j in failed]},
        "counts": {"users": db.query(User).count(), "runs": db.query(AnalysisVersion).count(), "models": db.query(Model).count(),
                   "artifacts": db.query(Artifact).count(), "audit_events": db.query(AuditLog).count()},
        "requests": METRICS.snapshot(),
        "config": {"token_minutes": int(os.environ.get("ECO_ACCESS_MINUTES", "60")), "cors_origins": os.environ.get("ECO_CORS_ORIGINS", "localhost")},
    }
