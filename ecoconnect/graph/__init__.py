"""Graph analysis layer: construction -> connectivity -> criticality -> what-if -> explain -> restoration."""
from .types import Patch, Edge
from .construction import HabitatGraph, build_graph, build_edges, haversine_km, edge_weight
from .connectivity import iic, pc, eca_ha, connectivity, summarise, composite_interface_score
from .criticality import compute_criticality, spearman, area_vs_criticality_rho, tau_sensitivity, write_criticality_csv
from .what_if import simulate_removal
from .restoration import evaluate_candidates, load_costs_csv, write_restoration_csv
from .explain import explain_patch, explain_all

__all__ = [
    "Patch", "Edge", "HabitatGraph", "build_graph", "build_edges", "haversine_km", "edge_weight",
    "iic", "pc", "eca_ha", "connectivity", "summarise", "composite_interface_score",
    "compute_criticality", "spearman", "area_vs_criticality_rho", "tau_sensitivity", "write_criticality_csv",
    "simulate_removal", "evaluate_candidates", "load_costs_csv", "write_restoration_csv",
    "explain_patch", "explain_all",
]
