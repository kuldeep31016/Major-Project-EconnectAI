# Experiments

## Registry

`outputs/segmentation/experiments.csv` — one row per training run: experiment_id, timestamp, mode,
result_label, dataset, train/val/test tiles, model, encoder, batch_size, learning_rate, epochs_run, seed,
device, training_time_s, best_epoch, val IoU/Dice/P/R/F1. Per-run detail in `<exp>/experiment.json`,
`metrics.json`, `history.csv`, `test_results.csv`, `confusion_matrix.png`, `sample_predictions/`.

Graph-analysis runs: `outputs/runs/<area>/<run_id>/manifest.json`.

## Locked decisions (2026-09-18)

Dataset **B** (S1 + S2 + GMW weak labels, four paper study areas, Kerala first) · binary mangrove/non-mangrove ·
**S1-only is the reported model**, S2 and S1+S2 are ablations · B0 = development, UNB7 = final (GPU) · τ = 5 km
reference with 3/5/8 km sensitivity, no invented species · threshold calibrated by sweep, MMU 2 ha ·
no fabricated costs · interface score demoted · timeline and polygon scenarios real, other scenarios labelled demo.

## Experimental hierarchy

| Exp. | Question | Config | Output |
|---|---|---|---|
| **E1** primary | S1 VV/VH → UNB7 → mangrove probability | `configs/train_full.yaml` (dev: `train_dev.yaml`), `dataset.yaml` bands `[0,1]` | `outputs/segmentation/<exp>/metrics.json` |
| **E2** ablation | S2 only | `train_full_s2.yaml` / `train_dev_s2.yaml` | same |
| **E3** ablation | S1 + S2 early fusion (**not** the paper's model) | `train_full_s1s2.yaml` / `train_dev_s1s2.yaml` | same |
| **Exp. 2** | threshold 0.30 → 0.70 vs GMW on held-out test tiles | `scripts/threshold_sweep.py` | `<exp>/threshold_calibration.{json,csv,png}` |
| **Exp. 3** | τ ∈ {3, 5, 8} km ranking stability | automatic in every run | `outputs/runs/<area>/<run>/tau_sensitivity.json` |
| **Exp. 4** | criticality ΔC_i, S_i per patch | automatic | `criticality.csv` |
| **Exp. 5** | restoration R_i (Priority_i only with a user cost CSV) | automatic | `restoration.csv` |
| **Timeline** | 2020 vs later-year imagery → mask difference | second acquisition + run; `GET /api/runs/<area>/timeline` | UI timeline |

All segmentation metrics are agreement with GMW (weak label), never field-truth accuracy. IIC/PC are not
compared across AOIs of different size; ECA % of habitat is used for cross-area statements.

## Executed so far

| Experiment | Status | Label |
|---|---|---|
| Graph analysis over prototype geometry, 4 areas (`prototype_synthetic`) | done 2026-09-18 | PROTOTYPE / SYNTHETIC RESULT |
| Kerala acquisition (S1 RTC ×6, S2 L2A ×4, GMW 2020) | in progress 2026-09-18 | data |
| E1 dev (B0, Kerala) | **NOT YET RUN** | — |
| E1 final (UNB7, GPU) | **NOT YET RUN** | — |
| E2 / E3 | **NOT YET RUN** | — |

Numbers that exist today and what they mean are listed in `docs/RESULTS_PROVENANCE.md`.
