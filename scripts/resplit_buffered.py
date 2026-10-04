#!/usr/bin/env python
"""Re-split an existing tile dataset with a boundary buffer (audit bug 21) without re-tiling.

    python scripts/resplit_buffered.py --src data/ecoconnect_tiles --dst data/ecoconnect_tiles_buf

Reconstructs each source raster's spatial-block assignment exactly as build_tiles made it (same seed and fractions),
verifies the reconstruction reproduces the current split files, then excludes tiles that overlap a block of another
split. The new dataset links to the same tile files (no copies) and has its own splits/ and metadata.json.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.geospatial.preprocessing.tiling import boundary_crossing  # noqa: E402

ID = re.compile(r"^(?P<src>.+)_(?P<r>\d{5})_(?P<c>\d{5})$")


def stratified_assign(src: Path, tiles, block_tiles: int, fracs, seed: int) -> dict:
    """Greedy stratified block assignment: blocks sorted by mangrove pixels (desc) go to the split furthest below its
    target share of the area's mangrove; mangrove-free blocks balance block counts. Whole blocks stay together."""
    import rasterio
    pos: dict = defaultdict(int)
    for t, ri, ci in tiles:
        with rasterio.open(src / "tiles" / "masks" / f"{t}.tif") as m:
            pos[(ri // block_tiles, ci // block_tiles)] += int((m.read(1) == 1).sum())
    blocks = sorted({(ri // block_tiles, ci // block_tiles) for _, ri, ci in tiles})
    rng = random.Random(seed)
    rng.shuffle(blocks)                                   # random tie order, then stable sort by mangrove content
    blocks.sort(key=lambda b: -pos[b])
    names = ["train", "val", "test"]
    tot_pos, n_blocks = sum(pos.values()) or 1, len(blocks)
    got_pos, got_n, assign = {k: 0 for k in names}, {k: 0 for k in names}, {}
    for b in blocks:
        if pos[b] > 0:
            k = max(names, key=lambda k: fracs[names.index(k)] * tot_pos - got_pos[k])
        else:
            k = max(names, key=lambda k: fracs[names.index(k)] * n_blocks - got_n[k])
        assign[b] = k
        got_pos[k] += pos[b]
        got_n[k] += 1
    return assign


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data/ecoconnect_tiles")
    ap.add_argument("--dst", default="data/ecoconnect_tiles_buf")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--block-tiles", type=int, default=4)
    ap.add_argument("--fracs", default="0.7,0.15,0.15")
    ap.add_argument("--strat-block-tiles", type=int, default=4,
                    help="block size (in strides) for --stratify; larger blocks lose fewer tiles to the buffer")
    ap.add_argument("--stratify", action="store_true",
                    help="assign blocks so every split gets its share of each area's mangrove pixels (stratified spatial split)")
    a = ap.parse_args()
    src, dst = Path(a.src), Path(a.dst)
    meta = json.loads((src / "metadata.json").read_text())
    stride, tile = int(meta["stride"]), int(meta["tile_size"])
    fr = [float(x) for x in a.fracs.split(",")]
    current = {s: set(l.strip() for l in (src / "splits" / f"{s}.txt").read_text().splitlines() if l.strip())
               for s in ("train", "val", "test")}
    groups: dict[str, list[tuple[str, int, int]]] = defaultdict(list)
    for p in sorted((src / "tiles" / "images").glob("*.tif")):
        m = ID.match(p.stem)
        if m and any(p.stem in v for v in current.values()):
            groups[m["src"]].append((p.stem, int(m["r"]) // stride, int(m["c"]) // stride))
    new = {"train": [], "val": [], "test": []}
    dropped, mismatch = 0, 0
    for g, tiles in groups.items():
        rng = random.Random(a.seed)                      # build_tiles: rng = random.Random(seed) per call
        blocks = sorted({(ri // a.block_tiles, ci // a.block_tiles) for _, ri, ci in tiles})
        rng.shuffle(blocks)
        n = len(blocks)
        n_tr, n_va = int(round(fr[0] * n)), int(round(fr[1] * n))
        assign = {b: "train" if i < n_tr else "val" if i < n_tr + n_va else "test" for i, b in enumerate(blocks)}
        mismatch += sum(1 for t, ri, ci in tiles if t not in current[assign[(ri // a.block_tiles, ci // a.block_tiles)]])
        if a.stratify:
            assign = stratified_assign(src, tiles, a.strat_block_tiles, fr, a.seed)
        bt = a.strat_block_tiles if a.stratify else a.block_tiles
        cross = boundary_crossing(tiles, assign, bt, -(-tile // stride))
        for t, ri, ci in tiles:
            if t in cross:
                dropped += 1
            else:
                new[assign[(ri // bt, ci // bt)]].append(t)
        print(f"{g:42} tiles {len(tiles):4}  excluded at split boundaries {len(cross & {t for t, _, _ in tiles}):4}")
    if mismatch:
        sys.exit(f"reconstruction does not match the current splits for {mismatch} tiles - aborting")
    if dst.exists():
        shutil.rmtree(dst)
    (dst / "splits").mkdir(parents=True)
    (dst / "tiles").symlink_to((src / "tiles").resolve(), target_is_directory=True)
    for s, ids in new.items():
        (dst / "splits" / f"{s}.txt").write_text("\n".join(sorted(ids)) + "\n")
    meta.update({"split_strategy": meta["split_strategy"] + (" -> stratified by mangrove pixels per area" if a.stratify else "")
                 + " + boundary buffer (resplit_buffered.py)",
                 "boundary_tiles_excluded": dropped, "resplit_from": str(src)})
    (dst / "metadata.json").write_text(json.dumps(meta, indent=1))
    print(f"reconstruction matches current splits; excluded {dropped} boundary tiles")
    print("before:", {s: len(v) for s, v in current.items()}, " after:", {s: len(v) for s, v in new.items()})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
