"""Hybrid retrieval over the versioned chunk index.

    ACL + scope filter (visibility allowed for the caller; run chunks only for the study area in context)
      ├─ lexical: BM25 over word tokens with query-side synonym expansion        (LEXICAL_TOP_K)
      └─ dense:   cosine over chunk embeddings of the current model version      (DENSE_TOP_K)
                  pgvector HNSW on PostgreSQL when available, else in-process numpy
    → reciprocal-rank fusion (k = 60) + small structural priors (named/selected object, glossary/FAQ match,
      definitional questions prefer docs over run records)                       (FUSED_TOP_K)

Authorisation is applied BEFORE scoring: a chunk the caller may not see is never a candidate, so it can never
reach the reranker, the context or the LLM. If the vector side fails, retrieval continues lexically and says so.
"""
from __future__ import annotations

import hashlib
import math
import threading
import time
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..db import RagChunk, RagDocument
from .config import S
from .embeddings import embed_query_cached, get_embedder
from .sources import NOT_KNOWLEDGE
from .text import DEFINE, expand, object_ids, tokens

RUN_TYPES = {"RUN_RESULTS"}
# developer-facing documents: kept searchable, but a user question should land on FAQ / glossary / workflow text first
DEV_DOCS = ("doc:docs/API.md", "doc:docs/ARCHITECTURE.md", "doc:docs/AUDIT.md", "doc:docs/IP_READINESS.md",
            "doc:docs/DEPLOYMENT.md", "doc:docs/REPRODUCIBILITY.md", "doc:docs/IMPLEMENTATION_STATUS.md",
            "doc:docs/PAPER_IMPLEMENTATION_MATRIX.md", "doc:docs/DEMO_VIDEO.md", "doc:docs/rag/")
TECH_Q = __import__("re").compile(r"\b(api|endpoint|route|http|json|sql|database|schema|table|code|function|python|fastapi|"
                                  r"backend|frontend|deploy\w*|docker|migration|token|implementation|implemented|architecture|"
                                  r"rag|retrieval|embedding|vector|pgvector|chunk\w*|audit|ip|patent\w*|reproduc\w*)\b",
                                  __import__("re").I)
UI_Q = __import__("re").compile(r"\b(page|screen|button|tab|where (do|can) i|how (do|can) i|open|navigate|menu)\b", __import__("re").I)
VISIBILITY_FOR_ROLE = {"public": {"public"}, "field": {"public"}, "staff": {"public", "staff"}, "admin": {"public", "staff", "admin"}}


@dataclass
class Cand:
    chunk_id: int
    source_key: str
    source_type: str
    title: str
    section: Optional[str]
    page: Optional[int]
    text: str
    visibility: str
    study_area: Optional[str]
    object_id: Optional[str]
    uri: Optional[str]
    run_id: Optional[str]
    meta: dict
    content_hash: str
    lexical: float = 0.0
    dense: float = 0.0
    fused: float = 0.0
    rerank: Optional[float] = None
    features: dict = field(default_factory=dict)

    @property
    def label(self) -> str:
        last = (self.section or "").split(" › ")[-1]
        base = last if last.startswith(("Glossary:", "/")) or self.meta.get("faq") or self.object_id else \
            (self.title if not last or last == self.title else f"{self.title} › {last}")
        if self.meta.get("faq"):
            base = f"Project FAQ › {last}"
        return base + (f" (p. {self.page})" if self.page else "")


@dataclass
class RetrievalResult:
    cands: list[Cand]
    method: str
    candidate_count: int
    retrieval_ms: float
    dense_used: bool
    errors: list[str] = field(default_factory=list)
    index_version: str = ""
    timings: dict = field(default_factory=dict)       # per-stage ms: lexical, embed, dense, fusion


