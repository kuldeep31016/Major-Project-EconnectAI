"""Deterministic query understanding (no LLM call): classification, follow-up rewriting, conversation memory.

Types: casual · unsafe (prompt injection / secret extraction) · follow_up · ambiguous · multi_step · analytical ·
knowledge. Structured questions are recognised by the structured-tool layer (backend/chat.py) before retrieval.
Rewriting only happens for follow-ups; exact identifiers are preserved; original / normalised / rewritten are kept
for tracing.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from .config import S
from .context import INJECTION
from .text import object_ids, tokens

CASUAL = re.compile(r"^\s*(hi+|hey+|hel+o+|hiya|yo|namaste|thanks?|thank you( so much)?|thx|ok(ay)?|cool|great|nice|good (morning|afternoon|evening|night)|"
                    r"high|bye|goodbye|see you|how are you( doing)?|who are you|what are you|what can you do|what do you do|help( me)?)"
                    r"(\s+(there|assistant|bot|ecoconnect(ai)?|buddy|friend|again))?[\s!.?,]*$", re.I)
SECRETS = re.compile(r"\b(api[\s_-]?key|secret key|password|credential|token|env(ironment)? variables?|system prompt|hidden (prompt|instructions))\b", re.I)
FOLLOW = re.compile(r"^\s*(and|what about|how about|and what about|same for|also|then)\b|\b(which one|that one|the other one|those|them|it|its|this one)\b", re.I)
ANALYTICAL = re.compile(r"\b(why|what makes|how come|reason|explain|compare|difference|versus|vs\.?|how does|how do|what if|impact|implication|trade[- ]?off|interpret)\b", re.I)
AREA_WORDS = ("kerala", "sundarbans", "mannar", "gulf of mannar", "odisha", "bhitarkanika", "vembanad")


@dataclass
class QueryPlan:
    original: str
    normalized: str
    rewritten: Optional[str]
    qtype: str
    reason: str = ""
    memory: str = ""
    entities: list[str] = field(default_factory=list)

    @property
    def effective(self) -> str:
        return self.rewritten or self.original


def _entities(text: str) -> list[str]:
    ents = object_ids(text)
    tl = text.lower()
    ents += [a for a in AREA_WORDS if a in tl]
    return ents


def memory_summary(history: list[dict]) -> str:
    """Bounded, deterministic summary of earlier turns (topics + entities), never their raw text."""
    if not history:
        return ""
    ents, topics = [], []
    for h in history:
        if h.get("role") == "user":
            ents += _entities(h.get("text", ""))
            topics += [t for t in tokens(h.get("text", "")) if len(t) > 4][:3]
    ents = list(dict.fromkeys(ents))[-6:]
    topics = list(dict.fromkeys(topics))[-8:]
    s = ("Earlier in this conversation the user asked about: " + ", ".join(ents + topics)) if ents or topics else ""
    return s[:300]


def classify(question: str, history: Optional[list[dict]] = None, selected: Optional[str] = None) -> QueryPlan:
    q = " ".join(question.split())
    norm = " ".join(tokens(q))
    hist = [h for h in (history or []) if h.get("role") in ("user", "assistant") and h.get("text")][-S.history_turns:]
    mem = memory_summary(hist)
    if INJECTION.search(q) or (SECRETS.search(q) and re.search(r"\b(show|reveal|print|give|what is|tell|leak|dump)\b", q, re.I)):
        return QueryPlan(q, norm, None, "unsafe", "instruction-override or secret-extraction attempt", mem)
    if CASUAL.match(q):
        return QueryPlan(q, norm, None, "casual", "greeting / small talk", mem)
    ents = _entities(q)
    prev_user = next((h["text"] for h in reversed(hist) if h["role"] == "user"), None)
    if prev_user and FOLLOW.search(q) and not object_ids(q):
        prev_ents = _entities(prev_user)
        new_area = [e for e in ents if e in AREA_WORDS]
        if new_area and prev_ents:                              # "and in Sundarbans?" -> previous question, new area
            rw = prev_user
            for e in prev_ents:
                if e in AREA_WORDS:
                    rw = re.sub(e, new_area[0], rw, flags=re.I)
            rw = rw if rw != prev_user else f"{prev_user} ({new_area[0]})"
        else:                                                   # "which one has the highest gain?" -> keep prior topic
            carry = [e for e in prev_ents if e not in q]
            rw = f"{q} (context: {prev_user}{'; ' + ', '.join(carry) if carry else ''})"
        return QueryPlan(q, norm, rw[:300], "follow_up", "resolved against the previous question", mem, _entities(rw))
    if re.fullmatch(r"\s*(tell me about|explain|what about|more about)?\s*(this|that|it)\s*[?.!]*\s*", q, re.I) and not selected:
        return QueryPlan(q, norm, None, "ambiguous", "no object selected and no earlier question to refer to", mem)
    if len(re.findall(r"\?", q)) > 1 or re.search(r"\b(compare|versus|vs\.?)\b", q, re.I) or (" and " in q.lower() and len(object_ids(q)) > 1):
        return QueryPlan(q, norm, None, "multi_step", "several parts or a comparison", mem, ents)
    if ANALYTICAL.search(q):
        return QueryPlan(q, norm, None, "analytical", "explanation requested", mem, ents)
    return QueryPlan(q, norm, None, "knowledge", "lookup in documentation / results", mem, ents)
