# EcoConnectAI — Implementation Audit and Execution Plan

**Date:** 2026-09-18
**Paper audited:** `docs/EcoConnectAI_IEEE_paper.pdf` (6-page IEEE conference version, LaTeX source `docs/paper_source_main.tex`, compiled 2026-09-17)
**Prototype audited:** https://github.com/kuldeep31016/Major-Project-Prototype (Next.js 16 / React 19 / TypeScript; copied unchanged into `frontend/`)
**Offline experiment audited:** `docs/legacy_experiment/connectivity_experiment.py` (Python stdlib; produced Tables VI–VIII of the paper over synthetic patches)

---

## 1. What the paper specifies

| Paper element | Specification (as written in the paper) | Eq. / Table |
|---|---|---|
| Input | Sentinel-1 SAR (VV, VH) drives segmentation; Sentinel-2 L2A supplies complementary indices. **Not fused.** | §IV-A |
| Preprocessing | Radiometric/geometric correction, cloud masking, normalization, co-registration, tiling | §IV-A |
| Segmentation | UNB7 = EfficientNet-B7 encoder + U-Net decoder + skip connections; weakly supervised against an existing imperfect ecosystem map; Swin-U-Net as an alternative | Eq. (1), Fig. 3 |
| Probability map | P_i(c) = P(y_i = c \| X; θ), soft probability kept | Eq. (1) |
| Patch extraction | Connected components of above-threshold pixels; threshold 0.5; MMU 2 ha; Patch_i = {A_i, (x_i,y_i), C_i, H_i} | Eq. (2) |
| Graph | G=(V,E); binary edge if d_ij ≤ τ; weighted w_ij = √(q_i q_j)·exp(−d_ij/τ); k=3 nearest neighbours subject to d ≤ τ | Eqs. (3)–(6) |
| Connectivity C(G) | **Research metric:** IIC (Pascual-Hortal & Saura 2006), with PC and ECA alongside (p_ij = exp(−α d), p(τ)=0.5). **Interface score:** 0–100 composite Eq. (7), weights 0.30/0.28/0.22/0.12/0.08 | Eq. (7), §VI-A |
| Criticality | ΔC_i = C(G) − C(G − v_i); S_i = ΔC_i / C(G); exact leave-one-out | Eqs. (8)–(9) |
| What-if | ΔC = C_base − C_after (single scenario case of Eq. 8) | Eq. (10) |
| Explainability | Rule-based; reports area, degree, bridge/cut-vertex status, neighbour distances, confidence, contribution, ΔC_i | §IV-E, Fig. 6 |
| Restoration | R_i = C(G + v_i) − C(G); Priority_i = R_i / Cost_i when cost exists, else R_i | Eqs. (11)–(12) |
| Study areas | Vembanad–Kol (Kerala), Sundarbans W. Delta (WB), Gulf of Mannar (TN), Bhitarkanika (Odisha) | Table III |
| Evaluation | Segmentation: OA/κ/F1 (inherited only, **not ours**); connectivity: IIC/PC/ECA, criticality ranking, Spearman ρ vs area, τ-sensitivity (τ ∈ {3,5,8} km) | §VI |
| Declared status | No model trained; patch geometry synthetic; interface what-if is heuristic; exact ΔC only offline | Table II, §VII |

---

## 2. Component audit

Legend for *Current State*: **implemented** = real computation exists · **prepared** = static synthetic JSON · **heuristic** = approximation, not the paper's formula · **absent** = nothing exists.

