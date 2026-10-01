"""Shared text utilities for lexical retrieval, caching keys and grounding checks."""
from __future__ import annotations

import re

_WORD = re.compile(r"[a-z0-9]+(?:\.[a-z0-9]+)*")
STOP = frozenset("a an the of to in on for and or is are was were be been being it its this that these those what which who "
                 "how does do did can could would should will with by from as at about into than then there their our we you "
                 "i me my your please tell show give explain".split())
# query-side expansion for common wording differences (documents are not expanded)
EXPAND = {"important": ("matter", "critical", "criticality"), "matter": ("important",), "critical": ("important", "criticality"),
          "validated": ("accurate", "validation"), "accurate": ("accuracy", "validated"), "accuracy": ("accurate",),
          "work": ("answer",), "approved": ("approval",), "predict": ("forecast", "prediction"),
          "animal": ("wildlife",), "movement": ("move",), "cost": ("costs",), "sure": ("confidence",),
          "radar": ("sar", "sentinel"), "lost": ("loss", "change"), "prove": ("confirmed", "confirm"), "proof": ("confirmed",),
          "decline": ("loss", "change"), "gained": ("gain", "change"), "satellite": ("sentinel",), "limitation": ("limit", "caveat"), "data": ("dataset",)}
DEFINE = re.compile(r"\b(what (is|are|does)|what's|meaning|mean|define|definition|explain)\b", re.I)
OBJECT_ID = re.compile(r"\b([PC]\d{1,3})\b", re.I)


def tokens(text: str) -> list[str]:
    out = []
    for w in _WORD.findall(text.lower()):
        if w in STOP:
            continue
        if len(w) > 4 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def expand(toks: list[str]) -> list[str]:
    return toks + [e for t in toks for e in EXPAND.get(t, ())]


def object_ids(text: str) -> list[str]:
    return list(dict.fromkeys(m.upper() for m in OBJECT_ID.findall(text)))
