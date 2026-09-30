# Paper ↔ implementation matrix

_Written 2026-10-01 from `docs/paper_source_main.tex` (source of `docs/EcoConnectAI_IEEE_paper.pdf`), the code
(`ecoconnect/`, `backend/`, `tests/`) and the stored outputs (`outputs/`). Supersedes
`PAPER_IMPLEMENTATION_TRACEABILITY.md` and `PAPER_IMPLEMENTATION_GAP.md`._

**Read this first.**

- The paper was written **before** any model was trained. It describes (a) a method, (b) a client-side prototype
  running on synthetic data, and (c) connectivity results computed on **synthetic patch geometry**. The software
  has moved on since then. Where they differ, this file says **DISAGREES** and explains how.
- Status values: **IMPLEMENTED** (the code does what the paper states), **PARTIAL** (implemented with a stated
  difference), **PROPOSED** (the paper proposes it as future or alternative work, and the code has at most a
  hook for it), **NOT IMPLEMENTED**.
- Every segmentation number in this repository measures **agreement with Global Mangrove Watch (GMW) v3 2020 weak
  labels**. None is field-truth accuracy. There has been **no field validation**, **no government or agency
  deployment**, and there are **no validated restoration costs**. Scenario outputs are **SIMULATED what-ifs, not
  predictions**.
- Reported model: **`multi_E1_s1_b0_dev`**. It is a U-Net with an EfficientNet-B0 encoder, trained on
  Sentinel-1 VV+VH over 4 areas with an 800/195/200 tile split. From
  `outputs/segmentation/multi_E1_s1_b0_dev/metrics.json` (`test`, threshold 0.5, no TTA): **IoU 0.8423, F1 0.9144,
  precision 0.8783, recall 0.9535**, OA 0.9664, κ 0.8935. Label: `DEVELOPMENT-SUBSET RESULT - NOT FINAL`. The
  score is dominated by Sundarbans, and Kerala is weak.
- Patch IDs (P01…) and candidate IDs (C1/C01…) are assigned **by area, separately in each run**. The same ID in
  two runs, or in the paper and a run, usually refers to a **different object**.

---

## A. Section-by-section matrix

### Abstract, §I Introduction and contributions

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| Abstract | "about 95.56 % overall accuracy from a U-Net with an EfficientNet-B7 encoder" | NOT IMPLEMENTED (not ours) | This is the accuracy **published by the foundation study** (Ghorbanian et al., IEEE JSTARS 18, 2025). No code in this repo produces it. | — | — | PUBLISHED BASELINE — NOT OUR RESULT | Never cite it as EcoConnectAI accuracy. |
| Abstract | "no segmentation model has been trained … we claim no segmentation accuracy of our own" | **DISAGREES** | Five development models are now trained (`outputs/segmentation/*`) | `ecoconnect/ml/`, `scripts/train.py`, `scripts/evaluate.py` | `multi_E1_s1_b0_dev` | IoU 0.842 / F1 0.914 vs GMW (dev) | Revise the abstract. It should report the development result, labelled as agreement with weak labels. |
| Abstract | "the patch geometry is synthetic" | **DISAGREES** (for the platform) | Real patch runs exist from model probability rasters: `outputs/runs/<area>/<area>_multi_E1_s1_b0_dev_t0.70/`. The synthetic geometry now exists only as a test fixture. | `ecoconnect/geospatial/patch_extraction/extract.py`; `tests/fixtures/synthetic_geometry/` | 4 real graph runs | see §VI rows | Present both: synthetic (checks the method) and real development geometry (checks the pipeline, NOT FINAL). |
| Abstract / §VIII | "most critical patch holds 3.8 % of habitat, 11th of 18 by size; largest ranks 6th" | IMPLEMENTED (synthetic only) | Reproduced exactly from the synthetic fixture (see Table VII row) | `ecoconnect/graph/criticality.py` | `tests/test_regression.py::test_synthetic_prototype_reproduces_paper_tables` | `docs/legacy_experiment/results_synthetic_prototype.json` → kerala-coast-p16: areaPct 3.779, rankByArea 11, S 0.4078 | **DISAGREES with real runs.** In every real 4-area run the top patch is the largest or second largest (see §VI-F row). The headline is a property of the synthetic instance and must not be generalised. |
| §I-A C1 | Habitat mapping layer on the weakly supervised S1 methodology, with S2 as a complementary input | PARTIAL | S1 VV/VH is the reported model and GMW v3 is the weak label. S2 exists only as ablations E2/E3. UNB7 (B7) has not been trained. | `ecoconnect/gee/stac_acquire.py`, `gmw_labels.py`; `ecoconnect/ml/` | E1/E2/E3, multi_E1 | see §IV-A rows | Train UNB7 on a GPU. |
| §I-A C2 | Graph where each patch is a node and each spatial relation a weighted edge | IMPLEMENTED | Eq. (3)–(6) rows | `ecoconnect/graph/construction.py` | all runs | — | — |
| §I-A C3 | Criticality framework (leave-one-out) | IMPLEMENTED | Eq. (8)–(9) rows | `ecoconnect/graph/criticality.py` | all runs | — | — |
| §I-A C4 | What-if module | IMPLEMENTED (extended) | Eq. (10) row, plus scenario types A–G | `ecoconnect/graph/what_if.py`, `backend/scenarios.py` | `what_if_top1.json` | — | — |
| §I-A C5 | Explainability layer (area, degree, bridge, contribution, change on removal) | IMPLEMENTED | §IV-E row | `ecoconnect/graph/explain.py` | `explanations.json` | — | — |
| §I-A C6 | Restoration ranking by gain, and gain/cost where costs exist | IMPLEMENTED (costs never shipped) | Eq. (11)–(12) rows | `ecoconnect/graph/restoration.py` | `restoration.json` | — | Real cost data. |
| §I-A C7 | Integrated architecture | IMPLEMENTED | Fig. 1 row | `scripts/run_pipeline.py`, `ecoconnect/pipeline/analysis.py`, `backend/` | — | — | — |
| §I-A C8 | "Working prototype … over demonstration data … formulations implemented offline" | **DISAGREES** (superseded) | The platform now has a FastAPI backend, a database, jobs and model inference, and it recomputes exactly online | `backend/main.py`, `backend/db.py`, `backend/jobs.py` | — | — | Update the paper's description of the prototype. |

