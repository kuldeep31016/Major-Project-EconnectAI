# EcoConnectAI — MESA preparation guide (repository audit)

> **Update (25 Sept 2026, after the videos were recorded): the UI issues flagged below are now fixed in the code.**
> The landing page uses real run values (study-area cards load live from the API; P17/C1 examples; no Landsat).
> The dashboard change chart and KPI deltas only compare runs of the same model and threshold (backend
> `/timeline?run_id=` and the alert rules). The graph page lists only true cut vertices (P07, P17). The model
> badge reads "Development model — not final". The synthetic importance timeline is removed. The Scenario Lab
> no longer invents numbers when the backend is offline. The two videos were recorded **before** these
> fixes, so they still show the old badge, landing figures and deltas; their narration already treats them as caveats.


Audited 25 Sept 2026 against commit `6444dcb` (clean working tree). Sources: the code, `configs/`, `outputs/`, `data/`,
`logs/`, the SQLite DB schema, the running app (backend :8000, frontend :3000) and `docs/paper_source_main.tex`.
Every number below was read from a file; the file is named next to it.

Companion files in this folder:
* `EcoConnectAI_Technical_Walkthrough.mp4` — 19 min narrated walkthrough (1080p), `…srt` captions
* `VIDEO_TRANSCRIPT.md` — full transcript with timestamps
* `PANEL_QUESTIONS.md` — A–Z question bank, 45 difficult questions, 20 "if they ask X → say Y"
* `CHEAT_SHEET.md` — one-page memorisation sheet

---

## 0. Read this first — six things that will hurt you tomorrow if you don't know them

1. **The model behind every screen is EfficientNet-B0, not UNB7.** UNB7 (B7) is configured (`configs/train_full.yaml`,
   `notebooks/colab_train_unb7.ipynb`) but **never trained**.
2. **Your best number (test IoU 0.842, F1 0.914) is from `multi_E1_s1_b0_dev`, and it is Sundarbans-driven.** Per test
   tile, Kerala has correct mangrove in 1 of 43 tiles. The README and `docs/RESULTS_PROVENANCE.md` don't mention this
   model at all — they still describe only the Kerala runs.
3. **The landing page (`/`) shows hard-coded synthetic numbers**: P16 "263 ha / 3.8 % / −40.8 %", "95.6 % Confidence",
   Kerala "18 patches, ECA 59.6 %", restoration "C1 +2.73 %", "Sentinel-1, S-2, Landsat-9", and a "Live" badge on an
   illustration. None of it is API data (`frontend/components/landing/*`). Don't demo from the landing page, or say
   up front that it's illustrative.
4. **The dashboard's "Change Over Time" chart and KPI deltas (+100 % patches, +7.3 % area) compare two different
   models at two thresholds.** The 2020 point is `kerala-coast_multi_E1_s1_b0_dev_t0.70`; the 2025 point is
   `kerala-coast_20260920T182222Z` (`kerala-coast_development`, t = 0.5). The timeline endpoint picks the latest run per
   year, whatever model produced it. For a like-for-like comparison use Scenario G with `kerala_E1_s1_b0_dev_t0.70`
   and `kerala_E1_s1_b0_dev_2025_t0.70`.
5. **Graph page "3 critical bridges" is wrong for P01.** The box lists every patch with S ≥ 0.25 and says it has "no
   redundant route". P01 is not a cut vertex; only P07 and P17 are (`frontend/app/graph/page.tsx:64`).
6. **Other hard-coded UI items**:
   * The "Validated Model" badge appears on every model on `/experiments`.
   * The "Importance timeline" in the patch inspector is synthetic (`components/maps/pixel-inspector.tsx:50-58`).
   * If the backend is offline, `/scenario` falls back to invented constants (`app/scenario/page.tsx` ~L105-185).
     Keep the backend running during the demo.

I didn't change any code. If you want, I can fix items 3–6 tonight; they're small frontend changes.

---

## 1. Complete project audit — what exists

