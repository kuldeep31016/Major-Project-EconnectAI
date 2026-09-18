"""Persistent application state: users, organisations, provenance registry, workflow entities, audit log.

SQLite by default (``ECO_DATABASE_URL``, e.g. ``sqlite:///./outputs/ecoconnect.db``); the schema is plain
SQLAlchemy so PostgreSQL/PostGIS is a connection-string change.  Geometry is stored as GeoJSON text plus
bbox columns (PostGIS-ready).  Large rasters are NEVER stored in the database - only their paths and manifests.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
                        create_engine, event)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from ecoconnect.pipeline.config import OUTPUTS_DIR, REPO_ROOT, load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("ECO_DATABASE_URL", f"sqlite:///{(OUTPUTS_DIR / 'ecoconnect.db').as_posix()}")
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


def init_db() -> None:
    Path(OUTPUTS_DIR).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)


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
