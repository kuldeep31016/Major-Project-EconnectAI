#!/usr/bin/env python
"""Merge bands from several scene GeoTIFFs on the same grid into one scene (e.g. an S1-only and an
S2-only acquisition of the same AOI/year).  Band descriptions and the .json sidecars are merged too.

    python scripts/merge_scenes.py --out data/scenes/kerala-coast/kerala-coast_2020_s12_10m.tif \
        data/scenes/kerala-coast/kerala-coast_2020_s1_10m.tif data/scenes/kerala-coast/kerala-coast_2020_s2_10m.tif
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
import rasterio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+"); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    bands, names, prof, info = [], [], None, {"sources": {}, "merged_from": []}
    for p in a.inputs:
        with rasterio.open(p) as s:
            if prof is None:
                prof = s.profile.copy()
            elif (s.width, s.height, s.transform, s.crs) != (prof["width"], prof["height"], prof["transform"], prof["crs"]):
                sys.exit(f"{p} is not on the same grid as {a.inputs[0]}")
            bands.append(s.read()); names += list(s.descriptions)
        sj = Path(p).with_suffix(".json")
        if sj.exists():
            j = json.loads(sj.read_text()); info["sources"].update(j.get("sources", {})); info["merged_from"].append(str(Path(p).resolve()))
            for k in ("study_area_id", "bbox", "date_range", "crs", "width", "height", "transform", "nodata", "note"):
                info.setdefault(k, j.get(k))
    arr = np.concatenate(bands, 0)
    prof.update(count=arr.shape[0], compress="deflate", tiled=True, blockxsize=256, blockysize=256)
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(out, "w", **prof) as d:
        d.write(arr)
        for i, n in enumerate(names, 1):
            d.set_band_description(i, n)
    info["bands"] = names; info["scene_id"] = out.stem
    out.with_suffix(".json").write_text(json.dumps(info, indent=1, default=str))
    print(f"wrote {out} bands={names} ({out.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
