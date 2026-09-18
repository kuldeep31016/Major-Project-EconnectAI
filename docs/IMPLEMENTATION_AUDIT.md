# EcoConnectAI — Implementation Audit v2 (product evolution)

**Date:** 2026-09-19 · **Scope:** the whole repository as it stands after the research-implementation phase
(35 commits, 5.7 k lines Python, 10.5 k lines TypeScript, 37 passing tests).
**Purpose:** baseline for evolving the research implementation into a *Coastal Ecosystem Intelligence and
Decision-Support Platform* for forest-department use, without breaking the science or fabricating anything.
The v1 audit (component-by-component paper mapping) is preserved in git history (commit 7e912ca) and its content is
superseded by `docs/PAPER_IMPLEMENTATION_TRACEABILITY.md`.

---

## 1. Current architecture

```
data acquisition (STAC, no credentials)  ecoconnect/gee        Sentinel-1 RTC (Planetary Computer), Sentinel-2 L2A (Earth Search), GMW v3 labels (Zenodo)
preprocessing / tiling                   ecoconnect/geospatial  nodata, SCL masks, median composites, dB, UTM grid, spatial-block tiles
segmentation                             ecoconnect/ml          smp U-Net; EfficientNet-B0 (dev) / B7 = UNB7 (final); train/validate/evaluate/predict; threshold sweep
patch extraction                         ecoconnect/geospatial  connected components, geodesic area, WGS84 geometry, MMU
graph analysis                           ecoconnect/graph       k-NN≤τ graph, Eq.6 weights, IIC/PC/ECA, exact leave-one-out criticality, what-if, explanations, restoration
orchestration + exports                  ecoconnect/pipeline    run directories with manifest/provenance, frontend bundle, report builder
API                                      backend/main.py        FastAPI over run directories (no DB, no auth)
UI                                       frontend/              Next.js 16 (App Router), Leaflet, React Flow, Recharts; dark theme inherited from the prototype
```
Persistence: **files only** (`outputs/runs/<area>/<run_id>/`, `outputs/segmentation/<exp>/`, `data/`). No database, no users.

## 2. Module status

### 2.1 Working, real-data modules
| Module | Files | Evidence |
|---|---|---|
| Acquisition (S1 RTC, S2 L2A, GMW) | `ecoconnect/gee/*`, `scripts/acquire_study_area.py` | Kerala 2020 (S1×6, S2×6), Kerala 2025 (S1×6) on disk; per-sensor checkpoint files; retries |
| Tiling + dataset + normalisation | `ecoconnect/geospatial/preprocessing/*`, `ecoconnect/ml/datasets/*` | 256 Kerala tiles, spatial-block split 176/32/48 |
| Training / evaluation / calibration | `ecoconnect/ml/*`, `scripts/train.py, evaluate.py, threshold_sweep.py` | E1/E2/E3 dev runs with metrics, curves, panels, calibration |
| Whole-scene inference | `ecoconnect/ml/inference/predict.py` | probability/confidence/binary GeoTIFFs for Kerala 2020 & 2025 |
| Patch extraction → graph → criticality → what-if → explanations → restoration | `ecoconnect/geospatial/patch_extraction`, `ecoconnect/graph/*`, `ecoconnect/pipeline/analysis.py` | runs `kerala_E1_s1_b0_dev_t0.70`, `…_2025_…`, `kerala_E2_…`; reproduces paper Tables VI–VIII on synthetic geometry to 1e-16 |
| Backend endpoints | `backend/main.py` | study-areas, runs, bundle, artefacts, timeline, report, what-if, restoration (+costs), reanalyse (τ/k/metric), probability.png, models, segment |
| Frontend on real runs | `frontend/*` | provenance badge, run selector, exact what-if, polygon removal, real timeline, real history, generated reports, Experiments page, sensitivity explorer, probability overlay, cost upload, "Run analysis" |

### 2.2 Incomplete / in progress
| Item | State |
|---|---|
| Odisha, Gulf of Mannar, Sundarbans 2020 | S1 composites on disk; S2 + GMW labels still downloading; `scripts/phase2_all_areas.sh` will build the 3-area dataset, train `multi_E1_s1_b0_dev`, calibrate and analyse; `phase2_late_area.sh` adds Sundarbans |
| UNB7 final model | notebook `notebooks/colab_train_unb7.ipynb` ready; **NOT YET RUN** (needs a CUDA GPU) |
| Frontend lint | 3 pre-existing prototype errors (React-compiler rule) untouched |

### 2.3 Synthetic / demonstration modules (labelled in UI)
`frontend/mock-data/*.json` (fallback only), scenario narratives (cyclone/SLR/urban), AI assistant canned replies, settings page, prototype budget bands, `outputs/runs/*/prototype_synthetic` (exact maths over synthetic geometry).

### 2.4 ML modules — model provenance
| Experiment | Input | Encoder | Data | Test IoU / Dice vs GMW | Label |
|---|---|---|---|---|---|
| kerala_E1_s1_b0_dev | S1 VV/VH | B0 | Kerala 2020, 176/32/48 tiles | 0.023 / 0.045 | DEVELOPMENT — NOT FINAL |
| kerala_E2_s2_b0_dev | S2 8 bands | B0 | same | 0.054 / 0.102 | DEVELOPMENT — NOT FINAL |
| kerala_E3_s1s2_b0_dev | S1+S2 | B0 | same | 0.053 / 0.101 | DEVELOPMENT — NOT FINAL |
| UNB7 (paper) | S1 | B7 | — | — | NOT YET RUN |
| Ghorbanian et al. 2025 | S1 | B7 | theirs | OA 95.56 %, κ 0.94 | FOUNDATION PAPER RESULT — NOT OURS |

