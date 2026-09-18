"""Restoration prioritization  (paper Section IV-F, Eqs. 11-12).

    R_i        = C(G + v_i) - C(G)                 connectivity gain by node addition
    Priority_i = R_i / Cost_i     if a cost is known
               = R_i             otherwise (paper: "Without cost data, Priority_i reduces to R_i")

Costs are NEVER invented here.  ``costs`` is an optional mapping supplied by the
user (e.g. loaded from a CSV they provide).  When absent, ranking is by raw
gain and the output says so.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Optional

from .connectivity import connectivity
from .construction import HabitatGraph
from .types import Patch


@dataclass
class RestorationRow:
    rank: int
    candidate_id: str
    name: Optional[str]
    area_ha: float
    centroid: list[float]
    c_before: float
    c_after: float
    connectivity_gain: float          # R_i (absolute, in metric units)
    gain_pct: float                   # 100 * R_i / C(G)
    new_links: int
    linked_patch_ids: list[str]
    components_before: int
    components_after: int
    cost: Optional[float]
    cost_unit: Optional[str]
    gain_per_cost: Optional[float]    # Priority_i when cost is known (gain_pct / cost)
    ranking_basis: str                # "gain_per_cost" | "raw_gain"

    def to_dict(self) -> dict:
        return asdict(self)


CSV_COLUMNS = [
    "rank", "candidate_id", "name", "area_ha", "connectivity_gain", "gain_pct", "new_links",
    "cost", "cost_unit", "gain_per_cost", "ranking_basis", "components_before", "components_after",
]


def evaluate_candidates(
    graph: HabitatGraph,
    candidates: Iterable[Patch],
    landscape_area_ha: float,
    metric: str = "iic",
    *,
    costs: Optional[dict[str, float]] = None,
    cost_unit: Optional[str] = None,
    rebuild_edges: bool = False,
    **metric_kw,
) -> tuple[list[RestorationRow], float]:
    """Insert each candidate into G, recompute, rank.

    Ranking: by Priority_i = gain_pct / cost when *every* candidate has a
    cost; otherwise by raw gain (mixed availability would make the ranking
    incomparable, so partial cost tables fall back to raw gain with a note in
    ``ranking_basis``).
    """
    cands = list(candidates)
    c_base = connectivity(graph, landscape_area_ha, metric, **metric_kw)
    costs = costs or {}
    use_cost = bool(cands) and all(c.id in costs and costs[c.id] > 0 for c in cands)
    basis = "gain_per_cost" if use_cost else "raw_gain"

    rows: list[RestorationRow] = []
    for cand in cands:
        g_plus = graph.with_patch(cand, rebuild=rebuild_edges)
        c_plus = connectivity(g_plus, landscape_area_ha, metric, **metric_kw)
        r = c_plus - c_base
        gain_pct = 100.0 * r / c_base if c_base else 0.0
        cost = costs.get(cand.id) if use_cost else None
        rows.append(RestorationRow(
            rank=0,
            candidate_id=cand.id,
            name=cand.name,
            area_ha=cand.area_ha,
            centroid=list(cand.centroid),
            c_before=c_base,
            c_after=c_plus,
            connectivity_gain=r,
            gain_pct=gain_pct,
            new_links=g_plus.n_edges - graph.n_edges,
            linked_patch_ids=sorted(g_plus.adj.get(cand.id, set())),
            components_before=graph.n_components(),
            components_after=g_plus.n_components(),
            cost=cost,
            cost_unit=cost_unit if use_cost else None,
            gain_per_cost=(gain_pct / cost) if (use_cost and cost) else None,
            ranking_basis=basis,
        ))
    key = (lambda r: -(r.gain_per_cost or 0.0)) if use_cost else (lambda r: -r.connectivity_gain)
    rows.sort(key=key)
    for n, r in enumerate(rows, 1):
        r.rank = n
    return rows, c_base


def load_costs_csv(path: str | Path, id_col: str = "candidate_id", cost_col: str = "cost") -> dict[str, float]:
    """Read a user-provided cost table.  Returns {} if the file does not exist."""
    path = Path(path)
    if not path.exists():
        return {}
    out: dict[str, float] = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            try:
                out[row[id_col]] = float(row[cost_col])
            except (KeyError, ValueError):
                continue
    return out


def write_restoration_csv(rows: list[RestorationRow], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r.to_dict())
    return path