| # | Component | Current State | Evidence (prototype) | Target State | Target Files | Priority |
|---|---|---|---|---|---|---|
| 1 | Satellite acquisition | **absent** (scene picker UI only; `sizeMb`, `productId` are fabricated metadata) | `frontend/mock-data/satellite-images.json`, `frontend/app/upload/page.tsx` | STAC-based downloader (no credentials) + optional GEE module; AOI/date/cloud/bands configurable | `ecoconnect/gee/`, `configs/acquisition.yaml` | HIGH (blocked on dataset decision, §5) |
| 2 | Preprocessing | **absent** (animated log lines only) | `frontend/lib/data.ts` → `PIPELINE_STAGES` | Real GeoTIFF read, band selection, nodata, normalization, tiling, train-only augmentation | `ecoconnect/geospatial/preprocessing/`, `docs/PREPROCESSING.md` | HIGH |
| 3 | Dataset loader | **absent** | — | Lazy `torch.utils.data.Dataset` over tile pairs; train/val/test splits; DEV subset mode; seeded | `ecoconnect/ml/datasets/`, `configs/dataset.yaml` | HIGH |
| 4 | Segmentation model (UNB7) | **absent** ("EcoSeg v3.2 Swin-UNet" is a fictional label in the log) | `PIPELINE_STAGES[2]` | UNB7 via `segmentation_models_pytorch` (EfficientNet-B7 encoder, U-Net decoder). Dev config: EfficientNet-B0 encoder, same decoder. Swin-U-Net optional. | `ecoconnect/ml/models/` | HIGH |
| 5 | Training / validation / evaluation | **absent** | — | `train.py`, `validate.py`, `evaluate.py`; IoU/Dice/P/R/F1; checkpoints; early stopping; AMP where supported; CSV/JSON experiment log | `ecoconnect/ml/training/`, `ecoconnect/ml/evaluation/`, `scripts/` | HIGH |
| 6 | Probability / binary habitat map | **prepared** (per-class area/coverage/confidence are generator outputs) | `mock-data/habitat-mask.json → classes, totals` | `predict_proba()` producing GeoTIFF probability, confidence and binary maps; configurable threshold | `ecoconnect/ml/inference/` | HIGH |
| 7 | Patch extraction | **prepared** (16–20 hand-generated polygons per landscape) | `mock-data/habitat-mask.json → patches` | Connected components (8-connectivity) on the binary map; area from pixel size × CRS; centroid; polygon via rasterio.features.shapes; mean confidence; MMU filter | `ecoconnect/geospatial/patch_extraction/` | HIGH |
| 8 | Graph construction | **prepared** in UI; **implemented** offline (k-NN ≤ τ, unweighted) | `mock-data/graph.json`; `legacy_experiment/build_edges()` | Port + extend offline code: Eq. (4) binary, Eq. (6) weighted w_ij, haversine or projected distance, configurable k/τ | `ecoconnect/graph/construction.py` | HIGH |
| 9 | Connectivity metrics (IIC, PC, ECA) | **implemented** offline; **prepared** in UI (`pcIndex`, `iicIndex` are static numbers) | `legacy_experiment/IIC(), PC()`; `mock-data/connectivity.json` | Port with unit tests; documented formulas/units; composite interface score Eq. (7) kept **separately labelled** | `ecoconnect/graph/connectivity.py`, `docs/CONNECTIVITY_METRICS.md` | HIGH |
| 10 | Criticality (leave-one-out) | **implemented** offline; **prepared** in UI (`bridgeScore`, `sensitivity` static) | `legacy_experiment` loop; `mock-data/heatmap.json` | Exact Eq. (8)–(9) for every patch; `criticality.csv`; cut-vertex detection | `ecoconnect/graph/criticality.py` | HIGH |
| 11 | What-if simulation | **heuristic** in UI (`bridgeScore*9 + connectivityContribution*22`) | `frontend/app/simulation/page.tsx:106-151` | Exact recomputation via backend `POST /what-if`; returns before/after C(G), ΔC, severed edges, components, isolated patches | `ecoconnect/graph/what_if.py`, `backend/` | HIGH |
| 12 | Explainability | **prepared** text (pre-written `explanation` strings) | `mock-data/graph.json → nodes[].explanation` | Rule-based generator from computed values (area, degree, cut-vertex, neighbour distances, confidence, ΔC, S_i) | `ecoconnect/graph/explain.py` | MEDIUM |
| 13 | Restoration prioritization | **implemented** offline (node addition); **prepared** candidates & costs in UI | `legacy_experiment` restoration loop; `mock-data/recommendations.json` | R_i by node addition on the real graph; candidates = sub-MMU / low-probability components or user-supplied; cost **optional and user-provided** | `ecoconnect/graph/restoration.py` | HIGH |
| 14 | Storage | none (static JSON) | — | **Decision: no database.** Pipeline writes versioned JSON/GeoJSON/CSV/GeoTIFF under `outputs/<run_id>/`; backend serves them. Rationale in §4. | `outputs/`, `docs/ARCHITECTURE.md` | LOW |
| 15 | Backend API | **absent** | — | FastAPI: study-areas, runs, patches, graph, metrics, criticality, what-if (exact), restoration, explanations | `backend/main.py` | HIGH |
| 16 | Frontend data layer | **implemented** over mock JSON | `frontend/lib/data.ts` (single access module — by design) | Same function signatures, backed by backend API with graceful fallback to mock **clearly labelled as PROTOTYPE / SYNTHETIC** | `frontend/lib/data.ts`, `frontend/lib/api.ts` | HIGH |
| 17 | Map (Leaflet) | **implemented** | `frontend/components/maps/gis-map.tsx` | Keep; add real habitat-probability raster overlay (PNG from pipeline) and GeoJSON patches | existing | MEDIUM |
| 18 | Graph view (React Flow) | **implemented** | `frontend/components/graph/connectivity-graph.tsx` | Keep; feed with real graph | existing | MEDIUM |
| 19 | Heatmap / sensitivity surface | **prepared** (426–508 cells) | `mock-data/heatmap.json` | Derive from criticality: each patch's pixels coloured by S_i (per-patch, not per-cell — honest to what is computed) | `ecoconnect/pipeline/export.py` | MEDIUM |
| 20 | Scenarios (cyclone, SLR …) / timeline 2020–25 / reports / history / assistant | **prepared** narrative content | `mock-data/simulation.json, timeline.json, reports.json, history.json, assistant.json` | Keep as **PROTOTYPE / DEMONSTRATION** features, labelled in UI. Not in the paper's core pipeline; not replaced in this iteration. | — | LOW |
| 21 | Tests | **absent** | — | pytest on tiny hand-checkable graphs + dataset/patch tests | `tests/` | HIGH |
| 22 | Paper→code traceability | partially in `deliverables_notes.md` | — | `docs/PAPER_IMPLEMENTATION_TRACEABILITY.md` | docs | MEDIUM |

