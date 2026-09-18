# Connectivity metrics — formulas, inputs, units, implementation

All in `ecoconnect/graph/connectivity.py`; tested in `tests/test_graph.py` against hand-computed values.

## Research metrics (used for every reported result)

| Metric | Formula | Inputs | Units | Function |
|---|---|---|---|---|
| **IIC** Integral Index of Connectivity (Pascual-Hortal & Saura 2006) | IIC = Σᵢ Σⱼ aᵢaⱼ / (1 + nlᵢⱼ) / A_L² | aᵢ patch area (ha); nlᵢⱼ number of links on the shortest topological path (BFS over the k-NN/τ graph; unreachable → term 0); A_L landscape area (ha) | dimensionless, (0, 1] | `iic(graph, A_L)` |
| **PC** Probability of Connectivity (Saura & Pascual-Hortal 2007) | PC = Σᵢ Σⱼ aᵢaⱼ p*ᵢⱼ / A_L² ; pᵢⱼ = exp(−α dᵢⱼ), α = −ln(p_τ)/τ (p_τ = 0.5 by default) ; p*ᵢⱼ = max-product path probability | centroid distances dᵢⱼ (km) over **all** pairs (not restricted to the k-NN edges) | dimensionless | `pc(graph, A_L, tau_km, p_at_tau)` |
| **ECA** Equivalent Connected Area | ECA = √PC · A_L | | ha | `eca_ha(pc, A_L)` |
| largest component | A(largest component) / A_L | | fraction | `connectivity(..., metric="largest_component")` |

`C(G)` for criticality / what-if / restoration is chosen by `configs/graph.yaml → connectivity.research_metric`
(default `iic`, exactly as the paper's §VI-A).

A_L is the analysis extent: for raster runs, the area of valid (non-nodata) pixels; for the prototype
geometry, the configured scene footprint (as in the paper's offline experiment).

## Interface / decision-support score (paper Eq. 7) — NOT a research metric

C_ui(G) = 100 · Σₖ ωₖ nₖ(G), Σ ωₖ = 1, weights 0.30 / 0.28 / 0.22 / 0.12 / 0.08 (design choice, unvalidated):

| component | nₖ ∈ [0,1] |
|---|---|
| structural | IIC / IIC_max, IIC_max = (A_H/A_L)² (all habitat as one patch) |
| functional | PC / PC_max = (ECA/A_H)² |
| quality | area-weighted mean qᵢ |
| redundancy | 1 − (#cut vertices / #patches) |
| protection | protected habitat area / habitat area |

Known property: it is **not monotone under patch removal** — deleting a low-quality leaf patch can raise the
area-weighted quality and redundancy terms while IIC falls. The UI therefore headlines C(G) (research metric)
in what-if results and labels this score "Interface score (Eq. 7)".

## Graph parameters

k = 3, τ = 5 km, w_ij = √(qᵢqⱼ)·exp(−dᵢⱼ/τ) (Eq. 6), haversine centroid distance. τ is species-relevant and
must be calibrated per deployment; every run also writes `tau_sensitivity.json` (τ ∈ {3, 5, 8} km,
Spearman ρ of rankings vs the reference τ), per paper §VI-F.
