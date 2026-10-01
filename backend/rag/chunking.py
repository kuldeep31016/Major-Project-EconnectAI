"""Structure-aware chunking (no fixed character windows).

Markdown/text is parsed into blocks - heading, paragraph, list, table, fenced code, page break - and packed per
section up to CHUNK_SIZE tokens. A chunk never crosses a heading; the heading path is stored as ``section`` and the
nearest heading is repeated at the top of every chunk so the text stays meaningful on its own. Tables and code are
kept whole unless larger than MAX_CHUNK_SIZE (tables are then split by rows with the header repeated). When a section
continues into a new chunk, the last sentences (≤ CHUNK_OVERLAP tokens) are carried over. Chunks shorter than
MIN_CHUNK_SIZE are merged into their neighbour in the same section.

Records (a patch, a candidate, an FAQ answer, a glossary term, a CSV block) are self-contained: one record → one
chunk, split by sentences only if it exceeds MAX_CHUNK_SIZE.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Optional

from .config import S
from .cost import estimate_tokens
from .sources import Document


@dataclass
class ChunkOut:
    index: int
    text: str
    section: Optional[str]
    page: Optional[int]
    object_id: Optional[str] = None
    meta: dict = field(default_factory=dict)

    @property
    def tokens(self) -> int:
        return estimate_tokens(self.text)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.text.encode()).hexdigest()


_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'])")


def _split_sentences(text: str, max_tokens: int) -> list[str]:
    parts, cur = [], ""
    for s in _SENT.split(text):
        if cur and estimate_tokens(cur + " " + s) > max_tokens:
            parts.append(cur.strip())
            cur = s
        else:
            cur = f"{cur} {s}" if cur else s
    if cur.strip():
        parts.append(cur.strip())
    out = []
    for p in parts:                       # a single sentence longer than the limit: hard split on words
        while estimate_tokens(p) > max_tokens:
            cut = p.rfind(" ", 0, max_tokens * 4) or max_tokens * 4
            out.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            out.append(p)
    return out


def _blocks(text: str):
    """Yield (kind, text, page) with kind in heading:N | para | list | table | code."""
    page, buf, kind = 1, [], None
    lines = text.split("\n")
    i = 0

    def flush():
        nonlocal buf, kind
        if buf and "".join(buf).strip():
            yield_ = (kind or "para", "\n".join(buf).strip(), page)
            buf, kind = [], None
            return yield_
        buf, kind = [], None
        return None

    out = []
    while i < len(lines):
        ln = lines[i]
        if "\f" in ln:
            before, _, after = ln.partition("\f")
            lines[i:i + 1] = [before, "\f", after] if before or after else ["\f"]
            ln = lines[i]
        if ln == "\f":
            b = flush()
            if b:
                out.append(b)
            page += 1
            i += 1
            continue
        if ln.startswith("```"):
            b = flush()
            if b:
                out.append(b)
            code = [ln]
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            code.append("```")
            out.append(("code", "\n".join(code), page))
            i += 1
            continue
        m = re.match(r"^(#{1,6})\s+(.*)", ln)
        if m:
            b = flush()
            if b:
                out.append(b)
            out.append((f"heading:{len(m.group(1))}", m.group(2).strip(), page))
            i += 1
            continue
        k = "table" if ln.lstrip().startswith("|") else "list" if re.match(r"^\s*([-*+]|\d+[.)])\s", ln) else "para" if ln.strip() else None
        if k is None:
            b = flush()
            if b:
                out.append(b)
        elif kind not in (None, k) and not (kind == "list" and k == "para" and ln.startswith("  ")):
            b = flush()
            if b:
                out.append(b)
            kind = k
            buf.append(ln)
        else:
            kind = kind or k
            buf.append(ln)
        i += 1
    b = flush()
    if b:
        out.append(b)
    return out


def _split_table(table: str, max_tokens: int) -> list[str]:
    rows = table.split("\n")
    head = rows[:2] if len(rows) > 1 and re.match(r"^\s*\|?\s*:?-{2,}", rows[1]) else rows[:1]
    body = rows[len(head):]
    out, cur = [], []
    for r in body:
        if cur and estimate_tokens("\n".join(head + cur + [r])) > max_tokens:
            out.append("\n".join(head + cur))
            cur = []
        cur.append(r)
    if cur:
        out.append("\n".join(head + cur))
    return out or [table]


def chunk_document(doc: Document) -> list[ChunkOut]:
    size, overlap, mn, mx = S.chunk_size, S.chunk_overlap, S.min_chunk_size, S.max_chunk_size
    out: list[ChunkOut] = []

    for rec in doc.records:
        body = rec.text if rec.text.startswith(rec.title) else f"{rec.title}\n{rec.text}"
        pieces = [body] if estimate_tokens(body) <= mx else [f"{rec.title}\n{p}" for p in _split_sentences(rec.text, mx - estimate_tokens(rec.title) - 2)]
        for p in pieces:
            out.append(ChunkOut(len(out), p, rec.title, None, rec.object_id, dict(rec.meta)))

    if doc.text:
        paged = "\f" in doc.text                                 # only paginated sources (PDF) carry page numbers
        path: list[tuple[int, str]] = []
        cur: list[str] = []
        cur_page: Optional[int] = None

        def section() -> Optional[str]:
            return " › ".join(t for _, t in path) or None

        def header() -> str:
            return f"{'#' * path[-1][0]} {path[-1][1]}\n" if path else ""

        def emit(carry: bool):
            nonlocal cur
            body = "\n\n".join(cur).strip()
            if body:
                text = header() + body
                if out and out[-1].section == section() and estimate_tokens(body) < mn and out[-1].tokens + estimate_tokens(body) <= mx:
                    out[-1].text += "\n\n" + body                     # too small: merge into previous of same section
                else:
                    out.append(ChunkOut(len(out), text, section(), cur_page if paged else None))
            tail = []
            if carry and body and overlap:
                for s in reversed(_SENT.split(body)):
                    if estimate_tokens(" ".join([s] + tail)) > overlap:
                        break
                    tail.insert(0, s)
            cur = [" ".join(tail)] if tail else []

        for kind, text, page in _blocks(doc.text):
            if kind.startswith("heading:"):
                emit(carry=False)
                lvl = int(kind.split(":")[1])
                path = [p for p in path if p[0] < lvl] + [(lvl, text)]
                continue
            cur_page = cur_page or page
            pieces = [text]
            if estimate_tokens(text) > mx:
                pieces = _split_table(text, mx) if kind == "table" else _split_sentences(text, size) if kind in ("para", "list") else [text[i:i + mx * 4] for i in range(0, len(text), mx * 4)]
            for piece in pieces:
                if cur and estimate_tokens("\n\n".join(cur + [piece])) > size:
                    emit(carry=kind in ("para", "list"))
                    cur_page = page
                cur.append(piece)
        emit(carry=False)

    for i, c in enumerate(out):
        c.index = i
    return out