### What already works and must be preserved

* The Next.js UI (all 9 routes, Leaflet map, React Flow graph, Recharts charts, theme) — starting point, not to be redesigned.
* `frontend/lib/data.ts` — the single typed data-access seam the paper (§V-A) promised for swapping in real outputs.
* The offline connectivity math (`legacy_experiment/connectivity_experiment.py`): IIC, PC, ECA, k-NN-τ edges, exact leave-one-out, node-addition restoration, Spearman. Ported (not rewritten) into `ecoconnect/graph/` and kept regression-tested against `results_synthetic_prototype.json` so the paper's Tables VI–VIII reproduce bit-for-bit.

### What is simulated and must be replaced

Everything under `frontend/mock-data/` except site metadata (names, coordinates, protection status). Specifically: patches, classes/coverage, graph edges, PC/IIC values, heatmap cells, criticality bands, what-if numbers, restoration candidates and costs, explanations.

---

## 3. Target architecture

```
Sentinel-1 / Sentinel-2 (STAC or GEE, or user-provided tiles)        ecoconnect/gee/
        ↓
Preprocessing: read, band select, nodata, normalise, tile            ecoconnect/geospatial/preprocessing/
        ↓
Dataset (lazy, split, DEV/FULL mode)                                  ecoconnect/ml/datasets/
        ↓
UNB7 segmentation (train / validate / evaluate)                       ecoconnect/ml/{models,training,evaluation}/
        ↓
predict_proba → probability GeoTIFF, confidence, binary (threshold)   ecoconnect/ml/inference/
        ↓
Patch extraction (connected components, MMU, geometry)                ecoconnect/geospatial/patch_extraction/
        ↓
Graph  G=(V,E)  k-NN ≤ τ, w_ij                                         ecoconnect/graph/construction.py
        ↓
Connectivity IIC / PC / ECA  (+ interface composite, labelled)         ecoconnect/graph/connectivity.py
        ↓
Criticality  ΔC_i, S_i  (exact leave-one-out)                          ecoconnect/graph/criticality.py
        ↓
What-if  (exact recomputation)                                         ecoconnect/graph/what_if.py
        ↓
Explanation (rule-based from computed evidence)                        ecoconnect/graph/explain.py
        ↓
Restoration  R_i, Priority_i                                           ecoconnect/graph/restoration.py
        ↓
Export  JSON / GeoJSON / CSV / PNG → outputs/<run_id>/                 ecoconnect/pipeline/
        ↓
FastAPI backend  →  Next.js frontend (existing UI)                     backend/, frontend/
```