| Area | Status | Evidence |
|---|---|---|
| Satellite acquisition (S1 RTC, S2 L2A, GMW labels) | **Implemented and executed** for 4 areas (2020) + Kerala 2025 S1 | `ecoconnect/gee/stac_acquire.py`, `gmw_labels.py`, `data/scenes/*/*.json`, `logs/acquire_*.log` |
| Tiling, dataset, spatial split | Implemented and executed | `scripts/build_tiles.py`, `ecoconnect/geospatial/preprocessing/tiling.py`, `logs/phase2_all_areas.log` |
| U-Net/EfficientNet model, training, evaluation, inference, threshold sweep | Implemented; **B0 executed 5×; B7 (UNB7) not run** | `ecoconnect/ml/`, `outputs/segmentation/*`, `experiments.csv` |
| Patch extraction | Implemented, tested, executed | `ecoconnect/geospatial/patch_extraction/extract.py` |
| Graph, IIC/PC/ECA, criticality, what-if, explanations, restoration | Implemented, tested (reproduce paper's synthetic tables to 5e-16), executed on real predictions | `ecoconnect/graph/*`, `outputs/runs/*/*` |
| Scenario Lab A–G, feasibility rules | Implemented | `backend/scenarios.py` |
| Backend (FastAPI) + DB (SQLite, 15 tables) + JWT/RBAC | Implemented | `backend/*.py`, `outputs/ecoconnect.db` |
| Frontend (17 routes) | Implemented, API-backed (with the hard-coded exceptions in §0) | `frontend/app/*` |
| Tests | 44 pass (`.venv/bin/python -m pytest -q`, 17 s) | `tests/` |
| Deployment config | Render (API Docker, **no torch → cannot run inference**) + Vercel (frontend). A live deployment wasn't verified | `render.yaml`, `Dockerfile`, `requirements-api.txt` |
| Field validation, real costs, species-calibrated τ, UNB7, real-time monitoring | **Not implemented / not done** | — |

Entry points:
* Backend: `backend/main.py` (`uvicorn backend.main:app --port 8000`).
* Frontend: `frontend/app/layout.tsx` and `page.tsx` (`npm run dev`, port 3000).
* One-command start: `start.sh`.
* Pipeline: `scripts/run_pipeline.py`, `run_graph_analysis.py`, `run_all_areas.py`.

## 2. Current system architecture

```
Sentinel-1 RTC (Planetary Computer) ─┐                    Sentinel-2 L2A (Earth Search) — ancillary
                                     ├─ acquisition: temporal median, dB, UTM 10 m      [gee/stac_acquire.py]
GMW v3 2020 (Zenodo 6894273) ────────┘   labels aligned to scene                        [gee/gmw_labels.py]
        ↓ tiles 256², stride 128, spatial-block split                    [scripts/build_tiles.py, ml/datasets/tiles.py]
        ↓ U-Net + EfficientNet-B0 (B7 = UNB7 configured, not trained)    [ml/models/unet.py, ml/training/trainer.py]
        ↓ sliding-window inference (256 px, overlap 64, Hann blend) → P(mangrove) raster  [ml/inference/predict.py]
        ↓ threshold (calibrated 0.70 for 4-area model) → 8-connected components → MMU 2 ha  [patch_extraction/extract.py]
        ↓ graph: k = 3 nearest, d ≤ τ = 5 km, w = √(qᵢqⱼ)·e^(−d/τ)       [graph/construction.py]
        ↓ C(G) = IIC (PC, ECA reported)                                  [graph/connectivity.py]
        ↓ exact leave-one-out ΔCᵢ, Sᵢ; τ ∈ {3,5,8} sensitivity            [graph/criticality.py]
        ↓ what-if (remove / polygon / restore / τ / threshold / periods) [graph/what_if.py, backend/scenarios.py]
        ↓ rule-based explanation text + evidence                         [graph/explain.py]
        ↓ restoration: Rᵢ = C(G+vᵢ) − C(G), R/cost only with uploaded costs [graph/restoration.py]
        ↓ run artefacts outputs/runs/<area>/<run>/ + SQLite registry/workflow  [pipeline/analysis.py, backend/]
        ↓ Next.js UI: dashboard, map, graph, scenario lab, restoration, alerts, field, reports  [frontend/app/]
        ↓ officers decide; field verification workflow (demo users only)
```

## 3. Data sources — actual

| Source | Purpose | Format | Resolution | Used for |
|---|---|---|---|---|
| Sentinel-1 RTC γ⁰ (from IW GRDH 1SDV scenes), Microsoft Planetary Computer, anonymous SAS | **Model input** | bands `s1_vv_db`, `s1_vh_db` in scene GeoTIFF | 10 m UTM | E1 (reported) model, S1 basemap |
| Sentinel-2 L2A, Element84 Earth Search (AWS COGs) | Ancillary / ablation | B02 B03 B04 B08 B11 B12 + NDVI + NDWI | 10 m (SWIR resampled) | E2/E3 ablations, RGB/NDVI basemaps, NDWI feasibility rule |
| Global Mangrove Watch v3.0, 2020 (Zenodo 6894273, CC-BY-4.0) | **Weak labels** | binary GeoTIFF aligned to scene | 10 m grid | training + agreement metrics |
| `configs/study_areas.yaml` | AOI metadata | YAML | — | acquisition extents, UI |
| Run outputs | analysis | GeoJSON / JSON / CSV | WGS84 | UI, reports, scenarios |

**Not used:** no Kaggle dataset, no Landsat, no field survey, no Google Earth Engine run. `gee_acquire.py` exists as an
optional path and wasn't used.

GMW reference per area. I computed these from `data/labels/*/gmw_2020.tif`:

| Area | GMW 2020 mangrove | % of AOI |
|---|---|---|
| Kerala | 102.1 ha | 0.21 % |
| Sundarbans | 58,903 ha | 55.9 % |
| Gulf of Mannar | 44.0 ha | 0.03 % |
| Odisha | 10,793 ha | 16.2 % |

## 4. Satellite sources — actual configuration

**Sentinel-1** (`configs/acquisition.yaml`, `stac_acquire.py: sentinel1_composite`)
* Collection `sentinel-1-rtc`. Radiometric terrain correction is done by the provider.
* VV and VH are converted with `10·log10` to dB. There's no VV/VH ratio band.
* Speckle: no spatial filter. The per-pixel temporal median over the year's scenes reduces it.
* Scenes (2020):
  * Kerala: 6 descending (2020-01-01 … 2020-10-21).
  * Sundarbans: 4, ascending and descending mixed.
  * Gulf of Mannar: 4 descending.
  * Odisha: 4 ascending.
  * Kerala 2025: 6 (2025-01-04 … 2025-10-31).
* Grid: reprojected to local UTM (EPSG 32643/32644/32645), 10 m, snapped.
* Normalisation: 1–99 % percentile clip, then z-score. Statistics come from training tiles only.
  * 4-area model: VV mean −11.33 dB, VH mean −17.60 dB (`experiment.json`).

**Sentinel-2** (`stac_acquire.py: sentinel2_composite`)
* Scene filter: cloud ≤ 40 %. Pixels are then masked with the SCL classes nodata, saturated, dark, shadow,
  cloud medium/high, cirrus and snow.
* Composite: median of the least-cloudy scenes per MGRS granule, with an AOI-overlap filter.
* NDVI and NDWI are computed from the composite.
* Granules: Kerala 43PFL/43PFM, Sundarbans 45QXE, Gulf 44PKR/44PLR, Odisha 45QVC/45QVD.

**Which model uses which sensor — proof**
* `configs/dataset.yaml` sets `bands: [0, 1]`, which is E1, S1 only.
* `outputs/segmentation/multi_E1_s1_b0_dev/experiment.json` records `"in_channels": 2, "bands": [0, 1]`.
* So the reported model is **Sentinel-1 only**. E2 is S2 only, and E3 is S1+S2 early fusion. Both are Kerala
  ablations.

## 5. Model details

* `smp.Unet(encoder_name="efficientnet-b0", encoder_weights="imagenet", in_channels=2, classes=1,
  decoder_channels=(256,128,64,32,16))` in `ecoconnect/ml/models/unet.py`.
* **6,251,181 parameters.**
* Transfer learning: the encoder is ImageNet-pretrained, and smp adapts the first conv to 2 channels. The whole
  network is fine-tuned; nothing is frozen.
* Output: 1 logit per pixel, sigmoid gives P(mangrove), and a threshold gives the binary mask. The task is binary
  (the paper's Eq. 1 is 3-class).
* **UNB7** is the alias `unb7` → `efficientnet-b7`, used by `configs/train_full*.yaml`. Every checkpoint stores
  `eco_meta.paper_name`, and all trained ones read `"U-Net/efficientnet-b0 (dev or alt config)"`.
* Alternative: Swin-T U-Net alias exists; it was never trained.
* Inference (`ml/inference/predict.py`): 256-px sliding window with 64-px overlap and Hann-window blending.
  Optional flip TTA exists but was off (`test_tta: false`). The code checks band count against the checkpoint.

## 6. Training details (actual)

| | `multi_E1_s1_b0_dev` (main) | Kerala E1/E2/E3 dev |
|---|---|---|
| Data | 4 areas, dev cap: 800 train / 195 val / 200 test tiles (full split 954/195/224) | Kerala 176/32/48 |
| Optimiser | AdamW lr 3e-4, wd 1e-4 | same |
| Scheduler | cosine, T_max 40, eta_min 1 % lr | same |
| Loss | BCE (pos_weight 25) + Dice, ignore 255 | same |
| Batch / epochs | 8 / 40 run (best 32), early stop patience 12 not triggered | E1 33 run (best 21), E2 16 (4), E3 27 (15) |
| Augmentation | hflip, vflip, rot90, p = 0.5 (train only) | same |
| Other | grad clip 1.0, seed 42, AMP off (CUDA only) | same |
| Hardware | Apple M3 16 GB, MPS, torch 2.13, Python 3.14 | same |
| Time | 1,777 s (~30 min) | 283 / 172 / 301 s |

A sixth run, `kerala-coast_development` (S1, Kerala 176 tiles, 2026-09-20, 340 s), produced the checkpoint used by
the current Kerala LATEST run.

Why pos_weight 25: it was chosen for Kerala's ~0.2 % positive pixels (`configs/train_dev.yaml` comment). On the
Sundarbans-heavy 4-area mix it pushes the model toward over-prediction: validation recall 0.970, precision 0.781.

**Reproducibility caveat:** `data/ecoconnect_tiles` was rebuilt Kerala-only on 2026-09-20 (now 176/32/48). To re-evaluate
`multi_E1_s1_b0_dev` you must rebuild the 4-area tiles (`scripts/phase2_all_areas.sh`, or `run_all_areas.py --stage tiles`).

## 7. Evaluation results (actual) — all "agreement with GMW", not field accuracy

| Model | Test tiles | IoU | Dice/F1 | P | R | OA | κ | Label |
|---|---|---|---|---|---|---|---|---|
| multi_E1_s1_b0_dev (S1) | 200 | **0.842** | **0.914** | 0.878 | 0.954 | 0.966 | 0.894 | DEVELOPMENT — NOT FINAL |
| kerala_E1_s1_b0_dev (S1) | 48 | 0.023 | 0.045 | 0.033 | 0.072 | 0.998 | 0.044 | DEV |
| kerala_E2_s2_b0_dev (S2) | 48 | 0.054 | 0.102 | 0.063 | 0.279 | 0.997 | 0.101 | DEV |
| kerala_E3_s1s2_b0_dev (S1+S2) | 48 | 0.053 | 0.101 | 0.066 | 0.209 | 0.998 | 0.100 | DEV |
| kerala-coast_development (S1) | 48 | 0.031 | 0.061 | 0.056 | 0.066 | 0.999 | 0.060 | DEV |
| UNB7, Ghorbanian et al. 2025 | their data | OA 95.56 %, κ 0.94, F1 0.95, mean PA 95.37 %, mean UA 95.90 % | | | | | | PUBLISHED — NOT OURS |
| UNB7 (ours) | — | — | | | | | | NOT YET RUN |

Notes on how to read the table:
* Metrics are for the habitat class at threshold 0.5.
* Test confusion matrix (4-area model): TN 10,312,199 · FP 325,844 · FN 114,660 · TP 2,352,369. That means ~2.8× more
  false positives than misses.

**Per-area breakdown of the 0.842.** I computed this from `test_results.csv`:

| Area | Test tiles | Tiles with any TP | Mean per-tile IoU |
|---|---|---|---|
| Sundarbans | 86 | 76 | 0.591 |
| Odisha | 43 | 3 | 0.026 |
| Gulf of Mannar | 28 | 9 | 0.022 |
| Kerala | 43 | 1 | 0.001 |

The pooled pixel IoU mostly measures Sundarbans.

**Threshold calibration** (4-area model, 224 test tiles pooled, `threshold_calibration.csv`):

| t | 0.30 | 0.40 | 0.50 | 0.60 | 0.70 |
|---|---|---|---|---|---|
| F1 | 0.912 | 0.919 | 0.924 | 0.929 | **0.933** |
| IoU | 0.838 | 0.850 | 0.859 | 0.867 | 0.875 |

* Selected t = 0.70. It sits at the upper edge of the sweep, so higher values weren't tested.
* Kerala E1 → 0.70, Kerala E2 → 0.45.

## 8. Patch / graph / criticality implementation (actual)

**Patches** (`extract.py`)
* Pipeline: threshold → `scipy.ndimage.label` (8-connectivity) → drop components < 2 ha (counted).
* Stored per patch: `id` (P01… by area), `area_ha` (true pixel areas), `centroid` (WGS84), `confidence` = `quality`
  (mean probability), `habitat_class`, `geometry`, `bbox`, `perimeter_km`, pixel count.
* Added by the analysis: degree, neighbours, cut-vertex flag, ΔC, S, ranks.

**Graph** (`construction.py`, pure Python — no NetworkX)
* Undirected union of each patch's k = 3 nearest (haversine centroid distance) with d ≤ τ = 5 km.
* Edge weight: w = √(qᵢqⱼ)·e^(−d/τ).
* Helpers: `is_cut_vertex`, `is_bridge_edge`, `without()`, `with_patch()`.

**Connectivity metrics** (`connectivity.py`)
* IIC = ΣΣ aᵢaⱼ/(1+nlᵢⱼ) / A_L², using BFS link counts. **IIC ignores edge weights.**
* PC uses pᵢⱼ = e^(−αd) with α = ln2/τ, over the full distance matrix with a max-product closure.
* ECA = √PC · A_L.
* The Eq. 7 interface score is labelled "design choice". It is non-monotone: removing Odisha P01 raises it from 56.1
  to 62.9.

**Criticality** (`criticality.py`)
* For every node: C(G) → G−vᵢ → C(G−vᵢ) → ΔCᵢ → Sᵢ = ΔCᵢ/C(G). It is exact.
* Bands: critical ≥ 0.25, high ≥ 0.10, medium ≥ 0.03.
* Spearman ρ(area, S) is reported per run.

**Runs on disk** (all DEVELOPMENT — NOT FINAL; k = 3, τ = 5 km, IIC):

| Run | Model / thr / year | Patches | Links | Comp. | Habitat ha | ECA % hab. |
|---|---|---|---|---|---|---|
| kerala-coast_20260920T182222Z (**LATEST**, on screen) | kerala-coast_development / 0.5 / 2025 | 24 | 43 | 2 | 219.6 | 75.1 |
| kerala-coast_multi_E1_s1_b0_dev_t0.70 | 4-area / 0.70 / 2020 | 12 | 18 | 3 | 204.6 | 80.7 |
| kerala_E1_s1_b0_dev_t0.70 | Kerala E1 / 0.70 / 2020 | 24 | 45 | 2 | 381.9 | 75.5 |
| kerala_E1_s1_b0_dev_2025_t0.70 | Kerala E1 / 0.70 / 2025 | 25 | 48 | 2 | 319.1 | 74.5 |
| kerala_E2_s2_b0_dev_t0.45 | Kerala E2 / 0.45 / 2020 | 31 | 60 | 2 | 365.1 | 70.3 |
| sundarbans_multi_…_t0.70 (LATEST) | 4-area / 0.70 / 2020 | 54 | 73 | 13 | 63,829.7 | 48.8 |
| gulf-of-mannar_multi_…_t0.70 (LATEST) | 4-area / 0.70 / 2020 | 16 | 17 | 6 | 117.6 | 54.4 |
| odisha-coast_multi_…_t0.70 (LATEST) | 4-area / 0.70 / 2020 | 21 | 28 | 4 | 14,943.8 | 70.7 |
| *_kerala_E1_…_ui_* (3 older transfer runs) | Kerala E1, no retraining | Sund. 23 / Gulf 36 / Odisha 2 | | | 80.9 / 159.8 / 4.8 | history only |

**Worked example.** Kerala LATEST run, `criticality.csv`:

| Patch | Area | Area rank | Degree | Conf. | Cut vertex | C(G) | C(G−v) | ΔC | S | Rank |
|---|---|---|---|---|---|---|---|---|---|---|
| P01 | 35.1 ha (16.0 %) | 1 | 5 | 0.88 | no (2→2) | 6.524e-6 | 4.521e-6 | 2.003e-6 | 0.307 | 1 |
| P07 | 8.79 ha (4.0 %) | 7 | 3 | 0.85 | yes (2→3) | | 4.584e-6 | 1.940e-6 | 0.297 | 2 |
| **P17** | **3.13 ha (1.4 %)** | **17/24** | 4 | 0.84 | **yes (2→3)** | | 4.765e-6 | 1.759e-6 | **0.270** | **3** |

P17's neighbours are P14 (0.59 km), P04 (0.85 km), P15 (1.24 km) and P07 (2.80 km).

The other real "small but critical" examples:
* Kerala E1 2020: P21, 2.61 ha, area rank 21/24, degree 7, cut vertex, criticality #4, S 0.204.
* Odisha 4-area: P09, 55.6 ha (0.4 % of habitat), area rank 9, cut vertex, criticality #3 (S 0.071). P04 (910 ha,
  area rank 4) is only #6.

**P16 exists only in the paper's synthetic Table VII.** It isn't in any current run.

**τ sensitivity** for the Kerala LATEST run (`tau_sensitivity.json`):

| τ | Links | Components | ρ vs 5 km |
|---|---|---|---|
| 3 km | 41 | 2 | 0.963 |
| 5 km | 43 | 2 | 1.00 |
| 8 km | 47 | 1 | 0.974 |

* The top 3 (P01, P07, P17) are stable across all three τ.
* Odisha 4-area is much less stable: ρ = 0.688 at 3 km (12 components) and 0.764 at 8 km.

## 9. Restoration implementation (actual)

* **Candidates** (`pipeline/analysis.py`, `configs/graph.yaml`): connected components with
  0.30 ≤ p < threshold, at least 1 ha, top 12 by area.
  * They're model output: "marginal habitat", not surveyed sites.
  * The Kerala LATEST run has only 4 (C1–C4, 1.02–1.61 ha).
* **Gain**: Rᵢ = C(G + vᵢ) − C(G). The candidate links to its k = 3 nearest patches within τ, and existing edges are
  not rewired.
  * Kerala: C1 +1.29 % IIC (3 links to P01, P06, P13), C2 +1.04 %, C3 +0.83 %, C4 +0.80 %.
* **Costs**: none shipped.
  * `ranking_basis = raw_gain`.
  * Priority = gain_pct / cost only when *every* candidate has a user-supplied cost. You can upload a CSV
    (`candidate_id,cost`) in the Restoration Planner, which sends it as JSON to POST `/restoration`.
  * The paper's Table VIII INR costs were indicative values on synthetic data.
* **Feasibility** (`backend/scenarios.py`): rules over the available layers only.
  * For: nearest habitat ≤ 2 km.
  * Against: NDWI > 0.3 (open water), > 50 % overlap with an existing patch, no new links.
  * Always "not assessed": legal status, ownership, settlements/infrastructure, cost.
  * "Recommended" is a rule output, not a field verdict.

## 10. Database / backend status (actual)

* FastAPI 0.141 with Uvicorn. About 52 route handlers across `backend/main.py` and `routers.py`.
* **SQLite** via SQLAlchemy 2 (`outputs/ecoconnect.db`; override with `ECO_DATABASE_URL`, e.g. Postgres). WAL mode,
  `create_all`, no migrations.
* **15 tables**:
  * `organizations`, `users`
  * `study_areas`, `scenes`, `label_sources`, `models`
  * `analysis_versions` (one row per run)
  * `detections` (AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED → FIELD_VERIFIED/REJECTED → CONFIRMED;
    CONFIRMED/FIELD_VERIFIED need ACCEPTED evidence)
  * `alerts`, `projects`, `field_tasks`, `evidence`
  * `scenarios` (always SIMULATED)
  * `reports`
  * `audit_log` (append-only)
  * Relationships are FK columns only.
* Rasters, checkpoints and run artefacts stay on disk. The DB holds paths, manifests and workflow state.
  `registry.sync_all()` mirrors the disk into the DB at startup.
* **Auth**: JWT HS256 (12 h), bcrypt. Six roles: state_admin, senior_officer, range_officer, field_officer, gis_officer,
  analyst. Capabilities are checked per action. Demo users are seeded; the password is `ECO_DEMO_PASSWORD`, default
  `demo1234`.
* **Honest gaps**:
  * Most read/analysis endpoints (what-if, scenario, restoration, reanalyse, assistant) need no login. Only
    `/api/segment`, `/api/registry/sync` and the workflow writes do.
  * No rate limiting, no token revocation.
  * `backend/main.py:3`'s docstring still says "No database".
* **Assistant** (`backend/insight.py`): regex intent (8 intents) plus templates over stored files and DB rows. **Not an
  LLM**, and it uses no API keys.
* **Reports**: JSON only (`pipeline/report.py`, plus the `insight.official_report` project and field sections). The
  backend generates no PDF.

## 11. Frontend architecture (actual)

* **Stack**: Next.js 16.3 (App Router, `next dev --webpack`), React 19.2, TypeScript, Tailwind 4, shadcn/base-ui.
  * Maps: Leaflet 1.9 + react-leaflet 5.
  * Graph: React Flow 11 (`reactflow`).
  * Charts: Recharts 3.
  * Motion: framer-motion.
* **State**: React Context (`hooks/use-analysis.tsx`, `hooks/use-auth.tsx`).
* **API client**: `lib/api.ts`. `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`, and the token lives in
  localStorage under `ecoconnect:token`.
* **Routes**:
  * `/` landing (hard-coded), `/login`
  * `/command` dashboard, `/analysis` interactive map + evidence drawer, `/graph`
  * `/simulation` (what-if / restore / timeline), `/scenario` (A–G), `/restoration`
  * `/experiments` (Data & Models), `/reports`, `/history`
  * `/alerts`, `/field`, `/projects`, `/audit`
  * `/upload` (New Analysis), `/settings` (local preferences only)
  * `/dashboard` redirects to `/command`.
* **Nav**: role filtering hides nav items, but there's no route guard.
* **Provenance badges**: "Real pipeline · dev subset · not final", "Exact computation · synthetic geometry", and
  so on.

## 12. Paper vs implementation — gap analysis

### A. Implemented and matches paper
* Eq. 2 patch tuple and MMU 2 ha. Eqs. 3–6: graph, k = 3, τ = 5 km, exponential weight.
* IIC as C(G), with PC (p = 0.5 at τ) and ECA reported. Eq. 7 kept as the interface score only.
* Eqs. 8–9 exact leave-one-out. Eq. 10 what-if. Eqs. 11–12 restoration gain and gain/cost.
* Rule-based explainability, as in §IV-E ("no post-hoc attribution").
* τ ∈ {3, 5, 8} sensitivity. Spearman area vs S baseline.
* The synthetic Tables VI–VIII are reproduced bit-for-bit (max |Δ| 5e-16; `docs/legacy_experiment/`).
* S1 is the primary segmentation input and S2 is complementary, not fused, in the reported model.

### B. Implemented but the paper is outdated (correct these)
| Paper says | Current implementation |
|---|---|
| "no segmentation model has been trained", "no inference run" (Abstract, Table II, §VI-B) | 6 EfficientNet-B0 runs trained and evaluated. Inference runs on 4 landscapes + Kerala 2025 |
| "There is no backend, database or ML runtime" (§V-A) | FastAPI + SQLite (15 tables) + JWT/RBAC + PyTorch inference via `/api/segment` |
| Datasets are synthetic; only Table III metadata is real | Real S1/S2 composites, GMW labels, real runs for all 4 areas |
| Offline analysis in "Python 3 standard library only" | Graph maths still pure Python; the pipeline uses rasterio, torch, scipy, shapely… |
| UI what-if is "heuristic"; exact only offline | Exact server-side recomputation (`/what-if`, `/scenario`) |
| Threshold "fixed at 0.5" (uncalibrated) | Calibrated sweep 0.30–0.70 → 0.70 (4-area), 0.45 (E2) |
| Labels: FSI atlas, wetland inventory, Ramsar; ≈14,000 tiles 512² | GMW v3.0 2020; 1,373 tiles 256² (800/195/200 used) |
| Table III sensors: S2 L2A (3 areas), Landsat-9 OLI-2 30 m (Gulf of Mannar) | S1 RTC + S2 L2A at 10 m for all four; no Landsat |
| Eq. 1: 3 classes (mangrove, non-mangrove water, non-habitat) | Binary mangrove / non-mangrove |
| Table II: patches 16–20, edges 30–39 (prepared) | Real runs: 12–54 patches, 17–73 links |
| d_ij "centroids or nearest boundaries" | Centroid haversine only |
| §V-C unknowns (window, scenes, split, hardware) | Now known: 2020, S1 ×4–6, spatial-block split seed 42, Apple M3 MPS |
| Candidate generation not described | Sub-threshold probability components (0.3 ≤ p < t, ≥ 1 ha) |
| Platform features absent | RBAC, alerts, field verification, projects, audit, reports, assistant — beyond the paper's scope |

### C. In the paper but not implemented
* UNB7 (EfficientNet-B7) training, and any accuracy of ours comparable to 95.56 %.
* Test-time augmentation in the reported evaluation (the code exists; it was off).
* Field validation. Species-named/calibrated τ. Habitat-condition term in qᵢ (quality = confidence only).
* Real restoration costs. Multi-objective budget optimisation.
* S1/S2 fusion as a final model (only ablation E3).
* Near-real-time change detection. Temporal GNNs. Uncertainty modelling. Fuller XAI evaluation. GIS-platform
  integration.
* The "100 m analysis grid" sensitivity surface: the current UI heatmap uses 300 m cells (`graph.yaml export`).

### Paper correction checklist
- [ ] Abstract and §VI-B: replace "no segmentation model has been trained". Report the dev B0 results with their label
      and the Sundarbans caveat. Keep 95.56 % explicitly as the foundation study's.
- [ ] Table II: rewrite every status row (segmentation, probability map, patches, graph, what-if now exact).
- [ ] §V-A: remove "no backend, database or ML runtime"; describe FastAPI + SQLite + inference.
- [ ] §V-A: "Python standard library only" applies to the graph module only.
- [ ] Table III: sensors → S1 RTC (primary) + S2 L2A (ancillary) at 10 m for all 4; delete Landsat-9.
- [ ] Table IV: labels → GMW v3.0 2020 (weak); 1,373 tiles of 256², spatial-block split; B0 dev encoder; threshold
      calibrated.
- [ ] Eq. 1: binary, not 3-class (or state 3-class as future work).
- [ ] §IV-A: add S1 processing details (RTC γ⁰, dB, temporal median, no ratio band, UTM 10 m).
- [ ] §IV-B: state centroid (haversine) distance; state IIC ignores edge weights.
- [ ] §IV-F: describe candidate generation and that costs are user-supplied only.
- [ ] §VI: add real-data results with labels: Table VI analogue for 4 areas (4-area model), Kerala criticality example
      (P17 / P07), τ-sensitivity on real geometry (Kerala ρ 0.96/0.97; Odisha 0.69/0.76).
- [ ] §VI: keep the synthetic Tables VI–VIII, clearly labelled synthetic, or move them to an appendix. Don't let P16
      read as a real patch.
- [ ] Add a segmentation table: E1/E2/E3 Kerala ablations + 4-area model + per-area caveat.
- [ ] §VII: limitations — over-prediction, pos_weight choice, threshold at sweep edge, change detection = model
      difference.
- [ ] Also update the repo's README status table and `docs/RESULTS_PROVENANCE.md`/`EXPERIMENTS.md`: both omit
      `multi_E1_s1_b0_dev` and the four `*_multi_*` runs, and still say the other areas are "NOT YET RUN".

## 13. Study areas (actual)

| Area | Designation (config) | AOI | 2020 data | GMW | Model run (4-area, t 0.70) | Notes |
|---|---|---|---|---|---|---|
| Vembanad–Kol, Kerala | Ramsar Site | 486 km² config / 489 km² valid | S1 ×6 desc, S2 43PFL/43PFM; 2025 S1 ×6 | 102 ha | 12 patches, 205 ha | Thin fringes (1–3 px); hardest; most complete (E1–E3, sweep, 2025) |
| Sundarbans W. delta, WB | UNESCO WH / Tiger Reserve | 1,284 km² config | S1 ×4 mixed, S2 45QXE | 58,903 ha | 54 patches, 63,830 ha, 13 comp. | Dominates training and test |
| Gulf of Mannar, TN | Marine NP / Biosphere Reserve | 826 km² config | S1 ×4 desc, S2 44PKR/44PLR | 44 ha | 16 patches, 118 ha | 625 empty tiles dropped; very sparse; unreliable |
| Bhitarkanika, Odisha | Ramsar / NP | 672 km² config | S1 ×4 asc, S2 45QVC/45QVD | 10,793 ha | 21 patches, 14,944 ha | τ-sensitive ranking |

Don't cite ecological statistics beyond these files.

## 14. Change detection (actual)

* **Implemented**:
  * A second S1 composite for Kerala 2025.
  * The timeline endpoint: a binary-mask difference between consecutive-year runs at each run's own threshold.
  * Scenario G: patches matched by centroid within 300 m, labelled "OBSERVED (MODEL OUTPUT)".
  * Alerts for habitat change ≥ 5 % and IIC change ≥ 10 %.
* **Valid pair** (Kerala E1 dev, t 0.70):
  * Habitat 381.9 → 319.1 ha (−16.4 %).
  * IIC 1.586e-5 → 1.051e-5 (−33.8 %).
  * 9 patches without a counterpart, 10 new.
  * That model's Kerala test IoU is **0.023**, so this is a model-output difference, not measured mangrove loss.
* **Invalid**: the dashboard chart pairs different models (see §0.4).

## 15. Things you must NOT claim

* Not "95.56 % accuracy" as ours. Not "we trained UNB7 / EfficientNet-B7".
* Not "ground truth" labels. Not "validated model".
* Not P16 as a real patch. Not the landing-page numbers as results.
* Not Sentinel-2 or fusion as the model input. Not Landsat, not Kaggle, not Google Earth Engine.
* Not "Kerala mangroves declined 16 %". Not any restoration cost in INR.
* Not field validation, deployment with a forest department, real-time or near-real-time monitoring, or a live
  public deployment (none was verified).
* Not SHAP/LIME/Grad-CAM. Not that the assistant is an LLM or "AI-generated".
* Not "0.84 IoU on all study areas". Not "UNB7 architecture" for the trained model (say "U-Net with EfficientNet-B0;
  UNB7 is the planned full configuration").
* Not "interface score" as a research metric. Not that "bridge patches have no redundant route" for P01.
* Not that the τ = 5 km value is species-calibrated.

## 16. Final consistency check (repository · data · model · experiments · UI · paper · video)

| Item | Repo / data | UI | Video | Paper | Consistent? |
|---|---|---|---|---|---|
| Model = U-Net + EffNet-B0, S1 VV/VH | ✔ experiment.json | ✔ Data & Models | ✔ | says UNB7 (as foundation) + no model | Paper outdated |
| Test IoU 0.842 / F1 0.914 (4-area) | ✔ metrics.json | ✔ | ✔ with Sundarbans caveat | absent | Paper outdated |
| 95.56 % = foundation study | ✔ RESULTS_PROVENANCE | ✔ "Benchmark baseline" card; ✘ landing "95.6 % Confidence" | ✔ | ✔ Table V | Landing page inconsistent |
| GMW weak labels | ✔ | ✔ New Analysis panel | ✔ | ✘ FSI | Paper outdated |
| Threshold 0.70 (4-area) / 0.5 (Kerala LATEST) | ✔ | ✔ | ✔ | 0.5 fixed | Paper outdated |
| k = 3, τ = 5 km, IIC | ✔ graph.yaml | ✔ | ✔ | ✔ | ✔ |
| P17 example numbers | ✔ criticality.csv | ✔ evidence drawer | ✔ | P16 (synthetic) | ✔ (P16 flagged) |
| Critical bridges list | P01 not a cut vertex | ✘ lists P01 | ✔ flagged | — | UI bug flagged |
| Change over time | model mix in timeline | ✘ deltas misleading | ✔ flagged | future work | UI issue flagged |
| No costs | ✔ | ✔ "no cost data" | ✔ | Table VIII INR (synthetic) | ✔ (paper flagged) |
| Backend + SQLite | ✔ | ✔ | ✔ | "no backend/database" | Paper outdated |
| Sensors per area | S1 + S2 everywhere | ✔ | ✔ | Landsat-9 for Gulf | Paper outdated |

Evidence that would be needed for claims the repo cannot support today:
* **UNB7 result**: `outputs/segmentation/<exp>/metrics.json` from `configs/train_full.yaml` on a GPU.
* **Field accuracy**: a field-survey validation layer.
* **Costs**: a `candidate_id,cost` CSV from a real source.
* **Species τ**: dispersal literature for a named species.
