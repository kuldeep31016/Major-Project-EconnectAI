# Connectivity analysis — graph, indices, criticality, sensitivity

> Connectivity here is **structural**: it is computed from patch areas and centroid distances of a *modelled*
> habitat map. It is not observed animal or propagule movement, and none of it is field-validated. k, τ and the
> habitat threshold are modelling assumptions. Short formula table: [CONNECTIVITY_METRICS.md](CONNECTIVITY_METRICS.md).

Code: `ecoconnect/graph/` — `construction.py`, `connectivity.py`, `criticality.py`, `what_if.py`,
`sensitivity.py`, `explain.py`. Parameters: `configs/graph.yaml`. Tests: `tests/test_graph.py`,
`tests/test_sensitivity.py`, `tests/test_regression.py`.

## 1. Graph construction (`build_edges`, `build_graph`)

- **Nodes** V = habitat patches ([GEOSPATIAL_PIPELINE.md](GEOSPATIAL_PIPELINE.md) §5).
- **Distance** d_ij = centroid-to-centroid **haversine** great-circle km (R = 6371.0088 km) in the default
  `distance_mode: haversine`; `euclidean` treats centroids as planar km.
- **Edges**: for every patch, sort all other patches by distance and take the **k nearest**; keep a pair only if
  d_ij ≤ **τ**. The union over both endpoints is the undirected edge set (so degree can exceed k).
  Defaults: **k = 3, τ = 5 km**.
- **Edge weight** (paper Eq. 6), stored on every edge:

  w_ij = √(q_i · q_j) · exp(−d_ij / τ), with q_i = mean model probability of patch i.

  **Important:** w_ij is *not* used by IIC, PC, ECA, criticality, what-if or restoration gain. It is exported for
  display only (`strength` = w, `resistance` = 1 − w in the frontend bundle). The bundle's betweenness centrality
  and network diameter use d_ij (km) as the path length, not w_ij.
- Adding a node for restoration (`with_patch`, default `rebuild=False`) links the new node to its k nearest
  existing patches within τ and leaves existing edges untouched.

## 2. Indices as implemented (`connectivity.py`)

a_i = patch area (ha); A_L = landscape area (ha) = area of valid raster pixels for raster runs.

| Index | Implementation | Notes |
|---|---|---|
| **IIC** | IIC = Σ_i Σ_j a_i a_j / (1 + nl_ij) / A_L² | nl_ij = BFS link count on the k-NN/τ graph; the sum **includes i = j** (nl = 0, term a_i²); unreachable pairs contribute 0. Depends on k and τ through the edge set. |
| **PC** | PC = Σ_i Σ_j a_i a_j p*_ij / A_L² | p_ij = exp(−α d_ij), α = −ln(p_τ)/τ with p_τ = 0.5 (so α = ln 2 / τ); p*_ij = best product path over **all** patch pairs (max-product Floyd–Warshall on the complete distance matrix), p*_ii = 1. PC ignores k and the edge set. |
| **ECA** | ECA = √PC · A_L (ha) | reported also as % of habitat area. |
| largest component | area of largest connected component / A_L | available as `research_metric: largest_component`. |

`C(G)` used for criticality, what-if and restoration = `configs/graph.yaml → connectivity.research_metric`
(**`iic`** in every stored run). IIC and PC scale with A_L, so raw values are **not comparable between areas**;
use ECA % of habitat. The Eq. 7 "interface score" is a presentation score, not a research metric (and is
non-monotone under removal) — see CONNECTIVITY_METRICS.md.

## 3. Leave-one-out criticality (`compute_criticality`, paper Eqs. 8–9)

For every patch i, the graph is actually rebuilt without i (node and incident edges removed, **no re-linking**
of the remaining patches) and C is recomputed:

ΔC_i = C(G) − C(G − v_i),  **S_i = ΔC_i / C(G)** (reported as `criticality_score`; `delta_pct` = 100·S_i).

Each row also reports: degree, neighbours and distances, `component_count_before/after`,
**`is_cut_vertex` = component count increases after removal** (articulation point), `rank_by_area`, and
Spearman ρ between area and S_i over all patches (`spearman_area_vs_criticality`). Presentation bands
(`criticality.level_thresholds` 0.25 / 0.10 / 0.03 → critical / high / medium / low) are display choices.
Removing an isolated patch lowers the component count, which is **not** a cut vertex.

What-if (`simulate_removal`, Eq. 10) is the same computation for any set of patches, plus severed edges, newly
isolated patches and affected neighbours.

## 4. Worked example — Kerala LATEST run

Run `outputs/runs/kerala-coast/kerala-coast_multi_E1_s1_b0_dev_t0.70/` (model `multi_E1_s1_b0_dev`, 2020 scene,
threshold 0.70, MMU 2 ha, k = 3, τ = 5 km, C = IIC). Label: **DEVELOPMENT-SUBSET RESULT — NOT FINAL**.

`metrics.json`: 12 patches, 18 edges, **3 components** (one 10-patch network + isolated P09 and P12),
habitat 204.58 ha, A_L 48,928.63 ha, IIC 8.138 × 10⁻⁶, PC 1.139 × 10⁻⁵, ECA 165.1 ha (80.7 % of habitat),
mean degree 3.0, largest component 197.15 ha, Spearman(area, S) = 0.90.

`criticality.json` (all 12 rows):