### §II Related work, §III Problem formulation

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §II, Table I | Comparison with the literature; "no study combines all" components | NOT IMPLEMENTED (literature claim, not software) | The review covers 6 papers. It does not cover Graphab, Conefor, Circuitscape or restoration-prioritisation tools (see `IP_READINESS.md §5`). | — | — | — | Widen the review before making any "no study combines" claim. |
| §II-B | "Finding no comparable IEEE work on AI-based restoration prioritization" | NOT IMPLEMENTED (literature claim) | The search was limited to IEEE. Non-IEEE connectivity and restoration-prioritisation literature exists. | — | — | — | Rephrase or broaden the search. |
| §III, Fig. 2 | Problem steps (i)–(vi): patches → graph → contribution → loss effect → justification → restoration ranking | IMPLEMENTED | All six steps run in `ecoconnect/pipeline/analysis.py::run_analysis` and are written per run | `ecoconnect/pipeline/analysis.py` | every `outputs/runs/*/*` | — | — |

### §IV-A Data, preprocessing, segmentation

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §IV-A | S1 is the primary input; S2 is complementary and **not fused** | IMPLEMENTED | S1-only is the reported model. S1+S2 fusion exists only as ablation E3, labelled as not the paper's model. | `configs/dataset*.yaml`, `configs/train_*` | `kerala_E3_s1s2_b0_dev` | E3 test IoU 0.053 (Kerala) | — |
| §IV-A | Preprocessing: radiometric and geometric correction, cloud masking, normalisation, co-registration, tiling | PARTIAL | Uses S1 **RTC** products from Planetary Computer (correction done upstream, not by us). S2 L2A is SCL cloud-masked (median). Normalisation is a z-score. Tiles are 256 px, stride 128. | `ecoconnect/gee/stac_acquire.py`, `ecoconnect/geospatial/preprocessing/`, `scripts/build_tiles.py` | — | — | Speckle filtering is not done explicitly. Normaliser-cache and split-leakage bugs are OPEN (see audit, bugs 20–28). |
| §IV-A, Fig. 3 | **UNB7** = EfficientNet-B7 encoder + U-Net decoder + skip connections | PARTIAL | Architecture is available: `build_model("efficientnet-b7")`, `configs/train_full.yaml`. **UNB7 has never been trained here.** The reported model is B0. | `ecoconnect/ml/models/unet.py` | none for B7 | NOT YET RUN | Full-mode training on a CUDA GPU (Colab or Kaggle). |
| §IV-A **Eq. (1)** | P_i(c) = P(y_i = c \| X; θ) ∈ [0,1]; soft probability kept | IMPLEMENTED (binary) | A per-pixel sigmoid probability is written as `*_prob.tif` | `ecoconnect/ml/inference/predict.py::predict_proba, predict_scene` | `outputs/segmentation/multi_E1_s1_b0_dev/predictions/<area>_prob.tif` (gitignored) | — | — |
| §IV-A Eq. (1) | Classes c = mangrove, non-mangrove water, non-habitat (3 classes) | **DISAGREES** | The code is **binary**: `num_classes: 1`, classes `{0: non-habitat, 1: habitat}` (`experiment.json`) | `configs/dataset.yaml` | — | — | Either revise the paper to binary or add a water class. |
| §IV-A | Weak supervision against an existing imperfect map | IMPLEMENTED | The label is GMW v3.0 2020 | `ecoconnect/gee/gmw_labels.py` | — | Kerala GMW = 102.1 ha (0.21 % of AOI) | — |
| §IV-A | Augmentation, patch-based training, TTA (from the foundation study) | PARTIAL | Augmentation and tiling exist. TTA is available (`predict_proba(tta=True)`, horizontal/vertical flips) but the reported test uses `test_tta: false`. | `ecoconnect/ml/datasets/`, `predict.py` | multi_E1 | TTA not used in the reported metric | — |
| §IV-A | Swin-Transformer U-Net as a recorded alternative | PROPOSED | Encoder aliases `swin-t` and `swin-s` exist (timm). Never trained. | `ecoconnect/ml/models/unet.py` | — | — | — |
| §IV-A | Threshold 0.5 and MMU 2 ha, "uncalibrated" | PARTIAL / **DISAGREES** | MMU 2 ha is used. The threshold is **calibrated by a sweep**: 0.70 for E1 and multi, 0.45 for E2. The sweep **selected the threshold on the test split**, a known methodological flaw. | `scripts/threshold_sweep.py` | `outputs/segmentation/multi_E1_s1_b0_dev/threshold_calibration.json` | selected_threshold 0.7, scope "test-split tiles only (224 tiles pooled over 4 rasters)" | Re-run the sweep on the validation split. 0.70 sits at the edge of the grid. |

