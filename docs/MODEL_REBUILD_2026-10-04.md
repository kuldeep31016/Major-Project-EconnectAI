# Model rebuild — 2026-10-04 (`multi_E1_s1_b0_dev_r2`)

## Why

The trained checkpoint of the reported model `multi_E1_s1_b0_dev` (trained on this Mac on 2026-09-18) was lost: it was
git-ignored (`outputs/**/*.pth`), the project folder was re-cloned from GitHub on 2026-09-27, and the old folder
(with `data/` and the checkpoint) was deleted and the Trash emptied. No backup existed (no Time Machine, no release).
The near-real-time satellite layer needs a checkpoint for inference, so the model was rebuilt.

## How (same recipe, new experiment id)

- `outputs/rebuild/acquire_all.sh`: re-acquired the 2020 data for the 4 study areas with `scripts/acquire_study_area.py`
  (Sentinel-1 RTC temporal median, 8 scenes, Planetary Computer; Sentinel-2 L2A median, Earth Search; GMW v3 2020
  labels from Zenodo). No credentials.
- `outputs/rebuild/train_all.sh`: `scripts/run_all_areas.py` tiles -> train -> evaluate -> sweep with
  `configs/train_dev.yaml`, identical to the original `config.yaml` (U-Net EfficientNet-B0, S1 VV/VH, 40 epochs,
  lr 3e-4, bce_dice with pos_weight 25, cosine schedule, seed 42), torch 2.13.0 on Apple MPS.
- New id `multi_E1_s1_b0_dev_r2` so the stored runs `<area>_multi_E1_s1_b0_dev_t0.70` and their provenance are not
  overwritten. The `analyse` stage (which would rewrite those runs) was not run.

## Fixes applied with the rebuild (audit 2026-09-27)

- Bug 20: the normaliser cache is now keyed by a fingerprint of the training split (stale statistics can no longer be
  reused for a different tile set).
- Bug 22: the threshold is selected on the **validation** split and the test split is reported once at that threshold;
  grid extended to 0.99 (the old sweep stopped at 0.70 with F1 still rising).
- Bug 23: `evaluate.py` uses the checkpoint's normaliser and scores the TTA probabilities when `--tta` is set.

## Results (development subset; agreement with GMW weak labels, not field accuracy)

| | original `multi_E1_s1_b0_dev` (lost) | rebuilt `multi_E1_s1_b0_dev_r2` |
|---|---|---|
| tiles train / val / test | 800 / 195 / 200 | 800 / 195 / 200 |
| normaliser mean VV / VH | -11.33 / -17.60 dB | -11.24 / -17.52 dB |
| best epoch (val IoU) | 32 (0.763), 40 epochs run | 19 (0.715), early stop after 31 |
| test @ 0.5: IoU / F1 / P / R | 0.842 / 0.914 / 0.878 / 0.954 | 0.788 / 0.882 / 0.807 / 0.972 |
| threshold (selection split) | 0.70 (test split, grid edge) | **0.97 (validation split, interior optimum)** |
| held-out test at the selected threshold | — | **IoU 0.873, F1 0.932, P 0.936, R 0.929** |

Same data and configuration; the run is weaker at threshold 0.5 (MPS training is not bit-reproducible and early
stopping triggered earlier). The high threshold reflects pos_weight 25 pushing probabilities up.

Per study area (2020 whole scene incl. training tiles, threshold 0.97): Sundarbans IoU 0.913, Odisha 0.724, Gulf of
Mannar 0.008, Kerala 0.000 (`outputs/segmentation/multi_E1_s1_b0_dev_r2/area_reliability.json`). The model maps the
large Sundarbans and Bhitarkanika mangroves well and cannot map the thin Kerala / Gulf of Mannar fringes.

## Keep it safe

The checkpoint (`outputs/segmentation/multi_E1_s1_b0_dev_r2/best_model.pth`, 72 MB) is git-ignored. It is backed up as
the GitHub release **`model-multi_E1_s1_b0_dev_r2`** (public; with calibration, config, metrics, reliability and
`SHA256SUMS.txt`). SHA-256 `ed97c3612a94b293207c2473e1d648d0d5d25df6ca4076388d6563b01621a2b8`; restore tested 2026-10-04.

```
gh release download model-multi_E1_s1_b0_dev_r2 -R kuldeep31016/Major-Project-EconnectAI -p best_model.pth \
    -D outputs/segmentation/multi_E1_s1_b0_dev_r2
shasum -a 256 outputs/segmentation/multi_E1_s1_b0_dev_r2/best_model.pth
```
Back up every future checkpoint the same way before deleting or retraining anything.

## r3 — leakage-free split (audit bug 21), now the near-real-time default