### 2.5 GIS modules
Raster IO (rasterio), latitude-aware pixel area, UTM grids, WGS84 GeoJSON export, Leaflet map with Esri imagery, probability overlay, patch polygons, graph edges, sensitivity choropleth, polygon drawing, coordinate readout, scale bar, minimap. **Missing:** measure tool, identify-any-layer, administrative/protected-area layers (only a flag on patches), change layer, alerts/field-observation layers, layer opacity per layer (heatmap only).

### 2.6 Backend modules — gaps versus the target service list
Present: study-areas, scenes, models, predictions(runs), patches, graphs, criticality, scenarios (what-if/reanalyse), restoration, reports, timeline. **Absent:** auth, users, organizations, datasets registry, alerts, field-tasks, evidence, projects, audit. No database.

### 2.7 Frontend modules
Present: landing (light), dashboard, analysis, simulation, experiments, reports, history, settings, running. **Absent:** command center, role-aware navigation, scenario lab (as a first-class comparison tool), restoration planner with feasibility/why-not, change detection view ("what changed / why it matters"), field tasks, evidence drawer, alerts, projects, model cards, audit view, login. Theme is the prototype's dark "startup" look; target is light professional GIS.

## 3. Data sources (all public, no credentials)
Sentinel-1 RTC γ⁰ (Microsoft Planetary Computer STAC) · Sentinel-2 L2A COGs (Element84 Earth Search) · Global Mangrove Watch v3.0 2020 (Zenodo 6894273, CC-BY-4.0) · Esri World Imagery (display only). Manifests: per-scene `.json` sidecars, per-label `.json`, per-run `manifest.json`, per-experiment `experiment.json`. **Gap:** no single machine-readable dataset registry; no admin/protected-area vector layers yet.

## 4. Technical debt
* Run state lives in folders; interactive features re-read JSON per request (fine for tens of patches, not for many users).
* Backend is one 600-line module; no schema versioning of run outputs; no auth.
* Frontend `lib/data.ts` registry mutates bundles in place (re-analysis, cost upload) — works, but is not a state store.
* Prototype narrative features (scenarios, assistant) remain as labelled demo content.
* Interface score (Eq. 7) is non-monotone under removal; demoted but still displayed.
* Kerala AOI has 0.2 % mangrove — a poor training area; final model must be multi-area.

## 5. Missing production features (mapped to the new spec)
Command center · ecosystem digital twin (versioned state) · change detection beyond area diff (patch loss/creation/fragmentation, criticality change) · scenario lab (restore multiple, threshold/τ/time comparisons side by side, OBSERVED/SIMULATED labels) · restoration feasibility constraints + why/why-not · human-in-the-loop verification workflow and statuses · field module · evidence drawer · audit trail · alerts · projects · official report incl. field verification · professional GIS controls · GIS-aware assistant · RBAC/auth · model cards · deployment docs.

## 6. Security concerns (current)
No authentication; CORS open to localhost only; `POST /segment` spawns subprocesses with user-supplied paths (path validation needed); file endpoints validate against the outputs root (ok); no rate limits; secrets: none in source (STAC is anonymous); `.env` ignored.

## 7. Scalability concerns
Whole-scene inference and criticality are O(n²)–O(n³) in patches but n is tens–hundreds; fine. Acquisition is network-bound (minutes per scene). JSON-per-request API and in-memory frontend registry will not scale to many concurrent users — acceptable for a departmental prototype with a SQLite/PostgreSQL migration path.

## 8. Decisions for the platform evolution
| Decision | Choice | Rationale |
|---|---|---|
| Database | **SQLite via SQLAlchemy** now (single file, zero ops), PostGIS-ready schema (geometry stored as GeoJSON text + bbox columns) | Persistent app state (users, projects, tasks, evidence, alerts, audit) is genuinely needed now; rasters stay on disk, referenced by path + manifest |
| Auth | JWT bearer tokens, bcrypt passwords, seeded demo users per role, RBAC dependency | Production-oriented foundation without external identity provider |
| Digital twin | `ecosystem_state` versions = existing run directories registered in DB (`analysis_versions` table) + change records | Reuses provenance already written by the pipeline |
| Theme | New light GIS theme (deep forest green #0f5132, coastal blue #1e5f8a, accent #16a34a, white surfaces) applied app-wide | Government/enterprise look; landing already light |
| Assistant | Rule/retrieval based over backend data (intents → API queries → templated answers with numbers and links) | No LLM dependency, no fabrication |
| Order | as §9 below | Phase 1 (real pipeline) is done; product phases follow the spec order |

## 9. Recommended implementation order
1. **Foundations**: DB + models + auth/RBAC + audit log + provenance registry (needed by every later phase).
2. **Command Center + professional GIS map** (light theme, role-aware nav, layers, measure, identify).
3. **Criticality explanations + Evidence drawer** (structured WHY panel from stored metrics).
4. **Scenario Lab** (A–G with baseline/scenario/difference and OBSERVED/SIMULATED labels).
5. **Restoration Planner** (candidate methodology doc, feasibility constraints from real layers, why/why-not).
6. **Change Detection** (patch-level T1/T2 comparison, criticality change, "what changed / why it matters").
7. **Field verification + field module** (statuses, tasks, evidence upload).
8. **Alerts + Projects**.
9. **Reports** (official report incl. field verification) · **Model cards** · **Assistant**.
10. **Security hardening + deployment docs**.
