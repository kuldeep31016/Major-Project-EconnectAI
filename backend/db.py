"""Persistent application state: users, organisations, provenance registry, workflow entities, audit log.

SQLite by default (``ECO_DATABASE_URL``, e.g. ``sqlite:///./outputs/ecoconnect.db``); the schema is plain
SQLAlchemy so PostgreSQL/PostGIS is a connection-string change.  Geometry is stored as GeoJSON text plus
bbox columns (PostGIS-ready).  Large rasters are NEVER stored in the database - only their paths and manifests.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
                        create_engine, event)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ecoconnect.pipeline.config import OUTPUTS_DIR, load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("ECO_DATABASE_URL") or f"sqlite:///{(OUTPUTS_DIR / 'ecoconnect.db').as_posix()}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA foreign_keys=ON")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    def to_dict(self) -> dict:
        out = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)
            out[c.name] = v.isoformat() if isinstance(v, datetime) else v
        return out


# --------------------------------------------------------------------------- identity
ROLES = ("state_admin", "senior_officer", "range_officer", "field_officer", "gis_officer", "analyst")
ROLE_LABELS = {
    "state_admin": "State Administrator", "senior_officer": "Senior Forest / Conservation Officer",
    "range_officer": "Division / Range Officer", "field_officer": "Field Officer",
    "gis_officer": "GIS / Technical Officer", "analyst": "Research / Analyst",
}


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    kind = Column(String, default="forest_department")
    state = Column(String)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String)
    role = Column(String, nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"))
    password_hash = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- provenance registry (digital twin)
class StudyArea(Base):
    __tablename__ = "study_areas"
    id = Column(String, primary_key=True)          # e.g. kerala-coast
    name = Column(String, nullable=False)
    short_name = Column(String)
    state = Column(String)
    protection = Column(String)
    center_lat = Column(Float); center_lon = Column(Float)
    min_lat = Column(Float); min_lon = Column(Float); max_lat = Column(Float); max_lon = Column(Float)
    footprint_km2 = Column(Float)
    primary_habitat = Column(String)
    meta = Column(JSON, default=dict)


class Scene(Base):
    __tablename__ = "scenes"
    id = Column(String, primary_key=True)          # scene_id from the sidecar
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    path = Column(String, nullable=False)
    year = Column(Integer)
    date_range = Column(JSON)
    bands = Column(JSON)
    sensors = Column(JSON)                          # {"sentinel1": {...}, "sentinel2": {...}}
    crs = Column(String)
    width = Column(Integer); height = Column(Integer)
    manifest = Column(JSON)
    created_at = Column(DateTime, default=utcnow)


class LabelSource(Base):
    __tablename__ = "label_sources"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    path = Column(String, nullable=False)
    source = Column(String)                         # Global Mangrove Watch v3.0
    year = Column(Integer)
    licence = Column(String)
    supervision = Column(String)                    # WEAK
    manifest = Column(JSON)


class Model(Base):
    __tablename__ = "models"
    id = Column(String, primary_key=True)          # experiment_id
    path = Column(String)                           # best_model.pth
    architecture = Column(String)
    encoder = Column(String)
    input_bands = Column(JSON)
    mode = Column(String)                           # development | full
    result_label = Column(String)
    dataset_name = Column(String)
    n_train = Column(Integer); n_val = Column(Integer); n_test = Column(Integer)
    metrics = Column(JSON)                          # val/test
    calibration = Column(JSON)
    trained_at = Column(String)
    hardware = Column(JSON)
    card = Column(JSON, default=dict)              # model-card extras (limitations, validation methodology)
    # registry (migration 0003): status ladder DEVELOPMENT -> EXPERIMENTAL -> CANDIDATE -> VALIDATED.
    # VALIDATED is only reachable through PATCH /api/models/{id}/status with independent validation evidence.
    status = Column(String, default="DEVELOPMENT", index=True)
    display_name = Column(String)                   # e.g. EcoConnectAI-Seg-B0-S1-v0.1
    version = Column(String)
    code_commit = Column(String)
    validation = Column(JSON)                       # evidence recorded when promoted to VALIDATED
    status_updated_at = Column(DateTime)


class AnalysisVersion(Base):
    """One pipeline run = one version of a landscape's ecosystem state."""
    __tablename__ = "analysis_versions"
    id = Column(String, primary_key=True)           # run_id
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    scene_id = Column(String, ForeignKey("scenes.id"))
    model_id = Column(String, ForeignKey("models.id"))
    result_kind = Column(String)                    # synthetic | development | experiment | external
    result_label = Column(String)
    scene_year = Column(Integer)
    threshold = Column(Float); mmu_ha = Column(Float); tau_km = Column(Float); k = Column(Integer); metric = Column(String)
    n_patches = Column(Integer); n_edges = Column(Integer); n_components = Column(Integer)
    habitat_area_ha = Column(Float); landscape_area_ha = Column(Float)
    iic = Column(Float); pc = Column(Float); eca_ha = Column(Float); eca_pct = Column(Float)
    interface_score = Column(Float)
    path = Column(String, nullable=False)
    timestamp = Column(DateTime)
    manifest = Column(JSON)