**Problem.** Tiles are 256 px placed every 128 px, and the split assigned whole 4x4-stride blocks: a tile at the edge of a
training block overlapped the neighbouring validation/test block by 128 px, so some test pixels were seen in training.
A plain random block split also left almost no mangrove in the validation/test tiles outside the Sundarbans (Gulf of
Mannar validation: 0 mangrove pixels), so per-area accuracy could not be measured at all.

**Fix (standard spatial cross-validation practice).** `scripts/resplit_buffered.py --stratify --strat-block-tiles 6`
(no re-tiling; same tile files): blocks of 6x6 strides; per study area, blocks sorted by GMW mangrove pixels are dealt
greedily so train/val/test each get ~70/15/15 % of that area's mangrove; every tile that reaches into a block of a
different split is excluded (`tiling.boundary_crossing`; `build_tiles(..., buffer_split_boundaries=True)` does the same
for new datasets). Result `data/ecoconnect_tiles_buf`: train/val/test 704/167/294 tiles (208 boundary tiles excluded).
Training: `outputs/rebuild/train_r3.sh` (`configs/train_dev_buf.yaml`, otherwise identical to r2; best epoch 36).
`scripts/threshold_sweep.py` now also selects a threshold per study area on that area's validation tiles when they hold
>= 2,000 mangrove pixels (else the pooled threshold) and reports each area's held-out test score.

| `multi_E1_s1_b0_dev_r3` (agreement with GMW 2020) | value |
|---|---|
| held-out test @0.5: IoU / F1 / P / R | 0.670 / 0.802 / 0.673 / 0.992 |
| threshold (pooled, validation split) | 0.96 (Odisha 0.92 on its own validation tiles) |
| held-out test @0.96, pooled: IoU / F1 / P / R | **0.776 / 0.874 / 0.806 / 0.956** |
| held-out test per area | Sundarbans **0.925**, Odisha **0.318**, Kerala 0.000, Gulf of Mannar 0.000 (666 / 482 reference px on test tiles: too few to score) |
| real 2026 NRT scenes (8-pass median) vs GMW 2020 | Sundarbans 0.902 (Copernicus input) / 0.876 (Planetary Computer); Odisha 0.610 / 0.622 |
| r2 on the same 2026 scenes (for comparison) | Sundarbans 0.884 / 0.861; Odisha 0.651 / 0.676 |

The r3 pooled score is lower than r2's 0.873 because r2's test tiles overlapped its training tiles; r3's is the honest
number. Odisha is the clearest case: r2's 0.724 included training tiles; on Odisha blocks it never saw, r3 scores 0.318
(it over-predicts there), so Odisha is now labelled unreliable. **Decision:** r3 is the near-real-time default
(`backend/satellite/preprocessing.MODEL_EXPERIMENTS`), because it is the only model with a leakage-free evaluation;
r2 stays selectable with `SATELLITE_MODEL_EXPERIMENT=multi_E1_s1_b0_dev_r2`. Stored dashboard runs are unchanged.
Backup: GitHub release **`model-multi_E1_s1_b0_dev_r3`**, SHA-256
`d79847742f0065eeed5f7aea9501c856cfb030c89be7536a51460ac8b28d9884` (restore tested 2026-10-04).

## E3 — Sentinel-1 + Sentinel-2 fusion on the same leakage-free split (experiment, not deployed)

`multi_E3_s1s2_b0_dev_r3` (`configs/train_dev_buf_s1s2.yaml`, `outputs/rebuild/train_e3.sh`): identical to r3 but all
10 bands (S1 VV/VH + S2 blue, green, red, nir, swir16, swir22, NDVI, NDWI). Backup: release
`model-multi_E3_s1s2_b0_dev_r3`, SHA-256 `4cf9f8c8a531eb447d8ffb4242c6f615177d5317c0965770a21b230c2631735b` (restore tested).

| Agreement with GMW 2020 | S1-only r3 | S1+S2 E3 |
|---|---|---|
| held-out test 2020, pooled IoU (threshold 0.96) | 0.776 | **0.859** |
| held-out test 2020, Sundarbans / Odisha | 0.925 / 0.318 | **0.948 / 0.441** |
| held-out test 2020, Kerala / Gulf of Mannar | 0.000 / 0.000 | 0.000 / 0.002 |
| **real 2026 input**, Sundarbans (S1 8-pass median + S2 Apr–Sep 2026 median, 6 least-cloudy scenes per granule, 100 % valid) | **0.876** | 0.637 (P 0.98, R 0.64) |
| **real 2026 input**, Odisha | **0.622** | 0.577 (P 0.90, R 0.62) |

Fusion is better on the 2020 test tiles but clearly worse on current imagery: it misses a third of the mangrove.
The model learned the optical appearance of a 2020 yearly least-cloudy composite; a 2026 composite (other season,
monsoon green-up, other year) looks different (domain shift). **Decision: the near-real-time default stays S1-only r3.**
The fix is to train on composites built like the near-real-time input (several seasons and years), then re-test on
current data — STATUS P1 "train for the input we actually use".
