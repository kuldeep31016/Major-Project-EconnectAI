"""Versioned, incremental ingestion (runs as the background job type ``rag_ingest``, never in the request path).

    collect sources → content hash → unchanged & same embedding model? skip
                                   → changed: PROCESSING → chunk → embed (embedding cache first) → replace chunks
                                              → version+1, INDEXED   (errors → FAILED with the reason)
    sources that disappeared (not uploads) → DELETED, chunks removed  (delete propagation)

Status values: PENDING, PROCESSING, INDEXED, FAILED, STALE (source changed since indexing), DELETED.
"""
from __future__ import annotations

import time
from typing import Callable, Optional

from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from ..db import RagChunk, RagDocument, RagEmbeddingCache, utcnow
from .chunking import chunk_document
from .embeddings import get_embedder
from .sources import Document, collect

EMBED_DIM = 384
_pgvector: Optional[bool] = None


def pgvector_enabled(db: Session) -> bool:
    """True when rag_chunks has the native vector column (migration 0007 on PostgreSQL with the extension)."""
    global _pgvector
    if _pgvector is None:
        try:
            _pgvector = db.bind.dialect.name == "postgresql" and any(c["name"] == "embedding_vec" for c in inspect(db.bind).get_columns("rag_chunks"))
        except Exception:  # noqa: BLE001
            _pgvector = False
    return _pgvector


def _embed(db: Session, texts_hashes: list[tuple[str, str]]) -> tuple[list[Optional[list[float]]], Optional[str], int]:
    """Vectors for (text, hash) pairs, reusing rag_embedding_cache; returns (vectors, model_version, newly_embedded)."""
    emb = get_embedder()
    if emb is None:
        return [None] * len(texts_hashes), None, 0
    mv = emb.model_version()
    hashes = list({h for _, h in texts_hashes})
    cached: dict[str, list[float]] = {}
    for i in range(0, len(hashes), 500):
        for row in db.query(RagEmbeddingCache).filter(RagEmbeddingCache.model == mv, RagEmbeddingCache.content_hash.in_(hashes[i:i + 500])):
            cached[row.content_hash] = row.vector
    todo = [(t, h) for t, h in dict((h, (t, h)) for t, h in texts_hashes).values() if h not in cached]
    if todo:
        vecs = emb.embed_documents([t for t, _ in todo])
        for (t, h), v in zip(todo, vecs):
            cached[h] = v
            db.add(RagEmbeddingCache(content_hash=h, model=mv, vector=v))
    return [cached.get(h) for _, h in texts_hashes], mv, len(todo)


def _index_document(db: Session, row: RagDocument, doc: Document) -> int:
    chunks = chunk_document(doc)
    vecs, mv, new = _embed(db, [(c.text, c.content_hash) for c in chunks])
    db.query(RagChunk).filter(RagChunk.document_id == row.id).delete(synchronize_session=False)
    added = []
    for c, v in zip(chunks, vecs):
        rc = RagChunk(document_id=row.id, chunk_index=c.index, section=(c.section or "")[:300] or None, page=c.page, text=c.text,
                      content_hash=c.content_hash, token_count=c.tokens, visibility=doc.visibility, study_area_id=doc.study_area,
                      object_id=c.object_id, meta={**c.meta, "title": doc.title, "uri": doc.uri, "run_id": doc.run_id},
                      embedding=v, embedding_model=mv if v is not None else None)
        db.add(rc)
        added.append((rc, v))
    db.flush()
    if mv and pgvector_enabled(db) and len(next((v for v in vecs if v), [])) == EMBED_DIM:
        for rc, v in added:
            if v is not None:
                db.execute(text("UPDATE rag_chunks SET embedding_vec = CAST(:v AS vector) WHERE id = :id"),
                           {"v": "[" + ",".join(f"{x:.6f}" for x in v) + "]", "id": rc.id})
    row.chunk_count, row.embedding_model = len(chunks), mv
    return new


