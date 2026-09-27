"""Assumption sensitivity: does the criticality conclusion survive a change of graph parameters?

For every (tau, k) variant the graph is rebuilt, exact leave-one-out criticality recomputed and compared with the
reference ranking: Spearman rho, Kendall tau-b, top-k overlap (Jaccard) and per-patch rank range. Pure functions,
no I/O - the API/job layer decides which variants to run.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from typing import Iterable, Optional

from .connectivity import summarise
from .construction import build_graph
from .criticality import compute_criticality, spearman
from .types import Patch


def kendall_tau(x: list[float], y: list[float]) -> float:
    """Kendall tau-b (tie-corrected). 1 = identical order, -1 = reversed."""
    n = len(x)
    if n < 2:
        return 1.0
    conc = disc = tx = ty = 0
    for i, j in combinations(range(n), 2):
        dx, dy = x[i] - x[j], y[i] - y[j]
        if dx == 0 and dy == 0:
            continue
        if dx == 0:
            tx += 1
        elif dy == 0:
            ty += 1
        elif (dx > 0) == (dy > 0):
            conc += 1
        else:
            disc += 1
    denom = ((conc + disc + tx) * (conc + disc + ty)) ** 0.5
    return (conc - disc) / denom if denom else 1.0


def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if a | b else 1.0


@dataclass
class Variant:
    tau_km: float
    k: int
    n_edges: int
    n_components: int
    density: float
    c: float
    top: list[str]
    spearman: float
    kendall: float
    top_overlap: float
    ranks: dict[str, int] = field(repr=False, default_factory=dict)


def sensitivity(patches: list[Patch], landscape_area_ha: float, *, taus_km: Iterable[float], ks: Iterable[int],
                reference: tuple[float, int], metric: str = "iic", distance_mode: str = "haversine",
                top_n: int = 5, **metric_kw) -> dict:
    """Grid over (tau, k). Returns the variants, per-patch stability and a plain-language stability verdict."""
    ref_tau, ref_k = reference
    grid = sorted({(float(t), int(k)) for t in taus_km for k in ks} | {(float(ref_tau), int(ref_k))})
    runs: dict[tuple[float, int], tuple[list, object]] = {}
    for t, k in grid:
        g = build_graph(patches, k=k, tau_km=t, distance_mode=distance_mode)
        try:
            rows, c = compute_criticality(g, landscape_area_ha, metric, **metric_kw)
        except ValueError:                        # zero baseline connectivity (e.g. no links at a tiny tau)
            rows, c = [], 0.0
        runs[(t, k)] = (rows, g, c)
    ref_rows = runs[(float(ref_tau), int(ref_k))][0]
    ref_rank = {r.patch_id: r.rank for r in ref_rows}
    ids = sorted(ref_rank)
    ref_top = [r.patch_id for r in ref_rows[:top_n]]
    variants: list[Variant] = []
    for (t, k), (rows, g, c) in runs.items():
        rk = {r.patch_id: r.rank for r in rows}
        s = summarise(g, landscape_area_ha)
        n = s.n_patches
        comparable = bool(rows) and set(rk) == set(ref_rank)
        variants.append(Variant(
            tau_km=t, k=k, n_edges=s.n_edges, n_components=s.n_components,
            density=(2 * s.n_edges / (n * (n - 1))) if n > 1 else 0.0, c=c,
            top=[r.patch_id for r in rows[:top_n]],
            spearman=spearman([ref_rank[i] for i in ids], [rk[i] for i in ids]) if comparable else float("nan"),
            kendall=kendall_tau([ref_rank[i] for i in ids], [rk[i] for i in ids]) if comparable else float("nan"),
            top_overlap=jaccard(ref_top, [r.patch_id for r in rows[:top_n]]) if rows else 0.0, ranks=rk))
    stability = []
    for pid in ref_top:
        ranks = [v.ranks[pid] for v in variants if pid in v.ranks]
        stability.append({"patch_id": pid, "reference_rank": ref_rank[pid], "min_rank": min(ranks), "max_rank": max(ranks),
                          "in_top_n": sum(pid in v.top for v in variants), "of": len(variants)})
    rhos = [v.spearman for v in variants if v.spearman == v.spearman]
    min_rho = min(rhos) if rhos else None
    robust = [s["patch_id"] for s in stability if s["in_top_n"] == s["of"]]
    verdict = ("Ranking is stable across the tested assumptions" if min_rho is not None and min_rho >= 0.8
               else "Ranking is moderately sensitive to the graph assumptions" if min_rho is not None and min_rho >= 0.5
               else "Ranking depends strongly on the graph assumptions - treat priorities with caution")
    return {"reference": {"tau_km": ref_tau, "k": ref_k}, "metric": metric, "top_n": top_n,
            "variants": [{**{k: v for k, v in vars(v).items() if k != "ranks"}} for v in variants],
            "stability": stability, "robust_top": robust, "min_spearman": min_rho,
            "verdict": f"{verdict} (min Spearman {min_rho:.2f} over {len(variants)} variants); "
                       f"{len(robust)}/{len(ref_top)} reference top-{top_n} patches stay top-{top_n} in every variant."
            if min_rho is not None else verdict}


def scale_areas(patches: list[Patch], patch_ids: Iterable[str], retain_fraction: float) -> list[Patch]:
    """Hypothetical degradation: shrink the listed patches to ``retain_fraction`` of their area (location unchanged)."""
    from dataclasses import replace
    ids = set(patch_ids)
    return [replace(p, area_ha=p.area_ha * retain_fraction) if p.id in ids else p for p in patches]


def hypothetical_patch(lat: float, lon: float, area_ha: float, quality: Optional[float] = None, pid: str = "H1") -> Patch:
    return Patch(id=pid, area_ha=float(area_ha), centroid=(float(lat), float(lon)), quality=quality if quality is not None else 1.0,
                 confidence=0.0, name="Hypothetical patch (user-defined)", extra={"hypothetical": True})
