# Dataset setup

**Rule 1: inspect before coding.** `python scripts/inspect_dataset.py --path <dir>` prints file types, counts,
shapes, bands, dtypes, value ranges, CRS, mask classes and split sizes for any folder. No loader code should be
written against a dataset before its output has been read.

**Rule 2: nothing personal is hard-coded.** The dataset location is `DATA_ROOT` (env / `.env`). Datasets are
git-ignored (`data/`).

## Canonical tile layout (what `ecoconnect/ml/datasets` reads)

```
${DATA_ROOT}/<dataset.name>/
  metadata.json            bands, nodata, ignore_index, classes, crs, pixel_size, split strategy, sources
  tiles/images/<id>.tif    (C, H, W) float32 GeoTIFF, georeferenced
  tiles/masks/<id>.tif     (H, W) uint8: 0 non-habitat, 1 habitat, 255 ignore/unlabelled
  splits/train.txt  val.txt  test.txt     one tile id per line
  stats.json               per-band mean/std/percentiles fitted on the TRAIN split (auto-generated)
```

Any dataset can be adapted to this layout. Two producers exist:

### Path B — build it from public satellite data + weak labels (paper methodology)

```bash
export DATA_ROOT=/path/with/space
python scripts/acquire_study_area.py --study-area kerala-coast          # S1 RTC + S2 L2A + GMW 2020
python scripts/build_tiles.py --image data/scenes/kerala-coast/kerala-coast_2020_s12_10m.tif \
                              --label data/labels/kerala-coast/gmw_2020.tif \
                              --bands s1_vv_db,s1_vh_db,s2_blue,s2_green,s2_red,s2_nir,s2_swir16,s2_swir22,s2_ndvi,s2_ndwi \
                              --tile 256 --stride 128
# repeat with --append for other study areas to build a multi-AOI dataset
```

Sources (all verified reachable, no credentials):

| Data | Source | Licence | Size / AOI (~22 km) |
|---|---|---|---|
| Sentinel-2 L2A B02 B03 B04 B08 B11 B12 + SCL | Element84 Earth Search STAC (AWS COGs) | Copernicus free & open | streamed; ~40 MB written |
| Sentinel-1 RTC γ⁰ VV, VH | Microsoft Planetary Computer STAC | Copernicus free & open | streamed; ~20 MB written |
| Mangrove extent 2020 (weak label) | Global Mangrove Watch v3.0, Zenodo 6894273 | CC-BY-4.0 | 66 MB zip once, tiles extracted |

**Labels are weak.** GMW is an existing, imperfect published map — precisely the "weak supervision against an
existing map" regime of the foundation study. Metrics against GMW measure agreement with that map, not with
field truth, and are reported as such.

**Band selection = experiment definition.** The scene stores S1 and S2 together; `configs/dataset.yaml → bands`
picks the model input:
* `[0, 1]` S1 VV/VH only — **paper baseline (SAR drives segmentation)**
* `[2..9]` S2 only — complementary optical experiment
* all — S1+S2 early fusion — **experimental, unvalidated; the paper explicitly does not claim fusion**

### Path A — you supply a dataset

1. `python scripts/inspect_dataset.py --path <dataset>` and read the output.
2. Write an adapter that produces the canonical layout (usually 30–60 lines: read image, read mask, remap
   classes, write GeoTIFF pairs, write split files). Put it in `scripts/adapters/<name>.py`.
3. Set `dataset.name`, `bands`, `num_classes`, `ignore_index` in `configs/dataset.yaml`.

## Splits

`build_tiles.py` splits by **spatial block** (default 4×4 tiles), not by random tile shuffle, so overlapping
tiles never straddle train and test. Fractions default to 70/15/15, seed 42. Train/val/test tile counts are
recorded in `experiment.json` of every run.

## Modes

| | DEVELOPMENT (`development:` in dataset.yaml) | FULL (`full:`) |
|---|---|---|
| tiles | ≤ 300 / 80 / 80 (seeded subset) | all |
| encoder | EfficientNet-B0 (resource-driven) | EfficientNet-B7 = UNB7 |
| label on every output | DEVELOPMENT-SUBSET RESULT — NOT FINAL | OUR EXPERIMENTAL RESULT |

## Storage budget

A 22 × 22 km AOI at 10 m → ~2200² px. Scene (10 bands float32, deflate) ≈ 60–150 MB; 256² tiles at stride 128
≈ 280 tiles ≈ 300 MB uncompressed. Four study areas fit in < 2 GB. Never extract the full GMW zip (~1.5 GB); the
loader extracts only the intersecting 1° tiles.