def ingest(db: Session, *, force: bool = False, only_keys: Optional[set] = None,
           progress: Optional[Callable[[float, str], None]] = None) -> dict:
    t0 = time.perf_counter()
    docs = collect(db)
    emb = get_embedder()
    mv = emb.model_version() if emb else None
    existing = {r.source_key: r for r in db.query(RagDocument).all()}
    st = {"documents": len(docs), "indexed": 0, "skipped_unchanged": 0, "failed": 0, "deleted": 0, "chunks_embedded": 0,
          "embedding_model": mv}
    seen = set()
    for i, doc in enumerate(docs):
        seen.add(doc.source_key)
        if only_keys and doc.source_key not in only_keys:
            continue
        h = doc.content_hash
        row = existing.get(doc.source_key)
        if row and not force and row.status == "INDEXED" and row.content_hash == h and row.embedding_model == mv:
            st["skipped_unchanged"] += 1                       # unchanged content + same embedding model: no work
            continue
        if row is None:
            row = RagDocument(source_key=doc.source_key, version=0, created_at=utcnow())
            db.add(row)
        changed = row.content_hash != h
        row.source_type, row.title, row.uri = doc.source_type, doc.title[:300], (doc.uri or "")[:500] or None
        row.visibility, row.study_area_id, row.run_id = doc.visibility, doc.study_area, doc.run_id
        row.status, row.updated_at, row.meta = "PROCESSING", utcnow(), {**(row.meta or {}), **doc.meta}
        db.flush()
        sp = db.begin_nested()                                  # one bad document must not undo the others
        try:
            st["chunks_embedded"] += _index_document(db, row, doc)
            sp.commit()
            row.content_hash = h
            row.version = (row.version or 0) + (1 if changed else 0)
            row.status, row.error, row.indexed_at = "INDEXED", None, utcnow()
            st["indexed"] += 1
        except Exception as e:  # noqa: BLE001
            sp.rollback()
            row.status, row.error = "FAILED", f"{type(e).__name__}: {e}"[:500]
            st["failed"] += 1
        db.commit()
        if progress:
            progress((i + 1) / max(1, len(docs)), f"indexed {doc.source_key}")
    if not only_keys:
        for key, row in existing.items():
            if key not in seen and row.source_type != "UPLOAD" and row.status != "DELETED":
                db.query(RagChunk).filter(RagChunk.document_id == row.id).delete(synchronize_session=False)
                row.status, row.chunk_count, row.updated_at = "DELETED", 0, utcnow()
                st["deleted"] += 1
        db.commit()
    from .retrieval import invalidate
    invalidate()
    st["seconds"] = round(time.perf_counter() - t0, 2)
    return st


def delete_document(db: Session, row: RagDocument) -> None:
    db.query(RagChunk).filter(RagChunk.document_id == row.id).delete(synchronize_session=False)
    row.status, row.chunk_count, row.updated_at = "DELETED", 0, utcnow()
    db.commit()
    from .retrieval import invalidate
    invalidate()


def detect_stale(db: Session) -> int:
    """Mark INDEXED documents whose source content changed since indexing as STALE (no re-indexing here)."""
    current = {d.source_key: d.content_hash for d in collect(db)}
    n = 0
    for row in db.query(RagDocument).filter(RagDocument.status == "INDEXED").all():
        if row.source_key in current and current[row.source_key] != row.content_hash:
            row.status, n = "STALE", n + 1
    db.commit()
    return n


def index_status(db: Session) -> dict:
    by = dict(db.query(RagDocument.status, func.count()).group_by(RagDocument.status).all())
    chunks = db.query(func.count(RagChunk.id)).scalar() or 0
    embedded = db.query(func.count(RagChunk.id)).filter(RagChunk.embedding_model.isnot(None)).scalar() or 0
    return {"documents_by_status": by, "chunks": chunks, "chunks_embedded": embedded, "pgvector": pgvector_enabled(db)}
