# Model cards

Served live at `GET /api/model-cards` and on the Models page. Categories are never mixed.

## FOUNDATION PAPER RESULT — NOT OURS
UNB7 (Ghorbanian et al., IEEE JSTARS 2025): U-Net + EfficientNet-B7 on Sentinel-1 time series, weakly supervised; OA 95.56 %, κ 0.94, F1 0.95 on their data. Not reproduced here.

## PROTOTYPE / DEMONSTRATION
No model. Deterministic synthetic patch geometry; only site metadata is real.

## OUR MODELS (development — NOT FINAL)
| Name | Architecture | Input bands | Training data | Label source | Validation | Test IoU / Dice / P / R (vs GMW) | Known limitations | Version / trained |
|---|---|---|---|---|---|---|---|---|
| kerala_E1_s1_b0_dev | U-Net + EfficientNet-B0 | S1 VV, VH | Kerala 2020, 176/32/48 spatial-block tiles | GMW v3 2020 (weak) | held-out test tiles, threshold 0.70 (calibrated) | 0.023 / 0.045 / 0.033 / 0.072 | weak labels; 0.2 % positives; single area; dev encoder; no field validation | 2026-09-18, Apple M3 MPS |
| kerala_E2_s2_b0_dev | same | S2 6 bands + NDVI/NDWI | same | same | threshold 0.45 | 0.054 / 0.102 / 0.063 / 0.279 | ablation, not the paper's model | same |
| kerala_E3_s1s2_b0_dev | same | S1 + S2 | same | same | threshold 0.50 | 0.053 / 0.101 / 0.066 / 0.209 | fusion ablation, unvalidated | same |
| multi_E1_s1_b0_dev | same | S1 VV, VH | Kerala + Odisha + Gulf of Mannar | same | — | NOT YET RUN | — | pending download chain |
| UNB7 final | U-Net + EfficientNet-B7 | S1 VV, VH | all four areas | same | — | NOT YET RUN (GPU) | — | `notebooks/colab_train_unb7.ipynb` |

All metrics are agreement with the Global Mangrove Watch reference map, not field-truth accuracy. Deployment date: none — development models only.
