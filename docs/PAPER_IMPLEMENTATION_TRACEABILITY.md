# Paper → code traceability

Paper: `docs/EcoConnectAI_IEEE_paper.pdf` (source `docs/paper_source_main.tex`). Equation numbers follow the paper.

| Paper element | Statement | Code | Test |
|---|---|---|---|
| Fig. 1 architecture (11 stages) | satellite → preprocessing → segmentation → probability map → patches → graph → sensitivity → what-if → XAI → restoration → decision | `scripts/run_pipeline.py` orchestrates `ecoconnect/gee` → `geospatial/preprocessing` → `ml` → `geospatial/patch_extraction` → `graph/*` → `pipeline/analysis.py` → `backend` → `frontend` | `tests/test_ml_pipeline.py` (plumbing), `tests/test_backend.py` |
| §IV-A, Fig. 3 | UNB7: EfficientNet-B7 encoder + U-Net decoder + skip connections | `ecoconnect/ml/models/unet.py::build_model("efficientnet-b7")` (`configs/train_full.yaml`); dev config B0 | `test_ml_pipeline` |
| §IV-A | S1 primary, S2 complementary, not fused | scene stores both; `configs/dataset.yaml → bands` selects S1-only baseline; fusion is an explicitly labelled experiment | `docs/DATASET_SETUP.md` |
| §IV-A | weak supervision against an existing imperfect map | `ecoconnect/gee/gmw_labels.py` (Global Mangrove Watch) | `tests/test_acquisition.py` |
| **Eq. (1)** P_i(c) = P(y_i = c \| X; θ) | soft per-pixel probability kept | `ecoconnect/ml/inference/predict.py::predict_proba`, `predict_scene` → `*_prob.tif` | `test_ml_pipeline` (range [0,1], nodata preserved) |
| **Eq. (2)** Patch_i = {A_i, (x_i,y_i), C_i, H_i}; threshold 0.5; MMU 2 ha | connected components → area (true pixel area), WGS84 centroid, mean probability, class | `ecoconnect/geospatial/patch_extraction/extract.py::extract_patches`; `ecoconnect/graph/types.py::Patch` | `tests/test_patch_extraction.py` |
| **Eq. (3)** G = (V, E) | | `ecoconnect/graph/construction.py::HabitatGraph`, `build_graph` | `test_graph` |
| **Eq. (4)** A_ij = 1 if d_ij ≤ τ | k-NN restricted to d ≤ τ, symmetrised | `construction.py::build_edges` | `test_edges_respect_tau_and_k`, `test_no_edge_beyond_tau` |
| **Eq. (5)–(6)** w_ij = √(q_i q_j)·exp(−d_ij/τ) | | `construction.py::edge_weight` | `test_edge_weight_formula` |
| §IV-B k = 3, τ = 5 km | configurable | `configs/graph.yaml` | — |
| §IV-C / §VI-A C(G) = IIC; PC, ECA alongside | | `ecoconnect/graph/connectivity.py::iic, pc, eca_ha, connectivity` | `test_iic_*`, `test_pc_*`, `test_eca` |
| **Eq. (7)** composite interface score, weights 0.30/0.28/0.22/0.12/0.08 | labelled INTERFACE score only | `connectivity.py::composite_interface_score` | `test_composite_score_bounds_and_weights` |
| **Eq. (8)** ΔC_i = C(G) − C(G − v_i) | exact node deletion + recomputation | `ecoconnect/graph/criticality.py::compute_criticality`; `HabitatGraph.without` | `test_bridge_patch_is_most_critical…`, `test_isolated_patch_delta…` |
| **Eq. (9)** S_i = ΔC_i / C(G), sorted descending | | same; `write_criticality_csv` → `criticality.csv` (rank, patch_id, area, area_pct, degree, ΔC, S_i, components after) | same |
| **Eq. (10)** ΔC = C_base − C_after (what-if) | exact; also severed edges, components, isolated/affected patches | `ecoconnect/graph/what_if.py::simulate_removal`; `POST /api/runs/{area}/{run}/what-if`; `frontend/app/simulation/page.tsx` | `test_what_if_*`, `test_exact_what_if_matches_criticality` |
| §IV-E, Fig. 6 explainability | area, degree, cut-vertex, neighbour distances, confidence, ΔC_i, sentence | `ecoconnect/graph/explain.py::explain_patch` | `test_explanation_uses_computed_evidence` |
| **Eq. (11)** R_i = C(G + v_i) − C(G) | node addition (k-NN links), recomputation | `ecoconnect/graph/restoration.py::evaluate_candidates`; `HabitatGraph.with_patch` | `test_restoration_gain_and_cost_ranking` |
| **Eq. (12)** Priority_i = R_i / Cost_i; reduces to R_i without cost | cost optional, user-supplied only | same; `load_costs_csv`; `POST …/restoration` | `test_partial_costs_fall_back_to_raw_gain`, `test_restoration_with_and_without_costs` |
| §VI-F area baseline: Spearman ρ(area, S_i) | | `criticality.py::spearman, area_vs_criticality_rho` | `test_spearman` |
| §VI-F τ sensitivity (3/5/8 km) | | `criticality.py::tau_sensitivity` → `tau_sensitivity.json` | — |
| Tables VI–VIII (synthetic geometry) | regenerated exactly | `scripts/run_graph_analysis.py --source prototype` → `outputs/runs/*/prototype_synthetic/` | regression vs `docs/legacy_experiment/results_synthetic_prototype.json`: max |Δ| = 5e-16 |
| Table II implementation status | | superseded by `docs/IMPLEMENTATION_AUDIT.md` + `README.md` status | — |
| Table III study areas | metadata only | `configs/study_areas.yaml` | — |
| Table V (foundation study accuracy) | PUBLISHED BASELINE — NOT OUR RESULT | never emitted by code; `docs/RESULTS_PROVENANCE.md` | — |
| Decision output | report of map, graph, ranking, what-if, explanations, restoration | `pipeline/analysis.py` exports + `frontend_bundle.json`; `pipeline/report.py` (`GET …/report`, Reports page); dashboard | — |