### §IV-B Patch extraction and graph construction

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| **Eq. (2)** | Patch_i = {A_i, (x_i,y_i), C_i, H_i}; connected components | IMPLEMENTED | 8-connectivity, true pixel area, WGS84 centroid, C_i = mean probability, H_i = class | `ecoconnect/geospatial/patch_extraction/extract.py::extract_patches`; `ecoconnect/graph/types.py::Patch` | `tests/test_patch_extraction.py` (6 tests) | Kerala LATEST: 56 components → 12 kept, 44 below MMU (`manifest.json` extraction_report) | H_i is always "mangrove" (binary model). |
| **Eq. (3)** | G = (V, E) | IMPLEMENTED | — | `ecoconnect/graph/construction.py::HabitatGraph, build_graph` | `tests/test_graph.py` | — | — |
| **Eq. (4)** | A_ij = 1 if d_ij ≤ τ; d = distance between centroids **or nearest boundaries** | PARTIAL | Only **centroid** distance is implemented (haversine or euclidean). Nearest-boundary distance is not. | `construction.py::build_edges, distance_fn` | `test_edges_respect_tau_and_k`, `test_no_edge_beyond_tau` | — | Add edge-to-edge distance. This matters for large deltaic patches. |
| **Eq. (5)** | w_ij = f(d_ij, habitat_similarity_ij, C_i, C_j), a proposed function | PARTIAL | Instantiated only through Eq. (6). The **habitat-similarity term is not used**; it is trivially constant because there is one class. | `construction.py::edge_weight` | — | — | — |
| **Eq. (6)** | w_ij = √(q_i q_j) · exp(−d_ij/τ) | IMPLEMENTED | Exact formula. q_i = patch confidence (`quality == confidence` in `criticality.csv`). The paper's "habitat condition" component of q_i is **not** used. | `construction.py::edge_weight` | `test_edge_weight_formula` | e.g. P07–P04 w = 0.764 at 0.54 km (`explanations.json`) | Add a habitat-condition input if data exists. Note: IIC ignores w_ij, so weights affect only the display and the interface score. |
| §IV-B | k = 3 nearest neighbours with d ≤ τ | IMPLEMENTED | k-NN, then the τ filter, then symmetrised by union | `build_edges`; `configs/graph.yaml` | all runs | — | — |
| §IV-B | "any reported τ must name the species it stands for" | NOT IMPLEMENTED | τ = 5 km is a reference value with **no species**. Locked decision: no invented species. | `configs/graph.yaml` | — | — | Calibrate τ from dispersal data for a named species. |

