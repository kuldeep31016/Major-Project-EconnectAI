# Reproducibility

_Written 2026-10-01 against the code and the files present in the repository._

This page covers what can be reproduced from a fresh clone, how, and what cannot be reproduced yet.

Short answer:

- **The graph stage can be reproduced from the repository alone.** This covers patches → graph → IIC/PC/ECA →
  criticality → what-if → restoration, and regression tests pin it.
- **The imagery and model stages cannot.** Satellite scenes, label rasters, tile datasets, model checkpoints and
  probability rasters are not in git, and some were overwritten.

All results are development results measured against Global Mangrove Watch (GMW) weak labels. Nothing is
field-validated.

## 1. Environment

| Use | Install | Python |
|---|---|---|
| API + tests (no PyTorch) | `python3 -m venv .venv && .venv/bin/pip install -r requirements-api.txt pytest pandas` | CI uses 3.12. The Docker image uses 3.11. `pyproject.toml` requires ≥ 3.10. |
| Full research stack (acquisition, training, inference) | `.venv/bin/pip install -r requirements.txt` (torch 2.13, segmentation-models-pytorch, rasterio, geopandas, …) | The dev machine used 3.14 on an Apple M3 (MPS) |

Caveats:

- Requirements are **lower-bound ranges (`>=`)**, not a lock file. Only `torch==2.13.0` is pinned. A later install
  can resolve different versions.
- The dev machine's `.venv` has no PyTorch today, so ML steps cannot run there.
- GPU/MPS kernels are not bit-deterministic. The trainer seeds `random`, `numpy` and `torch`, and the DataLoader
  generator comes from `seed: 42` in `configs/train_*.yaml` and `configs/dataset*.yaml`. It does **not** enable
  `torch.use_deterministic_algorithms`. Retraining gives similar numbers, not identical ones.

Configuration lives entirely in `configs/*.yaml`. Any leaf can be overridden with `ECO_<SECTION>__<KEY>`, and
`.env` is read with `setdefault` (see `.env.example`). `DATA_ROOT` (default `./data`) and `ECO_OUTPUTS_DIR`
(default `./outputs`) control locations.

| Config | Used by |
|---|---|
| `study_areas.yaml` | AOI names, bboxes (metadata only) |
| `acquisition.yaml` | STAC sources, date ranges, cloud limits |
| `dataset.yaml`, `dataset_s2.yaml`, `dataset_s1s2.yaml` | Tiling, bands, spatial-block split, seed |
| `train_dev*.yaml`, `train_full*.yaml` | Model (B0 dev / B7 = UNB7 full), loss, schedule, seed |
| `graph.yaml` | k = 3, τ = 5 km, τ-sensitivity grid, metric, restoration settings |
| `demo.yaml` | `scripts/run_pipeline.py` end-to-end config |

## 2. Pipeline, step by step

| Step | Command | Needs | Output |
|---|---|---|---|
| Acquire | `python scripts/acquire_study_area.py --study-area kerala-coast` | Network. STAC is credential-free: Planetary Computer S1 RTC, Earth Search S2 L2A, GMW v3 from Zenodo. | `${DATA_ROOT}/scenes/<area>/*.tif` + `.json`, `${DATA_ROOT}/labels/<area>/` |
| Tile | `python scripts/build_tiles.py --image … --label … --name ecoconnect_tiles` (or `run_all_areas.py --stage tiles`) | Scenes + labels | `${DATA_ROOT}/<dataset>/tiles`, `splits/`, `metadata.json` (see `docs/DATASET_SETUP.md`) |
| Train | `python scripts/train.py --config configs/train_dev.yaml` (see `docs/TRAINING.md`) | Tiles, PyTorch | `outputs/segmentation/<exp>/best_model.pth`, `metrics.json`, `experiment.json`, `history.csv` |
| Evaluate / calibrate | `scripts/evaluate.py`, `scripts/validate.py`, `scripts/threshold_sweep.py` | Checkpoint, tiles | Test metrics, `threshold_calibration.json` |
| Inference | `python scripts/predict.py --checkpoint … --input <scene>.tif --output …/<area>_prob.tif` (see `docs/INFERENCE.md`) | Checkpoint, scene, PyTorch | Probability, confidence and binary GeoTIFFs |
| Graph analysis | `python scripts/run_graph_analysis.py --study-area <area> --probability <prob.tif> --threshold 0.7 --result-kind development` | Probability raster (no PyTorch) | `outputs/runs/<area>/<run_id>/` |
| All stages | `python scripts/run_pipeline.py --config configs/demo.yaml` | Everything above | |

Re-acquiring from STAC is not guaranteed to be byte-identical: catalogue items can be reprocessed or replaced.
The scene sidecar `.json` records the item ids used, but those sidecars live in `data/`, which is not in git.

## 3. Checks that run from a fresh clone

### Regression tests: stored results must be reproducible from stored inputs

`tests/test_regression.py` (part of `.venv/bin/python -m pytest -q`):

- `test_kerala_criticality_matches_stored`, `test_p17_worked_example`, `test_restoration_c1_matches_stored`:
  recompute run `kerala-coast_20260920T182222Z` from its `patches_input.json` + config and compare against the
  stored `criticality.json` / `restoration.json`. This includes the P17 worked example (cut vertex, about 27 % IIC
  loss) and candidate C1.
