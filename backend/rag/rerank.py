"""Conditional reranking of the fused candidates.

    heuristic (default)  transparent features: coverage of the question's content words, exact bigram phrases,
                         identifier match, title/section match, dense similarity, curated-source bonus. Local, ~0 ms.
    cross-encoder        fastembed TextCrossEncoder (RERANKER_MODEL); loaded lazily; any failure → heuristic.
    none                 keep fused order.

Reranking is skipped when retrieval is already decisive (top fused score clearly ahead of the runner-up and the
top chunk covers the question), which is most identifier and FAQ questions.
"""
from __future__ import annotations

import time
from typing import Optional

from .config import S
from .retrieval import UI_Q, Cand
from .text import expand, object_ids, stem, tokens

_INTERROGATIVE = frozenset({"why", "when", "where", "whom", "whose", "much", "many", "any", "some", "there", "here"})


def content_terms(query: str) -> set:
    return {t for t in tokens(query) if t not in _INTERROGATIVE and not object_ids(t)}


def coverage(query: str, c: Cand) -> float:
    terms = content_terms(query)
    if not terms:
        return 1.0
    have = set(tokens(f"{c.title} {c.section or ''} {c.text}"))
    stems = {stem(h) for h in have}
    hit = sum(1 for t in terms if t in have or stem(t) in stems or any(e in have or stem(e) in stems for e in expand([t])[1:]))
    return hit / len(terms)


def features(query: str, c: Cand) -> dict:
    qt = tokens(query)
    body = f"{c.title} {c.section or ''} {c.text}".lower()
    bigrams = [f"{a} {b}" for a, b in zip(qt, qt[1:])]
    ids = object_ids(query)
    head = set(tokens(f"{c.section or ''} {c.title}"))
    return {
        "coverage": coverage(query, c),
        "phrase": (sum(1 for bg in bigrams if bg in body) / len(bigrams)) if bigrams else 0.0,
        "identifier": 1.0 if ids and c.object_id in ids else 0.0,
        "heading": len(head & set(qt)) / max(1, len(set(qt))),
        "dense": max(0.0, c.dense),
        "curated": 1.0 if (c.meta.get("faq") or (c.section or "").startswith("Glossary:")) else 0.0,
        # page help only answers "how do I use this page" questions
        "prior": 1.0 if c.source_key != "help:pages" or UI_Q.search(query) else 0.6,
    }


def heuristic_score(f: dict) -> float:
    return f.get("prior", 1.0) * (0.35 * f["coverage"] + 0.12 * f["phrase"] + 0.30 * f["identifier"] + 0.08 * f["heading"] + 0.10 * f["dense"] + 0.05 * f["curated"])


_ce = None
_ce_error: Optional[str] = None


def _cross_encoder():
    global _ce, _ce_error
    if _ce is None and _ce_error is None:
        try:
            from fastembed.rerank.cross_encoder import TextCrossEncoder
            from ecoconnect.pipeline.config import REPO_ROOT
            _ce = TextCrossEncoder(S.reranker_model, cache_dir=str(REPO_ROOT / S.embedding_cache_dir))
        except Exception as e:  # noqa: BLE001
            _ce_error = f"{type(e).__name__}"
    return _ce


def decisive(query: str, cands: list[Cand]) -> bool:
    if len(cands) < 2:
        return True
    a, b = cands[0], cands[1]
    return a.fused >= 1.35 * b.fused and coverage(query, a) >= 0.75


def rerank(query: str, cands: list[Cand], provider: Optional[str] = None) -> tuple[list[Cand], str, float]:
    """Returns (top RAG_RERANK_TOP_K candidates, reranker used, ms)."""
    t0 = time.perf_counter()
    for c in cands:
        c.features = features(query, c)
    kind = provider or S.reranker_provider
    if kind == "none" or decisive(query, cands):
        used = "skipped(decisive)" if kind != "none" else "none"
        for c in cands:
            c.rerank = heuristic_score(c.features)                 # still used for confidence
        return cands[:S.rerank_top_k], used, (time.perf_counter() - t0) * 1000
    used = "heuristic"
    if kind == "cross-encoder":
        ce = _cross_encoder()
        if ce is not None:
            try:
                scores = list(ce.rerank(query, [c.text[:2000] for c in cands]))
                lo, hi = min(scores), max(scores)
                for c, s in zip(cands, scores):
                    c.rerank = 0.7 * ((s - lo) / ((hi - lo) or 1.0)) + 0.3 * heuristic_score(c.features)
                used = "cross-encoder"
            except Exception:  # noqa: BLE001 - reranker failure: fall back to the heuristic, never fail the question
                used = "heuristic(cross-encoder failed)"
        else:
            used = "heuristic(cross-encoder unavailable)"
    if used.startswith("heuristic"):
        for c in cands:
            c.rerank = heuristic_score(c.features) + 0.15 * (c.fused / (cands[0].fused or 1.0))
    ranked = sorted(cands, key=lambda c: -(c.rerank or 0.0))
    return ranked[:S.rerank_top_k], used, (time.perf_counter() - t0) * 1000


def confidence(query: str, top: list[Cand]) -> tuple[float, Optional[str]]:
    """0..1 grounding confidence from coverage of the best chunk, supporting sources and dense agreement."""
    if not top:
        return 0.0, "no relevant passages retrieved"
    best = max(coverage(query, c) for c in top[:3])
    named = object_ids(query)
    if any(c.object_id and c.object_id in named and coverage(query, c) >= 0.5 for c in top[:3]):
        best = max(best, 0.8)                     # the named object's record answers the question (not just mentions it)
    elif len(named) >= 2 and set(named) <= {c.object_id for c in top if c.object_id}:
        best = max(best, 0.75)                    # comparison: every named object's stored record was retrieved
    support = len({c.source_key for c in top if coverage(query, c) >= 0.5})
    dense = max((c.dense for c in top), default=0.0)
    conf = round(0.6 * best + 0.25 * min(1.0, support / 2) + 0.15 * max(0.0, min(1.0, dense)), 3)
    if best < 0.6:
        return conf, "the question's key terms are not covered by the available sources"
    if conf < S.min_confidence:
        return conf, "retrieval confidence below threshold"
    return conf, None
