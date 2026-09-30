# Geospatial pipeline — from AOI to habitat graph

> Research prototype. Every step below exists in code; where a check is **missing** it is listed as missing.
> Step detail lives in [PREPROCESSING.md](PREPROCESSING.md), [GEE_SETUP.md](GEE_SETUP.md),
> [DATASET_SETUP.md](DATASET_SETUP.md), [DATA.md](DATA.md), [INFERENCE.md](INFERENCE.md); models in [ML.md](ML.md);
> graph maths in [CONNECTIVITY.md](CONNECTIVITY.md).

```
AOI (configs/study_areas.yaml bbox)
 └─ TargetGrid: UTM zone of AOI centre, 10 m, snapped origin           ecoconnect/gee/stac_acquire.py
     ├─ Sentinel-1 RTC (Planetary Computer STAC) → γ⁰ → dB → temporal median
     ├─ Sentinel-2 L2A (Earth Search STAC) → SCL mask → BOA offset → median → NDVI/NDWI
     └─ GMW v3 2020 (Zenodo zip) → 1° tiles → mosaic → nearest onto grid  ecoconnect/gee/gmw_labels.py
 └─ scene GeoTIFF (10 bands, nodata −9999) + label GeoTIFF (0/1/255)    scripts/acquire_study_area.py
 └─ tiling 256 px / stride 128, spatial-block split                     scripts/build_tiles.py → tiling.py
 └─ training / evaluation                                               scripts/train.py, evaluate.py
 └─ inference: sliding window 256, overlap 64, Hann blend               scripts/predict.py → ml/inference/predict.py
 └─ probability raster (float32, NaN nodata) + confidence + binary@thr
 └─ threshold (p ≥ t) → mask → connected components (8-connectivity)    geospatial/patch_extraction/extract.py
 └─ MMU 2 ha filter → patch attributes (area, centroid, mean p, polygon)
 └─ marginal band [0.30, t) → restoration candidates (≥ 1 ha, top 12)   pipeline/sources.py
 └─ graph (k-NN, τ) → IIC/PC/ECA → criticality → what-if → restoration  pipeline/analysis.py
 └─ outputs/runs/<area>/<run_id>/  + LATEST pointer                     scripts/run_graph_analysis.py
```

## 1. AOI and grid

- AOIs are bounding boxes in `configs/study_areas.yaml` (`min_lat, min_lon, max_lat, max_lon`), overridable with
  `--bbox`.
- `TargetGrid.for_aoi` picks the **UTM zone of the AOI centre** (`utm_epsg_for`, EPSG:326xx north / 327xx south),
  transforms the bbox, snaps `minx`/`maxy` to the 10 m lattice and derives width/height. Every source is
  reprojected onto this one grid, so S1, S2 and labels align pixel-for-pixel. Recorded grids: Kerala
  EPSG:32643 (2203 × 2221 px for the LATEST run), Sundarbans/Odisha EPSG:32645.

## 2. Acquisition (`scripts/acquire_study_area.py`, `configs/acquisition.yaml`)

| Source | Access | Processing in code |
|---|---|---|
| Sentinel-1 RTC γ⁰ VV, VH | Microsoft Planetary Computer STAC, collection `sentinel-1-rtc`, assets signed anonymously with `planetary_computer.sign` | items sorted by date and thinned evenly to `max_scenes_s1` (config default 8; the Kerala 2020 log records 6); optional orbit filter (default `any`); bilinear reprojection; values ≤ 0 → NaN; `10·log10` → dB; per-pixel `nanmedian` |
| Sentinel-2 L2A B02 B03 B04 B08 B11 B12 + SCL | Element84 Earth Search STAC, `sentinel-2-l2a`, scene cloud < 40 % | per-MGRS-granule selection: drop granules with < 2 % AOI overlap, greedy coverage until ≥ 98 % of the AOI, drop partial granules (< 60 % of the best overlap), one item per date, least-cloudy `max_scenes_s2` (6) per granule; SCL classes 0,1,2,3,8,9,10,11 → NaN; DN ≤ 0 → NaN; subtract 1000 when baseline ≥ 04.00 and the offset was not applied; median; ÷ 10000; NDVI, NDWI |
| GMW v3.0 2020 | Zenodo record 6894273, 66 MB zip cached once | only 1° tiles intersecting the AOI are extracted (**named by the northern edge**), merged, reprojected nearest; pixels outside tile coverage = 255 |

