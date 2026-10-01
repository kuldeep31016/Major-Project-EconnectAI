"""ContextBuilder: turns reranked candidates into a compact, de-duplicated, citation-ready context within a token
budget. Retrieved text is UNTRUSTED: instruction-like lines are neutralised and every item is fenced so it cannot
pose as instructions."""
from __future__ import annotations

import re
from dataclasses import dataclass

from .config import S
from .cost import estimate_tokens
from .retrieval import Cand
from .text import tokens

INJECTION = re.compile(
    r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?)"
    r"|reveal\s+(the\s+)?(system|hidden)\s+prompt|you\s+are\s+now\s+|act\s+as\s+(an?\s+)?(unrestricted|developer)|jailbreak"
    r"|(print|show|output|leak)\s+(the\s+)?(api[\s_-]?key|secret|password|credentials?|env(ironment)?\s+variables?)", re.I)


@dataclass
class ContextItem:
    sid: str
    cand: Cand
    content: str
    tokens: int
    sanitized: bool


def _neutralise(text: str) -> tuple[str, bool]:
    lines, hit = [], False
    for ln in text.splitlines():
        if INJECTION.search(ln):
            lines.append("[instruction-like text removed from source]")
            hit = True
        else:
            lines.append(ln.replace("</source>", "</ source>"))
    return "\n".join(lines), hit


def build_context(cands: list[Cand], budget: int | None = None) -> list[ContextItem]:
    budget = budget or S.max_context_tokens
    kept: list[Cand] = []
    seen_hash, seen_sets = set(), []
    for c in sorted(cands, key=lambda c: -(c.rerank if c.rerank is not None else c.fused)):
        if c.content_hash in seen_hash:
            continue                                             # exact duplicate (same text in two documents)
        ts = set(tokens(c.text))
        if any(len(ts & s) / max(1, len(ts | s)) >= 0.85 for s in seen_sets):
            continue                                             # near duplicate
        seen_hash.add(c.content_hash)
        seen_sets.append(ts)
        kept.append(c)
    items, used = [], 0
    for c in kept:                                               # strongest first; stop at the budget, never mid-chunk
        content, hit = _neutralise(c.text)
        t = estimate_tokens(content)
        if used + t > budget:
            if not items:                                        # the single best chunk always fits (trimmed at a sentence)
                content = content[: budget * 4].rsplit(". ", 1)[0] + "."
                t = estimate_tokens(content)
            else:
                continue
        items.append(ContextItem(f"S{len(items) + 1}", c, content, t, hit))
        used += t
    return items


def render(items: list[ContextItem]) -> str:
    parts = []
    for it in items:
        c = it.cand
        attrs = f'id="{it.sid}" title="{c.title}"' + (f' section="{c.section}"' if c.section and c.section != c.title else "") \
            + (f' page="{c.page}"' if c.page else "") + (f' run="{c.run_id}"' if c.run_id else "")
        parts.append(f"<source {attrs}>\n{it.content}\n</source>")
    return "\n\n".join(parts)
