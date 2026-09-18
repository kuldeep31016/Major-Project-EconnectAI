#!/usr/bin/env python
"""Inspect a dataset BEFORE writing any training code that depends on it: format, count, shapes,
bands, dtypes, value ranges, mask classes, CRS, split sizes.  Works on the canonical layout and
on arbitrary folders of .tif/.npy/.png files.

    python scripts/inspect_dataset.py --path $DATA_ROOT/ecoconnect_tiles
    python scripts/inspect_dataset.py --path /some/unknown/dataset --max-files 20
"""
import argparse, collections, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np


def describe_tif(p):
    import rasterio
    with rasterio.open(p) as s:
        a = s.read(masked=True)
        return {"shape": list(a.shape), "dtype": str(a.dtype), "crs": str(s.crs), "res": [abs(s.transform.a), abs(s.transform.e)],
                "nodata": s.nodata, "min": float(a.min()) if a.count() else None, "max": float(a.max()) if a.count() else None,
                "bounds": list(s.bounds), "unique_if_small": sorted(np.unique(a.compressed()).tolist()[:12]) if a.dtype.kind in "iu" else None}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--path", required=True); ap.add_argument("--max-files", type=int, default=10)
    a = ap.parse_args(); root = Path(a.path)
    if not root.exists():
        sys.exit(f"{root} does not exist")
    exts = collections.Counter(p.suffix.lower() for p in root.rglob("*") if p.is_file())
    print("file counts by extension:", dict(exts.most_common(12)))
    for name in ("metadata.json", "stats.json", "README.md", "readme.txt", "dataset_info.json"):
        for p in root.rglob(name):
            print(f"\n--- {p.relative_to(root)} ---"); print(p.read_text()[:2500]); break
    splits = {p.stem: sum(1 for l in p.read_text().splitlines() if l.strip()) for p in root.glob("splits/*.txt")}
    if splits:
        print("\nsplit sizes:", splits)
    tifs = sorted(root.rglob("*.tif")) + sorted(root.rglob("*.tiff"))
    print(f"\nGeoTIFFs: {len(tifs)}")
    for p in tifs[: a.max_files]:
        try:
            print(f"  {p.relative_to(root)}: {json.dumps(describe_tif(p))}")
        except Exception as e:
            print(f"  {p.relative_to(root)}: ERROR {e}")
    for ext in (".npy", ".npz", ".png", ".jpg", ".h5", ".parquet", ".csv"):
        fs = sorted(root.rglob(f"*{ext}"))
        if fs:
            print(f"\n{ext}: {len(fs)} files, e.g. {[str(f.relative_to(root)) for f in fs[:5]]}")
            if ext == ".npy":
                arr = np.load(fs[0], mmap_mode="r"); print(f"   first shape={arr.shape} dtype={arr.dtype}")


if __name__ == "__main__":
    main()
