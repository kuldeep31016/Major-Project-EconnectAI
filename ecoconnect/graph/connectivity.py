"""Connectivity measures C(G)   (paper Section IV-C, Section VI-A).

RESEARCH METRICS  (used for every reported result):
    IIC  Integral Index of Connectivity      Pascual-Hortal & Saura (2006)
         IIC = sum_i sum_j  a_i a_j / (1 + nl_ij)  /  A_L^2
         nl_ij = number of links on the shortest topological path i->j
         (unreachable pairs contribute 0).  Units: dimensionless, in (0, 1].
    PC   Probability of Connectivity          Saura & Pascual-Hortal (2007)
         PC  = sum_i sum_j  a_i a_j p*_ij  /  A_L^2
         p_ij = exp(-alpha d_ij), alpha = ln 2 / tau  (so p = 0.5 at d = tau),
         p*_ij = maximum-product path probability over all intermediate
         patches (computed by a max-product Floyd-Warshall closure over the
         complete distance matrix - i.e. PC is *not* restricted to the k-NN
         edge set, exactly as in the offline experiment).
    ECA  Equivalent Connected Area = sqrt(PC) * A_L   (hectares)

    a_i  patch area (ha);  A_L  landscape (analysis extent) area (ha).

INTERFACE / DECISION-SUPPORT SCORE  (paper Eq. 7, a *design choice*, not
validated against field data, never used for Tables VI-VIII):
    C_ui(G) = 100 * sum_k  omega_k n_k(G),   sum omega_k = 1
    with five normalised components (see ``composite_interface_score``).

Every function takes the graph plus explicit parameters; no globals.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Optional

from .construction import HabitatGraph, distance_fn


# --------------------------------------------------------------------------- IIC
def iic(graph: HabitatGraph, landscape_area_ha: float) -> float:
    """Integral Index of Connectivity (Pascual-Hortal & Saura 2006)."""
    if landscape_area_ha <= 0:
        raise ValueError("landscape_area_ha must be > 0")
    total = 0.0
    for i in graph.node_ids:
        a_i = graph.patches[i].area_ha
        for j, nl in graph.topological_distances(i).items():
            total += a_i * graph.patches[j].area_ha / (1.0 + nl)
    return total / (landscape_area_ha ** 2)


# --------------------------------------------------------------------------- PC
def pc(graph: HabitatGraph, landscape_area_ha: float, tau_km: Optional[float] = None,
       p_at_tau: float = 0.5) -> float:
    """Probability of Connectivity (Saura & Pascual-Hortal 2007).

    ``tau_km`` defaults to the graph's tau; ``p_at_tau`` fixes alpha so that the
    direct dispersal probability equals ``p_at_tau`` at distance tau.
    """
    if landscape_area_ha <= 0:
        raise ValueError("landscape_area_ha must be > 0")
    tau = graph.tau_km if tau_km is None else tau_km
    alpha = -math.log(p_at_tau) / tau
    ids = graph.node_ids
    n = len(ids)
    if n == 0:
        return 0.0
    dist = distance_fn(graph.distance_mode)
    cen = [graph.patches[i].centroid for i in ids]
    area = [graph.patches[i].area_ha for i in ids]

    p = [[1.0 if i == j else math.exp(-alpha * dist(cen[i], cen[j])) for j in range(n)] for i in range(n)]
    # max-product transitive closure
    for k in range(n):
        pk = p[k]
        for i in range(n):
            pik = p[i][k]
            if pik == 0.0:
                continue
            row = p[i]
            for j in range(n):
                v = pik * pk[j]
                if v > row[j]:
                    row[j] = v
    total = sum(area[i] * area[j] * p[i][j] for i in range(n) for j in range(n))
    return total / (landscape_area_ha ** 2)


def eca_ha(pc_value: float, landscape_area_ha: float) -> float:
    """Equivalent Connected Area (ha) = sqrt(PC) * A_L."""
    return math.sqrt(max(pc_value, 0.0)) * landscape_area_ha


# --------------------------------------------------------------------------- dispatcher
METRICS = ("iic", "pc", "largest_component")


def connectivity(graph: HabitatGraph, landscape_area_ha: float, metric: str = "iic", **kw) -> float:
    """Scalar C(G) for the chosen research metric (Section IV-C: 'any such measure')."""
    if metric == "iic":
        return iic(graph, landscape_area_ha)
    if metric == "pc":
        return pc(graph, landscape_area_ha, **kw)
    if metric == "largest_component":
        return graph.largest_component_area_ha() / landscape_area_ha
    raise ValueError(f"unknown metric {metric!r}; choose from {METRICS}")


# --------------------------------------------------------------------------- summary
@dataclass
class ConnectivitySummary:
    n_patches: int
    n_edges: int
    n_components: int
    habitat_area_ha: float
    landscape_area_ha: float
    iic: float
    pc: float
    eca_ha: float
    eca_pct_of_habitat: float
    mean_degree: float
    largest_component_area_ha: float
    tau_km: float
    k: int
    metric_labels: dict

    def to_dict(self) -> dict:
        return asdict(self)


def summarise(graph: HabitatGraph, landscape_area_ha: float) -> ConnectivitySummary:
    iic_v = iic(graph, landscape_area_ha)
    pc_v = pc(graph, landscape_area_ha)
    eca_v = eca_ha(pc_v, landscape_area_ha)
    a_h = graph.habitat_area_ha()
    return ConnectivitySummary(
        n_patches=graph.n_nodes,
        n_edges=graph.n_edges,
        n_components=graph.n_components(),
        habitat_area_ha=a_h,
        landscape_area_ha=landscape_area_ha,
        iic=iic_v,
        pc=pc_v,
        eca_ha=eca_v,
        eca_pct_of_habitat=(100.0 * eca_v / a_h) if a_h > 0 else 0.0,
        mean_degree=(2.0 * graph.n_edges / graph.n_nodes) if graph.n_nodes else 0.0,
        largest_component_area_ha=graph.largest_component_area_ha(),
        tau_km=graph.tau_km,
        k=graph.k,
        metric_labels={
            "iic": "RESEARCH METRIC - Integral Index of Connectivity (Pascual-Hortal & Saura 2006)",
            "pc": "RESEARCH METRIC - Probability of Connectivity (Saura & Pascual-Hortal 2007), p(tau)=0.5",
            "eca_ha": "RESEARCH METRIC - Equivalent Connected Area = sqrt(PC)*A_L",
        },
    )


# --------------------------------------------------------------------------- interface score (Eq. 7)
DEFAULT_COMPOSITE_WEIGHTS = {
    "structural": 0.30,   # from IIC
    "functional": 0.28,   # from PC
    "quality": 0.22,      # habitat quality
    "redundancy": 0.12,   # patch redundancy
    "protection": 0.08,   # protection coverage
}


def composite_interface_score(
    graph: HabitatGraph,
    landscape_area_ha: float,
    weights: Optional[dict[str, float]] = None,
    *,
    iic_value: Optional[float] = None,
    pc_value: Optional[float] = None,
) -> dict:
    """INTERFACE / DECISION-SUPPORT SCORE, paper Eq. (7).  0-100.

    Normalised components n_k in [0, 1] (design choices, documented here):
      structural  = IIC / IIC_max,  IIC_max = (A_H / A_L)^2  (all habitat as one patch)
      functional  = PC  / PC_max ,  PC_max  = (A_H / A_L)^2  -> equals (ECA / A_H)^2
      quality     = area-weighted mean of q_i
      redundancy  = 1 - (#cut-vertices / #patches)
      protection  = protected habitat area / total habitat area
    This score is shown in the UI as a headline number.  It is NOT a research
    metric and is never used in Tables VI-VIII.
    """
    w = dict(DEFAULT_COMPOSITE_WEIGHTS if weights is None else weights)
    s = sum(w.values())
    if abs(s - 1.0) > 1e-9:
        raise ValueError(f"composite weights must sum to 1 (got {s})")
    a_h = graph.habitat_area_ha()
    if a_h <= 0 or graph.n_nodes == 0:
        return {"score": 0.0, "components": {k: 0.0 for k in w}, "weights": w,
                "label": "INTERFACE SCORE (Eq. 7) - design choice, not a research metric"}
    max_index = (a_h / landscape_area_ha) ** 2
    iic_v = iic(graph, landscape_area_ha) if iic_value is None else iic_value
    pc_v = pc(graph, landscape_area_ha) if pc_value is None else pc_value
    comps = {
        "structural": min(1.0, iic_v / max_index),
        "functional": min(1.0, pc_v / max_index),
        "quality": sum(p.area_ha * p.quality for p in graph.patches.values()) / a_h,
        "redundancy": 1.0 - sum(graph.is_cut_vertex(i) for i in graph.node_ids) / graph.n_nodes,
        "protection": sum(p.area_ha for p in graph.patches.values() if p.protected) / a_h,
    }
    score = 100.0 * sum(w[k] * comps[k] for k in w)
    return {
        "score": score,
        "components": comps,
        "weights": w,
        "label": "INTERFACE SCORE (Eq. 7) - design choice, not a research metric",
    }