# --------------------------------------------------------------------------- workflow
DETECTION_STATUSES = ("AI_DETECTED", "UNDER_REVIEW", "FIELD_ASSIGNED", "FIELD_VERIFIED", "REJECTED", "CONFIRMED")


class Detection(Base):
    """Status of an AI-detected object (patch, change, restoration candidate) in the verification workflow.
    An AI prediction never becomes a verified fact without a field-verification record."""
    __tablename__ = "detections"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    run_id = Column(String, ForeignKey("analysis_versions.id"), index=True)
    object_type = Column(String, nullable=False)    # patch | candidate | change
    object_id = Column(String, nullable=False)
    status = Column(String, default="AI_DETECTED")
    lat = Column(Float); lon = Column(Float)
    summary = Column(Text)
    updated_by = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=utcnow)


ALERT_STATUSES = ("OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "DISMISSED")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    run_id = Column(String, ForeignKey("analysis_versions.id"))
    type = Column(String, nullable=False)           # habitat_loss | connectivity_degradation | critical_patch | low_confidence | restoration_opportunity | pending_verification
    severity = Column(String, nullable=False)       # low | medium | high | critical
    title = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    lat = Column(Float); lon = Column(Float)
    object_type = Column(String); object_id = Column(String)
    evidence = Column(JSON)                         # structured evidence (numbers + refs)
    status = Column(String, default="OPEN")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


TASK_STATUSES = ("PENDING", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "REJECTED")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    objectives = Column(Text)
    status = Column(String, default="PLANNED")      # PLANNED | ACTIVE | UNDER_REVIEW | COMPLETED | ARCHIVED
    owner_id = Column(Integer, ForeignKey("users.id"))
    run_id = Column(String, ForeignKey("analysis_versions.id"))
    priority_patches = Column(JSON, default=list)
    candidates = Column(JSON, default=list)
    responsible = Column(JSON, default=list)        # user ids
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


class FieldTask(Base):
    __tablename__ = "field_tasks"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    detection_id = Column(Integer, ForeignKey("detections.id"))
    title = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    lat = Column(Float); lon = Column(Float)
    object_type = Column(String); object_id = Column(String); run_id = Column(String)
    evidence_required = Column(String, default="photo + observation")
    assignee_id = Column(Integer, ForeignKey("users.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="PENDING")
    due_date = Column(String)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("field_tasks.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lat = Column(Float); lon = Column(Float)
    observed_at = Column(String)
    observation = Column(Text)                      # habitat_present | habitat_lost | degraded | unchanged | other
    notes = Column(Text)
    photo_path = Column(String)
    verification = Column(String, default="SUBMITTED")   # SUBMITTED | ACCEPTED | REJECTED
    checklist = Column(JSON)                              # structured observation (FIELD_CHECKLIST keys), migration 0004
    created_at = Column(DateTime, default=utcnow)


class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    run_id = Column(String, ForeignKey("analysis_versions.id"))
    type = Column(String, nullable=False)           # remove_patch | remove_polygon | restore | restore_multi | tau | threshold | time
    label = Column(String, default="SIMULATED")
    params = Column(JSON)
    result = Column(JSON)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    study_area_id = Column(String, ForeignKey("study_areas.id"))
    run_id = Column(String, ForeignKey("analysis_versions.id"))
    title = Column(String)
    content = Column(JSON)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)


class AuditLog(Base):
    """Append-only: rows are never updated or deleted by the application."""
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer); username = Column(String); role = Column(String)
    action = Column(String, nullable=False)
    object_type = Column(String); object_id = Column(String)
    old_state = Column(JSON); new_state = Column(JSON)
    reason = Column(Text)
    ts = Column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- platform: jobs + artifacts
MODEL_STATUSES = ("DEVELOPMENT", "EXPERIMENTAL", "CANDIDATE", "VALIDATED")
JOB_STATUSES = ("QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED")


class Job(Base):
    """Background work (inference, analysis, reports). The browser gets an id and polls; nothing long runs in a request."""
    __tablename__ = "jobs"
    id = Column(String, primary_key=True)                     # uuid4 hex
    type = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="QUEUED", index=True)
    progress = Column(Float, default=0.0)                     # 0..1
    stage = Column(String)                                    # human-readable current step
    params = Column(JSON)
    result = Column(JSON)
    error = Column(Text)
    log = Column(Text)                                        # tail of step output
    study_area_id = Column(String, ForeignKey("study_areas.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    worker = Column(String)
    created_at = Column(DateTime, default=utcnow, index=True)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    heartbeat_at = Column(DateTime)


class Artifact(Base):
    """Every stored file the platform produces or consumes (rasters, GeoJSON, graphs, reports, checkpoints).
    Bytes live in object storage (``backend.storage``); the DB keeps identity, lineage and a content hash."""
    __tablename__ = "artifacts"
    id = Column(String, primary_key=True)                     # sha256-derived stable id: <kind>:<key>
    kind = Column(String, nullable=False, index=True)         # run_manifest | patches_geojson | graph | criticality | ...
    storage = Column(String, nullable=False, default="local") # local | s3
    key = Column(String, nullable=False, unique=True)         # object key relative to the storage root
    sha256 = Column(String(64))
    size_bytes = Column(Integer)
    content_type = Column(String)
    run_id = Column(String, ForeignKey("analysis_versions.id"), index=True)
    model_id = Column(String, ForeignKey("models.id"))
    job_id = Column(String, ForeignKey("jobs.id"))
    processing_version = Column(String)                       # ecoconnect package version that wrote it
    meta = Column(JSON)
    created_at = Column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- Phase 7: refresh tokens
class ChatCache(Base):
    """Grounded assistant answers keyed by a normalised question + scope (study area, run, selected object, role
    scope, knowledge-index version). A new run or re-indexed docs change the key, so stale answers are never served."""
    __tablename__ = "chat_cache"
    id = Column(Integer, primary_key=True)
    key = Column(String(64), unique=True, nullable=False)
    scope = Column(String(64), index=True, nullable=False)       # hash of everything except the question
    canonical = Column(String(400), nullable=False)               # normalised question tokens (semantic match)
    answer = Column(JSON, nullable=False)
    hits = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)


class ChatEvent(Base):
    """One row per assistant question: which tier answered, cache hit/miss, retrieval size, whether an LLM was
    called and its estimated tokens/latency. Admin diagnostics + cost control; the question is truncated."""
    __tablename__ = "chat_events"
    id = Column(Integer, primary_key=True)
    ts = Column(DateTime, default=utcnow, index=True)
    session_id = Column(String(64), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String(32))
    study_area_id = Column(String(64))
    run_id = Column(String(200))
    question = Column(String(200))
    tier = Column(String(16))                 # structured | retrieval | llm | refused
    intent = Column(String(48))
    cache_hit = Column(Boolean, default=False)
    llm_called = Column(Boolean, default=False)
    llm_reason = Column(String(120))
    retrieval_count = Column(Integer, default=0)
    tokens_in_est = Column(Integer, default=0)
    tokens_out_est = Column(Integer, default=0)
    latency_ms = Column(Float)
    llm_latency_ms = Column(Float)
    error = Column(String(200))
    # RAG tracing + cost (migration 0007)
    request_id = Column(String(32), index=True)
    query_type = Column(String(24))
    rewritten_query = Column(String(300))
    retrieval_method = Column(String(40))
    candidate_count = Column(Integer)
    reranker = Column(String(40))
    selected_chunks = Column(JSON)                 # chunk ids only, never raw text
    retrieval_ms = Column(Float)
    rerank_ms = Column(Float)
    model = Column(String(80))
    embedding_model = Column(String(120))
    index_version = Column(String(32))
    citation_count = Column(Integer)
    confidence = Column(Float)
    abstain_reason = Column(String(120))
    cache_read_tokens = Column(Integer)
    cost_usd = Column(Float)
    feedback = Column(Integer)                     # +1 / -1 from the user


class RagDocument(Base):
    """One indexed source (a doc file, a paper section set, a run object, an uploaded file). content_hash decides
    whether re-indexing is needed; version increments on every content change; DELETED rows keep the history."""
    __tablename__ = "rag_documents"
    id = Column(Integer, primary_key=True)
    source_key = Column(String(300), unique=True, nullable=False)     # stable identity, e.g. doc:docs/ML.md
    source_type = Column(String(40), index=True, nullable=False)       # PROJECT_DOCS, PAPER, PATCH_RESULTS, UPLOAD ...
    title = Column(String(300))
    uri = Column(String(500))
    visibility = Column(String(16), default="public", index=True)    # public | staff | admin
    study_area_id = Column(String(64), index=True)
    run_id = Column(String(200))
    content_hash = Column(String(64))
    version = Column(Integer, default=0)
    status = Column(String(16), default="PENDING", index=True)        # PENDING PROCESSING INDEXED FAILED STALE DELETED
    chunk_count = Column(Integer, default=0)
    embedding_model = Column(String(120))
    error = Column(String(500))
    meta = Column(JSON)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)
    indexed_at = Column(DateTime)


class RagChunk(Base):
    """A retrievable unit with provenance + ACL copied from its document (filtered before scoring)."""
    __tablename__ = "rag_chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("rag_documents.id", ondelete="CASCADE"), index=True, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    section = Column(String(300))
    page = Column(Integer)
    text = Column(Text, nullable=False)
    content_hash = Column(String(64), index=True, nullable=False)
    token_count = Column(Integer)
    visibility = Column(String(16), default="public", index=True)
    study_area_id = Column(String(64), index=True)
    object_id = Column(String(16))                                     # patch / candidate id for run records
    meta = Column(JSON)
    embedding = Column(JSON)                                           # list[float]; NULL until embedded
    embedding_model = Column(String(120))
    created_at = Column(DateTime, default=utcnow)


class RagEmbeddingCache(Base):
    """content hash + model -> vector, so identical text is never embedded twice (also across documents)."""
    __tablename__ = "rag_embedding_cache"
    content_hash = Column(String(64), primary_key=True)
    model = Column(String(120), primary_key=True)
    vector = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class RefreshToken(Base):
    """Rotating refresh tokens. Only a sha256 of the token is stored; reuse of a rotated token revokes its family."""
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)
    family = Column(String(32), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- Phase 5: restoration decisions + HITL
# Structured field checklist: key -> allowed values. Free text goes in Evidence.notes.
FIELD_CHECKLIST = {
    "habitat_present": ("yes", "no", "unsure"),
    "mangrove_present": ("yes", "no", "unsure"),
    "condition": ("good", "fair", "poor", "not_applicable"),
    "water_condition": ("tidal", "permanently_flooded", "dry", "unknown"),
    "human_disturbance": ("none", "low", "high"),
}
REVIEW_STAGES = ("MODEL_CANDIDATE", "GIS_REVIEW", "FIELD_VERIFICATION", "FEASIBILITY", "DECIDED")
# Feasibility factors the model cannot know. None = "Not assessed" (never filled with a guess).
FEASIBILITY_FACTORS = ("ownership", "legal_status", "water_conditions", "land_use", "cost", "accessibility")


class RestorationReview(Base):
    """Human workflow around a model-ranked restoration candidate. The model output (gain, rank) is copied as
    ``model_recommendation`` at creation; everything after that is a human judgement with who/when/why."""
    __tablename__ = "restoration_reviews"
    id = Column(Integer, primary_key=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    run_id = Column(String, ForeignKey("analysis_versions.id"), index=True)
    candidate_id = Column(String, nullable=False)
    stage = Column(String, default="MODEL_CANDIDATE")
    model_recommendation = Column(JSON)                  # rank, gain_pct, area_ha, verdict, why/why_not at creation
    gis_review = Column(JSON)                            # {outcome, notes, by, at}
    field_task_id = Column(Integer, ForeignKey("field_tasks.id"))
    feasibility = Column(JSON)                           # {factor: {value, source, by, at} | None}
    decision = Column(String)                            # APPROVED | REJECTED | DEFERRED (human)
    decision_reason = Column(Text)
    decided_by = Column(Integer, ForeignKey("users.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


class ModelDisagreement(Base):
    """Accepted field evidence that contradicts the model output. Candidate training data for a FUTURE experiment;
    nothing retrains automatically. Status: OPEN -> INCLUDED | EXCLUDED (reviewed)."""
    __tablename__ = "model_disagreements"
    id = Column(Integer, primary_key=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), unique=True)
    study_area_id = Column(String, ForeignKey("study_areas.id"), index=True)
    run_id = Column(String, ForeignKey("analysis_versions.id"))
    model_id = Column(String, ForeignKey("models.id"))
    object_type = Column(String); object_id = Column(String)
    lat = Column(Float); lon = Column(Float)
    observed_at = Column(String)
    model_prediction = Column(JSON)                      # {class, confidence}
    field_observation = Column(JSON)                     # checklist + observation
    kind = Column(String)                                # false_positive | false_negative
    status = Column(String, default="OPEN", index=True)
    review_note = Column(Text)
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)


def init_db() -> None:
    """Bring the schema to the latest Alembic revision (see backend/migrations)."""
    Path(OUTPUTS_DIR).mkdir(parents=True, exist_ok=True)
    from .migrate import upgrade
    upgrade(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def audit(db: Session, user, action: str, object_type: str | None = None, object_id=None,
          old=None, new=None, reason: str | None = None) -> None:
    db.add(AuditLog(user_id=getattr(user, "id", None), username=getattr(user, "username", "system"),
                    role=getattr(user, "role", "system"), action=action, object_type=object_type,
                    object_id=str(object_id) if object_id is not None else None,
                    old_state=old, new_state=new, reason=reason))
