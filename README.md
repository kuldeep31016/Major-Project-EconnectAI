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
| Graph construction, IIC/PC/ECA, exact leave-one-out criticality, what-if, explanations, restoration | **Implemented, unit-tested**; reproduces the paper's Tables VI–VIII bit-for-bit from the synthetic prototype geometry. |
| Patch extraction from probability rasters | **Implemented, unit-tested.** |
| Backend API + frontend (exact what-if, real timeline, provenance badge, polygon scenarios) | **Implemented, verified in the browser on real runs.** |
| Satellite acquisition (Sentinel-1 RTC, Sentinel-2 L2A, GMW weak labels; no credentials) | **Implemented and executed for Kerala 2020** (S1 ×6, S2 ×6, GMW tile N10E076). |
| Dataset, preprocessing, UNB7 model, train/validate/evaluate/predict, threshold sweep | **Implemented and executed** on Kerala (dev mode, B0 encoder). |
| **E1/E2/E3 development runs (Kerala, B0)** | **Done — DEVELOPMENT-SUBSET RESULTS, NOT FINAL.** Test IoU vs GMW: E1 S1-only 0.023, E2 S2-only 0.054, E3 fusion 0.053 (48 tiles). Weak: 176 training tiles, 0.2 % positives, 1–3 px fringes. See `docs/RESULTS_PROVENANCE.md`. |
| Graph analysis on real predictions | **Done** (`outputs/runs/kerala-coast/kerala_E1_s1_b0_dev_t0.70`, 24 patches, IIC 1.59e-5, ECA 75.5 % of habitat). |
| Other three study areas; multi-area dataset | **NOT YET RUN.** |
| **UNB7 final run (GPU) → OUR EXPERIMENTAL RESULT** | **NOT YET RUN.** EcoConnectAI's final segmentation accuracy is therefore **NOT AVAILABLE**; 95.56 % OA is the foundation study's (PUBLISHED BASELINE — NOT OUR RESULT). |

Runs under `outputs/runs/*/prototype_synthetic/` are PROTOTYPE / SYNTHETIC (exact maths over synthetic geometry).
Runs named `kerala_E*_dev_*` are real-data development runs. Every number in the UI carries its label.

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
# multi-area (every area with a scene + label): tiles → train → evaluate → sweep → analyse
.venv/bin/python scripts/run_all_areas.py --stage tiles
.venv/bin/python scripts/run_all_areas.py --stage train --config configs/train_dev.yaml --experiment-id all4_E1_s1_b0_dev
.venv/bin/python scripts/run_all_areas.py --stage evaluate --experiment-id all4_E1_s1_b0_dev
.venv/bin/python scripts/run_all_areas.py --stage sweep    --experiment-id all4_E1_s1_b0_dev
.venv/bin/python scripts/run_all_areas.py --stage analyse  --experiment-id all4_E1_s1_b0_dev
# or all of the above for one area:
./run_demo.sh configs/demo.yaml
# UNB7 final run on a GPU: notebooks/colab_train_unb7.ipynb
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
