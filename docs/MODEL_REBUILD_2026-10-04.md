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

The checkpoint (`outputs/segmentation/multi_E1_s1_b0_dev_r2/best_model.pth`, 72 MB) is still git-ignored. Keep a copy
outside this folder (e.g. a GitHub release asset or cloud drive); losing it again means repeating this rebuild.
