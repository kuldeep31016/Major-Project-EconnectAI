"""Knowledge-question orchestration: retrieve → rerank → confidence/abstain → context → (LLM | extractive) → citations.

Called by backend/chat.py after classification, structured tools and the answer cache. Never answers from model
memory: if the LLM is off, capped or failing, the answer is extracted verbatim from the same retrieved evidence.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from sqlalchemy.orm import Session

from .classify import QueryPlan
from .context import build_context, render
from .generation import SYSTEM_PROMPT, GenResult, LLMUnavailable, generate_with_fallback, route, stream_with_fallback
from .rerank import confidence, coverage, rerank
from .retrieval import Cand, retrieve
from .text import object_ids, tokens

ABSTAIN = "I couldn't find enough information in the available project data to answer that reliably."
LOW_CONF = ("I couldn't find a reliable answer to that in EcoConnectAI's data or documents, so I won't guess. "
            "I can help with the study areas, habitat patches, connectivity, what-if scenarios, restoration and the model.")
DEGRADED = ("I can still answer questions using the application's stored project data, but generative explanation "
            "is temporarily unavailable.")
_CITE = re.compile(r"\[(S\d+)\]")
# words that only point at the object ("why this location?", "is this site good?") - not information requests
GENERIC_ABOUT_OBJECT = frozenset({"why", "location", "site", "place", "area", "patch", "candidate", "good", "bad", "important",
                                  "critical", "matter", "chosen", "selected", "one", "here", "there", "tell", "explain", "more",
                                  "about", "detail", "describe", "summary", "information", "info"})


@dataclass
class KnowledgeAnswer:
    text: str
    tier: str                          # retrieval | llm | refused
    citations: list[dict]
    confidence: float
    note: Optional[str] = None
    trace: dict = field(default_factory=dict)
    gen: Optional[GenResult] = None


def citation(c: Cand, sid: str) -> dict:
    return {"id": sid, "label": c.label, "title": c.title, "section": c.section if c.section != c.title else None, "page": c.page,
            "type": c.source_type.lower(), "uri": c.uri, "run_id": c.run_id}


def validate_citations(text: str, items) -> tuple[str, list[dict]]:
    by = {it.sid: it for it in items}
    used = []
    for sid in _CITE.findall(text):
        if sid in by and sid not in used:
            used.append(sid)
    clean = _CITE.sub(lambda m: m.group(0) if m.group(1) in by else "", text)      # fabricated ids removed
    return clean.strip(), [citation(by[s].cand, s) for s in used]


# --------------------------------------------------------------------------- extractive (no generation)
_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(])")


def _sentences(text: str) -> list[str]:
    out = []
    for line in text.splitlines():
        line = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", line)
        line = re.sub(r"[`*|>#]+", " ", line).strip(" -•\t")
        if not line or line.lower().startswith(("see ", "companion", "these limitations are shown")):
            continue
        for s in _SENT.split(re.sub(r"\s+", " ", line)):
            s = s.strip()
            if len(s) > 25:
                out.append(s if len(s) < 420 else s[:300].rsplit(" ", 1)[0] + " …")   # long table rows kept, trimmed
    return out


def _record_answer(q: str, it, robustness, caveat) -> Optional[str]:
    """Self-contained records (FAQ answer, glossary term, patch/candidate) are returned whole, without their title."""
    c = it.cand
    body = it.content.split("\n", 1)[1] if "\n" in it.content else it.content
    if c.meta.get("faq"):
        return " ".join(body.split())
    if (c.section or "").startswith("Glossary:"):
        t = body.strip()
        return t[:1].upper() + t[1:]
    if c.object_id and c.object_id in object_ids(q):
        text = body.split(" Criticality rank #")[0].strip()
        if c.object_id.startswith("P") and robustness:
            text += " " + robustness(c.object_id)
        return (text + (" " + caveat if caveat else "")).strip()
    return None


def extractive(q: str, items, robustness: Optional[Callable[[str], str]] = None, caveat: str = "") -> tuple[str, list[dict]]:
    if not items:
        return "", []
    qt = set(tokens(q))
    for rank, it in enumerate(items[:2]):
        title = set(tokens(it.cand.section or ""))
        if rank == 0 or (it.cand.meta.get("faq") and title and len(title & qt) / len(title) >= 0.5):
            r = _record_answer(q, it, robustness, caveat)
            if r:
                return r, [citation(it.cand, it.sid)]
    best, best_src = (0.0, []), None
    for rank, it in enumerate(items[:2]):                     # best 3-sentence window across the top two passages
        sents = _sentences(it.content)
        toks = [set(tokens(x)) for x in sents]
        acr = {w.lower() for w in re.findall(r"\b[A-Z]{2,}\b", q)}                # IIC, PC, ECA ... named in the question
        ov = [len(qt & t) + 2 * len(acr & t) for t in toks]
        for i in range(len(sents)):
            if not ov[i]:
                continue                                      # windows start at a relevant sentence
            win = sents[i:i + 3]
            distinct = len(qt & set().union(*toks[i:i + 3]))   # prefer windows covering more of the question
            score = 2 * distinct + sum(ov[i:i + 3]) + ov[i] - 0.5 * rank
            if score > best[0]:
                best, best_src = (score, win), it
    if not best_src:
        return "", []
    return " ".join(best[1]), [citation(best_src.cand, best_src.sid)]


# --------------------------------------------------------------------------- main entry
def answer(db: Session, plan: QueryPlan, *, scope: str, study_area: str, selected: Optional[str], app_data: str,
           llm_block: Optional[str], robustness: Optional[Callable[[str], str]] = None, caveat: str = "",
           on_delta: Optional[Callable[[str], None]] = None) -> KnowledgeAnswer:
    q = plan.effective
    rr = retrieve(db, q, scope=scope, study_area=study_area, selected=selected)
    top, reranker, rerank_ms = rerank(q, rr.cands)
    conf, abstain = confidence(q, top)
    trace = {"retrieval_method": rr.method, "candidate_count": rr.candidate_count, "retrieval_ms": round(rr.retrieval_ms, 1),
             "reranker": reranker, "rerank_ms": round(rerank_ms, 1), "index_version": rr.index_version, "errors": rr.errors,
             "retrieved": [{"source": c.label, "category": c.source_type, "score": round(c.rerank or c.fused, 4), "chunk_id": c.chunk_id} for c in top],
             "confidence": conf, "abstain_reason": abstain}
    if abstain:
        return KnowledgeAnswer(LOW_CONF, "refused", [], conf, trace=trace)
    named = set(object_ids(q))
    rec = next((c for c in top if c.object_id and c.object_id in named), None)
    specific = {t for t in tokens(q) if t not in GENERIC_ABOUT_OBJECT} - {i.lower() for i in named}
    covered_elsewhere = 0.0
    if rec is not None and specific:
        for c in top[:3]:                                   # one passage must cover it - not words pooled across passages
            seen = set(tokens(f"{c.section or ''} {c.text}"))
            covered_elsewhere = max(covered_elsewhere, sum(1 for t in specific if t in seen) / len(specific))
    if rec is not None and specific and coverage(" ".join(specific), rec) < 0.5 and covered_elsewhere < 0.9:
        # asks about the object something neither its record nor the documentation holds (e.g. species in P07)
        trace["abstain_reason"] = "named object's stored record does not cover the question"
        return KnowledgeAnswer(f"The stored results for {rec.object_id} do not include that information. They cover its area, "
                               "criticality, links, model confidence and (for candidates) the simulated connectivity gain; "
                               "anything else would need field survey data.", "refused", [citation(rec, "S1")], conf, trace=trace)
    items = build_context(top)
    trace["selected_chunks"] = [it.cand.chunk_id for it in items]
    trace["context_tokens"] = sum(it.tokens for it in items)
    trace["sanitized_sources"] = sum(it.sanitized for it in items)

    if llm_block is None:
        user = (f"<app_data>\n{app_data}\n</app_data>\n\n" if app_data else "") + render(items) \
            + (f"\n\n<conversation>{plan.memory}</conversation>" if plan.memory else "") + f"\n\nQuestion: {q}"
        trace["model"] = route(plan.qtype)
        try:
            gen = None
            if on_delta is not None:
                parts = []
                for part in stream_with_fallback(SYSTEM_PROMPT, user, plan.qtype):
                    if isinstance(part, GenResult):
                        gen = part
                    else:
                        parts.append(part)
                        on_delta(part)
            else:
                gen = generate_with_fallback(SYSTEM_PROMPT, user, plan.qtype)
            text, cites = validate_citations(gen.text, items)
            trace.update({"model": gen.model, "fallback_used": gen.fallback_used, "attempts": gen.attempts})
            if text.startswith(ABSTAIN[:40]):
                return KnowledgeAnswer(ABSTAIN, "refused", [], conf, trace=trace, gen=gen)
            if not cites:                                    # ungrounded output is never shown
                trace["grounding_failure"] = True
                llm_block = "LLM answer had no valid citation"
            else:
                return KnowledgeAnswer(text, "llm", cites, conf, trace=trace, gen=gen)
        except LLMUnavailable as e:
            llm_block = f"LLM unavailable: {e}"
        trace["llm_error"] = llm_block

    text, cites = extractive(q, items, robustness, caveat)
    if not text:
        return KnowledgeAnswer(LOW_CONF, "refused", [], conf, trace=trace)
    degraded = llm_block and (llm_block.startswith(("LLM unavailable", "LLM answer")) or "limit" in llm_block)
    trace["llm_block"] = llm_block
    return KnowledgeAnswer(text, "retrieval", cites, conf, note=DEGRADED if degraded else None, trace=trace)
