"""Patch criticality by exact leave-one-out sensitivity  (paper Eqs. 8-9).

For every patch i:
    1. C(G)          baseline connectivity
    2. G - v_i       delete node and incident edges
    3. C(G - v_i)    recompute
    4. dC_i = C(G) - C(G - v_i)                                   (Eq. 8)
    5. S_i  = dC_i / C(G)                                          (Eq. 9)
Rows are sorted by S_i descending.  Also reported: degree, cut-vertex status,
component count after removal, rank by area, and Spearman rho between the
area ranking and the criticality ranking (Section VI-F "area baseline").
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Optional

from .connectivity import connectivity
from .construction import HabitatGraph


@dataclass
class CriticalityRow:
    rank: int
    patch_id: str
    name: Optional[str]
    habitat_class: str
    area_ha: float
    area_pct: float
    degree: int
    confidence: float
    quality: float
    c_before: float
    c_after: float
    delta_connectivity: float
    criticality_score: float          # S_i
    delta_pct: float                  # 100 * S_i
    component_count_before: int
    component_count_after: int
    is_cut_vertex: bool
    rank_by_area: int
    neighbour_ids: list[str]
    neighbour_distances_km: list[float]

    def to_dict(self) -> dict:
        return asdict(self)


CSV_COLUMNS = [
    "rank", "patch_id", "name", "habitat_class", "area_ha", "area_pct", "degree", "confidence",
    "quality", "c_before", "c_after", "delta_connectivity", "criticality_score", "delta_pct",
    "component_count_before", "component_count_after", "is_cut_vertex", "rank_by_area",
]


def compute_criticality(
    graph: HabitatGraph,
    landscape_area_ha: float,
    metric: str = "iic",
    **metric_kw,
) -> tuple[list[CriticalityRow], float]:
    """Return (rows sorted by S_i desc, baseline C(G))."""
    c_base = connectivity(graph, landscape_area_ha, metric, **metric_kw)
    if c_base <= 0:
        raise ValueError("baseline connectivity is zero; criticality undefined")
    a_h = graph.habitat_area_ha()
    comps_before = graph.n_components()
    rows: list[CriticalityRow] = []
    for pid in graph.node_ids:
        p = graph.patches[pid]
        g_minus = graph.without(pid)
        c_after = connectivity(g_minus, landscape_area_ha, metric, **metric_kw)
        d_c = c_base - c_after
        nbs = graph.neighbours(pid)
        comps_after = g_minus.n_components()
        rows.append(CriticalityRow(
            rank=0,
            patch_id=pid,
            name=p.name,
            habitat_class=p.habitat_class,
            area_ha=p.area_ha,
            area_pct=100.0 * p.area_ha / a_h if a_h else 0.0,
            degree=graph.degree(pid),
            confidence=p.confidence,
            quality=p.quality,
            c_before=c_base,
            c_after=c_after,
            delta_connectivity=d_c,
            criticality_score=d_c / c_base,
            delta_pct=100.0 * d_c / c_base,
            component_count_before=comps_before,
            component_count_after=comps_after,
            is_cut_vertex=comps_after > comps_before,
            rank_by_area=0,
            neighbour_ids=[n for n, _, _ in nbs],
            neighbour_distances_km=[round(d, 3) for _, d, _ in nbs],
        ))
    rows.sort(key=lambda r: -r.criticality_score)
    for n, r in enumerate(rows, 1):
        r.rank = n
    for n, r in enumerate(sorted(rows, key=lambda r: -r.area_ha), 1):
        r.rank_by_area = n
    return rows, c_base


def spearman(x: Iterable[float], y: Iterable[float]) -> float:
    """Spearman rank correlation with average ranks for ties (stdlib only)."""
    x, y = list(x), list(y)

    def rank(v: list[float]) -> list[float]:
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2.0 + 1
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r

    rx, ry = rank(x), rank(y)
    n = len(x)
    if n < 2:
        return float("nan")
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else float("nan")


def area_vs_criticality_rho(rows: list[CriticalityRow]) -> float:
    """Spearman rho between area and S_i  (Section VI-F baseline comparison)."""
    return spearman([r.area_ha for r in rows], [r.criticality_score for r in rows])


def write_criticality_csv(rows: list[CriticalityRow], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r.to_dict())
    return path


def tau_sensitivity(
    patches,
    landscape_area_ha: float,
    taus_km: Iterable[float],
    *,
    k: int,
    reference_tau_km: float,
    distance_mode: str = "haversine",
    metric: str = "iic",
) -> dict:
    """Re-run criticality at several tau and compare rankings to the reference tau
    (Section VI-F threshold-sensitivity analysis)."""
    from .construction import build_graph  # local import to avoid cycle at module load

    def ranking(tau):
        g = build_graph(list(patches), k=k, tau_km=tau, distance_mode=distance_mode)
        rows, _ = compute_criticality(g, landscape_area_ha, metric)
        return g, {r.patch_id: r.rank for r in rows}, [r.patch_id for r in rows[:5]]

    _, ref_rank, _ = ranking(reference_tau_km)
    ids = list(ref_rank.keys())
    out = {}
    for tau in taus_km:
        g, rk, top5 = ranking(tau)
        out[f"tau_{tau:g}km"] = {
            "tau_km": tau,
            "edges": g.n_edges,
            "components": g.n_components(),
            "top5": top5,
            "spearman_vs_reference": spearman([ref_rank[i] for i in ids], [rk[i] for i in ids]),
        }
    return {"reference_tau_km": reference_tau_km, "results": out}
