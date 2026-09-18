# Experiments

## Registry

`outputs/segmentation/experiments.csv` — one row per training run: experiment_id, timestamp, mode,
result_label, dataset, train/val/test tiles, model, encoder, batch_size, learning_rate, epochs_run, seed,
device, training_time_s, best_epoch, val IoU/Dice/P/R/F1. Per-run detail in `<exp>/experiment.json`,
`metrics.json`, `history.csv`, `test_results.csv`, `confusion_matrix.png`, `sample_predictions/`.

Graph-analysis runs: `outputs/runs/<area>/<run_id>/manifest.json`.

## Planned first real experiment (§6 of IMPLEMENTATION_AUDIT)

1. One study area (Vembanad–Kol or Bhitarkanika), one S1+S2 2020 composite, GMW 2020 weak labels.
2. `build_tiles` 256², stride 128 → ≈ 280 tiles, 70/15/15 spatial-block split.
3. `train_dev.yaml` (B0, 15 epochs) on MPS — pipeline validity: loss decreases, masks align, patches
   extract, graph builds, UI shows the run. Label: DEVELOPMENT-SUBSET — NOT FINAL.
4. Then `train_full.yaml` (UNB7) on a CUDA GPU over all four areas → OUR EXPERIMENTAL RESULT.
5. Band ablation: S1-only (paper baseline) vs S2-only vs S1+S2 (fusion, experimental).
6. τ ∈ {3,5,8} km criticality-ranking stability on real patches (already automatic in every run).

## Executed so far

| Experiment | Status | Label |
|---|---|---|
| Graph analysis over prototype geometry, 4 areas (`prototype_synthetic`) | done 2026-09-18 | PROTOTYPE / SYNTHETIC RESULT |
| Segmentation training | **NOT YET RUN** (dataset pending) | — |
| Real-patch connectivity / criticality / restoration | **NOT YET RUN** | — |

Numbers that exist today and what they mean are listed in `docs/RESULTS_PROVENANCE.md`.
