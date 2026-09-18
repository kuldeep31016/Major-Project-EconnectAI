"""Patch extraction from a habitat probability map  (paper Section IV-B, Eq. 2).

    probability map  P_i(c)  --threshold-->  binary map  --connected components-->  patches

Each patch carries  Patch_i = {A_i, (x_i, y_i), C_i, H_i}  plus geometry:
    A_i        area in hectares from true pixel areas (projected: |a*e|; geographic: latitude-corrected)
    (x_i,y_i)  centroid in WGS84 (lat, lon)  -> distances downstream are great-circle km
    C_i        mean class probability inside the component
    H_i        habitat class name
    polygon    GeoJSON geometry (WGS84), bounding box, perimeter (km)

Components smaller than the minimum mapping unit (paper: 2 ha) are dropped and
counted.  Threshold and MMU are explicit parameters - the paper states both are
uncalibrated design values.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from scipy import ndimage
from rasterio import features
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform as shp_transform
from pyproj import Transformer, CRS as PCRS

from ecoconnect.graph.types import Patch
from ecoconnect.geospatial.raster_processing.io import RasterMeta, pixel_area_ha, to_wgs84, utm_epsg_for


@dataclass
class ExtractionReport:
    threshold: float
    mmu_ha: float
    connectivity: int
    n_components_total: int
    n_patches_kept: int
    n_dropped_below_mmu: int
    habitat_pixels: int
    valid_pixels: int
    habitat_coverage_pct: float          # of valid pixels
    habitat_area_ha: float
    landscape_area_ha: float             # valid (non-nodata) extent of the raster
    mean_confidence_habitat: float
    crs: str

    def to_dict(self) -> dict:
        return asdict(self)


_STRUCT = {4: ndimage.generate_binary_structure(2, 1), 8: ndimage.generate_binary_structure(2, 2)}


def extract_patches(
    prob: np.ndarray,
    meta: RasterMeta,
    *,
    threshold: float = 0.5,
    mmu_ha: float = 2.0,
    connectivity: int = 8,
    habitat_class: str = "mangrove",
    id_prefix: str = "P",
    valid_mask: Optional[np.ndarray] = None,
    simplify_m: float = 10.0,
    quality_from_confidence: bool = True,
) -> tuple[list[Patch], np.ndarray, ExtractionReport]:
    """Return (patches, label_raster, report).

    ``prob``       (H, W) float in [0, 1] - class probability from ``predict_proba``.
    ``valid_mask`` (H, W) bool - False where the scene has nodata/cloud; defaults to finite pixels.
    ``quality``    q_i for Eq. (6) defaults to C_i (mean probability).  A habitat-condition
                   term can be multiplied in later by the caller; the paper leaves it open.
    """
    if prob.ndim != 2:
        raise ValueError("prob must be a 2-D (H, W) array")
    if connectivity not in _STRUCT:
        raise ValueError("connectivity must be 4 or 8")
    if not (0.0 <= threshold <= 1.0):
        raise ValueError("threshold must be in [0, 1]")

    valid = np.isfinite(prob) if valid_mask is None else (valid_mask & np.isfinite(prob))
    binary = (prob >= threshold) & valid
    labels, n = ndimage.label(binary, structure=_STRUCT[connectivity])

    row_area = pixel_area_ha(meta)                       # (H,)
    area_img = np.broadcast_to(row_area[:, None], prob.shape)

    # per-component aggregates in one pass each
    idx = np.arange(1, n + 1)
    comp_area = ndimage.sum(area_img, labels, idx) if n else np.array([])
    comp_pix = ndimage.sum(np.ones_like(prob, dtype=np.int32), labels, idx) if n else np.array([])
    comp_conf = ndimage.mean(np.nan_to_num(prob), labels, idx) if n else np.array([])
    comp_cy_cx = ndimage.center_of_mass(binary, labels, idx) if n else []

    wgs = to_wgs84(meta)
    keep_ids = [i for i in range(n) if comp_area[i] >= mmu_ha]

    # shapes only for kept components (vectorising is the slow part)
    kept_label = np.where(np.isin(labels, [i + 1 for i in keep_ids]), labels, 0).astype(np.int32)
    geoms: dict[int, list] = {}
    if keep_ids:
        for geom, val in features.shapes(kept_label, mask=kept_label > 0, transform=meta.transform, connectivity=connectivity):
            geoms.setdefault(int(val), []).append(shape(geom))

    to_ll = Transformer.from_crs(meta.crs, PCRS.from_epsg(4326), always_xy=True).transform \
        if (meta.crs is not None and meta.crs.to_epsg() != 4326) else None

    patches: list[Patch] = []
    width = len(str(max(len(keep_ids), 1)))
    for rank, i in enumerate(sorted(keep_ids, key=lambda i: -comp_area[i]), 1):
        lab = i + 1
        cy, cx = comp_cy_cx[i]
        x, y = meta.transform @ (cx + 0.5, cy + 0.5)
        lon, lat = wgs(x, y)

        poly = unary_union(geoms.get(lab, []))
        # metric ops (perimeter, simplify) in the local UTM zone
        utm = PCRS.from_epsg(utm_epsg_for(lon, lat))
        to_utm = Transformer.from_crs(meta.crs, utm, always_xy=True).transform
        poly_utm = shp_transform(to_utm, poly)
        if simplify_m > 0:
            poly_utm = poly_utm.simplify(simplify_m, preserve_topology=True)
        perimeter_km = poly_utm.length / 1000.0
        poly_ll = shp_transform(Transformer.from_crs(utm, PCRS.from_epsg(4326), always_xy=True).transform, poly_utm)
        minx, miny, maxx, maxy = poly_ll.bounds

        conf = float(comp_conf[i])
        patches.append(Patch(
            id=f"{id_prefix}{rank:0{width}d}",
            area_ha=float(comp_area[i]),
            centroid=(float(lat), float(lon)),
            quality=conf if quality_from_confidence else 1.0,
            confidence=conf,
            habitat_class=habitat_class,
            name=None,
            perimeter_km=float(perimeter_km),
            bbox=(float(miny), float(minx), float(maxy), float(maxx)),
            geometry=mapping(poly_ll),
            extra={"pixel_count": int(comp_pix[i]), "label_value": int(lab),
                   "centroid_pixel": [float(cx), float(cy)]},
        ))

    habitat_pix = int(binary.sum())
    valid_pix = int(valid.sum())
    report = ExtractionReport(
        threshold=threshold,
        mmu_ha=mmu_ha,
        connectivity=connectivity,
        n_components_total=int(n),
        n_patches_kept=len(patches),
        n_dropped_below_mmu=int(n) - len(patches),
        habitat_pixels=habitat_pix,
        valid_pixels=valid_pix,
        habitat_coverage_pct=100.0 * habitat_pix / valid_pix if valid_pix else 0.0,
        habitat_area_ha=float(sum(p.area_ha for p in patches)),
        landscape_area_ha=float((area_img * valid).sum()),
        mean_confidence_habitat=float(np.nan_to_num(prob)[binary].mean()) if habitat_pix else 0.0,
        crs=str(meta.crs),
    )
    return patches, labels, report


def patches_to_geojson(patches: list[Patch], extra_props: Optional[dict[str, dict]] = None) -> dict:
    """FeatureCollection in WGS84.  ``extra_props`` maps patch_id -> additional properties
    (e.g. criticality) merged into each feature."""
    feats = []
    for p in patches:
        props = {k: v for k, v in p.to_dict().items() if k not in ("geometry", "centroid")}
        props["centroid_lat"], props["centroid_lon"] = p.centroid
        if extra_props and p.id in extra_props:
            props.update(extra_props[p.id])
        feats.append({"type": "Feature", "id": p.id, "geometry": p.geometry, "properties": props})
    return {"type": "FeatureCollection", "features": feats}
