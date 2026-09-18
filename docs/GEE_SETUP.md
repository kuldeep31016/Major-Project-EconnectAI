# Satellite acquisition: STAC (default) and Google Earth Engine (optional)

## Default — no credentials (`provider: stac`)

`scripts/acquire_study_area.py` reads Sentinel-2 L2A from Element84 Earth Search and Sentinel-1 RTC from
Microsoft Planetary Computer through public STAC APIs, and Global Mangrove Watch labels from Zenodo. It
streams only the AOI window of each Cloud-Optimised GeoTIFF. Parameters in `configs/acquisition.yaml`:
study area (bbox), date range, cloud threshold, number of scenes, sensor bands, orbit, resolution.

Nothing is downloaded until the script is explicitly run. Verified 2026-09-18 on a 1.7 km test AOI.

## Optional — Google Earth Engine (`provider: gee`)

Use when you prefer GEE compositing/exports or need collections not on public STAC.

```bash
pip install earthengine-api
earthengine authenticate                 # opens a browser; needs a Google account with EE access
# set your cloud project id in configs/acquisition.yaml → gee.project
```

`ecoconnect/gee/gee_acquire.py` provides `s2_composite_image` (COPERNICUS/S2_SR_HARMONIZED, SCL-masked
median, NDVI/NDWI), `s1_composite_image` (COPERNICUS/S1_GRD IW VV+VH median, dB) and `download_image`
(small-AOI `getDownloadURL`, GeoTIFF). Exports are AOI-sized only; large exports should go through
`ee.batch.Export.image.toDrive`, which is deliberately not automated.

If authentication is unavailable the module raises a clear `RuntimeError`; the STAC path and the tile
dataset pipeline work without it.

## Study areas and honesty about coverage

`configs/study_areas.yaml` holds the paper's four landscapes with real metadata only. Whether imagery has
actually been processed for an area is visible in each run's `manifest.json → data_source` and in the UI's
provenance badge. Until then they are **demonstration locations**, not dataset training locations.