### §IV-C Connectivity sensitivity and criticality

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §IV-C | C(G) can be LCC, PC or IIC; "analysis holds for any measure" | IMPLEMENTED | `connectivity(graph, a_l, metric)` supports `iic` and `pc` | `ecoconnect/graph/connectivity.py` | `test_iic_*`, `test_pc_*`, `test_eca` | — | — |
| §IV-C / §VI-A | C(G) = IIC; PC (p = 0.5 at d = τ) and ECA reported alongside | IMPLEMENTED | PC uses max-product paths over **all pairs**. ECA = √PC · A_L. | `connectivity.py::iic, pc, eca_ha` | `test_pc_direct_probability_half_at_tau`, `test_pc_uses_max_product_path` | Kerala LATEST IIC 8.138e-6, PC 1.139e-5, ECA 165.1 ha (80.7 % of habitat) | — |
| **Eq. (7)** | Composite index 100·Σ ω_k n_k(G), weights 0.30/0.28/0.22/0.12/0.08 | PARTIAL (demoted) | Implemented, but only as an **INTERFACE SCORE**, never as C(G). It is **non-monotone under removal**, so the UI headlines IIC. In real runs the protection component is 0.0. | `connectivity.py::composite_interface_score` | `test_composite_score_bounds_and_weights` | Kerala LATEST score 60.96 (`metrics.json` interface_score) | Paper should add the caveat about non-monotonicity. |
| **Eq. (8)** | ΔC_i = C(G) − C(G − v_i) | IMPLEMENTED | Exact node deletion and recomputation, stored `delta_connectivity` | `ecoconnect/graph/criticality.py::compute_criticality`; `HabitatGraph.without` | `test_bridge_patch_is_most_critical_despite_smallest_area`, `test_isolated_patch_delta_equals_own_area_term` | — | Cost is O(n) recomputations; fine at ≤54 patches. |
| **Eq. (9)** | S_i = ΔC_i / C(G), sorted in descending order | IMPLEMENTED | Also stores cut vertex, components after removal, and area rank | same; `criticality.csv/.json` | `tests/test_regression.py` (bit-for-bit recomputation of stored runs) | Kerala LATEST: P01 S 0.638 (#1, largest); **P07** 5.49 ha, 2.7 %, 7th by area, rank #3, S 0.256, cut vertex 3→4 | — |
| §IV-C / Fig. 1 "Sensitivity" | Sensitivity analysis | PARTIAL / **DISAGREES in scope** | The paper's "sensitivity" means leave-one-out criticality. The code also has an **assumption-sensitivity grid** (τ × k, Spearman, Kendall, top-k Jaccard, per-patch rank range, verdict). This is an extension the paper does not have. | `ecoconnect/graph/sensitivity.py`; `backend/scenarios.py` type `sensitivity` | `tests/test_sensitivity.py`; computed on demand (no stored file) | Per `docs/context/PROJECT_CONTEXT.md` §3 (old LATEST `kerala-coast_20260920T182222Z`, 2026-09-28): stable across τ at k=3 (ρ 0.96–1.0); k=2 ρ ≈ 0.67–0.71 | Store grid results per run so they are citable. Add the extension to the paper. |

### §IV-D What-if, §IV-E Explainability, §IV-F Restoration

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| **Eq. (10)**, Fig. 4 | ΔC = C_base − C_after for a user-chosen scenario ("P7" illustrative) | IMPLEMENTED | Exact recomputation. Also severed edges, components, isolated and affected patches, and multi-patch removal. | `ecoconnect/graph/what_if.py::simulate_removal`; `POST /api/runs/{area}/{run}/what-if`; `POST …/scenario` | `test_what_if_matches_criticality_for_single_patch`, `test_what_if_multiple_and_unknown_ids` | `what_if_top1.json` (Kerala LATEST, remove P01): loss 63.85 %, 18→14 edges, 3→3 components. SIMULATED. | The paper's "P7" is purely illustrative. It is not the real-run P07 (a coincidence of naming). |
| §IV-D (extension) | — | IMPLEMENTED (not in the paper) | Scenario Lab A–G: polygon removal, area reduction, hypothetical patch, radius and τ change, restore / multi-restore, threshold, period comparison | `backend/scenarios.py::run_scenario` | `test_new_scenarios_on_kerala_run` | SIMULATED | Describe in the paper as a platform extension. |
| §IV-E, Fig. 5 | Rule-based explanation: area, degree, bridge/cut vertex, neighbour distances, confidence, contribution, ΔC_i, sentence | IMPLEMENTED | The sentence is built only from computed evidence. No post-hoc attribution. | `ecoconnect/graph/explain.py::explain_patch` | `test_explanation_uses_computed_evidence` | `explanations.json` P07: "ranks #3 of 12 … lowers IIC by 25.6% … cut vertex … 3 to 4 components" | — |
| §IV-E | Grad-CAM / SHAP / LIME for the segmentation model "should follow" Klotz / Naceur | PROPOSED | Not implemented. The new `frontend/components/analysis/patch-importance.tsx` is a graph-level view, not pixel attribution. | — | — | — | — |
| **Eq. (11)** | R_i = C(G + v_i) − C(G), by node addition | IMPLEMENTED | The candidate is inserted and links form under the same k/τ rule, then everything is recomputed | `ecoconnect/graph/restoration.py::evaluate_candidates`; `HabitatGraph.with_patch` | `test_restoration_gain_and_cost_ranking` | Old LATEST: C1 1.61 ha, +1.289 % IIC. Current LATEST: C05 17.97 ha, +16.45 %. SIMULATED. | — |
| §IV-F | Source of candidates (not specified in the paper) | IMPLEMENTED (not in the paper) | Candidates = connected components with probability in [0.30, threshold), min 1 ha. Rule: area > 5 ha **and** > 10 % of habitat → "uncertain habitat — field check", never headlined as a gain. | `ecoconnect/pipeline/restoration_rules.py` | Kerala LATEST | C01–C04 (20.9–158.8 ha, gains up to +220.7 %) are classified as uncertain habitat, not restoration sites | Add a candidate-generation sentence to the paper. |
| **Eq. (12)** | Priority_i = R_i / Cost_i; reduces to R_i without a cost | IMPLEMENTED (no real costs) | Costs are optional and user-supplied only (`load_costs_csv`, `POST …/restoration`). Every stored real run has `ranking_basis: raw_gain`. | `restoration.py`, `backend/main.py:380` | `test_partial_costs_fall_back_to_raw_gain` | No validated costs exist | Obtain surveyed costs before any cost-aware ranking is used for a decision. |
| §IV-F | Final report: map, graph, ranking, what-if, explanations, restoration | IMPLEMENTED | JSON bundle, PDF report, Reports page | `ecoconnect/pipeline/report.py`, `backend/report_pdf.py`, `backend/insight.py` | — | — | — |

### §V Implementation status and experimental setup

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §V-A | "client-side web application … There is **no backend, database or ML runtime**" | **DISAGREES** | FastAPI backend, SQLAlchemy (SQLite or Postgres), Alembic migrations, a job queue, PyTorch inference, JWT/RBAC | `backend/*`, `ecoconnect/ml/` | `tests/test_backend.py` etc. | — | Rewrite §V-A. |
| §V-A, **Table II** Acquisition | "no imagery retrieved" | **DISAGREES** | S1 RTC and S2 L2A through STAC (Planetary Computer, Earth Search); GMW tiles. Kerala 2020: S1 × 6, S2 × 6. | `ecoconnect/gee/stac_acquire.py`, `scripts/acquire_study_area.py` | — | Rasters are gitignored | Revise Table II. |
| Table II Preprocessing | "Not implemented" | **DISAGREES** (PARTIAL now) | See the §IV-A preprocessing row | `ecoconnect/geospatial/preprocessing/` | — | — | — |
| Table II Segmentation | "Not implemented. No model trained" | **DISAGREES** | 5 development models trained (B0) | `ecoconnect/ml/` | `outputs/segmentation/experiments.csv` | multi_E1 IoU 0.842 | — |
| Table II Probability map / patches / graph | "Prepared" (synthetic, 16–20 patches, 30–39 edges) | **DISAGREES** | Real rasters → patches → graph | — | 4 multi runs | 12–54 patches, 17–73 edges | — |
| Table II Sensitivity | "prepared leave-one-out surface of 426–508 grid cells, four bands" (100 m grid) | NOT IMPLEMENTED (retired) | The heuristic grid surface from the old prototype no longer exists. Criticality is per patch and exact. | — | — | — | Remove it from the paper, or re-implement it as a raster product. |
| Table II What-if | "interface's drop is heuristic; offline exact" | **DISAGREES** (resolved) | The interface calls exact backend recomputation | `backend/main.py:354`, `backend/scenarios.py` | `test_what_if_*` | — | Remove limitation 3 in §VII. |
| Table II Restoration | "Budget-constrained selection" | PARTIAL | Ranking by R_i or R_i/Cost exists. **Budget-constrained selection (knapsack) is not implemented.** | `restoration.py` | — | — | Implement it, or drop "budget-constrained". |
| Table II Decision output | "Implemented: report composition and export" | IMPLEMENTED | — | `report.py`, `report_pdf.py` | — | — | — |
| **Table III** | Kerala, Sundarbans, Odisha: S2 L2A 10 m; **Gulf of Mannar: Landsat-9 OLI-2 30 m**; footprints 486 / 1284 / 826 / 672 km² | PARTIAL / **DISAGREES** | All four areas use **S1 RTC + S2 L2A at 10 m**. There is no Landsat path. Runs use the valid-pixel AOI as A_L (Kerala 48 928.63 ha vs 486 km² configured). | `configs/study_areas.yaml`, `configs/acquisition.yaml` | — | — | Revise Table III to S2 for all areas and define A_L. |
| **Table IV** Training tiles | "≈14 000 labelled 512 × 512 tiles; sources FSI atlas, national wetland inventory, Ramsar" | **DISAGREES** | 256 × 256 tiles, stride 128. Reported split **800 / 195 / 200** (4 areas). Labels are **GMW v3 2020 only**. | `scripts/build_tiles.py`, `configs/dataset.yaml` | `multi_E1_s1_b0_dev/experiment.json` | n_train 800, n_val 195, n_test 200 | Revise Table IV. The 4-area tile set was overwritten on 2026-09-20 and is **not reproducible from the repo alone**. |
| Table IV Segmentation | UNB7 | PARTIAL | B0 development model only | — | — | — | UNB7 run. |
| Table IV Patch extraction | threshold 0.5, MMU 2 ha | PARTIAL / **DISAGREES** | Threshold 0.70 (calibrated) in the reported runs | — | `manifest.json` threshold 0.7 | — | — |
| Table IV Graph / connectivity | k = 3, τ = 5 km (3/5/8 sensitivity), Eq. (6); C(G) = IIC, PC, ECA; interface score | IMPLEMENTED | — | `configs/graph.yaml` | every run: `tau_sensitivity.json` | — | — |
| Table IV Sensitivity grid | 100 m grid, four bands | NOT IMPLEMENTED | see Table II row | — | — | — | — |
| Table IV Software (built) | "Python 3, standard library only" for §VI | IMPLEMENTED (core) | The graph core (`ecoconnect/graph/{construction,connectivity,criticality,what_if,restoration}.py`) imports only the stdlib. networkx is used only in `pipeline/frontend_adapter.py`. | `ecoconnect/graph/` | — | — | — |
| Table IV Software (planned) / unfixed window, scene count, split, hardware | PyTorch, Rasterio, GeoPandas, OpenCV; four quantities "unfixed" | **DISAGREES** (now fixed) | PyTorch + segmentation-models-pytorch, rasterio, shapely, pyproj (no GeoPandas or OpenCV). Kerala window 2020, S1 × 6 / S2 × 6. Spatial-block split seed 42. Apple M3 (MPS). | `requirements.txt`; `experiment.json` | — | — | Fill in Table IV. |

### §VI Results — where paper and software diverge most

The §VI results were computed over **SYNTHETIC** patch geometry. `ecoconnect/graph` reproduces them from
`tests/fixtures/synthetic_geometry/` (the geometry comes from the old prototype's deterministic generator; only the
site metadata is real). The reference file is `docs/legacy_experiment/results_synthetic_prototype.json`, produced by
`docs/legacy_experiment/connectivity_experiment.py`.

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §VI-A | Results come from our implementation of Eqs. (4)–(12) over synthetic geometry, k=3, τ=5, PC p=0.5 at τ | IMPLEMENTED | Same parameters are recorded in the reference file's `parameters` | `ecoconnect/pipeline/sources.py::from_prototype_mock` | `tests/test_regression.py` | — | — |
| §VI-B, **Table V** | UNB7 OA 95.56 %, κ 0.94, F1 0.95, PA 95.37 %, UA 95.90 %; RF 77.35 % / 0.74 | NOT IMPLEMENTED (not ours) | **The foundation study's numbers.** Nothing in `outputs/` produces them. | — | — | PUBLISHED BASELINE — NOT OUR RESULT | Add a separate, clearly labelled block with our development result (IoU 0.842 / F1 0.914 vs GMW). **Never merge the two.** Note that the metrics differ (OA vs IoU/F1) and so do the labels (theirs vs GMW). |
| §VI-C, **Table VI** | Kerala 18/18/3, IIC×10³ 5.38, PC×10³ 7.28, ECA 4147 ha 59.6 %; Sundarbans 20/10/12, 0.55, 1.54, 5045, 53.7; GoM 17/12/9, 0.81, 2.05, 3741, 55.1; Odisha 16/10/8, 1.91, 4.40, 4460, 54.7 | IMPLEMENTED (**SYNTHETIC**) | **Bit-for-bit.** Counts are equal. IIC, PC and ECA match to rel 1e-9 for all 4 landscapes. | `ecoconnect/graph/connectivity.py::summarise` | `tests/test_regression.py::test_synthetic_prototype_reproduces_paper_tables[4 areas]` (passes 2026-10-01) | e.g. kerala-coast IIC 0.0053756, PC 0.0072800, ECA 4146.68 ha, 59.58 % | **DISAGREES with real runs** (same k/τ, multi_E1, t 0.70; `outputs/runs/<area>/<area>_multi_E1_s1_b0_dev_t0.70/metrics.json`). Kerala 12/18/3, IIC 8.138e-6, ECA 80.7 %. Sundarbans 54/73/13, IIC 4.293e-2, 48.8 %. GoM 16/17/6, IIC 9.772e-8, 54.4 %. Odisha 21/28/4, IIC 1.913e-2, 70.7 %. The paper's "ECA 53.7–59.6 % in all four" does **not** hold on real geometry (48.8–80.7 %). |
| §VI-D, **Table VII** | Kerala top-9: P16 (263.0 ha, 3.8 %, S 0.408, comp 5, area rk 11) … P14 (820.6 ha, S 0.245, rank 6) … **P17 (355.2 ha, 5.1 %, deg 2, S 0.194, rank 7)** | IMPLEMENTED (**SYNTHETIC**) | Rank and S_i for **every** patch of all 4 landscapes are pinned (rel 1e-9) | `criticality.py::compute_criticality` | same test | reference `sensitivity[]`: kerala-coast-p16 S 0.40785, p14 S 0.24505, p17 S 0.19376 | **Paper P17 ≠ real-run P17.** The paper's P17 is the synthetic "kerala-coast-p17" (rank 7, S 0.194). The platform's "P17 story" is `kerala-coast_20260920T182222Z` P17: 3.13 ha, 1.4 %, rank #3, S 0.2695, cut vertex 2→3 (pinned by `test_p17_worked_example`). The current Kerala LATEST (`kerala-coast_multi_E1_s1_b0_dev_t0.70`) has **no P17 at all** (12 patches); its worked example is P07. |
| §VI-D | "Most critical patch not the largest in 3 of 4 instances (11th, 2nd, 3rd by area; GoM agrees)" | IMPLEMENTED (**SYNTHETIC**) | Reference top-1 rankByArea: kerala 11, sundarbans 2, odisha 3, GoM 1 | — | same test (ranks) | as stated | **DISAGREES with real runs.** Real top-1 area rank: Kerala P01 1, Sundarbans P01 1, Odisha P01 1, GoM P02 2. In real geometry the largest patch is the most critical in 3 of 4 landscapes. The small-bridge pattern does appear, but lower in the ranking (Kerala P07, rank #3, 7th by area). |
| §VI-E, **Table VIII** | Kerala restoration C1…C8: C1 101.7 ha R 2.73 % Priority×10³ 5.9 … C5 143.0 ha 3.50 %, INR 807 lakh, rank 5; C8 0.07 % | IMPLEMENTED (**SYNTHETIC**, costs synthetic) | Reproduces when run by hand (2026-10-01): max \|Δ gain %\| ≤ 2.8e-14 over 4 areas, identical cost-aware order. **No test pins Table VIII.** | `restoration.py::evaluate_candidates(costs=…)` | ad hoc; costs from `tests/fixtures/synthetic_geometry/recommendations.json` (`costLakh`) | reference `restoration[]`: kerala-coast-r8 gainPct 2.728, cost 466.3, priority 0.00585 | The paper's C1–C8 are **rank relabels** of fixture ids r8, r3, r1, r5, r7, r2, r4, r6. The INR costs are **synthetic generator values**, not "indicative planning values" from any survey. There are no real costs, and real runs rank by raw gain. Add a Table VIII regression test. |
| §VI-F | Spearman ρ(area, S_i) = 0.459 Kerala, 0.641 Odisha, 0.767 GoM, 0.917 Sundarbans | IMPLEMENTED (**SYNTHETIC**) | Exact reproduction by hand (`area_vs_criticality_rho`). **Not pinned by a test.** | `criticality.py::spearman, area_vs_criticality_rho` | ad hoc; `test_spearman` (unit) | reference `spearman_area_vs_S` equal to 1e-16 | **DISAGREES with real runs** (`metrics.json` `spearman_area_vs_criticality`): Kerala 0.902, Odisha 0.873, GoM 0.800, Sundarbans 0.834. On real geometry area is a **strong** proxy. The paper's "area weakest where network most connected" is not supported. |
| §VI-F | τ sensitivity (Kerala): 3 / 18 / 30 links at τ = 3/5/8; ρ vs 5 km 0.492 / 0.494, "negative result" | IMPLEMENTED (**SYNTHETIC**) | Exact reproduction by hand (`tau_sensitivity`): edges 3/18/30, ρ 0.49226 / 0.49432. **Not pinned by a test.** | `criticality.py::tau_sensitivity` | ad hoc; reference `tau_robustness_kerala` | as stated | **DISAGREES with real runs** (`tau_sensitivity.json`, ρ vs 5 km at 3 / 8 km): Kerala 0.811 / 0.993, Odisha 0.688 / 0.764, GoM 1.000 / 0.594, Sundarbans 0.818 / 0.867. Sensitivity depends on the landscape. The τ × k grid shows k matters more (k = 2 → ρ ≈ 0.67 on the old Kerala run). |
| §VI-F | Explanation of P16 restates Table VII ("exact by construction") | IMPLEMENTED | The explanation is built from the same computed fields | `explain.py` | `test_explanation_uses_computed_evidence` | — | — |

### §VII Limitations, §VIII Conclusion

| Paper Section | Claim | Implemented? | Evidence | Code Location | Experiment | Result | Remaining Work |
|---|---|---|---|---|---|---|---|
| §VII limitation 1 | Geometry is synthetic | **DISAGREES** (partly resolved) | Real development geometry exists. It is still not field-validated. | — | 4 multi runs | — | Replace with "development-model geometry, weak-label agreement only". |
| §VII limitation 2 | Ranking materially sensitive to τ (ρ ≈ 0.49) | PARTIAL | True for the synthetic instance only. Real runs: ρ 0.59–1.0 (see §VI-F). | — | — | — | Report both. |
| §VII limitation 3 | Interface what-if is heuristic; exact only offline | **DISAGREES** (resolved) | Exact in the interface | `backend/scenarios.py` | — | — | Remove. |
| §VII future | S1/S2 fusion | PARTIAL | E3 early fusion exists as an ablation (Kerala IoU 0.053) | configs `*_s1s2` | `kerala_E3_s1s2_b0_dev` | — | — |
| §VII future | Field validation | NOT IMPLEMENTED (data) | The workflow software exists (field tasks, evidence, HITL disagreements), but **no field campaign has happened** | `backend/workflow_api.py`, `docs/FIELD_WORKFLOW.md` | — | none | Field campaign. |
| §VII future | Temporal GNN, uncertainty modelling, multi-objective budget optimisation, near-real-time change detection, fuller XAI evaluation, GIS integration | PROPOSED | Not implemented. A geometric (non-learned) patch-tracking module exists: `ecoconnect/graph/temporal.py` (disappeared, new, split, merged, …; flags cross-model comparisons as not comparable). It is uncommitted as of 2026-10-01. | `ecoconnect/graph/temporal.py`, `tests/test_temporal.py` | — | "modelled habitat change", never "confirmed loss" | — |
| §VIII | "No model has been trained and the geometry is synthetic" | **DISAGREES** | see Abstract rows | — | — | — | Revise. |

---

## B. Implemented but not in the paper (platform extensions)

These exist in the code. They are **not** paper results, and the paper does not need them. Never present them as
validated.

| Feature | Code | Tests | Status caveat |
|---|---|---|---|
| τ × k assumption-sensitivity grid with a stability verdict | `ecoconnect/graph/sensitivity.py` | `tests/test_sensitivity.py` | Computed on demand |
| Scenario Lab A–G (polygon removal, area reduction, hypothetical patch, radius and τ, restore, threshold, period comparison) | `backend/scenarios.py` | `test_new_scenarios_on_kerala_run` | SIMULATED |
| Restoration candidate rule ("uncertain habitat — field check") and water/NDWI feasibility screen | `ecoconnect/pipeline/restoration_rules.py`, `backend/scenarios.py::restoration_feasibility` | backend tests | Screening only, not feasibility assessment |
| Provenance lineage (12 steps, hashes, commit, config hash) and on-demand reproduction | `backend/provenance.py`, `backend/registry_api.py`, `backend/job_handlers.py` | `tests/test_registry.py` | Reproduction is at graph level. Rasters and checkpoints are not in git. |
| Model status ladder DEVELOPMENT → EXPERIMENTAL → CANDIDATE → VALIDATED | `backend/registry_api.py` | `tests/test_registry.py` | Nothing is VALIDATED |
| Staged restoration review (GIS → field → feasibility → decision), field checklist, HITL disagreement export | `backend/workflow_api.py` | `tests/test_phase5.py`, `tests/test_workflow.py` | No real field data |
| Evidence-grounded LLM assistant (citations filtered to the evidence pack, proposed scenarios run only on user click) | `backend/assistant_llm.py`, template fallback `backend/insight.py` | `tests/test_assistant.py` (stubbed model) | Live model not evaluated |
| Alerts, projects, audit trail, RBAC, jobs, S3 storage | `backend/*` | `tests/test_backend.py`, `test_platform.py` | — |
| Patch tracking between runs | `ecoconnect/graph/temporal.py` | `tests/test_temporal.py` | Uncommitted. Modelled change only. |

## C. Complete list of paper ↔ code disagreements

1. **Segmentation status.** The paper says no model was trained. The repo has 5 development B0 models; the
   reported one is `multi_E1_s1_b0_dev` with IoU 0.842 / F1 0.914 vs GMW weak labels.
2. **95.56 % OA** is the foundation study's UNB7 result. It is not ours and is never produced by this code.
3. **UNB7 (EfficientNet-B7)** is specified but was never trained here. Only B0 was trained.
4. **Tables VI–VIII** are synthetic. VI and VII are pinned bit-for-bit by `tests/test_regression.py`. VIII,
   ρ(area, S) and τ-robustness reproduce exactly when run by hand but are **not** pinned by any test.
   (`PROJECT_CONTEXT.md §3` still says "no test enforces it". That is stale for VI–VII.)
5. **P17.** The paper's P17 is synthetic (rank 7, S 0.194). The platform's P17 comes from run
   `kerala-coast_20260920T182222Z` (rank #3, S 0.270, cut vertex). The current Kerala LATEST has no P17; its
   worked example is P07. The same applies to the paper's P16/P14 and C1–C8: synthetic objects only.
6. **The headline "most critical patch is small"** holds only on synthetic geometry. In real runs the largest
   patch is #1 in 3 of 4 landscapes, and ρ(area, S) is 0.80–0.90 (paper: 0.46–0.92).
7. **τ sensitivity.** The paper reports ρ ≈ 0.49. Real runs give 0.59–1.0, depending on the landscape.
8. **ECA range.** The paper reports 53.7–59.6 % of habitat. Real runs give 48.8–80.7 %.
9. **Table VIII costs** are synthetic generator values (`recommendations.json`). No real or validated costs exist.
   Real runs rank by raw gain.
10. **Classes.** The paper uses 3 classes; the code is binary.
11. **Threshold.** The paper uses a fixed 0.5. The code uses a sweep-calibrated 0.70, selected on the test
    split (a known flaw).
12. **Training data.** The paper states ≈14 000 × 512² tiles from FSI, wetland-inventory and Ramsar sources. The
    code uses 800/195/200 × 256² tiles labelled with GMW v3 only, and that tile set is not reproducible from the
    repo.
13. **Table III.** The paper uses Landsat-9 30 m for Gulf of Mannar. The code uses S2 10 m for all areas.
14. **Architecture.** The paper states there is no backend, database or ML runtime and that the interface what-if
    is heuristic. The code has a full backend and computes the what-if exactly online.
15. **Table II/IV "100 m sensitivity grid, four bands"** does not exist in the code.
16. **Table II "budget-constrained selection"** is not implemented. The code only ranks.
17. **Eq. (4)/(5)/(6) details.** The code has no nearest-boundary distance, no habitat-similarity term, and
    q_i = confidence only (no "habitat condition"). No species is named for τ.
18. **Eq. (7)** is implemented but demoted to an interface score, because it is non-monotone under removal.

## D. How to keep paper and code in sync

1. **One source per number.** Every number in the paper should name the file it came from: a `metrics.json`,
   `criticality.json`, `tau_sensitivity.json`, or the legacy synthetic JSON. If a number has no file, it is not a
   result.
2. **Pin every table with a test.** Tables VI–VII are pinned in `tests/test_regression.py`. Add
   `test_synthetic_table_viii_restoration`, `test_synthetic_area_rho` and `test_synthetic_tau_robustness` against
   `docs/legacy_experiment/results_synthetic_prototype.json`. Pin any new real-run table the same way it pins P17
   and C1.
3. **Never reuse an ID across runs in prose.** Always write "P07 in `kerala-coast_multi_E1_s1_b0_dev_t0.70`". IDs
   are reassigned by area in each run. For the same place across runs, use `ecoconnect/graph/temporal.py`.
4. **Label every table.** Use `PUBLISHED BASELINE — NOT OUR RESULT`, `PROTOTYPE / SYNTHETIC`,
   `DEVELOPMENT-SUBSET RESULT — NOT FINAL`, or `SIMULATED`. Never put a synthetic and a real value in the same
   column.
5. **When LATEST changes** (`outputs/runs/<area>/LATEST`), re-check the worked example and all figures quoted
   in the paper, landing page, `mesa_prep/` and `docs/context/PROJECT_CONTEXT.md §3`.
6. **Before any paper revision,** walk section C of this file. For each disagreement, either revise the paper
   or change the code, then update the row to IMPLEMENTED.
7. **At commit time,** update this matrix together with `docs/context/` (SESSION_LOG, PROJECT_CONTEXT §3), as
   `CLAUDE.md` requires.
