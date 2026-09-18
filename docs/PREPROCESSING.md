# Preprocessing

Every operation, where it lives, and why. Nothing resamples pixels by interpolation inside the ML stage.

| # | Operation | Where | Details |
|---|---|---|---|
| 1 | Reprojection to a common UTM grid | `gee/stac_acquire.TargetGrid` | AOI → WGS84/UTM zone of its centre (EPSG:326xx), 10 m, origin snapped to the 10 m lattice so S1, S2 and labels align pixel-exactly. |
| 2 | Windowed COG reads | `_read_asset_to_grid` | Only the AOI window of each remote GeoTIFF is fetched; bilinear for reflectance/backscatter, nearest for SCL and labels. |
| 3 | Cloud / shadow masking (S2) | `sentinel2_composite` | Pixels with SCL ∈ {0,1,2,3,8,9,10,11} → NaN before compositing. |
| 4 | BOA offset (S2) | `sentinel2_composite` | Processing baseline ≥ 04.00 stores DN+1000; subtracted when `earthsearch:boa_offset_applied` is false. Then DN/10000 → reflectance [0,1]. |
| 5 | Temporal median composite | S1 and S2 | Per-pixel `nanmedian` over N scenes: cloud-gap filling (S2) and speckle reduction (S1 time series, as in the foundation study). |
| 6 | Radiometric scale (S1) | `sentinel1_composite` | RTC γ⁰ linear → dB (`10·log10`), zeros → NaN. |
| 7 | Spectral indices | `sentinel2_composite` | NDVI = (NIR−R)/(NIR+R), NDWI = (G−NIR)/(G+NIR) from the composite. |
| 8 | Nodata | `write_scene` / `transforms.handle_nodata` | Scene nodata = −9999 (recorded in the .json). In the loader any band == nodata or non-finite → pixel invalid → image 0, mask 255 (ignored by loss and metrics). |
| 9 | Label alignment | `tiling.align_label_to_image` | Nearest-neighbour reprojection of the label raster onto the image grid if grids differ. |
| 10 | Tiling | `tiling.build_tiles` | Fixed window, configurable size/stride; tiles with < 60 % valid or < 50 % labelled pixels are skipped and counted. Spatial-block split. |
| 11 | Normalisation | `transforms.fit_normalizer` | Per-band z-score (or min-max). Statistics from the **train split only**, robust to outliers via 1–99 percentile clipping, cached in `stats.json`. |
| 12 | Size handling | `transforms.pad_or_crop` | Reflect-pad (image) / ignore-pad (mask) when smaller, centre-crop when larger. **No interpolation.** |
| 13 | Augmentation (train only) | `transforms.train_augment` | Horizontal/vertical flips, 90° rotations (label-preserving), optional brightness jitter. Never applied to val/test. |

Sentinel-2 native resolutions: B02/B03/B04/B08 are 10 m; B11/B12 are 20 m and are resampled to the 10 m grid
(bilinear) at acquisition — the 20 m origin is recorded in the scene metadata. Sentinel-1 RTC is delivered at
10 m. Landsat-9 (Gulf of Mannar in paper Table III) is 30 m and is not acquired by the default path; the
grid resolution is a parameter (`target_resolution_m`).
