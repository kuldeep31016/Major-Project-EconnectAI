"""What-if loss simulation  (paper Section IV-D, Eq. 10).

    dC = C_base - C_after,   C_after = C(G - {v_i ...})

The user picks one or more patches; the graph is *actually* rebuilt without
them and C(G) is recomputed - no heuristic.  Besides the scalar loss we report
everything the interface needs to draw the difference: severed edges,
component counts, patches that became isolated, and patches whose component
membership changed.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Iterable

from .connectivity import connectivity, composite_interface_score
from .construction import HabitatGraph


@dataclass
class WhatIfResult:
    removed_patch_ids: list[str]
    metric: str
    c_before: float
    c_after: float
    delta_connectivity: float
    loss_fraction: float                     # dC / C_base  (= S for a single patch)
    loss_pct: float
    habitat_area_before_ha: float
    habitat_area_removed_ha: float
    habitat_area_removed_pct: float
    components_before: int
    components_after: int
    edges_before: int
    edges_after: int
    severed_edges: list[dict]
    newly_isolated_patch_ids: list[str]      # degree > 0 before, degree == 0 after
    affected_patch_ids: list[str]            # lost at least one neighbour
    interface_score_before: float | None = None
    interface_score_after: float | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def simulate_removal(
    graph: HabitatGraph,
    patch_ids: Iterable[str],
    landscape_area_ha: float,
    metric: str = "iic",
    *,
    include_interface_score: bool = True,
    **metric_kw,
) -> WhatIfResult:
    ids = [p for p in dict.fromkeys(patch_ids) if p in graph.patches]
    missing = sorted(set(patch_ids) - set(ids))
    notes = [f"ignored unknown patch id(s): {missing}"] if missing else []
    if not ids:
        raise ValueError("no valid patch ids to remove")

    c_before = connectivity(graph, landscape_area_ha, metric, **metric_kw)
    g_after = graph.without(*ids)
    c_after = connectivity(g_after, landscape_area_ha, metric, **metric_kw) if g_after.n_nodes else 0.0
    d_c = c_before - c_after

    removed = set(ids)
    severed = [e.to_dict() for e in graph.edges.values() if e.source in removed or e.target in removed]
    affected = sorted({
        (e["target"] if e["source"] in removed else e["source"])
        for e in severed
    } - removed)
    newly_isolated = sorted(
        p for p in affected if graph.degree(p) > 0 and g_after.degree(p) == 0
    )
    a_before = graph.habitat_area_ha()
    a_removed = sum(graph.patches[p].area_ha for p in ids)

    ui_before = ui_after = None
    if include_interface_score:
        ui_before = composite_interface_score(graph, landscape_area_ha)["score"]
        ui_after = composite_interface_score(g_after, landscape_area_ha)["score"] if g_after.n_nodes else 0.0

    return WhatIfResult(
        removed_patch_ids=ids,
        metric=metric,
        c_before=c_before,
        c_after=c_after,
        delta_connectivity=d_c,
        loss_fraction=d_c / c_before if c_before else 0.0,
        loss_pct=100.0 * d_c / c_before if c_before else 0.0,
        habitat_area_before_ha=a_before,
        habitat_area_removed_ha=a_removed,
        habitat_area_removed_pct=100.0 * a_removed / a_before if a_before else 0.0,
        components_before=graph.n_components(),
        components_after=g_after.n_components(),
        edges_before=graph.n_edges,
        edges_after=g_after.n_edges,
        severed_edges=severed,
        newly_isolated_patch_ids=newly_isolated,
        affected_patch_ids=affected,
        interface_score_before=ui_before,
        interface_score_after=ui_after,
        notes=notes,
    )
