"""Rule-based explainability  (paper Section IV-E, Fig. 6).

The explanation for a patch is composed *only* from quantities that were
actually computed: area and area share, degree, cut-vertex (bridge) status,
neighbour distances, segmentation confidence, dC_i and S_i, component counts.
No template sentence is emitted unless its evidence exists.  The structured
evidence is returned alongside the text so the UI can show both.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

from .construction import HabitatGraph
from .criticality import CriticalityRow


@dataclass
class Explanation:
    patch_id: str
    text: str
    evidence: dict
    level: str          # "critical" | "high" | "medium" | "low"

    def to_dict(self) -> dict:
        return asdict(self)


def criticality_level(s_i: float, thresholds=(0.25, 0.10, 0.03)) -> str:
    """Map S_i to a qualitative band.  Thresholds are configurable and are
    presentation choices, not ecological facts."""
    hi, mid, lo = thresholds
    if s_i >= hi:
        return "critical"
    if s_i >= mid:
        return "high"
    if s_i >= lo:
        return "medium"
    return "low"


def explain_patch(row: CriticalityRow, graph: HabitatGraph, metric_name: str = "IIC",
                  thresholds=(0.25, 0.10, 0.03)) -> Explanation:
    p = graph.patches[row.patch_id]
    label = row.name or row.patch_id
    level = criticality_level(row.criticality_score, thresholds)
    nbs = graph.neighbours(row.patch_id)

    parts: list[str] = []
    # -- headline
    parts.append(
        f"{label} ranks #{row.rank} of {graph.n_nodes} by criticality (S = {row.criticality_score:.3f}): "
        f"removing it lowers {metric_name} by {row.delta_pct:.1f}%."
    )
    # -- size vs role
    parts.append(
        f"It holds {row.area_ha:.1f} ha, {row.area_pct:.1f}% of mapped habitat (#{row.rank_by_area} by area)."
    )
    if row.rank < row.rank_by_area:
        parts.append("Its structural importance exceeds what its size alone would suggest.")
    elif row.rank > row.rank_by_area + 2:
        parts.append("It is large but structurally redundant: other patches carry its links.")
    # -- topology
    if row.degree == 0:
        parts.append("It is isolated (degree 0), so its loss removes only its own area.")
    else:
        d_txt = ", ".join(f"{n} ({d:.1f} km)" for n, d, _ in nbs[:3])
        parts.append(f"It maintains {row.degree} link{'s' if row.degree != 1 else ''} to {d_txt}.")
    if row.is_cut_vertex:
        parts.append(
            f"It is a cut vertex (bridge patch): its removal splits the network from "
            f"{row.component_count_before} to {row.component_count_after} components."
        )
    elif row.degree > 0:
        parts.append("Alternative routes exist around it; the network stays in "
                     f"{row.component_count_after} component{'s' if row.component_count_after != 1 else ''}.")
    # -- confidence
    parts.append(f"Segmentation confidence for this patch is {100 * row.confidence:.0f}%.")

    evidence = {
        "area_ha": row.area_ha,
        "area_pct": row.area_pct,
        "rank_by_area": row.rank_by_area,
        "degree": row.degree,
        "is_cut_vertex": row.is_cut_vertex,
        "neighbours": [{"id": n, "distance_km": d, "weight": w} for n, d, w in nbs],
        "confidence": row.confidence,
        "quality": row.quality,
        "c_before": row.c_before,
        "c_after": row.c_after,
        "delta_connectivity": row.delta_connectivity,
        "criticality_score": row.criticality_score,
        "delta_pct": row.delta_pct,
        "components_before": row.component_count_before,
        "components_after": row.component_count_after,
        "metric": metric_name,
        "habitat_class": p.habitat_class,
    }
    return Explanation(patch_id=row.patch_id, text=" ".join(parts), evidence=evidence, level=level)


def explain_all(rows: list[CriticalityRow], graph: HabitatGraph, metric_name: str = "IIC",
                thresholds=(0.25, 0.10, 0.03)) -> list[Explanation]:
    return [explain_patch(r, graph, metric_name, thresholds) for r in rows]