**One deviation from the requested folder layout, explained:** Python modules live under a single package `ecoconnect/` (`ecoconnect/ml`, `ecoconnect/geospatial`, `ecoconnect/graph`, `ecoconnect/gee`) instead of top-level `ml/`, `graph/`, `gee/`. A top-level package literally named `graph` shadows common imports and cannot be `pip install -e .`'d cleanly. The internal structure is exactly the one requested.

---

## 4. Decisions requiring explanation

| Decision | Choice | Why |
|---|---|---|
| Database | **None.** File outputs (`outputs/<run_id>/*.json|geojson|csv|tif|png`) served by FastAPI. | A research prototype with ~4 study areas and tens of patches does not need PostGIS. The frontend already consumes JSON. Every result stays a versioned, diffable file with provenance. A DB can be added later without touching analysis code. |
| C(G) for research results | **IIC** (with PC and ECA reported alongside) | Exactly what §VI-A of the paper states. Composite Eq. (7) is implemented only as the *interface score* and labelled as such everywhere. |
| Distance d_ij | Centroid-to-centroid, **great-circle (haversine) in km** when working in geographic CRS; **Euclidean in metres** when the raster is in a projected CRS (UTM). | Matches the offline experiment (haversine on lat/lon) so paper tables reproduce; real rasters will typically be UTM so we support both and record which was used. |
| UNB7 feasibility on M3/16 GB | Implement UNB7 (EfficientNet-B7) as the **configured primary**; ship a **dev config with EfficientNet-B0** encoder for local smoke runs; full B7 training is designated for `CLOUD_TRAINING_MODE` (Colab/Kaggle GPU). | B7 has ~66 M params; a 512² batch on MPS with 16 GB is impractical for training. Architecture is unchanged — only the encoder depth differs in dev mode, and it is printed in every log and metrics file. |
| Threshold | `SEGMENTATION_THRESHOLD=0.5` default, configurable; **not** claimed as calibrated | Paper explicitly says 0.5 is uncalibrated. |
| Restoration costs | Cost is **optional**, loaded from a user-supplied CSV/YAML; default ranking is raw R_i | Paper Table VIII costs were "indicative planning values". No fabricated costs are shipped as data. |
| Weak labels | If no dense-mask dataset is supplied, weak labels come from an **existing published mangrove extent map** (Global Mangrove Watch), following the foundation study's methodology | This is literally the paper's stated training scheme (§IV-A: "weak supervision against an existing imperfect map"). |

---

## 5. BLOCKER — dataset not yet provided

`~/datasets/GEE/` is empty; no GeoTIFF/NPY/HDF5/zip dataset was found on this machine, and no Hugging Face cache exists. **Nothing in the ML stages can be inspected, trained or evaluated until a dataset exists.** Per instructions I do not assume its structure.

Two paths, both real, neither fabricated:

**Path A — you supply a dataset** (local path, Hugging Face repo id, Kaggle slug, or Google Drive link). I will inspect its format, samples, bands, masks, CRS and split before writing a single line of loader code that depends on it.

