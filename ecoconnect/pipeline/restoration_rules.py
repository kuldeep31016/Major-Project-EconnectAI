"""One rule for what a restoration candidate is (used by feasibility, alerts, API responses and the UI).

Candidates are connected areas whose model probability lies between 0.30 and the habitat threshold. With a calibrated
threshold (e.g. 0.70) that band also captures LARGE areas that are most likely existing habitat the model was unsure
about - not restoration sites. Such areas are reported as "uncertain habitat - field check" and are never headlined
as restoration gains.
"""
from __future__ import annotations

UNCERTAIN_FRACTION = 0.10      # candidate larger than 10 % of the mapped habitat ...
UNCERTAIN_MIN_HA = 5.0         # ... and larger than 5 ha

CATEGORY_LABEL = {
    "restoration_site": "Restoration candidate",
    "uncertain_habitat": "Uncertain habitat — field check",
}
UNCERTAIN_NOTE = ("Large area with a marginal model signal (probability between 0.30 and the habitat threshold): it is "
                  "more likely existing mangrove the model was unsure about than a restoration site. Verify in the field "
                  "before treating it as either.")


def classify(area_ha: float, habitat_area_ha: float) -> str:
    if habitat_area_ha > 0 and area_ha > UNCERTAIN_MIN_HA and area_ha > UNCERTAIN_FRACTION * habitat_area_ha:
        return "uncertain_habitat"
    return "restoration_site"


def annotate(candidates: list[dict], habitat_area_ha: float, area_key: str = "area_ha") -> list[dict]:
    for c in candidates:
        cat = classify(float(c.get(area_key) or 0), habitat_area_ha)
        c["category"] = cat
        c["category_label"] = CATEGORY_LABEL[cat]
    return candidates
