"""Patch sources for the graph-analysis stage.

    from_probability_raster   REAL pipeline path: model probability GeoTIFF -> patches + candidates
    from_geojson              externally supplied patch polygons (WGS84) with area/confidence properties
    from_prototype_mock       the prototype's synthetic geometry -> labelled PROTOTYPE / SYNTHETIC

Each returns (patches, candidates, landscape_area_ha, data_source_dict, result_kind).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform
from pyproj import Transformer, CRS as PCRS

from ecoconnect.graph import Patch
from ecoconnect.geospatial.raster_processing.io import read_raster, utm_epsg_for
from ecoconnect.geospatial.patch_extraction import extract_patches
from .config import REPO_ROOT


# --------------------------------------------------------------------------- real raster path
def from_probability_raster(
    prob_path: str | Path,
    *,
    threshold: float,
    mmu_ha: float,
    connectivity: int = 8,
    habitat_class: str = "mangrove",
    candidate_threshold: Optional[float] = 0.30,
    candidate_min_area_ha: float = 1.0,
    candidate_max_count: int = 12,
    valid_mask_path: Optional[str | Path] = None,
    result_kind: str = "development",
    model_info: Optional[dict] = None,
):
    prob, meta = read_raster(prob_path, bands=[1])
    prob = prob[0].astype(np.float32)
    if meta.nodata is not None:
        prob = np.where(prob == meta.nodata, np.nan, prob)
    valid = None
    if valid_mask_path:
        vm, _ = read_raster(valid_mask_path, bands=[1])
        valid = vm[0] > 0

    patches, labels, report = extract_patches(
        prob, meta, threshold=threshold, mmu_ha=mmu_ha, connectivity=connectivity,
        habitat_class=habitat_class, id_prefix="P", valid_mask=valid,
    )

    # Restoration candidates: marginal habitat - components whose probability lies in
    # [candidate_threshold, threshold).  These are places the model considers plausible but
    # not confident habitat, i.e. natural restoration/expansion sites.  Design choice, documented.
    candidates: list[Patch] = []
    if candidate_threshold is not None and candidate_threshold < threshold:
        marginal = np.where((prob >= candidate_threshold) & (prob < threshold), prob, 0.0).astype(np.float32)
        cands, _, _ = extract_patches(
            marginal, meta, threshold=candidate_threshold, mmu_ha=candidate_min_area_ha,
            connectivity=connectivity, habitat_class=habitat_class, id_prefix="C", valid_mask=valid,
        )
        candidates = cands[:candidate_max_count]

    src = {
        "type": "probability_raster", "path": str(Path(prob_path).resolve()),
        "crs": str(meta.crs), "width": meta.width, "height": meta.height,
        "pixel_size": [abs(meta.transform.a), abs(meta.transform.e)],
        "threshold": threshold, "mmu_ha": mmu_ha, "connectivity": connectivity,
        "candidate_threshold": candidate_threshold, "candidate_min_area_ha": candidate_min_area_ha,
        "extraction_report": report.to_dict(),
        "model": (model_info or {}).get("checkpoint", "unknown"), "model_info": model_info or {},
    }
    return patches, candidates, report.landscape_area_ha, src, result_kind


# --------------------------------------------------------------------------- geojson path
def from_geojson(path: str | Path, *, landscape_area_ha: float, habitat_class: str = "mangrove",
                 result_kind: str = "external", area_prop: str = "area_ha", conf_prop: str = "confidence"):
    fc = json.loads(Path(path).read_text())
    patches = []
    for n, f in enumerate(fc["features"], 1):
        geom = shape(f["geometry"])
        props = f.get("properties", {})
        lon, lat = geom.centroid.x, geom.centroid.y
        if area_prop in props:
            area = float(props[area_prop])
        else:  # compute in local UTM
            utm = PCRS.from_epsg(utm_epsg_for(lon, lat))
            area = shp_transform(Transformer.from_crs(4326, utm, always_xy=True).transform, geom).area / 10_000
        conf = float(props.get(conf_prop, 1.0))
        patches.append(Patch(
            id=str(f.get("id") or props.get("id") or f"P{n:02d}"), area_ha=area, centroid=(lat, lon),
            quality=float(props.get("quality", conf)), confidence=conf,
            habitat_class=props.get("habitat_class", habitat_class), name=props.get("name"),
            protected=bool(props.get("protected", False)), geometry=mapping(geom),
        ))
    src = {"type": "geojson", "path": str(Path(path).resolve()), "n_features": len(patches)}
    return patches, [], landscape_area_ha, src, result_kind


# --------------------------------------------------------------------------- prototype path
def from_prototype_mock(study_area_id: str, mock_dir: Path = REPO_ROOT / "frontend" / "mock-data"):
    """The prototype's synthetic geometry, so the full pipeline + UI can be exercised before the
    segmentation stage exists.  Always labelled PROTOTYPE / SYNTHETIC."""
    masks = json.loads((mock_dir / "habitat-mask.json").read_text())
    scenes = {s["id"]: s for s in json.loads((mock_dir / "satellite-images.json").read_text())["scenes"]}
    recs = json.loads((mock_dir / "recommendations.json").read_text())
    if study_area_id not in masks:
        raise KeyError(f"{study_area_id} not in prototype mock data: {list(masks)}")

    def poly(latlng_ring):
        ring = [(lon, lat) for lat, lon in latlng_ring]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        return {"type": "Polygon", "coordinates": [ring]}

    patches = [Patch(
        id=p["id"], area_ha=p["areaHa"], centroid=tuple(p["center"]), quality=p["quality"],
        confidence=p["confidence"], habitat_class=p["habitatClass"], name=p["name"],
        protected=bool(p.get("protected", False)), geometry=poly(p["polygon"]),
    ) for p in masks[study_area_id]["patches"]]
    candidates = [Patch(
        id=a["id"], area_ha=a["areaHa"], centroid=tuple(a["center"]), name=a["location"],
        confidence=a.get("confidence", 1.0), quality=1.0,
    ) for a in recs.get(study_area_id, {}).get("actions", [])]
    a_l = scenes[study_area_id]["areaKm2"] * 100.0
    src = {"type": "prototype_mock", "path": str(mock_dir), "note":
           "synthetic patch geometry from the prototype's deterministic generator; site metadata only is real",
           "model": "none (synthetic geometry)"}
    return patches, candidates, a_l, src, "synthetic"