All remote reads are **windowed COG reads** (GDAL `/vsicurl`, 4 MB chunks, HTTP/2, multi-range) with 4 retries
and exponential back-off (2/4/8/16 s). Optional Earth Engine path: `ecoconnect/gee/gee_acquire.py`
([GEE_SETUP.md](GEE_SETUP.md)); not used for any stored result.

Output: `${DATA_ROOT}/scenes/<area>/<area>_<year>_{s1,s2,s12}_10m.tif` (float32, nodata −9999, band descriptions)
with a `.json` sidecar (date range, scenes used, valid fraction), and `${DATA_ROOT}/labels/<area>/gmw_2020.tif`
+ `.json` (tiles, mangrove fraction of labelled pixels, labelled fraction).

## 3. Preprocessing and temporal compositing

Temporal **median** for both sensors (S1: speckle reduction over the time series; S2: cloud-gap filling). No
terrain correction beyond what RTC provides, no speckle filter, no co-registration step beyond reprojection. Full
table: [PREPROCESSING.md](PREPROCESSING.md).

## 4. Tiling, training, inference

Tiling/splits/normalisation/training: [ML.md](ML.md) §3–4. Inference (`predict_scene`): the scene bands listed in
the checkpoint are read, nodata masked, normalised with the **checkpoint's** normaliser, reflect-padded, predicted
in 256 px windows with 64 px overlap and blended with a Hann weight (floor 0.05). Writes `<name>_prob.tif`
(float32, NaN = nodata), `<name>_confidence.tif` (`|p − 0.5|·2`), `<name>_binary_t<thr>.tif` (uint8, 255 nodata)
and `<name>_prob.json` (checkpoint, scene, threshold, valid fraction). Probability rasters are **not in git**;
only the `.json` sidecars are.

## 5. Threshold → mask → patches (`extract_patches`)

1. `binary = (p ≥ threshold) & valid` (valid = finite, optionally a supplied mask). Threshold is an explicit
   argument: `--threshold`, else `SEGMENTATION_THRESHOLD`, else 0.5 (`scripts/run_graph_analysis.py`). Stored
   runs use the sweep's value in the run id (`…_t0.70`).
2. `scipy.ndimage.label` with the **8-connectivity** structure (4 is also accepted).
3. Component area = sum of per-pixel areas (`pixel_area_ha`: projected CRS → |a·e|; geographic →
   latitude-dependent).
4. **MMU 2 ha** (`--mmu-ha`, = 200 pixels at 10 m): smaller components are dropped and counted
   (`n_dropped_below_mmu`).
5. Kept components are vectorised (`rasterio.features.shapes`), unioned, simplified by 10 m in the local UTM zone,
   and exported in WGS84.
6. **Patch attributes** (`ecoconnect/graph/types.py::Patch`): `id` `P01…` **by descending area, per run**;
   `area_ha`; `centroid` (lat, lon) = pixel centre of mass; `confidence` = mean probability in the component;
   `quality` = confidence (used only in the displayed edge weight); `perimeter_km`; `bbox`; GeoJSON geometry;
   `pixel_count`.
7. `ExtractionReport` (stored in `manifest.json → data_source.extraction_report`): threshold, MMU, connectivity,
   component counts, habitat/valid pixels, coverage %, habitat area, **landscape area A_L = area of valid
   pixels**, mean confidence, CRS.

Kerala LATEST (`kerala-coast_multi_E1_s1_b0_dev_t0.70`): 56 components at t = 0.70, 44 below 2 ha, **12 patches**,
204.58 ha habitat, A_L = 48,928.63 ha, coverage 0.46 % of valid pixels, mean confidence 0.84.

## 6. Candidates and graph

