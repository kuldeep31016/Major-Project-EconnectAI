"""HTTP API of the EcoConnectAI Assistant and its knowledge index (design: docs/rag/ARCHITECTURE.md).

Assistant
    POST   /api/chat                    JSON answer (backward compatible)                       public / signed in
    POST   /api/chat/stream             same pipeline as Server-Sent Events: status · delta · final
    POST   /api/chat/feedback           thumbs up/down on an answer (event id)
    GET    /api/chat/diagnostics        tiers, cost, latency p50/p95, index + embedder status    view_audit
    POST   /api/chat/reindex            alias of POST /api/rag/ingest                           view_audit
    DELETE /api/chat/cache              drop cached answers                                     view_audit
Knowledge index (admin)
    GET    /api/rag/status              documents by status, chunks, embeddings, stale count    view_audit
    GET    /api/rag/documents           per-document status, version, chunks, embedding, errors view_audit
    POST   /api/rag/ingest              queue an incremental ingest job (force=true re-embeds)  view_audit
    POST   /api/rag/documents/{id}/reindex                                                      view_audit
    DELETE /api/rag/documents/{id}      uploads only (built-in sources follow their files)      manage_users
    POST   /api/rag/upload              md/txt/html/json/csv/pdf ≤ 5 MB, visibility public|staff|admin   manage_users
"""
from __future__ import annotations

import json
import queue
import re
import threading
import uuid
from datetime import timedelta
from types import SimpleNamespace
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import PERMISSIONS, optional_user, require
from .chat import MAX_QUESTION_CHARS, ChatContext, ask
from .db import ChatCache, ChatEvent, RagDocument, SessionLocal, User, audit, get_db, utcnow
from .llm_provider import get_provider, llm_enabled, max_output_tokens
from .rag.embeddings import embedder_status
from .rag.ingest import delete_document, detect_stale, index_status
from .security import anon_assistant_limiter, is_slug

router = APIRouter(prefix="/api/chat", tags=["assistant"])
rag_router = APIRouter(prefix="/api/rag", tags=["knowledge index"])
MAX_UPLOAD = 5 * 1024 * 1024
UPLOAD_TYPES = (".md", ".markdown", ".txt", ".html", ".htm", ".json", ".csv", ".pdf")


class ChatContextIn(BaseModel):
    study_area: Optional[str] = None
    run_id: Optional[str] = None
    selected_patch: Optional[str] = Field(None, max_length=8)
    selected_candidate: Optional[str] = Field(None, max_length=8)
    module: Optional[str] = Field(None, max_length=40)


class Turn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str = Field(..., max_length=2000)


class ChatIn(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_CHARS)
    context: ChatContextIn = ChatContextIn()
    session_id: Optional[str] = Field(None, max_length=64)
    history: list[Turn] = Field(default_factory=list, max_length=20)
    debug: bool = False


def _clean_id(v: Optional[str]) -> Optional[str]:
    return v.upper() if v and len(v) <= 8 and v[:1].upper() in "PC" and v[1:].isdigit() else None


def _ctx(body: ChatIn, user: Optional[User]) -> ChatContext:
    c = body.context
    for v in (c.study_area, c.run_id):
        if v and not is_slug(v):
            raise HTTPException(400, "invalid study area or run id")
    return ChatContext(study_area=c.study_area or "kerala-coast", run_id=c.run_id or "latest",
                       selected_patch=_clean_id(c.selected_patch), selected_candidate=_clean_id(c.selected_candidate),
                       module=c.module, session_id=body.session_id, user=user)


def _auditor(db: Session, user: Optional[User], body: ChatIn):
    who = user or SimpleNamespace(id=None, username="anonymous", role="public")

    def _audit(q: str, ans) -> None:
        audit(db, who, "assistant_question", "run", body.context.run_id or "latest",
              new={"question": q[:300], "tier": ans.tier, "intent": ans.intent, "cache_hit": ans.cache_hit, "llm_called": ans.llm_called,
                   "study_area": body.context.study_area, "sources": [s.get("label") for s in ans.sources][:6]})
    return _audit


