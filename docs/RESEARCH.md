# Research overview

## Questions
1. Can Sentinel-1 radar (cloud-independent) map coastal mangrove patches well enough to build a habitat network?
2. Which patches hold the network together, and does the answer survive changes in modelling assumptions?
3. Where would restoration most improve structural connectivity?
4. Can every such result be traced to its data and parameters, and recomputed?

## Methods (implemented)
- Segmentation: U-Net / EfficientNet-B0 (dev), spatial-block splits, BCE + Dice, threshold sweep (`ecoconnect/ml/`).
- Patches: threshold, 8-connectivity, 2 ha minimum mapping unit (`ecoconnect/geospatial/`).
- Graph: k-NN within τ km; IIC, PC, ECA; exact leave-one-out criticality; cut vertices (`ecoconnect/graph/`).
- Sensitivity: τ × k grid with Spearman, Kendall τ-b, top-k Jaccard (`ecoconnect/graph/sensitivity.py`).
- Restoration: candidate insertion gain R = C(G+v) − C(G).
- Reproducibility: manifests with config hash, git commit, input hashes; reproduce job diffs every result.

## Results to date (all DEVELOPMENT, vs GMW weak labels)
| Result | Value | Source |
|---|---|---|
| 4-area S1 B0 model, test | IoU 0.842, F1 0.914, P 0.878, R 0.954 | `outputs/segmentation/multi_E1_s1_b0_dev/metrics.json` |
| Kerala-only models, test | IoU 0.023–0.054 (weak) | `docs/RESULTS_PROVENANCE.md` |
| Kerala P17 | 3.13 ha, #17 by area, #3 by criticality, cut vertex, −27.0 % IIC if removed | `outputs/runs/kerala-coast/kerala-coast_20260920T182222Z/` |
| Kerala sensitivity (τ 3/5/8 × k 2/3/4) | ρ ≥ 0.96 across τ at k = 3; ρ ≈ 0.67 at k = 2; P17 rank #2–#20 | Scenario Lab `sensitivity` |
| Paper Tables VI–VIII | reproduced exactly from synthetic geometry | `tests/test_regression.py` |

## Open experiments (need compute or data, not code)
- Fix tile-overlap leakage and threshold-on-test (audit bugs 20–28) and re-run the 4-area model.
- Train UNB7 (EfficientNet-B7) on a GPU; S2 and S1+S2 at 4-area scale; probability calibration.
- Same-model multi-year inference (2020–2025) for honest temporal change.
- Independent validation data (field survey) — the only route to a VALIDATED model status.
- Field verification of cut-vertex patches; user study with GIS / forest officers.

## Citation
If you use this work, cite the project repository and the data sources: Sentinel-1/2 (Copernicus), Global Mangrove
Watch v3.0 (Bunting et al., Zenodo 6894273), and the connectivity indices (Pascual-Hortal & Saura 2006; Saura &
Pascual-Hortal 2007). Limitations: `docs/LIMITATIONS.md`.
