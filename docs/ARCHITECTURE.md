# Architecture

```
┌──────────────────────── acquisition (ecoconnect/gee) ─────────────────────────┐
│ STAC: Sentinel-1 RTC (PC)  ·  Sentinel-2 L2A (Earth Search)  ·  GMW v3 (Zenodo) │  optional: Earth Engine
└──────────────┬────────────────────────────────────────────────────────────────┘
               ▼   data/scenes/<area>/<scene>.tif  +  data/labels/<area>/gmw_2020.tif
┌──────── preprocessing / tiling (ecoconnect/geospatial/preprocessing) ─────────┐
│ nodata · SCL mask · median composites · dB · indices · spatial-block tiles     │
└──────────────┬────────────────────────────────────────────────────────────────┘
               ▼   ${DATA_ROOT}/<dataset>/tiles/{images,masks}, splits/, metadata.json
┌──────────────────── segmentation (ecoconnect/ml) ─────────────────────────────┐
│ TileDataset → U-Net(EfficientNet-B7 = UNB7 | B0 dev) → train / validate / evaluate │
│ predict_scene → *_prob.tif  *_confidence.tif  *_binary.tif                    │
└──────────────┬────────────────────────────────────────────────────────────────┘
               ▼
┌──────── patch extraction (ecoconnect/geospatial/patch_extraction) ────────────┐
│ threshold → connected components → area (geodesic) · centroid · polygon · C_i │
└──────────────┬────────────────────────────────────────────────────────────────┘
               ▼   list[Patch]
┌──────────────────── graph analysis (ecoconnect/graph) ────────────────────────┐
│ construction (k-NN ≤ τ, w_ij) → connectivity (IIC/PC/ECA, Eq.7 UI score)      │
│ → criticality (exact leave-one-out) → what_if → explain → restoration         │
└──────────────┬────────────────────────────────────────────────────────────────┘
               ▼   outputs/runs/<area>/<run_id>/  (manifest, geojson, json, csv, frontend_bundle)
┌──────── backend (FastAPI) ────────┐      ┌──────── frontend (Next.js) ────────┐
│ GET study-areas/runs/bundle/...   │ ───► │ lib/api.ts → lib/data.ts registry   │
│ GET timeline (real, per year)     │      │ provenance badge · exact what-if UI │
│ GET report (from run artefacts)   │ ◄─── │ Leaflet map · React Flow graph      │
│ POST what-if (exact) / restoration│      │ real timeline · real history        │
│ POST segment (auto scene/ckpt)    │      │ "Run analysis" → real backend run   │
└───────────────────────────────────┘      └─────────────────────────────────────┘
```

## Storage decision: files, not a database

Each pipeline run is an immutable folder `outputs/runs/<study_area>/<run_id>/` plus a `LATEST` pointer.
Contents: `manifest.json` (provenance, config, hardware, files), `patches.geojson`, `graph.json`,
`metrics.json`, `criticality.csv/json`, `explanations.json`, `restoration.csv/json`, `what_if_top1.json`,
`tau_sensitivity.json`, `patches_input.json` (what the API needs to recompute), `frontend_bundle.json`.
Segmentation experiments live in `outputs/segmentation/<experiment_id>/` with `experiments.csv` as a registry.

Why no DB: tens of patches × four areas; the UI already consumed JSON; every result stays a diffable,
versioned file with provenance; the interactive computations (what-if, restoration re-ranking) are
milliseconds on the in-memory graph. PostGIS can be added later behind `backend/main.py` without touching
analysis code.

## Modes

`LOCAL_DEVELOPMENT_MODE` = `mode: development` (subset, B0, MPS/CPU) · `CLOUD_TRAINING_MODE` = `mode: full`
(all tiles, UNB7, CUDA). Both write the same artefacts; labels differ.

## Configuration

`configs/*.yaml` + `.env` (`DATA_ROOT`, `SEGMENTATION_THRESHOLD`, `ECO_<SECTION>__<KEY>` overrides). No
paths are hard-coded.

## Frontend data flow

`hooks/use-analysis.tsx` loads `/api/runs/<scene>/latest/bundle` and registers it in `lib/data.ts`. Every
existing getter (`getHabitatMask`, `getGraph`, …) returns the live bundle when present, otherwise the
prototype mock labelled PROTOTYPE / SYNTHETIC. Scenario narratives (cyclone, SLR…) and the 2020–25
timeline are prototype content outside the paper's pipeline and always stay mock.

## Backend endpoints (backend/main.py)

| Endpoint | Purpose |
|---|---|
| `GET /api/health`, `/api/study-areas`, `/api/runs`, `/api/scenes`, `/api/models` | discovery: areas + latest run, all runs, acquired scenes, trained experiments |
| `GET /api/runs/{area}/{run|latest}/bundle` | everything the UI needs, in the prototype's types, with provenance |
| `GET …/patches|graph|metrics|criticality|explanations|restoration|tau-sensitivity|manifest|files/{name}` | raw artefacts |
| `GET /api/runs/{area}/timeline` | REAL timeline: one entry per scene year with a run; mask difference between years |
| `GET …/report` | decision-support report composed only from the run's artefacts |
| `POST …/what-if {patch_ids}` | exact Eq. (10) recomputation |
| `POST …/restoration {costs?}` | Eq. (11)/(12); cost-aware only with user costs |
| `POST /api/segment {study_area, …}` | inference + graph analysis; auto-picks newest scene, best checkpoint (full > calibrated > newest) and its calibrated threshold |

## What in the UI is real vs demonstration

| UI element | Real when a run exists | Otherwise |
|---|---|---|
| Analysis map/graph/metrics, criticality, explanations | real run (badge shows label) | prototype mock, badge *Prototype · synthetic* |
| What-if (patch click / polygon) | exact backend recomputation | prototype heuristic, labelled |
| Restoration | raw-gain ranking; cost-aware only with a cost CSV | prototype budget bands |
| Timeline | real runs per year + mask difference | demonstration timeline, labelled |
| History, Reports, Models panel | real runs / generated reports / real experiments | demonstration entries, labelled |
| Scenario narratives (cyclone, SLR, …), AI assistant | always demonstration content, labelled | |
