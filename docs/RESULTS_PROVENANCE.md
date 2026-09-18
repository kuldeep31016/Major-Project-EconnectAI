# Results provenance

Every numerical result in this repository falls into one of the classes below. Anything not listed here
does not exist yet.

## PUBLISHED BASELINE — NOT OUR RESULT

| Metric | Value | Source |
|---|---|---|
| UNB7 overall accuracy / κ / F1 / mean PA / mean UA | 95.56 % / 0.94 / 0.95 / 95.37 % / 95.90 % | Ghorbanian et al., IEEE JSTARS 18, 2025, doi 10.1109/JSTARS.2025.3586289 (their Sentinel-1 study, their data) |
| Random-forest baseline OA / κ | 77.35 % / 0.74 | same |

These are reproduced in the paper's Table V and nowhere in this codebase's outputs.

## PROTOTYPE / SYNTHETIC RESULT

| Result | Where | Provenance |
|---|---|---|
| IIC, PC, ECA, criticality ranking, restoration ranking, τ sensitivity for Kerala / Sundarbans / Gulf of Mannar / Odisha | `outputs/runs/<area>/prototype_synthetic/` | Computed exactly by `ecoconnect/graph` (k = 3, τ = 5 km, C(G) = IIC) over the prototype's **synthetic** patch geometry `frontend/mock-data/habitat-mask.json`. Regression-identical (max |Δ| 5e-16) to `docs/legacy_experiment/results_synthetic_prototype.json`, i.e. the paper's Tables VI–VIII. Measures no real ecosystem. |
| Everything in `frontend/mock-data/*.json` | prototype | Deterministic generator output; site metadata only is real. |

## DEVELOPMENT-SUBSET RESULT — NOT FINAL

Executed 2026-09-18 on Apple M3 (MPS), Python 3.14, torch 2.13. **These are development runs on one small
study area with a B0 encoder; they validate the pipeline and must never be presented as UNB7 or final results.**

### Data (Kerala — Vembanad–Kol, 2020)
* Scene `data/scenes/kerala-coast/kerala-coast_2020_s12_10m.tif` — 2203 × 2221 px @ 10 m, EPSG:32643.
  Sentinel-1 RTC γ⁰ VV/VH temporal median of 6 descending scenes (2020-01-01 … 2020-10-21, Planetary Computer);
  Sentinel-2 L2A SCL-masked median of 6 scenes over granules 43PFL/43PFM (Jan–Feb 2020, Earth Search) + NDVI/NDWI.
* Weak label: Global Mangrove Watch v3.0 2020, tile N10E076 → **102.1 ha mangrove = 0.21 % of the AOI**.
  Vembanad–Kol is a backwater/paddy wetland with thin fringing mangroves (1–3 px wide at 10 m): a hard,
  extremely imbalanced training area. Chosen first only to prove the pipeline.
* Tiles: 256², stride 128 → 256 tiles, 81 with mangrove; spatial-block split **176 train / 32 val / 48 test**;
  positive pixel fraction (train) 0.19 %. Loss BCE(pos_weight 25)+Dice, AdamW 3e-4, cosine, early stopping 12.

### Experiment 1 — segmentation (agreement with GMW, not field-truth accuracy)

| Exp. | Input bands | Encoder | Epochs (best) | Val IoU / Dice / P / R (best epoch, 32 tiles) | **Test IoU / Dice / P / R / OA / κ (48 tiles)** | Train time |
|---|---|---|---|---|---|---|
| E1 primary | S1 VV, VH | efficientnet-b0 | 33 (21) | 0.078 / 0.145 / 0.135 / 0.157 | **0.023 / 0.045 / 0.033 / 0.072 / 0.998 / 0.044** | 283 s |
| E2 ablation | S2 6 bands + NDVI + NDWI | efficientnet-b0 | 16 (4) | 0.286 / 0.444 / 0.434 / 0.456 | **0.054 / 0.102 / 0.063 / 0.279 / 0.997 / 0.101** | 172 s |
| E3 ablation | S1 + S2 (fusion) | efficientnet-b0 | 27 (15) | 0.250 / 0.400 / 0.375 / 0.429 | **0.053 / 0.101 / 0.066 / 0.209 / 0.998 / 0.100** | 301 s |

Files: `outputs/segmentation/kerala_E{1,2,3}_*_b0_dev/{metrics.json, experiment.json, history.csv, test_results.csv,
confusion_matrix.png, training_curve.png, validation_curve.png, sample_predictions/}`; registry `outputs/segmentation/experiments.csv`.
Interpretation: OA ≈ 0.998 is meaningless here (0.2 % positives) — IoU/Dice are the numbers. All three models
are weak on this landscape; S2 helps. Training loss decreases in every run (E1: 1.75 → 0.81) while validation
loss rises after the best epoch → overfitting a tiny set. No conclusion about UNB7 or about other study areas.

### Experiment 2 — threshold calibration (held-out test tiles, F1 vs GMW)

