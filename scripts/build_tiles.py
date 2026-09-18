#!/usr/bin/env python
"""Cut an AOI image + label raster into the canonical tile dataset (spatial-block split).

    python scripts/build_tiles.py --image data/scenes/kerala-coast/S2_2024.tif \
        --label data/labels/kerala-coast/gmw_2020.tif --name ecoconnect_tiles --tile 256 --stride 128
"""
import argparse, json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.geospatial.preprocessing import build_tiles
from ecoconnect.pipeline.config import load_dotenv


def main():
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True); ap.add_argument("--label", required=True)
    ap.add_argument("--name", default="ecoconnect_tiles"); ap.add_argument("--data-root", default=os.environ.get("DATA_ROOT"))
    ap.add_argument("--tile", type=int, default=256); ap.add_argument("--stride", type=int, default=None)
    ap.add_argument("--block-tiles", type=int, default=4); ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--min-valid-frac", type=float, default=0.6); ap.add_argument("--min-labelled-frac", type=float, default=0.5)
    ap.add_argument("--bands", default=None, help="comma-separated band names recorded in metadata.json")
    ap.add_argument("--id-prefix", default="t"); ap.add_argument("--append", action="store_true", help="add to an existing dataset (multi-AOI)")
    ap.add_argument("--source-note", default=None)
    a = ap.parse_args()
    if not a.data_root:
        ap.error("set DATA_ROOT (env/.env) or pass --data-root")
    rep = build_tiles(a.image, a.label, Path(a.data_root) / a.name, tile_size=a.tile, stride=a.stride,
                      block_tiles=a.block_tiles, seed=a.seed, min_valid_frac=a.min_valid_frac,
                      min_labelled_frac=a.min_labelled_frac, band_names=a.bands.split(",") if a.bands else None,
                      id_prefix=a.id_prefix, append=a.append,
                      source_description={"note": a.source_note} if a.source_note else None)
    print(json.dumps(rep.to_dict(), indent=1))


if __name__ == "__main__":
    main()