def _can_debug(body: ChatIn, user: Optional[User]) -> bool:
    return bool(body.debug and user and user.role in PERMISSIONS.get("view_audit", set()))


@router.post("")
def chat(body: ChatIn, request: Request, user: Optional[User] = Depends(optional_user), db: Session = Depends(get_db)):
    if user is None:
        anon_assistant_limiter.hit(request)
    return ask(db, body.question, _ctx(body, user), debug=_can_debug(body, user), audit=_auditor(db, user, body),
               history=[t.model_dump() for t in body.history])


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/stream")
def chat_stream(body: ChatIn, request: Request, user: Optional[User] = Depends(optional_user)):
    """Server-Sent Events: 'status' (stage), 'delta' (answer text as generated), 'final' (full answer + citations)."""
    if user is None:
        anon_assistant_limiter.hit(request)
    uid = user.id if user else None
    q: "queue.Queue[Optional[tuple[str, object]]]" = queue.Queue()

    def worker():
        with SessionLocal() as db:
            u = db.get(User, uid) if uid else None
            try:
                ctx = _ctx(body, u)
                q.put(("status", {"stage": "searching project data"}))
                out = ask(db, body.question, ctx, debug=_can_debug(body, u), audit=_auditor(db, u, body),
                          history=[t.model_dump() for t in body.history], on_delta=lambda t: q.put(("delta", {"text": t})))
                q.put(("final", out))
            except HTTPException as e:
                q.put(("error", {"message": e.detail}))
            except Exception:  # noqa: BLE001 - never stream a stack trace
                q.put(("error", {"message": "The assistant could not answer. Please try again."}))
            finally:
                q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def gen():
        streamed = False
        while True:
            try:
                item = q.get(timeout=120)
            except queue.Empty:
                yield _sse("error", {"message": "timed out"})
                return
            if item is None:
                return
            kind, data = item
            if kind == "delta":
                streamed = True
            if kind == "final" and not streamed:
                yield _sse("delta", {"text": data["answer"]})            # structured / cached / extractive answers
            yield _sse(kind, data)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class FeedbackIn(BaseModel):
    event_id: int
    rating: int = Field(..., ge=-1, le=1)
    session_id: Optional[str] = Field(None, max_length=64)


@router.post("/feedback")
def feedback(body: FeedbackIn, user: Optional[User] = Depends(optional_user), db: Session = Depends(get_db)):
    ev = db.get(ChatEvent, body.event_id)
    # only the asker (same user, or same anonymous session) may rate an answer
    if ev is None or (ev.user_id != (user.id if user else None)) or (ev.user_id is None and ev.session_id != body.session_id):
        raise HTTPException(404, "answer not found")
    ev.feedback = body.rating
    db.commit()
    return {"ok": True}


def _pct(vals: list[float], p: float) -> Optional[float]:
    if not vals:
        return None
    s = sorted(vals)
    return round(s[min(len(s) - 1, int(p * len(s)))], 1)