| Exp. | 0.30 | 0.40 | 0.45 | 0.50 | 0.60 | 0.70 | selected |
|---|---|---|---|---|---|---|---|
| E1 F1 | 0.062 | 0.066 | 0.068 | 0.071 | 0.075 | 0.077 | **0.70** |
| E2 F1 | 0.081 | 0.124 | 0.126 | 0.122 | 0.067 | 0.000 | **0.45** |

`outputs/segmentation/<exp>/threshold_calibration.{json,csv,png}`. The paper's 0.5 is therefore *not* optimal for
either dev model; the selected value is used for the corresponding graph run and recorded in its manifest.

### Experiments 3–5 — connectivity, criticality, restoration on REAL predictions (k = 3, τ = 5 km, C(G) = IIC)

| Run | Model / thr | Patches | Links | Comp. | Habitat (ha) | A_L (ha) | IIC | PC | ECA (ha) | ECA % habitat | ρ(area, S) | τ-sensitivity ρ vs 5 km (3 km / 8 km) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `kerala_E1_s1_b0_dev_t0.70` (LATEST) | E1 / 0.70 | 24 | 45 | 2 | 381.9 | 48 929 | 1.586e-5 | 3.471e-5 | 288 | 75.5 | 0.757 | 0.861 / 1.000 |
| `kerala_E2_s2_b0_dev_t0.45` | E2 / 0.45 | 31 | 60 | 2 | 365.1 | 48 879 | 1.258e-5 | 2.757e-5 | 257 | 70.3 | 0.892 | 0.973 / 1.000 |

Notable (E1 run): patch **P21 — 2.6 ha, rank 21/24 by area, degree 7 — is a cut vertex ranked #4 by criticality
(S = 0.204)**; the largest patch P01 (87.2 ha) ranks #1 (S = 0.404) and its exact removal lowers IIC by 40.4 %.
Both models predict ~370 ha of mangrove vs 102 ha in GMW — over-prediction consistent with their low precision.
Restoration candidates (marginal-probability components) are ranked by raw R_i; no cost data.
Files: `outputs/runs/kerala-coast/<run>/`.

## OUR EXPERIMENTAL RESULT

None yet. (`NOT YET RUN` — requires the UNB7 run on a CUDA GPU over the multi-area dataset.)

## Template for a real result

```
Metric:       Dice (habitat class)
Dataset:      ecoconnect_tiles  (S1 RTC + S2 L2A 2020, GMW 2020 weak labels)   [DATA_ROOT/…/metadata.json]
Split:        test (N tiles, spatial-block split seed 42)
Model:        UNB7 (efficientnet-b7)  /  dev: efficientnet-b0
Checkpoint:   outputs/segmentation/<exp>/best_model.pth
Experiment:   <exp>  (outputs/segmentation/<exp>/experiment.json)
Threshold:    0.5
Hardware:     …
Date:         …
Label:        DEVELOPMENT-SUBSET RESULT — NOT FINAL | OUR EXPERIMENTAL RESULT
Caveat:       agreement with a weak label (GMW), not field truth
```
`scripts/evaluate.py` writes all of these fields into `metrics.json` / `experiment.json` automatically.

## Four-landscape runs with the Kerala development model (2026-09-19) — DEVELOPMENT, NOT FINAL

The `kerala_E1_s1_b0_dev` checkpoint (EfficientNet-B0 U-Net, Sentinel-1 VV/VH only, trained on the Kerala
subset, calibrated threshold 0.70) was applied **without retraining** to the downloaded 2020 scenes of the
other three landscapes through `POST /api/segment`. These are real pipeline runs (scene → probability raster →
patches (MMU 2 ha) → graph k = 3, τ = 5 km → IIC/PC/ECA → exact criticality), but they are *transfer* results
of a small development model and must not be read as mangrove extent estimates: Sundarbans and Odisha are
grossly under-detected (the model has never seen delta-scale mangrove), which is exactly what the pending
four-area training (`scripts/phase2_all_areas.sh`) is meant to fix.

| Landscape | run | scene year | patches | links | components | habitat (ha) | ECA / habitat | threshold |
|---|---|---|---|---|---|---|---|---|
| kerala-coast | `kerala_E1_s1_b0_dev_2025_t0.70` | 2025 | 25 | 48 | 2 | 319.1 | 74.5 % | 0.7 |
| sundarbans | `sundarbans_kerala_E1_s1_b0_dev_ui_20260918T201317Z` | 2020 | 23 | 20 | 10 | 80.9 | 50.1 % | 0.7 |
| gulf-of-mannar | `gulf-of-mannar_kerala_E1_s1_b0_dev_ui_20260918T201304Z` | 2020 | 36 | 60 | 6 | 159.8 | 51.5 % | 0.7 |
| odisha-coast | `odisha-coast_kerala_E1_s1_b0_dev_ui_20260918T201251Z` | 2020 | 2 | 0 | 2 | 4.8 | 73.0 % | 0.7 |

No prototype/synthetic run exists in `outputs/runs` any more; the platform shows "no analysis yet" for a
landscape without a real run.
