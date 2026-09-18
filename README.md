# EcoConnectAI

**A Satellite-Driven Framework for Coastal Ecosystem Connectivity and Conservation Decision Support**

Final-year major project. This repository turns the research design in `docs/EcoConnectAI_IEEE_paper.pdf`
into a runnable, testable pipeline:

```
Sentinel-1 / Sentinel-2  →  preprocessing  →  habitat segmentation (UNB7)  →  probability map
      →  patch extraction  →  connectivity graph  →  IIC / PC / ECA  →  patch criticality (leave-one-out)
      →  what-if loss simulation  →  rule-based explanation  →  restoration prioritisation  →  web dashboard
```

The web interface is the original prototype (`frontend/`, Next.js + Leaflet + React Flow), now fed by real
pipeline outputs through a FastAPI backend. Every number shown carries a provenance label.

---

## Status (2026-09-18) — read this first

| Stage | State |
|---|---|
| Graph construction, IIC/PC/ECA, exact leave-one-out criticality, what-if, explanations, restoration | **Implemented and unit-tested.** Reproduces the paper's Tables VI–VIII bit-for-bit from the synthetic prototype geometry. |
| Patch extraction from a probability raster (connected components, geodesic area, polygons, MMU) | **Implemented and unit-tested.** |
| Backend API + frontend integration (exact what-if in the UI, provenance badge) | **Implemented and verified in the browser.** |
| Satellite acquisition (Sentinel-1 RTC, Sentinel-2 L2A, no credentials) + GMW weak labels | **Implemented; verified live on a small test AOI.** |
| Dataset loader, preprocessing, UNB7 model, training/validation/evaluation/inference | **Implemented; plumbing verified end-to-end on a synthetic test fixture.** |
| **Trained segmentation model / real segmentation results** | **NOT YET RUN — blocked on the dataset decision (see below).** |
| EcoConnectAI segmentation accuracy | **NOT AVAILABLE.** The 95.56 % OA in the paper is the foundation study's result (PUBLISHED BASELINE — NOT OUR RESULT). |

The runs currently under `outputs/runs/*/prototype_synthetic/` are **PROTOTYPE / SYNTHETIC RESULTS**: the
mathematics is exact, the patch geometry is the prototype's synthetic data. They exist so the full
pipeline and UI can be exercised; they are not measurements of any real ecosystem.

### Dataset decision (blocker)

No dataset has been supplied yet. Two paths are ready (`docs/DATASET_SETUP.md`):

* **A.** You provide a dataset (local path / Hugging Face / Kaggle / Drive). `scripts/inspect_dataset.py` inspects
  it first; an adapter then writes the canonical tile layout.
* **B.** `scripts/acquire_study_area.py` builds a weakly-labelled dataset for the paper's four study areas
  from public Sentinel-1/2 imagery and Global Mangrove Watch (≈ 30–80 MB per area, no credentials) —
  the foundation study's own weak-supervision regime.

---

## Quick start

```bash
# 1. Python environment (Python ≥ 3.10; tested 3.14 on Apple Silicon)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 2. Frontend
cd frontend && npm install && cd ..

# 3. Configure
cp .env.example .env            # set DATA_ROOT (dataset location), SEGMENTATION_THRESHOLD, etc.

# 4. Tests (graph maths, patch extraction, ML plumbing, API) — 35 tests
.venv/bin/python -m pytest -q

# 5. Exercise the whole analysis + UI on the prototype geometry (labelled SYNTHETIC)
.venv/bin/python scripts/run_graph_analysis.py --study-area kerala-coast --source prototype
.venv/bin/python -m uvicorn backend.main:app --port 8000          # terminal 1
cd frontend && npm run dev                                         # terminal 2 → http://localhost:3000
```

### Real pipeline (once a dataset exists)

```bash
.venv/bin/python scripts/acquire_study_area.py --study-area kerala-coast     # or bring your own data
.venv/bin/python scripts/build_tiles.py --image data/scenes/kerala-coast/<scene>.tif --label data/labels/kerala-coast/gmw_2020.tif
.venv/bin/python scripts/train.py --config configs/train_dev.yaml            # MODE A laptop; train_full.yaml on a GPU
.venv/bin/python scripts/evaluate.py --checkpoint outputs/segmentation/<exp>/best_model.pth
.venv/bin/python scripts/predict.py  --checkpoint outputs/segmentation/<exp>/best_model.pth --input data/scenes/kerala-coast/<scene>.tif --output outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif
.venv/bin/python scripts/run_graph_analysis.py --study-area kerala-coast --probability outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif --result-kind development
# or all of the above:
./run_demo.sh configs/demo.yaml
```

---

## Repository layout

```
frontend/            Next.js dashboard (the original prototype, now API-backed)   docs: frontend/README.md
backend/main.py      FastAPI: study areas, runs, exact what-if, restoration, segment
ecoconnect/
  gee/               acquisition: STAC Sentinel-1/2 (no auth), GMW weak labels, optional Earth Engine
  geospatial/        preprocessing (nodata, normalisation, tiling), raster IO, patch extraction
  ml/                datasets, UNB7 model, training, evaluation (metrics/plots), inference
  graph/             construction, connectivity (IIC/PC/ECA/interface score), criticality, what_if,
                     explain, restoration
  pipeline/          config, run orchestration + provenance exports, frontend adapter, sources
configs/             dataset.yaml, train_dev.yaml, train_full.yaml, graph.yaml, acquisition.yaml,
                     study_areas.yaml, demo.yaml
scripts/             inspect_dataset, acquire_study_area, build_tiles, train, validate, evaluate,
                     predict, run_graph_analysis, run_pipeline
tests/               35 pytest tests on hand-checkable graphs/rasters + API + ML plumbing
outputs/             runs/<area>/<run_id>/ (analysis) and segmentation/<exp>/ (models, metrics, curves)
docs/                IMPLEMENTATION_AUDIT, PAPER_IMPLEMENTATION_TRACEABILITY, DATASET_SETUP, PREPROCESSING,
                     TRAINING, INFERENCE, GEE_SETUP, ARCHITECTURE, EXPERIMENTS, CONNECTIVITY_METRICS,
                     RESULTS_PROVENANCE, TROUBLESHOOTING, the paper PDF + LaTeX, legacy offline experiment
```

## Result labels used everywhere

`PUBLISHED BASELINE — NOT OUR RESULT` · `PROTOTYPE / SYNTHETIC RESULT` · `DEVELOPMENT-SUBSET RESULT — NOT FINAL` ·
`OUR EXPERIMENTAL RESULT` · `NOT YET RUN` · `REQUIRES VERIFICATION`

## Documentation index

`docs/IMPLEMENTATION_AUDIT.md` (what existed, what changed, why) · `docs/ARCHITECTURE.md` ·
`docs/PAPER_IMPLEMENTATION_TRACEABILITY.md` (equation → function) · `docs/DATASET_SETUP.md` ·
`docs/PREPROCESSING.md` · `docs/TRAINING.md` · `docs/INFERENCE.md` · `docs/CONNECTIVITY_METRICS.md` ·
`docs/GEE_SETUP.md` · `docs/EXPERIMENTS.md` · `docs/RESULTS_PROVENANCE.md` · `docs/TROUBLESHOOTING.md`