@router.get("/diagnostics")
def diagnostics(limit: int = 50, user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    day = utcnow() - timedelta(hours=24)
    evs = db.query(ChatEvent).filter(ChatEvent.ts >= day).all()
    total = len(evs)
    by_tier: dict[str, int] = {}
    for e in evs:
        by_tier[e.tier or "?"] = by_tier.get(e.tier or "?", 0) + 1
    llm_calls = sum(1 for e in evs if e.llm_called)
    answered = [e for e in evs if e.tier in ("structured", "retrieval", "llm")]
    cost = round(sum(e.cost_usd or 0 for e in evs), 4)
    per_user: dict[str, float] = {}
    for e in evs:
        if e.cost_usd:
            k = str(e.user_id or "anonymous")
            per_user[k] = round(per_user.get(k, 0) + e.cost_usd, 5)
    prov = get_provider()
    recent = db.query(ChatEvent).order_by(ChatEvent.ts.desc()).limit(min(limit, 200)).all()
    lat = [e.latency_ms for e in evs if e.latency_ms is not None]

    def group_cost(key) -> dict:
        out: dict[str, float] = {}
        for e in evs:
            if e.cost_usd:
                k = key(e) or "?"
                out[k] = round(out.get(k, 0) + e.cost_usd, 5)
        return out

    def stage(vals) -> dict:
        v = [x for x in vals if x is not None]
        return {"p50": _pct(v, 0.5), "p95": _pct(v, 0.95), "p99": _pct(v, 0.99), "n": len(v)}

    week = db.query(ChatEvent.ts, ChatEvent.cost_usd).filter(ChatEvent.ts >= utcnow() - timedelta(days=7)).all()
    per_day: dict[str, float] = {}
    for ts, c in week:
        if c and ts:
            per_day[ts.date().isoformat()] = round(per_day.get(ts.date().isoformat(), 0) + c, 5)
    return {
        "config": {"llm_enabled": llm_enabled(), "provider": prov.name, "provider_available": prov.available(),
                   "max_output_tokens": max_output_tokens()},
        "embedder": embedder_status(),
        "index": {**index_status(db), "chunks_total": index_status(db)["chunks"]},
        "cache": {"entries": db.query(ChatCache).count(), "total_hits": int(db.query(func.coalesce(func.sum(ChatCache.hits), 0)).scalar() or 0)},
        "last_24h": {"questions": total, "by_tier": by_tier, "llm_calls": llm_calls, "cache_hits": sum(1 for e in evs if e.cache_hit),
                     "llm_share": round(llm_calls / total, 3) if total else 0.0,
                     "tokens_in_est": sum(e.tokens_in_est or 0 for e in evs), "tokens_out_est": sum(e.tokens_out_est or 0 for e in evs),
                     "cost_usd": cost, "cost_per_answer_usd": round(cost / len(answered), 5) if answered else 0.0,
                     "cost_by_user_usd": per_user, "cost_by_model_usd": group_cost(lambda e: e.model),
                     "cost_by_query_type_usd": group_cost(lambda e: e.query_type), "cost_by_route_usd": group_cost(lambda e: e.tier),
                     "latency_p50_ms": _pct(lat, 0.5), "latency_p95_ms": _pct(lat, 0.95), "latency_p99_ms": _pct(lat, 0.99),
                     "stage_latency_ms": {"total": stage(lat), "retrieval": stage([e.retrieval_ms for e in evs]),
                                          "rerank": stage([e.rerank_ms for e in evs]), "llm": stage([e.llm_latency_ms for e in evs])},
                     "feedback": {"up": sum(1 for e in evs if e.feedback == 1), "down": sum(1 for e in evs if e.feedback == -1)}},
        "cost_per_day_usd_7d": per_day,
        "recent": [{"ts": e.ts.isoformat() if e.ts else None, "role": e.role, "question": e.question, "tier": e.tier, "intent": e.intent,
                    "query_type": e.query_type, "cache_hit": e.cache_hit, "llm_called": e.llm_called, "llm_reason": e.llm_reason,
                    "retrieval_count": e.retrieval_count, "reranker": e.reranker, "confidence": e.confidence, "model": e.model,
                    "cost_usd": e.cost_usd, "latency_ms": e.latency_ms, "llm_latency_ms": e.llm_latency_ms, "error": e.error,
                    "run_id": e.run_id, "request_id": e.request_id} for e in recent],
    }


@router.post("/reindex")
def reindex(user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    return _queue_ingest(db, user, force=False)


@router.delete("/cache")
def clear_cache(user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    n = db.query(ChatCache).delete()
    audit(db, user, "assistant_cache_cleared", new={"entries": n}); db.commit()
    return {"deleted": n}


# --------------------------------------------------------------------------- knowledge index admin
def _queue_ingest(db: Session, user: User, force: bool, keys: Optional[list[str]] = None) -> dict:
    from .jobs import enqueue
    j = enqueue(db, "rag_ingest", {"force": force, "only_keys": keys}, user=user)
    audit(db, user, "rag_ingest_queued", new={"force": force, "keys": keys}); db.commit()
    return {"job_id": j.id, "status": j.status}


def _doc_out(d: RagDocument) -> dict:
    return {"id": d.id, "source_key": d.source_key, "source_type": d.source_type, "title": d.title, "visibility": d.visibility,
            "status": d.status, "version": d.version, "chunk_count": d.chunk_count, "embedding_model": d.embedding_model,
            "content_hash": (d.content_hash or "")[:12], "error": d.error, "study_area": d.study_area_id,
            "indexed_at": d.indexed_at.isoformat() if d.indexed_at else None, "updated_at": d.updated_at.isoformat() if d.updated_at else None}


@rag_router.get("/status")
def rag_status(user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    stale = detect_stale(db)
    return {**index_status(db), "stale_detected_now": stale, "embedder": embedder_status()}


@rag_router.get("/documents")
def rag_documents(user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    return [_doc_out(d) for d in db.query(RagDocument).order_by(RagDocument.source_type, RagDocument.source_key).all()]


@rag_router.post("/ingest", status_code=202)
def rag_ingest(force: bool = False, user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    return _queue_ingest(db, user, force)


@rag_router.post("/documents/{doc_id}/reindex", status_code=202)
def rag_reindex_doc(doc_id: int, user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    d = db.get(RagDocument, doc_id)
    if d is None:
        raise HTTPException(404, "document not found")
    if d.status == "DELETED" and d.source_type == "UPLOAD":
        d.status = "PENDING"; db.commit()
    return _queue_ingest(db, user, force=True, keys=[d.source_key])


@rag_router.delete("/documents/{doc_id}")
def rag_delete_doc(doc_id: int, user: User = Depends(require("manage_users")), db: Session = Depends(get_db)):
    d = db.get(RagDocument, doc_id)
    if d is None:
        raise HTTPException(404, "document not found")
    if d.source_type != "UPLOAD":
        raise HTTPException(400, "built-in sources follow their files; remove or edit the file and re-ingest")
    from .storage import get_storage
    key = (d.meta or {}).get("storage_key")
    if key and get_storage().exists(key):
        get_storage().delete(key)
    delete_document(db, d)
    audit(db, user, "rag_document_deleted", "rag_document", d.id, new={"source_key": d.source_key}); db.commit()
    return _doc_out(d)


@rag_router.post("/upload", status_code=202)
def rag_upload(file: UploadFile = File(...), title: str = Form(""), visibility: str = Form("staff"),
               user: User = Depends(require("manage_users")), db: Session = Depends(get_db)):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "upload")[:120]
    if not name.lower().endswith(UPLOAD_TYPES):
        raise HTTPException(400, f"unsupported type; allowed: {', '.join(UPLOAD_TYPES)}")
    if visibility not in ("public", "staff", "admin"):
        raise HTTPException(400, "visibility must be public, staff or admin")
    data = file.file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "document larger than 5 MB")
    from .rag.sources import parse_bytes
    try:
        text, recs = parse_bytes(name, data)                     # validate before storing anything
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(400, f"could not parse document: {e}")
    if not text.strip() and not recs:
        raise HTTPException(400, "document has no extractable text")
    from .storage import get_storage
    key = f"rag/uploads/{uuid.uuid4().hex[:10]}_{name}"
    get_storage().put_bytes(key, data, content_type="application/octet-stream")
    d = RagDocument(source_key=f"upload:{key}", source_type="UPLOAD", title=(title or name)[:300], uri=name, visibility=visibility,
                    status="PENDING", version=0, meta={"storage_key": key, "uploaded_by": user.username}, created_at=utcnow())
    db.add(d); db.flush()
    audit(db, user, "rag_document_uploaded", "rag_document", d.id, new={"name": name, "visibility": visibility, "bytes": len(data)})
    db.commit()
    return {"document": _doc_out(d), **_queue_ingest(db, user, force=False, keys=[d.source_key])}