**Path B — build a weakly-labelled dataset for the four paper study areas** (fallback matching the paper's methodology):

| Item | Source | Auth | Size for 4 AOIs |
|---|---|---|---|
| Sentinel-2 L2A (B02,B03,B04,B08,B11,B12) | Element84 Earth Search STAC on AWS (public COGs) | none | ~30–60 MB per AOI at 10 m for a ~20×20 km window |
| Sentinel-1 RTC (VV, VH) | Microsoft Planetary Computer STAC | anonymous token, no account | ~20 MB per AOI |
| Weak labels: mangrove extent | Global Mangrove Watch v3 (2020), Zenodo, CC-BY-4.0 | none | ~5 MB per 1° tile |

Total well under 1 GB, fits the 8.9 GB free disk. It yields **real imagery of the real study areas**, so the "dataset training locations" and "demonstration locations" coincide — exactly the case the paper wants. Labels are weak (GMW is an imperfect map), which is the foundation study's own regime; the docs will say so.

**Local compute reality:** Apple M3, 16 GB, MPS (no CUDA), 8.9 GB free. → `LOCAL_DEVELOPMENT_MODE` uses ≤ 500 tiles at 256² with the B0 encoder; `CLOUD_TRAINING_MODE` (Colab/Kaggle) runs B7 at 512².

---

## 6. Smallest real subset for the first end-to-end experiment

* 1 study area (Vembanad–Kol or Bhitarkanika — highest mangrove density among the four).
* 1 Sentinel-2 L2A scene (+ 1 Sentinel-1 RTC scene if Path B), ~20 × 20 km AOI → 2000 × 2000 px at 10 m.
* Tiled to 256 × 256 with 50 % overlap → ~200–250 tiles; split 70/15/15 by **spatial block**, not random pixel shuffle, to avoid leakage.
* UNB0 (dev encoder), 10–20 epochs on MPS ≈ minutes.
* Success criterion for this stage is *pipeline validity*, not accuracy: loss decreases, masks align with imagery, patches extract, graph builds, criticality runs, frontend displays. Its metrics will be labelled **DEVELOPMENT-SUBSET RESULT — NOT FINAL**.

---

## 7. Execution plan (order of work)

| Step | Scope | Depends on dataset? | Status |
|---|---|---|---|
| 1 | Repo layout, venv, requirements, `.gitignore`, copy prototype → `frontend/` | no | **DONE** |
| 2 | `ecoconnect/graph/`: construction, connectivity (IIC/PC/ECA/composite), criticality, what-if, explain, restoration — ported from the offline experiment, parameterised | no | next |
| 3 | `tests/`: tiny hand-computed graphs + regression against `results_synthetic_prototype.json` | no | next |
| 4 | `ecoconnect/geospatial/patch_extraction/`: connected components → patches with true geodesic area, centroid, polygon, confidence, MMU | no (unit-tested on synthetic rasters; run on real predictions later) | next |
| 5 | `ecoconnect/pipeline/`: run orchestration + export (JSON/GeoJSON/CSV/PNG) with provenance | no | next |
| 6 | `backend/`: FastAPI over `outputs/` incl. exact `POST /what-if` | no | next |
| 7 | `frontend/lib/api.ts` + `data.ts` switch: real outputs when available, mock labelled otherwise; exact what-if in simulation page | no | next |
| 8 | `ecoconnect/ml/`: dataset, preprocessing, UNB7 model, train/validate/evaluate/predict scripts, configs | **loader + preprocessing are written generically; running them needs the dataset** | after §5 answer |
| 9 | `ecoconnect/gee/`: STAC acquisition (no-auth) + GEE module (optional) | no for code; yes for execution | after §5 answer |
| 10 | First real experiment (dev subset), then scale-up config for cloud | yes | blocked |
| 11 | Docs: README, DATASET_SETUP, TRAINING, INFERENCE, GEE_SETUP, ARCHITECTURE, EXPERIMENTS, TROUBLESHOOTING, TRACEABILITY, RESULTS_PROVENANCE | partly | continuous |

---

## 8. Result-labelling rules applied throughout this repository

* `PUBLISHED BASELINE — NOT OUR RESULT` → Ghorbanian et al. 2025 UNB7 numbers (OA 95.56 %, κ 0.94, F1 0.95).
* `PROTOTYPE / SYNTHETIC RESULT` → anything computed over `frontend/mock-data/` geometry (this includes the paper's Tables VI–VIII).
* `DEVELOPMENT-SUBSET RESULT — NOT FINAL` → runs in `LOCAL_DEVELOPMENT_MODE`.
* `OUR EXPERIMENTAL RESULT` → runs in `FULL_EXPERIMENT_MODE` with recorded provenance.
* `NOT YET RUN` / `REQUIRES VERIFICATION` → used verbatim wherever applicable.

EcoConnectAI segmentation accuracy as of this document: **NOT AVAILABLE — NOT YET RUN.**
