#!/usr/bin/env python
"""Acquire one study area: Sentinel-1 RTC (VV,VH) + Sentinel-2 L2A composite + GMW weak labels,
all on one aligned UTM grid.

    python scripts/acquire_study_area.py --study-area kerala-coast
    python scripts/acquire_study_area.py --study-area odisha-coast --bbox 20.65,86.80,20.80,86.98 --max-scenes-s2 4

Writes  ${DATA_ROOT}/scenes/<area>/<scene_id>.tif   multi-band float32 scene (band names in .json)
        ${DATA_ROOT}/labels/<area>/gmw_<year>.tif    uint8 weak label aligned to the scene
Nothing is downloaded until this script is run.  Sizes: ~30-80 MB per study area.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from ecoconnect.pipeline.config import load_config, load_study_areas, load_dotenv  # noqa: E402
from ecoconnect.gee.stac_acquire import AOI, TargetGrid, sentinel1_composite, sentinel2_composite, write_scene  # noqa: E402
from ecoconnect.gee.gmw_labels import gmw_labels_for_grid  # noqa: E402
from ecoconnect.geospatial.raster_processing.io import write_raster  # noqa: E402


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--study-area", required=True)
    ap.add_argument("--config", default="acquisition")
    ap.add_argument("--bbox", help="override min_lat,min_lon,max_lat,max_lon")
    ap.add_argument("--date-range", help="YYYY-MM-DD,YYYY-MM-DD")
    ap.add_argument("--max-scenes-s2", type=int); ap.add_argument("--max-scenes-s1", type=int)
    ap.add_argument("--skip-s1", action="store_true"); ap.add_argument("--skip-s2", action="store_true")
    ap.add_argument("--skip-labels", action="store_true")
    ap.add_argument("--data-root", default=os.environ.get("DATA_ROOT"))
    a = ap.parse_args()
    if not a.data_root:
        ap.error("DATA_ROOT not set (env / .env) and --data-root not given")
    os.environ["DATA_ROOT"] = a.data_root

    cfg = load_config(a.config)
    acq = cfg["acquisition"]
    if a.date_range:
        acq["date_range"] = a.date_range.split(",")
    if a.max_scenes_s2:
        acq["max_scenes_s2"] = a.max_scenes_s2
    if a.max_scenes_s1:
        acq["max_scenes_s1"] = a.max_scenes_s1
    if acq.get("provider", "stac") != "stac":
        sys.exit("provider != stac: use the GEE path documented in docs/GEE_SETUP.md (ecoconnect/gee/gee_acquire.py)")

    areas = load_study_areas()
    meta = areas[a.study_area]
    bbox = tuple(float(v) for v in a.bbox.split(",")) if a.bbox else tuple(meta["bbox"])
    aoi = AOI(a.study_area, bbox)
    grid = TargetGrid.for_aoi(aoi, acq["target_resolution_m"])
    print(f"[acquire] {a.study_area}  bbox={bbox}  grid={grid.width}x{grid.height} @ {acq['target_resolution_m']} m  {grid.crs}")
    print(f"[acquire] date range {acq['date_range']}  provider=stac (no credentials)")

    bands, names, info = [], [], {"study_area_id": a.study_area, "bbox": bbox, "date_range": acq["date_range"], "sources": {}}
    t0 = time.time()
    if not a.skip_s1:
        print("[acquire] Sentinel-1 RTC (Planetary Computer) ...")
        b, n, i = sentinel1_composite(aoi, grid, cfg["sentinel1"], acq)
        bands.append(b); names += n; info["sources"]["sentinel1"] = i
    if not a.skip_s2:
        print("[acquire] Sentinel-2 L2A (Earth Search) ...")
        b, n, i = sentinel2_composite(aoi, grid, cfg["sentinel2"], acq)
        bands.append(b); names += n; info["sources"]["sentinel2"] = i
    if not bands:
        sys.exit("nothing to write (both sensors skipped)")
    scene = np.concatenate(bands, axis=0)
    scene_id = f"{a.study_area}_{acq['date_range'][0][:4]}_s{'1' if not a.skip_s1 else ''}{'2' if not a.skip_s2 else ''}_{acq['target_resolution_m']}m"
    out_dir = Path(a.data_root) / "scenes" / a.study_area
    info.update({"scene_id": scene_id, "elapsed_s": round(time.time() - t0, 1),
                 "note": "S1 = primary segmentation input (paper), S2 = complementary. Bands are stored together; "
                         "the model's band subset is chosen in configs/dataset.yaml."})
    path = write_scene(out_dir / f"{scene_id}.tif", scene, names, grid, info)
    print(f"[acquire] wrote {path} ({path.stat().st_size/1e6:.1f} MB) bands={names}")

    if not a.skip_labels:
        print("[acquire] GMW weak labels (Zenodo) ...")
        label, linfo = gmw_labels_for_grid(aoi, grid, cfg["labels"])
        lp = Path(a.data_root) / "labels" / a.study_area / f"gmw_{cfg['labels']['gmw_year']}.tif"
        write_raster(lp, label, grid.meta, dtype="uint8", nodata=255)
        lp.with_suffix(".json").write_text(json.dumps({**linfo, "aligned_to_scene": str(path)}, indent=1))
        print(f"[acquire] wrote {lp}  mangrove fraction of labelled pixels = {linfo['mangrove_fraction_of_labelled']:.3f}  "
              f"labelled fraction = {linfo['labelled_fraction']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