class _MemIndex:
    def __init__(self, rows: list[Cand], vecs: dict[int, list[float]], model: Optional[str], version: str):
        self.rows, self.version, self.model = rows, version, model
        self.toks = [tokens(f"{r.title} {r.section or ''} {r.text}") for r in rows]
        self.tf = [Counter(t) for t in self.toks]
        self.avgdl = sum(len(t) for t in self.toks) / max(1, len(self.toks))
        df = Counter(w for t in self.toks for w in set(t))
        n = len(rows)
        self.idf = {w: math.log(1 + (n - d + 0.5) / (d + 0.5)) for w, d in df.items()}
        self.has_vec = np.array([r.chunk_id in vecs for r in rows], dtype=bool)
        dim = len(next(iter(vecs.values()))) if vecs else 0
        self.mat = np.zeros((n, dim), dtype=np.float32)
        for i, r in enumerate(rows):
            if r.chunk_id in vecs:
                v = np.asarray(vecs[r.chunk_id], dtype=np.float32)
                self.mat[i] = v / (np.linalg.norm(v) or 1.0)

    def bm25(self, q: list[str], i: int, k1: float = 1.4, b: float = 0.75) -> float:
        tf, dl, s = self.tf[i], len(self.toks[i]), 0.0
        for w in q:
            f = tf.get(w)
            if f:
                s += self.idf.get(w, 0) * f * (k1 + 1) / (f + k1 * (1 - b + b * dl / self.avgdl))
        return s


_lock = threading.Lock()
_mem: Optional[_MemIndex] = None
_version_cache: tuple[float, str] = (0.0, "")
_LEX_FAIL = False      # test hook: simulate a lexical-index outage
_rcache: "OrderedDict[str, list[tuple[int, float, float, float]]]" = OrderedDict()


def invalidate() -> None:
    global _version_cache, _mem
    with _lock:
        _version_cache, _mem = (0.0, ""), None
        _rcache.clear()


def index_version(db: Session) -> str:
    """Changes whenever any indexed document changes or the embedding model changes (part of every cache key)."""
    global _version_cache
    now = time.time()
    if now - _version_cache[0] < 5 and _version_cache[1]:
        return _version_cache[1]
    n, vs, last = db.query(func.count(RagDocument.id), func.coalesce(func.sum(RagDocument.version), 0), func.max(RagDocument.indexed_at)) \
        .filter(RagDocument.status == "INDEXED").one()
    emb = get_embedder()
    v = hashlib.sha256(f"{n}|{vs}|{last}|{emb.model_version() if emb else 'none'}".encode()).hexdigest()[:16]
    _version_cache = (now, v)
    return v


def _load(db: Session) -> _MemIndex:
    global _mem
    ver = index_version(db)
    with _lock:
        if _mem is not None and _mem.version == ver:
            return _mem
    emb = get_embedder()
    mv = emb.model_version() if emb else None
    q = db.query(RagChunk, RagDocument).join(RagDocument, RagChunk.document_id == RagDocument.id).filter(RagDocument.status.in_(("INDEXED", "STALE")))
    rows, vecs = [], {}
    for c, d in q.all():
        rows.append(Cand(c.id, d.source_key, d.source_type, d.title or d.source_key, c.section, c.page, c.text, c.visibility or "public",
                         c.study_area_id, c.object_id, d.uri, d.run_id, c.meta or {}, c.content_hash))
        if c.embedding is not None and c.embedding_model == mv:
            vecs[c.id] = c.embedding
    if not rows:                                   # first boot before the ingest job finished: index sources lexically
        from .chunking import chunk_document
        from .sources import collect
        i = -1
        for d in collect(db):
            for ch in chunk_document(d):
                rows.append(Cand(i, d.source_key, d.source_type, d.title, ch.section, ch.page, ch.text, d.visibility, d.study_area,
                                 ch.object_id, d.uri, d.run_id, {**ch.meta, "ephemeral": True}, ch.content_hash))
                i -= 1
    mem = _MemIndex(rows, vecs, mv, ver)
    with _lock:
        _mem = mem
    return mem


