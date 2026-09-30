# Machine learning — models, data, training, results

> **Status: research prototype.** Every segmentation number below is **agreement with Global Mangrove Watch (GMW)
> v3 2020 weak labels**, not field-truth accuracy. No model is validated. The **95.56 % overall accuracy belongs to
> the foundation study** (Ghorbanian et al., IEEE JSTARS 2025, UNB7) — it is not an EcoConnectAI result.

Detail that this page does not repeat: [TRAINING.md](TRAINING.md) (commands, loop, cloud mode),
[INFERENCE.md](INFERENCE.md) (sliding-window prediction), [DATASET_SETUP.md](DATASET_SETUP.md) (tile layout),
[PREPROCESSING.md](PREPROCESSING.md) (every preprocessing step), [MODEL_CARD.md](MODEL_CARD.md),
[EXPERIMENTS.md](EXPERIMENTS.md), [RESULTS_PROVENANCE.md](RESULTS_PROVENANCE.md). Pipeline context:
[GEOSPATIAL_PIPELINE.md](GEOSPATIAL_PIPELINE.md).

## 1. Model

`ecoconnect/ml/models/unet.py` → `build_model(encoder, in_channels, num_classes)` wraps
`segmentation_models_pytorch.Unet` (U-Net decoder with skip connections, decoder channels 256/128/64/32/16,
ImageNet encoder weights by default).

| Name | Encoder | Where configured | Parameters | Status |
|---|---|---|---|---|
| **UNB7** (foundation architecture) | `efficientnet-b7` | `configs/train_full*.yaml` | not measured here (TRAINING.md quotes 67.1 M) | **Not trained in this repository** (intended for a CUDA GPU, `notebooks/colab_train_unb7.ipynb`) |
| Development configuration | `efficientnet-b0` | `configs/train_dev*.yaml` | 6,251,181 (2 bands) · 6,252,909 (8) · 6,253,485 (10) — from `experiment.json` | the only encoder actually trained |
| Alternative (not baseline) | `swin-t` / `swin-s` via timm | alias in `ENCODER_ALIASES` | — | never trained |

Binary output (`num_classes: 1`, sigmoid). The encoder name is written into every checkpoint, `metrics.json` and
`experiments.csv`; `paper_name` is `"UNB7"` only for EfficientNet-B7.

## 2. Inputs (bands)

Acquisition writes one 10-band scene per area/year (`<area>_<year>_s12_10m.tif`); band order recorded in the
tiles' `metadata.json`:

| Index | Band | Source |
|---|---|---|
| 0, 1 | `s1_vv_db`, `s1_vh_db` | Sentinel-1 RTC γ⁰, temporal median, dB |
| 2–7 | `s2_blue`, `s2_green`, `s2_red`, `s2_nir`, `s2_swir16`, `s2_swir22` | Sentinel-2 L2A (B02 B03 B04 B08 B11 B12), SCL-masked median, reflectance 0–1 |
| 8, 9 | `s2_ndvi`, `s2_ndwi` | computed from the S2 composite |

