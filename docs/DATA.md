# Data

| Data | Source | Licence / terms | In git? | How to get it |
|---|---|---|---|---|
| Sentinel-1 RTC γ⁰ (VV, VH) | Microsoft Planetary Computer (STAC) | Copernicus open licence | no | `scripts/acquire_study_area.py` |
| Sentinel-2 L2A (B2–B4, B8, B11, B12 + NDVI/NDWI) | Earth Search (STAC) | Copernicus open licence | no | same script |
| Global Mangrove Watch v3.0 (2020) | Zenodo record 6894273 | CC BY 4.0 — cite Bunting et al. | no | same script (tiles named by **north** edge) |
| Study-area boundaries | `configs/study_areas.yaml` | project config | yes | — |
| Pipeline runs (patches, graph, criticality, restoration, manifests) | produced by this repo | project | **yes** (`outputs/runs/`) | `scripts/run_graph_analysis.py` |
| Segmentation metrics, curves, sample predictions | produced by this repo | project | yes (`outputs/segmentation/*/` JSON/PNG) | `scripts/train.py`, `evaluate.py` |
| Scene rasters, probability rasters, checkpoints (`.tif`, `.pth`) | produced locally | — | **no** (size) | re-run acquisition / training |
| Field evidence photos, application database | created in the app | contains personal data (GPS, officer names) | no | — |

Notes
- Labels are **weak** (a reference map), so all segmentation metrics measure agreement with GMW, not field truth.
- The 4-area tile set used for `multi_E1_s1_b0_dev` was overwritten on 2026-09-20; recreate with
  `scripts/run_all_areas.py` after acquisition.
- Grids: scenes are reprojected to a snapped UTM 10 m grid per area (EPSG:32643 Kerala, 32645 Sundarbans/Odisha …).
- Detailed procedures: `DATASET_SETUP.md`, `PREPROCESSING.md`, `DATA_PROVENANCE.md`, `RESULTS_PROVENANCE.md`.