| Rank | Patch | Area ha (% of habitat) | Area rank | Degree | S_i | ΔIIC | Components after | Cut vertex |
|---|---|---|---|---|---|---|---|---|
| 1 | P01 | 76.19 (37.2 %) | 1 | 4 | 0.638 | −63.8 % | 3 | no |
| 2 | P02 | 31.07 (15.2 %) | 2 | 4 | 0.444 | −44.4 % | 4 | **yes** |
| 3 | **P07** | **5.49 (2.7 %)** | **7** | 3 | **0.256** | **−25.6 %** | **4** | **yes** |
| 4 | P03 | 24.49 (12.0 %) | 3 | 4 | 0.172 | −17.2 % | 3 | no |
| 5 | P04 | 24.12 (11.8 %) | 4 | 4 | 0.170 | −17.0 % | 3 | no |
| 6 | P05 | 14.30 (7.0 %) | 5 | 4 | 0.120 | −12.0 % | 3 | no |
| 7 | P06 | 8.84 (4.3 %) | 6 | 3 | 0.055 | −5.5 % | 3 | no |
| 8 | P08 | 5.18 (2.5 %) | 8 | 4 | 0.043 | −4.3 % | 3 | no |
| 9 | P11 | 3.40 (1.7 %) | 11 | 3 | 0.026 | −2.6 % | 3 | no |
| 10 | P10 | 4.07 (2.0 %) | 10 | 3 | 0.025 | −2.5 % | 3 | no |
| 11 | P09 | 4.96 (2.4 %) | 9 | 0 | 0.001 | −0.13 % | 2 | no (isolated) |
| 12 | P12 | 2.47 (1.2 %) | 12 | 0 | 0.0003 | −0.03 % | 2 | no (isolated) |

**Why P07 matters although it is small.** P07's three links are P04 (0.54 km), P03 (3.50 km) and **P02
(3.75 km)**. The P02–P07 link is the only edge between group A {P01, P02, P05, P08, P11} and group B
{P03, P04, P06, P10} (checked against the neighbour lists in `criticality.json`). Removing P07 cuts that route:
3 → 4 components, and every a_i·a_j term between the two groups (e.g. P01 × P03, P01 × P04) drops out of IIC, so
2.7 % of the habitat carries 25.6 % of the index. P09 (4.96 ha) — almost the same size — scores 0.001 because it has no links.

**"Large patch ≠ most important."** Area and criticality are strongly correlated here (ρ = 0.90; P01 is both the
largest and the most critical), but the order is not an area ordering: P07 (7th by area) ranks 3rd, above P03 and
P04 which are ~4.5× larger; P09 (9th by area) ranks 11th. Criticality measures a patch's **position** in the
network (bridging, number of pairs it connects), not only its size.

## 5. Sensitivity to the graph assumptions

### Stored per run: τ only (`tau_sensitivity.json`, k fixed = 3)

| τ | Edges | Components | Top-5 | Spearman vs τ = 5 km |
|---|---|---|---|---|
| 3 km | 13 | 5 | P01 P02 P05 P03 P04 | 0.811 |
| 5 km (ref) | 18 | 3 | P01 P02 P07 P03 P04 | 1.000 |
| 8 km | 21 | 2 | P01 P02 P07 P03 P04 | 0.993 |

### τ × k grid (`ecoconnect/graph/sensitivity.py::sensitivity`, Scenario Lab `type: "sensitivity"`)

For every (τ, k) the graph is rebuilt and criticality recomputed exactly; compared with the reference (τ 5, k 3):
**Spearman ρ** and **Kendall τ-b** (tie-corrected) of the full ranking, **Jaccard** overlap of the top-5 sets,
and per-patch min/max rank and "in top-5 in n of N variants". Verdict: min ρ ≥ 0.8 "stable", ≥ 0.5 "moderately
sensitive", else "depends strongly". Not stored as a file; the table below was computed on 2026-10-01 by calling
`sensitivity()` on the run's stored `patches_input.json` (deterministic, reproducible through the Scenario Lab):

| τ \ k | 2 | 3 | 4 |
|---|---|---|---|
| 3 km | 10 edges, 5 comp · ρ 0.76 · τ_b 0.64 · J 0.43 | 13, 5 · 0.81 · 0.70 · 0.67 | 14, 5 · 0.81 · 0.70 · 0.67 |
| 5 km | 12, 4 · 0.83 · 0.73 · 0.67 | 18, 3 · 1.00 · 1.00 · 1.00 (ref) | 21, 3 · 1.00 · 1.00 · 1.00 |
| 8 km | 14, 3 · 0.82 · 0.70 · 0.67 | 21, 2 · 0.99 · 0.97 · 1.00 | 25, 2 · 0.99 · 0.97 · 1.00 |

Verdict: *moderately sensitive (min Spearman 0.76 over 9 variants); 3/5 reference top-5 patches stay top-5 in
every variant.* P01 (rank 1 in 9/9), P02 (rank 2 in 9/9) and P03 (rank 4–5, top-5 in 9/9) are robust; P04 is
top-5 in 8/9. **P07 is top-5 in only 4/9 variants (rank 3–9)**: it drops out when k = 2 or τ = 3 km, because
the P02–P07 bridge then no longer exists. The small-but-critical finding is therefore **conditional on k ≥ 3 and
τ ≥ 5 km** — state that whenever P07 is quoted.

Other sensitivity tools: Scenario Lab `tau` / `radius` / `threshold` ([SCENARIOS.md](SCENARIOS.md)) and
`POST /api/runs/{area}/{run}/reanalyse` (rebuild with another τ, k or metric).

## 6. Caveats

- τ (5 km) and k (3) are the paper's values, not calibrated dispersal distances for any species.
- The threshold changes the patch set itself (Scenario Lab `threshold`), which changes every number above.
- `summarise()` always computes PC with p_τ = 0.5 even if `pc_probability_at_tau` is changed, and
  `tau_sensitivity` ignores that setting (audit bug 26).
- Patch ids are per run; the older `kerala-coast_20260920T182222Z` run's "P17" example refers to different
  geometry (a different, Kerala-only model at threshold 0.5).