Restoration candidates: components of the probability band `candidate_threshold ≤ p < threshold`
(0.30 by default), ≥ 1 ha, 8-connectivity, largest 12 kept — see [RESTORATION.md](RESTORATION.md). Graph and
indices: [CONNECTIVITY.md](CONNECTIVITY.md). `pipeline/analysis.py::run_graph_analysis` writes manifest, patches,
graph, metrics, criticality, explanations, restoration, what-if, τ sensitivity, frontend bundle, and moves
`LATEST` unless `--no-latest`.

## 7. CRS handling summary

| Stage | CRS |
|---|---|
| Scene, labels, tiles, probability raster | per-AOI UTM (metres), 10 m |
| Patch areas | from raster pixel areas (projected grid area) |
| Polygon simplification / perimeter | local UTM zone of each patch centroid |
| Exported polygons, centroids, graph distances | WGS84; distances = haversine great-circle km |
| Patch tracking between runs | EPSG:6933 (equal-area) — `ecoconnect/graph/temporal.py` |
| Web map geometry | WGS84, simplified 15 m (`configs/graph.yaml → export`) |

## 8. Data-validation checks

**Exist in code**
- STAC search returns nothing → `RuntimeError` (S1 and S2); no S2 granule overlapping ≥ 2 % → error.
- Remote read failures retried 4×, then `RuntimeError`.
- S2 cloud/shadow/snow via SCL; non-positive DNs/backscatter → NaN; `valid_fraction` recorded in sidecars.
- Missing GMW tile → label stays 255 (ignored) and the log says `NONE`.
- Label grid ≠ image grid (size, transform or CRS) → label realigned nearest-neighbour before tiling.
- Tiles < 60 % valid or < 50 % labelled are skipped and counted; nodata pixels become label 255.
- `DATA_ROOT` unset, dataset folder missing, or split ids missing on disk → explicit errors.
- Inference: scene band count ≠ model `in_channels` → `ValueError`.
- Extraction: probability must be 2-D, threshold ∈ [0, 1], connectivity ∈ {4, 8}.
- Threshold sweep: label raster must be on the probability grid; test-tile footprints of other CRSs are skipped.
- Graph stage: unknown `result_kind` or zero patches → error; zero baseline connectivity → criticality error.
- Scenario inputs: τ ∈ [0.5, 50] km, k ∈ [1, 10], hypothetical patch 0.1–10 000 ha within bbox ± 0.25°.
- Period comparison checks same model checkpoint, threshold and MMU ([SCENARIOS.md](SCENARIOS.md)).

**Do not exist (known gaps)**
- No check that the imagery year matches the label year (a 2025 scene was trained against 2020 labels).
- No check of band **names/order** at inference — only the count (audit bug 24).
- No minimum valid-fraction or cloud-free-fraction threshold for a composite; it is only recorded.
- No normaliser-cache consistency check (bug 20); no train/test spatial-overlap check (bug 21).
- Nodata is treated as valid in candidate extraction and habitat fraction (bug 28).
- No S1 orbit consistency (ascending and descending are mixed when `s1_orbit: any`).
- No label-quality assessment of GMW and no independent (non-GMW) reference data anywhere.

## 9. Gotchas

- GMW 1° tiles are named by their **north** edge (N10E076 covers 9–10° N).
- Patch ids are reassigned by area in every run — `P07` in one run is not `P07` in another; identity across runs
  comes only from polygon overlap.
- The centroid is the pixel centre of mass; for curved fringes it can fall outside the polygon.
- `manifest.json` records `aoi_area_km2 == valid_area_km2` (both from A_L, bug 27); the `model` path is sometimes
  absolute, sometimes repo-relative.
- A fresh clone has no scenes, probability rasters or checkpoints: inference, threshold scenarios, NDWI
  feasibility and timeline mask-differences do not work there; stored run JSON does.
- `scripts/run_pipeline.py` (end-to-end wrapper) picks the newest scene (`scenes[-1]`, possibly a different
  year than the labels) and passes 10 band names for a 2-band scene (audit bug 24) — prefer `predict.py` +
  `run_graph_analysis.py` with explicit arguments.
- STAC reads need CA certificates on python.org macOS builds (`_ensure_certs` uses `certifi`).
