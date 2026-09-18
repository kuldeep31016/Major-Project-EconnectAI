# Data provenance

Every dataset and derived artefact carries a machine-readable manifest; the backend mirrors them into the registry
(`/api/registry/{study_area}`). No number is displayed without a manifest behind it.

| Artefact | Manifest | Fields |
|---|---|---|
| Scene (`data/scenes/<area>/<id>.tif`) | `<id>.json` | study_area_id, bbox, date_range, sources (per-sensor scene ids, dates, cloud cover, AOI overlap, processing baseline, composite method, valid fraction), bands, nodata, crs, width/height, transform |
| Label (`data/labels/<area>/gmw_2020.tif`) | `gmw_2020.json` | source (GMW v3.0), year, zenodo record, licence CC-BY-4.0, tiles, classes, mangrove fraction, labelled fraction, supervision = WEAK |
| Tile dataset (`data/<name>/`) | `metadata.json` | bands, nodata, ignore index, classes, tile size/stride, crs, pixel size, split strategy (spatial blocks, seed), negative subsampling counts, sources |
| Experiment (`outputs/segmentation/<exp>/`) | `experiment.json`, `metrics.json`, `threshold_calibration.json`, `config.yaml` | dataset, splits, bands, model, parameters, hardware, timing, best epoch, val/test metrics, calibration scope/criterion |
| Prediction (`…/predictions/<area>_prob.tif`) | `<area>_prob.json` | checkpoint, experiment id, mode, scene, threshold, tile/overlap, valid fraction |
| Analysis run (`outputs/runs/<area>/<run>/`) | `manifest.json` | run id, study area, timestamp, version, result kind/label, data source (raster path, scene year, threshold, MMU, extraction report, model), landscape/AOI area, config (graph, connectivity, restoration), hardware, elapsed, files |
| Workflow records | database rows | user, role, timestamps; audit log with old/new state |

Result labels: `FOUNDATION PAPER RESULT — NOT OURS` · `PROTOTYPE / SYNTHETIC` · `DEVELOPMENT-SUBSET — NOT FINAL` · `OUR EXPERIMENTAL RESULT` · `SIMULATED` · `OBSERVED (MODEL OUTPUT)`.
Sources: Copernicus Sentinel-1 RTC (Microsoft Planetary Computer), Sentinel-2 L2A (Element84 Earth Search), Global Mangrove Watch v3.0 (Zenodo 6894273), Esri World Imagery (display only).