`configs/dataset*.yaml → dataset.bands` selects the experiment: `[0, 1]` = **E1 (S1 only, the reported
configuration)**, `[2..9]` = E2 (S2 only, ablation), `null` = E3 (all 10 bands, early-fusion ablation — not the
paper's model). The `kerala-coast_development` experiment was trained on a 2-band S1-only 2025 scene.

## 3. Dataset

- **Labels:** GMW v3.0, year 2020 (Zenodo 6894273, CC-BY-4.0), reprojected nearest-neighbour onto the scene grid:
  1 = mangrove, 0 = not mangrove, 255 = outside GMW tile coverage / nodata (ignored by loss and metrics). This is
  **weak supervision** against an existing, imperfect map.
- **Tiles:** 256 × 256 px, **stride 128** (50 % overlap), `scripts/build_tiles.py` →
  `ecoconnect/geospatial/preprocessing/tiling.py`. Tiles with < 60 % valid pixels or < 50 % labelled pixels are
  skipped. Optional negative-tile subsampling (`--max-negative-ratio`; the Kerala E1–E3 and 4-area builds recorded
  `3.0`, the 2025 Kerala rebuild recorded `null`).
- **Split:** spatial blocks of 4 × 4 tile *indices*, fractions 0.70/0.15/0.15, seed 42 (recorded in every
  `experiment.json`).
- **Development caps** (`configs/dataset.yaml → development`): at most 800 train / 200 val / 200 test tiles, a
  seeded subset. The 4-area experiment hit the cap (800/195/200 — only 195 validation tiles existed).
- **Normalisation:** per-band z-score after 1–99 percentile clipping, fitted on at most 400 seeded **train** tiles,
  cached as `stats_bands-<bands>.json` next to the dataset.
- **Augmentation (train only):** h/v flips p = 0.5, rot90 p = 0.5, brightness jitter off.

## 4. Training configuration (as stored in every experiment's `config.yaml` / `experiment.json`)

| Setting | Development runs (all five stored) | Full / UNB7 config (never run) |
|---|---|---|
| Encoder | efficientnet-b0 | efficientnet-b7 |
| Epochs (max) / early-stopping patience | 40 / 12 | 60 / 10 |
| Optimiser, LR, weight decay | AdamW, 3e-4, 1e-4 | AdamW, 1e-4, 1e-4 |
| Loss | BCE + soft Dice, masked by `ignore_index` 255, **`pos_weight` 25** | BCE + Dice, no `pos_weight` |
| Schedule | cosine (η_min = 1 % of LR) | cosine |
| Batch size | 8 | 8 |
| Gradient clipping | 1.0 | 1.0 |
| Mixed precision | requested, only active on CUDA → `false` on the MPS runs | CUDA |
| Model selection | best validation IoU at threshold 0.5 | same |
| Hardware | Apple M3, MPS, torch 2.13.0, Python 3.14.3 | CUDA GPU (Colab/Kaggle) |

**Seeds.** `seed_everything(42)` seeds `random`, `numpy`, `torch` (and CUDA); the train DataLoader uses a
`torch.Generator` seeded 42; the split uses seed 42, negative subsampling seed 43, the development subset seed 42.
Bit-exact reproducibility has **not** been verified (MPS kernels, DataLoader workers, and the augmentation RNG
draws `random.randrange` per sample).

## 5. Results — built only from stored files

Source: `outputs/segmentation/<exp>/metrics.json` (`test` block, written by `scripts/evaluate.py`, threshold 0.5,
no TTA), `experiment.json`, and `threshold_calibration.json` where it exists. "Areas" = sources listed in the
experiment's tile metadata.

| Experiment | Bands | Areas (scene year) | Tiles train/val/test | Test IoU | Test F1 | Test P | Test R | Best val IoU (epoch) | Sweep-selected threshold | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| UNB7 (Ghorbanian et al. 2025) | S1 VV/VH time series | their data | — | — | — | — | — | — | — | **Foundation architecture — not trained here** (their 95.56 % OA, κ 0.94) |
| **multi_E1_s1_b0_dev** | [0, 1] S1 VV, VH | Kerala, Sundarbans, Gulf of Mannar, Odisha (2020) | 800 / 195 / 200 | **0.842** | **0.914** | 0.878 | 0.954 | 0.763 (32 of 40) | 0.70 (grid edge, test split) | Development model (reported configuration) |
| kerala_E1_s1_b0_dev | [0, 1] S1 VV, VH | Kerala (2020) | 176 / 32 / 48 | 0.023 | 0.045 | 0.033 | 0.072 | 0.078 (21 of 33) | 0.70 (grid edge, test split) | Development model |
| kerala_E2_s2_b0_dev | [2..9] S2 6 bands + NDVI + NDWI | Kerala (2020) | 176 / 32 / 48 | 0.054 | 0.102 | 0.063 | 0.279 | 0.286 (4 of 16) | 0.45 (test split) | Development model (ablation) |
| kerala_E3_s1s2_b0_dev | all 10 bands | Kerala (2020) | 176 / 32 / 48 | 0.053 | 0.101 | 0.066 | 0.209 | 0.250 (15 of 27) | none (no sweep file) | Development model (fusion ablation) |
| kerala-coast_development | [0, 1] S1 VV, VH | Kerala **2025** scene vs GMW **2020** labels | 176 / 32 / 48 | 0.031 | 0.061 | 0.056 | 0.066 | 0.067 (22 of 34) | none (no sweep file) | Development model (known-flawed, see §6) |

- **Experimental:** none (no `mode: full` run exists). **Validated:** none. The registry assigns `DEVELOPMENT` to
  every `mode: development` experiment (`backend/registry.py`); `VALIDATED` can only be set by a `state_admin`
  through `PATCH /api/models/{id}/status`, and has never been set.
- IoU/F1/P/R are for the habitat class (class 1). Overall accuracy is stored but meaningless here (Kerala test:
  0.998 while IoU is 0.023) because of class imbalance.
- The threshold sweep (`scripts/threshold_sweep.py`, grid 0.30–0.70) scores pixels in the **union** of test-tile
  footprints on the whole-scene probability raster, so its pixel counts differ from `evaluate.py`, which scores
  each (overlapping) tile separately. For multi_E1 the sweep reports F1 0.924 at 0.50 and 0.933 at 0.70; for
  kerala_E1 0.071 → 0.077. The sweep's chosen value is what the graph runs use (`…_t0.70`, `…_t0.45`).
- Parameters, runtime and epochs: `experiment.json` / `experiments.csv` (e.g. multi_E1: 1,777 s, 40 epochs).

### Where the 4-area score comes from

`multi_E1_s1_b0_dev/test_results.csv` (per tile) shows the 200 test tiles are 86 Sundarbans, 43 Kerala,
43 Odisha, 28 Gulf of Mannar. The model produced at least one true-positive pixel in 76/86 Sundarbans tiles,
9/28 Gulf of Mannar, 3/43 Odisha and **1/43 Kerala** tiles. Positives make up 18.8 % of the pooled test pixels
(2,467,029 of 13,105,072), almost all Sundarbans. **The 0.842 IoU is a Sundarbans-dominated number; it says
little about Kerala.** No per-area metrics file is stored.

## 6. Known data and methodology issues (open; audit bugs 20–25 in `docs/context/AUDIT_2026-09-27.md`)

1. **Tiling leakage risk (bug 21).** Tiles overlap by 128 px, but blocks are formed from tile indices, so a
   tile at the last index of one block and the first tile of the next block share 128 px. Train/val/test pixels
   can therefore overlap at block borders — the `tiling.py` docstring and DATASET_SETUP.md claim they cannot.
   Test scores may be optimistic.
2. **Threshold chosen on the test split (bug 22).** The selected 0.70 is the upper edge of the grid (F1 still
   rising); it is not an independent calibration.
3. **4-area tile set overwritten (bug 25 + context notes).** The 2026-09-20 Kerala-only rebuild replaced the
   `ecoconnect_tiles` set used by multi_E1; rasters, tiles and checkpoints are gitignored. The multi_E1 result is
   **not reproducible from the repository alone**. Appending areas also overwrites `metadata.json` CRS/split
   fields (multi_E1's metadata records EPSG:32645 although Kerala is EPSG:32643).
4. **Kerala has very few positives.** Kerala test tiles contain 1,822 GMW-mangrove pixels out of 3,143,564
   labelled pixels (≈ 0.06 %); validation 16,668 of 2,090,016. Mangroves there are 1–3 px fringes. Kerala-only
   scores are therefore both low and statistically fragile (one test tile with any true positive for E1).
5. **Normaliser cache (bug 20).** The cache file is keyed by band subset only, not by dataset content:
   `kerala-coast_development` reused multi_E1's statistics (identical mean/std in both `experiment.json`,
   `n_tiles` 400).
6. **Image/label year mismatch (bug 24).** `kerala-coast_development` trained on a 2025 S1 scene against 2020
   labels; nothing in the code prevents this.
7. **Evaluation re-fits the normaliser (bug 23).** `evaluate.py` rebuilds the dataset and ignores the
   checkpoint's stored normaliser; `--tta` only affects the sample panels, never the stored metrics.
8. Confidence values are mean sigmoid probabilities and are **not calibrated**.

These need new experiments (fixed tiling, validation-split threshold, rebuilt 4-area tiles), not code patches —
see `docs/context/ROADMAP.md`.
