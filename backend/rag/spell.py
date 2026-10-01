"""Light typo correction for the project's vocabulary (no LLM, no dictionary download).

Only words that are NOT already known and look like a misspelling of a domain word are corrected
("stuey" → "study", "uisng" → "using", "conectivity" → "connectivity"). Identifiers (P07, C05), numbers and short
words are never touched, so exact lookups stay exact. The original question is always kept for tracing.
"""
from __future__ import annotations

import difflib
import re

DOMAIN = sorted(set("""
study studies area areas case cases site sites region regions landscape landscapes location locations using use used
many much how what which why where when who list number count total show tell explain give
patch patches habitat habitats mangrove mangroves forest forests link links connection connections connectivity network
component components criticality critical important largest biggest smallest restoration restore candidate candidates
scenario scenarios simulation simulate remove removed removal model models accuracy accurate validated validation
threshold sentinel radar satellite image images data dataset datasets label labels watch global limitation limitations
alert alerts field task tasks verification verified report reports run runs latest current kerala sundarbans mannar
odisha bhitarkanika vembanad paper method methodology sensitivity distance assumption assumptions cost costs
change changed compare comparison year years confidence probability vertex vertices bridge gain hectare hectares
""".split()))
# plain words only: never touch hyphenated or alphanumeric terms (Sentinel-1, P07, EfficientNet-B0, k-NN)
_TOKEN = re.compile(r"(?<![\w-])[A-Za-z]+(?:'[A-Za-z]+)?(?![\w-])")
COMMON = set("""
a an the is are was were be been am i we you they he she it this that these those here there our your my their of to in
on for and or with by from as at about into than then do does did can could would should will have has had not no yes
please hi hello thanks thank ok okay so if but also any some all each every more most less few lot
""".split())


def correct(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Return (corrected text, [(wrong, right), ...])."""
    fixes: list[tuple[str, str]] = []

    def fix(m: re.Match) -> str:
        w = m.group(0)
        lw = w.lower()
        if len(lw) < 4 or lw in COMMON or lw in DOMAIN or re.fullmatch(r"[pc]\d+", lw):
            return w
        hit = difflib.get_close_matches(lw, DOMAIN, n=1, cutoff=0.78)
        if not hit:
            return w
        fixes.append((w, hit[0]))
        return hit[0]

    return _TOKEN.sub(fix, text), fixes
