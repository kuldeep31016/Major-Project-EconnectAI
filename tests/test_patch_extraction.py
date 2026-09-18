"""Patch extraction tests on small synthetic rasters with known geometry (test-only data)."""
import numpy as np
import pytest
from rasterio.crs import CRS
from rasterio.transform import from_origin

from ecoconnect.geospatial.raster_processing.io import RasterMeta, pixel_area_ha
from ecoconnect.geospatial.patch_extraction.extract import extract_patches, patches_to_geojson


def utm_meta(h=100, w=100, res=10.0):
    # UTM 43N (Kerala), 10 m pixels: each pixel = 100 m^2 = 0.01 ha
    return RasterMeta(CRS.from_epsg(32643), from_origin(650_000, 1_095_000, res, res), w, h, None, 1, "float32")


def test_pixel_area_projected():
    meta = utm_meta()
    a = pixel_area_ha(meta)
    assert a.shape == (100,)
    assert np.allclose(a, 0.01)


def test_pixel_area_geographic_varies_with_latitude():
    meta = RasterMeta(CRS.from_epsg(4326), from_origin(76.0, 10.0, 0.0001, 0.0001), 10, 10, None, 1, "float32")
    a = pixel_area_ha(meta)
    # ~11.1 m x ~10.9 m at 10 N -> ~0.0121 ha, decreasing slightly southwards? (cos(lat) grows towards equator)
    assert 0.011 < a[0] < 0.0125
    assert a[-1] > a[0]  # closer to the equator -> wider pixels


def test_two_blobs_area_centroid_confidence_and_mmu():
    meta = utm_meta()
    prob = np.zeros((100, 100), dtype=np.float32)
    prob[10:30, 10:40] = 0.9     # 20 x 30 = 600 px = 6.0 ha
    prob[60:80, 60:70] = 0.7     # 20 x 10 = 200 px = 2.0 ha  (exactly MMU -> kept)
    prob[90:92, 90:92] = 0.95    # 4 px = 0.04 ha -> dropped
    patches, labels, rep = extract_patches(prob, meta, threshold=0.5, mmu_ha=2.0)
    assert rep.n_components_total == 3 and rep.n_patches_kept == 2 and rep.n_dropped_below_mmu == 1
    assert [p.id for p in patches] == ["P1", "P2"]           # sorted by area desc
    assert patches[0].area_ha == pytest.approx(6.0)
    assert patches[1].area_ha == pytest.approx(2.0)
    assert patches[0].confidence == pytest.approx(0.9)
    assert patches[1].confidence == pytest.approx(0.7)
    # centroid of blob 1: pixel (x=25, y=20) -> UTM (650_250, 1_094_800) -> WGS84 near 9.9N 76.4E
    lat, lon = patches[0].centroid
    assert 9.5 < lat < 10.5 and 76.0 < lon < 77.0
    assert patches[0].geometry["type"] == "Polygon"
    assert patches[0].perimeter_km == pytest.approx((2 * 200 + 2 * 300) / 1000.0, rel=0.05)
    assert rep.habitat_area_ha == pytest.approx(8.0)
    assert rep.landscape_area_ha == pytest.approx(100.0)   # 100x100 px * 0.01 ha
    assert rep.habitat_coverage_pct == pytest.approx(100 * 804 / 10000)


def test_threshold_controls_binary_map():
    meta = utm_meta()
    prob = np.full((100, 100), 0.4, dtype=np.float32)
    prob[0:50] = 0.6
    p_low, _, _ = extract_patches(prob, meta, threshold=0.3, mmu_ha=0.0)
    p_high, _, _ = extract_patches(prob, meta, threshold=0.5, mmu_ha=0.0)
    assert len(p_low) == 1 and p_low[0].area_ha == pytest.approx(100.0)
    assert len(p_high) == 1 and p_high[0].area_ha == pytest.approx(50.0)


def test_diagonal_connectivity_4_vs_8():
    meta = utm_meta(10, 10)
    prob = np.zeros((10, 10), dtype=np.float32)
    prob[2, 2] = prob[3, 3] = 1.0   # diagonal neighbours
    p8, _, _ = extract_patches(prob, meta, mmu_ha=0.0, connectivity=8)
    p4, _, _ = extract_patches(prob, meta, mmu_ha=0.0, connectivity=4)
    assert len(p8) == 1 and len(p4) == 2


def test_nodata_excluded_from_landscape_and_habitat():
    meta = utm_meta()
    prob = np.full((100, 100), 0.9, dtype=np.float32)
    valid = np.ones((100, 100), bool)
    valid[:, 50:] = False
    patches, _, rep = extract_patches(prob, meta, valid_mask=valid, mmu_ha=0.0)
    assert rep.landscape_area_ha == pytest.approx(50.0)
    assert rep.habitat_area_ha == pytest.approx(50.0)
    assert rep.habitat_coverage_pct == pytest.approx(100.0)


def test_geojson_export():
    meta = utm_meta()
    prob = np.zeros((100, 100), dtype=np.float32)
    prob[10:30, 10:40] = 0.9
    patches, _, _ = extract_patches(prob, meta)
    fc = patches_to_geojson(patches, {"P1": {"criticality_score": 0.5}})
    assert fc["type"] == "FeatureCollection" and len(fc["features"]) == 1
    f = fc["features"][0]
    assert f["properties"]["criticality_score"] == 0.5
    assert "centroid_lat" in f["properties"] and f["geometry"]["type"] == "Polygon"
