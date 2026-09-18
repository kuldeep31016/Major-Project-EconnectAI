"""Authentication (JWT bearer) and role-based access control.

Secrets come from the environment: ECO_JWT_SECRET (required outside demo mode), ECO_DEMO_PASSWORD (seeded
demo accounts).  No credentials live in source code.
"""
from __future__ import annotations

import os
import secrets
from datetime import timedelta
from typing import Iterable

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import ROLES, Organization, User, get_db, utcnow

def _dev_secret() -> str:
    """Without ECO_JWT_SECRET, keep one random secret per installation (outputs/.jwt_secret) so sessions
    survive backend restarts in development. Production must set ECO_JWT_SECRET (docs/SECURITY.md)."""
    from ecoconnect.pipeline.config import OUTPUTS_DIR
    f = OUTPUTS_DIR / ".jwt_secret"
    try:
        if f.exists():
            return f.read_text().strip()
        f.parent.mkdir(parents=True, exist_ok=True)
        s = secrets.token_hex(32)
        f.write_text(s)
        return s
    except OSError:
        return secrets.token_hex(32)


JWT_SECRET = os.environ.get("ECO_JWT_SECRET") or _dev_secret()
JWT_ALG = "HS256"
TOKEN_HOURS = int(os.environ.get("ECO_TOKEN_HOURS", "12"))

# Capability matrix (what each role may do). Keep it small and explicit.
PERMISSIONS: dict[str, set[str]] = {
    "view": set(ROLES),
    "run_analysis": {"gis_officer", "analyst", "state_admin"},
    "change_parameters": {"gis_officer", "analyst", "state_admin"},
    "review_detections": {"senior_officer", "range_officer", "state_admin", "gis_officer"},
    "manage_projects": {"senior_officer", "range_officer", "state_admin"},
    "assign_tasks": {"senior_officer", "range_officer", "state_admin"},
    "submit_evidence": {"field_officer", "range_officer", "state_admin"},
    "verify_evidence": {"senior_officer", "range_officer", "state_admin"},
    "manage_alerts": {"senior_officer", "range_officer", "state_admin", "gis_officer"},
    "generate_report": {"senior_officer", "range_officer", "state_admin", "analyst", "gis_officer"},
    "manage_users": {"state_admin"},
    "view_audit": {"state_admin", "senior_officer"},
    "view_models": set(ROLES),          # model cards are transparency, visible to everyone
}


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    payload = {"sub": user.username, "uid": user.id, "role": user.role,
               "exp": utcnow() + timedelta(hours=TOKEN_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "authentication required")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"invalid token: {e}")
    user = db.get(User, payload.get("uid"))
    if not user or not user.active:
        raise HTTPException(401, "user not found or inactive")
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    try:
        return current_user(request, db)
    except HTTPException:
        return None


def require(*capabilities: str):
    """Dependency: the current user must hold every listed capability."""
    def _dep(user: User = Depends(current_user)) -> User:
        for cap in capabilities:
            if user.role not in PERMISSIONS.get(cap, set()):
                raise HTTPException(403, f"role '{user.role}' lacks capability '{cap}'")
        return user
    return _dep


def capabilities_for(role: str) -> list[str]:
    return sorted(cap for cap, roles in PERMISSIONS.items() if role in roles)


DEMO_USERS = [
    ("admin", "State Administrator (demo)", "state_admin"),
    ("senior", "Senior Conservation Officer (demo)", "senior_officer"),
    ("range", "Range Officer (demo)", "range_officer"),
    ("field", "Field Officer (demo)", "field_officer"),
    ("gis", "GIS / Technical Officer (demo)", "gis_officer"),
    ("analyst", "Research Analyst (demo)", "analyst"),
]


def seed_demo_users(db: Session, org_name: str = "Kerala Forest & Wildlife Department (demo organisation)") -> list[str]:
    """Create demo accounts for every role if none exist. Password from ECO_DEMO_PASSWORD (default 'demo1234').
    These are demonstration accounts, clearly named as such."""
    if db.query(User).count():
        return []
    pw = os.environ.get("ECO_DEMO_PASSWORD", "demo1234")
    org = db.query(Organization).filter_by(name=org_name).first()
    if not org:
        org = Organization(name=org_name, kind="forest_department", state="Kerala")
        db.add(org)
        db.flush()
    created = []
    for username, full_name, role in DEMO_USERS:
        db.add(User(username=username, full_name=full_name, email=f"{username}@demo.local", role=role,
                    org_id=org.id, password_hash=hash_password(pw)))
        created.append(username)
    db.commit()
    return created