def _pg_dense(db: Session, qv: list[float], allowed: set, area: Optional[str], mv: str, k: int) -> dict[int, float]:
    sql = text("""SELECT c.id, 1 - (c.embedding_vec <=> CAST(:q AS vector)) AS sim
                  FROM rag_chunks c JOIN rag_documents d ON d.id = c.document_id
                  WHERE d.status IN ('INDEXED','STALE') AND c.embedding_model = :mv AND c.visibility = ANY(:vis)
                    AND (d.source_type <> 'RUN_RESULTS' OR c.study_area_id = :area)
                    AND COALESCE(c.meta->>'content_type', '') NOT IN ('evaluation_artifact', 'test_data', 'planning')
                  ORDER BY c.embedding_vec <=> CAST(:q AS vector) LIMIT :k""")
    res = db.execute(sql, {"q": "[" + ",".join(f"{x:.6f}" for x in qv) + "]", "mv": mv, "vis": list(allowed), "area": area or "", "k": k})
    return {int(r[0]): float(r[1]) for r in res}


def retrieve(db: Session, query: str, *, scope: str, study_area: Optional[str], selected: Optional[str] = None) -> RetrievalResult:
    t0 = time.perf_counter()
    errors: list[str] = []
    mem = _load(db)
    allowed = VISIBILITY_FOR_ROLE.get(scope, {"public"})
    mode = S.retrieval_mode
    key = hashlib.sha256(f"{mem.version}|{mode}|{scope}|{study_area}|{selected}|{' '.join(sorted(tokens(query)))}".encode()).hexdigest()
    pos = {r.chunk_id: i for i, r in enumerate(mem.rows)}

    cached = _rcache.get(key)
    if cached is not None:
        _rcache.move_to_end(key)
        cands = []
        for cid, lx, de, fu in cached:
            r = mem.rows[pos[cid]]
            cands.append(Cand(**{**r.__dict__, "lexical": lx, "dense": de, "fused": fu, "features": {}}))
        return RetrievalResult(cands, "cache", len(cands), (time.perf_counter() - t0) * 1000, any(c.dense for c in cands), [], mem.version)

    # 1. authorisation + scope BEFORE scoring
    idx = [i for i, r in enumerate(mem.rows)
           if r.visibility in allowed and (r.source_type not in RUN_TYPES or r.study_area == study_area)
           and (r.meta or {}).get("content_type") not in NOT_KNOWLEDGE]     # defence in depth: ingest already skips these
    q = expand(tokens(query))

    # 2. lexical (BM25) - a failure here degrades to vector-only search, never fails the question
    timings: dict = {}
    t1 = time.perf_counter()
    try:
        if _LEX_FAIL:
            raise RuntimeError("lexical index unavailable (test hook)")
        if mode == "vector":
            raise LookupError("lexical disabled (RAG_RETRIEVAL_MODE=vector)")
        lex = sorted(((mem.bm25(q, i), i) for i in idx), reverse=True)[:S.lexical_top_k]
        lex = [(s, i) for s, i in lex if s > 0]
    except Exception as e:  # noqa: BLE001
        lex = []
        errors.append(f"lexical retrieval unavailable: {type(e).__name__}")
    timings["lexical_ms"] = round((time.perf_counter() - t1) * 1000, 2)

    # 3. dense
    dense: list[tuple[float, int]] = []
    dense_used = False
    emb = get_embedder()
    if emb is not None and mem.has_vec.any() and mode != "bm25":
        try:
            t2 = time.perf_counter()
            qv = embed_query_cached(query)
            timings["embed_ms"] = round((time.perf_counter() - t2) * 1000, 2)
            t3 = time.perf_counter()
            if S.vector_store in ("auto", "pgvector") and _pgvector(db):
                sims = _pg_dense(db, qv, allowed, study_area, mem.model, S.dense_top_k)
                dense = sorted(((s, pos[c]) for c, s in sims.items() if c in pos), reverse=True)
            else:
                sub = np.array([i for i in idx if mem.has_vec[i]], dtype=int)
                if len(sub):
                    qa = np.asarray(qv, dtype=np.float32)
                    sims = mem.mat[sub] @ (qa / (np.linalg.norm(qa) or 1.0))
                    top = np.argsort(-sims)[:S.dense_top_k]
                    dense = [(float(sims[j]), int(sub[j])) for j in top]
            dense_used = bool(dense)
            timings["dense_ms"] = round((time.perf_counter() - t3) * 1000, 2)
        except Exception as e:  # noqa: BLE001 - vector side down: continue lexically, never fail the question
            errors.append(f"dense retrieval unavailable: {type(e).__name__}")
    elif emb is None:
        errors.append("dense retrieval disabled or embedding model unavailable")

    # 4. reciprocal-rank fusion + structural priors
    fused: dict[int, float] = {}
    lex_s, den_s = {i: s for s, i in lex}, {i: s for s, i in dense}
    k_rrf, w_lex, w_vec = S.rrf_k, S.rrf_lexical_weight, S.rrf_vector_weight
    for rank, (_, i) in enumerate(lex):
        fused[i] = fused.get(i, 0) + w_lex / (k_rrf + rank)
    for rank, (_, i) in enumerate(dense):
        fused[i] = fused.get(i, 0) + w_vec / (k_rrf + rank)
    ids_q = set(object_ids(query))
    qset = set(q)
    definitional = not ids_q and bool(DEFINE.search(query))
    technical = bool(TECH_Q.search(query))
    for i in list(fused):
        r = mem.rows[i]
        sec = r.section or ""
        term = set(tokens(sec.split(":", 1)[-1])) if sec.startswith("Glossary:") else set()
        if term and term <= qset:
            fused[i] += 0.06
        if r.meta.get("faq") and not ids_q:
            ft = set(tokens(r.section or r.title))
            if ft and len(ft & qset) / len(ft) >= 0.5:
                fused[i] += 0.05
        if r.source_key == "help:pages" and not UI_Q.search(query):
            fused[i] *= 0.5                                     # page help answers "how do I use this page", not analysis
        if not technical and r.source_key.startswith(DEV_DOCS):
            fused[i] *= 0.6                                     # developer docs only lead for technical questions
        if definitional and r.source_type in RUN_TYPES:
            fused[i] *= 0.4
        if r.object_id and r.object_id in ids_q:
            fused[i] += 0.08                                    # the stored record of the object named in the question
        elif r.object_id and r.object_id == selected:
            fused[i] += 0.02
        elif r.object_id and ids_q:
            fused[i] *= 0.3
    best = sorted(fused.items(), key=lambda x: -x[1])[:S.fused_top_k]
    cands = [Cand(**{**mem.rows[i].__dict__, "lexical": lex_s.get(i, 0.0), "dense": den_s.get(i, 0.0), "fused": s, "features": {}}) for i, s in best]
    _rcache[key] = [(c.chunk_id, c.lexical, c.dense, c.fused) for c in cands]
    if len(_rcache) > 256:
        _rcache.popitem(last=False)
    lex_ok = not any(e.startswith("lexical") for e in errors)
    vec = "dense/pgvector" if dense_used and _pgvector(db) else "dense"
    method = (f"hybrid(bm25+{vec})" if lex_ok else f"{vec} only (bm25 unavailable)") if dense_used else "lexical(bm25)"
    if any(r.meta.get("ephemeral") for r in mem.rows[:1]):
        method += "+unindexed"
    return RetrievalResult(cands, method, len(set(i for _, i in lex) | set(i for _, i in dense)), (time.perf_counter() - t0) * 1000,
                           dense_used, errors, mem.version, timings)


def _pgvector(db: Session) -> bool:
    from .ingest import pgvector_enabled
    return pgvector_enabled(db)