- `test_scenarios_are_deterministic`: the same scenario gives the same result twice.
- `test_synthetic_prototype_reproduces_paper_tables`: the synthetic prototype geometry reproduces
  `docs/legacy_experiment/results_synthetic_prototype.json` (paper Tables VI–VIII) for all four landscapes.

These tests pin **reproducibility of the maths**, not ecological truth. The pinned Kerala run is the previous
LATEST. The current LATEST (`kerala-coast_multi_E1_s1_b0_dev_t0.70`) is covered by the reproduce job and the
acceptance test below.

### "Reproduce this analysis" job

`POST /api/runs/{study_area}/{run_id}/reproduce` (signed-in, 202 + job; UI button; handler
`backend/job_handlers.py::reproduce`). It recomputes a stored run from its recorded inputs and configuration,
diffs every result, and never overwrites the stored run.

- **Graph level (always)**: `patches_input.json` + manifest config → graph → `n_patches`, `n_edges`,
  `n_components`, IIC, PC, ECA, rank / S / cut-vertex for every patch, and restoration rank and gain for every
  candidate (skipped for cost-ranked runs). It also checks `config_sha256` when the manifest has one.
- **Raster level (only when the probability raster is on the server)**: it also re-extracts patches from the
  probability GeoTIFF and compares patch count, habitat area and landscape area. No raster is in the repo or
  the deployed image, so the job reports `level: "graph"` with a note saying so.
- The result carries `reproduced: true|false`, every check (stored vs recomputed), and the code version then and
  now.

### End-to-end acceptance test

`.venv/bin/python scripts/acceptance_test.py [--study-area kerala-coast] [--json out.json]` walks the 20
decision-support steps through the real HTTP API (FastAPI TestClient). It uses a scratch copy of `outputs/`,
a fresh SQLite DB and the template assistant (no paid API call). Steps that need missing data are reported as
**SKIP with the reason, never PASS**. The exit code is 1 on any FAIL. CI runs it too, but CI is currently blocked
by the GitHub billing lock.

Result on the dev machine, 2026-10-01: **16 PASS / 4 SKIP / 0 FAIL**.

- Skipped:
  - 3 (acquire satellite data)
  - 4 (preprocessing)
  - 5 (segmentation model)
  - 6 (probability map)
- Reason: no Sentinel-1 scenes, no checkpoint and no PyTorch on the machine. For step 6, the stored raster's
  path is reported, but the file itself is absent.
- Step 2 creates the analysis as a background `reproduce` job, which matches at graph level (8 checks).
- Steps 7–20 cover:
  - patches, graph, IIC, criticality, critical patch (P07), what-if and τ sensitivity
  - restoration (C05; uncertain areas sent to field check)
  - field task + evidence (test data), report, template assistant, and checking its numbers against
    `criticality.json`
  - audit log and PDF

## 4. What cannot be reproduced from the repository alone

| Missing | Why | Effect |
|---|---|---|
| Satellite scenes and GMW label rasters (`data/`) | Gitignored (size) | No retraining, inference, raster-level reproduce, timeline mask difference or quicklooks |
| Tile datasets | Gitignored. The 4-area tile set used for `multi_E1_s1_b0_dev` was **overwritten** by a Kerala-only rebuild on 2026-09-20. | The reported segmentation metrics (test IoU 0.842 / F1 0.914 vs GMW) cannot be recomputed as-is |
| Model checkpoints (`best_model.pth`) | Gitignored, and **none are present** on the dev machine today | No inference or `evaluate.py`. `POST /api/segment` returns 404 (no scene, or no trained checkpoint). |
| Probability rasters (`*_prob.tif`) | Gitignored. Only the `.json` sidecars are in `outputs/segmentation/*/predictions/`. | Graph-level reproduction only |
| Code version and hashes of stored runs | The 11 stored manifests predate `code` / `config_sha256` / `input_sha256`. Stored `experiment.json` files have no commit or config hash. | The exact commit that produced each stored result is not recorded |
| Exact dependency set | No lock file | Environment drift possible |

Known methodological issues also limit how far the stored segmentation numbers can be trusted, independent of
reproducibility (audit bugs 20–28, `docs/context/AUDIT_2026-09-27.md`):

- The threshold was selected on the test split.
- 128 px stride tiles risk leakage across the split.
- A Kerala model was trained on 2025 imagery against 2020 labels.

## 5. What would be needed for full reproducibility

1. Re-acquire the four AOIs with `acquire_study_area.py`. Keep the scene sidecars, and archive the scenes, labels
   and tiles with content hashes (object storage or a data DOI).
2. Rebuild the 4-area tile set with a leakage-free split. Retrain `multi_E1` (and UNB7 on a GPU). Select the
   threshold on the validation split only.
3. Archive `best_model.pth` and the probability rasters. The manifests then carry `input_sha256`, and the
   reproduce job can run at raster level.
4. Regenerate the runs with the current pipeline, so every manifest records `code.git_commit`,
   `config_sha256` and `input_sha256`.
5. Pin dependencies (a lock file or `pip freeze` per release) and record the Python version.
6. Extend `tests/test_regression.py` to pin the current LATEST runs.
