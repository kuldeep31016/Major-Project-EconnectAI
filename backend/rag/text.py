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
          "decline": ("loss", "change"), "gained": ("gain", "change"), "satellite": ("sentinel",), "limitation": ("limit", "caveat"), "data": ("dataset",),
          # procedural wording: "how is X calculated/found/made" vs documents saying computed/measured/generated/produced
          "calculated": ("computed", "measured", "calculation", "computation", "recomputing", "removing"),
          "calculate": ("compute", "measure", "calculation", "computed", "measured"),
          "computed": ("calculated", "measured", "recomputed"), "measured": ("computed", "calculated", "measure"),
          "found": ("find", "identified", "generated", "generation", "candidate", "detected"), "find": ("found", "identify", "generation"),
          "generated": ("created", "generation", "rule", "rules"), "created": ("generated", "made", "built"),
          "made": ("produced", "created", "built", "pipeline"), "extracted": ("extraction", "threshold", "connected"),
          "user": ("officer", "role"), "people": ("officer", "role"), "use": ("used", "using"), "used": ("use", "using"),
          "trust": ("validated", "limitation", "reliable"), "reliable": ("trust", "validated"),
          "methodology": ("method", "pipeline", "framework", "approach"), "method": ("methodology", "pipeline"),
          "kappa": ("κ", "cohen"), "iou": ("intersection",)}
# light suffix stripping for the grounding check only ("calculation" ~ "calculated", "extraction" ~ "extracted")
_SUFFIXES = ("ations", "ation", "ions", "ion", "ing", "ed", "ment", "ly", "er")


def stem(w: str) -> str:
    for suf in _SUFFIXES:
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w
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


# Audience / style instructions ("in simple words", "for a forest officer", "briefly"): they say HOW to answer, not WHAT
# about, so they are removed from the retrieval query (they made the coverage check abstain) but kept for the LLM prompt.
_STYLE = re.compile(
    r"\b(?:in\s+(?:very\s+)?(?:simple|plain|easy|everyday|layman'?s?|non-?technical)\s+(?:words|terms|language|english|hindi)"
    r"|for\s+(?:a|an|the|my)?\s*(?:forest|range|field|district|government|state)?\s*(?:officers?|officials?|laypersons?|layman|laymen"
    r"|beginners?|non-?experts?|students?|child|children|kids?|ministers?|farmers?|villagers?|ngos?|managers?|public|audience)"
    r"|like\s+i'?m\s+(?:five|5|a\s+child)|eli5|briefly|in\s+(?:short|brief)|in\s+one\s+(?:line|sentence)|step\s+by\s+step"
    r"|simply|in\s+detail)\b", re.I)


def strip_style(q: str) -> str:
    """Retrieval query without audience/style instructions (never empty)."""
    out = " ".join(_STYLE.sub(" ", q).split())
    return out if len(out) >= 3 else q
