"""Build the canonical tile dataset from AOI-level rasters.

    image.tif  (C, H, W) any CRS      +      label.tif (H, W) uint8, aligned or reprojectable
        -> ${DATA_ROOT}/<name>/tiles/{images,masks}/<id>.tif, splits/*.txt, metadata.json

Splitting is by SPATIAL BLOCK (a coarse grid of ``block_tiles`` x ``block_tiles`` tiles), not
by random tile shuffle, so that neighbouring/overlapping tiles never straddle train and test.
Tiles whose valid fraction is below ``min_valid_frac`` are skipped and counted.
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.windows import Window


@dataclass
class TilingReport:
    dataset_root: str
    source_image: str
    source_label: str
    tile_size: int
    stride: int
    n_tiles_written: int
    n_tiles_skipped_invalid: int
    n_tiles_skipped_unlabelled: int
    split_counts: dict
    positive_fraction_train: float
    crs: str
    pixel_size: list
    bands: list

    def to_dict(self) -> dict:
        return asdict(self)


def align_label_to_image(label_path: Path, image_path: Path, out_path: Path, nodata: int = 255) -> Path:
    """Reproject/resample a label raster onto the image grid (nearest neighbour - labels are categorical)."""
    with rasterio.open(image_path) as img, rasterio.open(label_path) as lab:
        dst = np.full((img.height, img.width), nodata, dtype=np.uint8)
        reproject(
            source=rasterio.band(lab, 1), destination=dst,
            src_transform=lab.transform, src_crs=lab.crs, src_nodata=lab.nodata,
            dst_transform=img.transform, dst_crs=img.crs, dst_nodata=nodata,
            resampling=Resampling.nearest,
        )
        prof = img.profile.copy()
        prof.update(count=1, dtype="uint8", nodata=nodata, compress="deflate")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(out_path, "w", **prof) as o:
            o.write(dst, 1)
    return out_path


def build_tiles(
    image_path: str | Path,
    label_path: str | Path,
    dataset_root: str | Path,
    *,
    tile_size: int = 256,
    stride: Optional[int] = None,
    split_fracs: tuple[float, float, float] = (0.7, 0.15, 0.15),
    block_tiles: int = 4,
    min_valid_frac: float = 0.6,
    min_labelled_frac: float = 0.5,
    label_ignore: int = 255,
    image_nodata: Optional[float] = None,
    band_names: Optional[list[str]] = None,
    id_prefix: str = "t",
    seed: int = 42,
    source_description: Optional[dict] = None,
    append: bool = False,
) -> TilingReport:
    image_path, label_path, root = Path(image_path), Path(label_path), Path(dataset_root)
    stride = stride or tile_size
    (root / "tiles" / "images").mkdir(parents=True, exist_ok=True)
    (root / "tiles" / "masks").mkdir(parents=True, exist_ok=True)
    (root / "splits").mkdir(parents=True, exist_ok=True)

    with rasterio.open(image_path) as img, rasterio.open(label_path) as lab:
        if (lab.width, lab.height) != (img.width, img.height) or lab.transform != img.transform or lab.crs != img.crs:
            aligned = root / "_aligned_labels" / f"{label_path.stem}_on_{image_path.stem}.tif"
            align_label_to_image(label_path, image_path, aligned, nodata=label_ignore)
            lab.close()
            lab = rasterio.open(aligned)
        nodata = image_nodata if image_nodata is not None else img.nodata
        prof_img = img.profile.copy()
        prof_img.update(compress="deflate", tiled=False, width=tile_size, height=tile_size)
        prof_lab = lab.profile.copy()
        prof_lab.update(compress="deflate", tiled=False, width=tile_size, height=tile_size, dtype="uint8", nodata=label_ignore)

        rows = range(0, img.height - tile_size + 1, stride)
        cols = range(0, img.width - tile_size + 1, stride)
        written: list[tuple[str, int, int, float]] = []
        skipped_invalid = skipped_unlab = 0
        for r in rows:
            for c in cols:
                win = Window(c, r, tile_size, tile_size)
                x = img.read(window=win).astype(np.float32)
                y = lab.read(1, window=win)
                valid = np.isfinite(x).all(0)
                if nodata is not None:
                    valid &= ~(x == nodata).any(0)
                if valid.mean() < min_valid_frac:
                    skipped_invalid += 1
                    continue
                labelled = (y != label_ignore) & valid
                if labelled.mean() < min_labelled_frac:
                    skipped_unlab += 1
                    continue
                y = np.where(valid, y, label_ignore).astype(np.uint8)
                tid = f"{id_prefix}_{image_path.stem}_{r:05d}_{c:05d}"
                t = rasterio.windows.transform(win, img.transform)
                with rasterio.open(root / "tiles" / "images" / f"{tid}.tif", "w", **{**prof_img, "transform": t}) as o:
                    o.write(x.astype(prof_img["dtype"]))
                with rasterio.open(root / "tiles" / "masks" / f"{tid}.tif", "w", **{**prof_lab, "transform": t, "count": 1}) as o:
                    o.write(y, 1)
                pos = float((y == 1).sum() / max(labelled.sum(), 1))
                written.append((tid, r // stride, c // stride, pos))
        crs, px = str(img.crs), [abs(img.transform.a), abs(img.transform.e)]
        n_bands = img.count
    lab.close()

    # spatial-block split: assign each block (of block_tiles x block_tiles tiles) to a split
    rng = random.Random(seed)
    blocks = sorted({(ri // block_tiles, ci // block_tiles) for _, ri, ci, _ in written})
    rng.shuffle(blocks)
    n = len(blocks)
    n_tr = int(round(split_fracs[0] * n))
    n_va = int(round(split_fracs[1] * n))
    assign = {}
    for i, b in enumerate(blocks):
        assign[b] = "train" if i < n_tr else "val" if i < n_tr + n_va else "test"
    split_ids: dict[str, list[str]] = {"train": [], "val": [], "test": []}
    pos_train = []
    for tid, ri, ci, pos in written:
        s = assign[(ri // block_tiles, ci // block_tiles)]
        split_ids[s].append(tid)
        if s == "train":
            pos_train.append(pos)
    for s, ids in split_ids.items():
        p = root / "splits" / f"{s}.txt"
        existing = [l for l in p.read_text().splitlines() if l.strip()] if (append and p.exists()) else []
        p.write_text("\n".join(existing + sorted(ids)) + "\n")

    meta_path = root / "metadata.json"
    meta = json.loads(meta_path.read_text()) if (append and meta_path.exists()) else {}
    meta.update({
        "bands": band_names or meta.get("bands") or [f"band_{i + 1}" for i in range(n_bands)],
        "nodata": nodata, "ignore_index": label_ignore,
        "classes": {"0": "non-habitat", "1": "habitat"},
        "tile_size": tile_size, "stride": stride, "crs": crs, "pixel_size": px,
        "split_strategy": f"spatial blocks of {block_tiles}x{block_tiles} tiles, fractions {split_fracs}, seed {seed}",
    })
    meta.setdefault("sources", []).append({
        "image": str(image_path.resolve()), "label": str(label_path.resolve()), **(source_description or {})})
    meta_path.write_text(json.dumps(meta, indent=1))

    return TilingReport(
        dataset_root=str(root), source_image=str(image_path), source_label=str(label_path),
        tile_size=tile_size, stride=stride, n_tiles_written=len(written),
        n_tiles_skipped_invalid=skipped_invalid, n_tiles_skipped_unlabelled=skipped_unlab,
        split_counts={k: len(v) for k, v in split_ids.items()},
        positive_fraction_train=float(np.mean(pos_train)) if pos_train else 0.0,
        crs=crs, pixel_size=px, bands=meta["bands"],
    )
