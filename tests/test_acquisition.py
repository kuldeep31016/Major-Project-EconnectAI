"""Offline tests for the acquisition helpers (no network)."""
from ecoconnect.gee import AOI, TargetGrid, gmw_tile_names


def test_gmw_tile_names_cover_bbox():
    aoi = AOI("kerala-coast", (9.778, 76.272, 9.978, 76.472))
    assert gmw_tile_names(aoi) == ["N10E076"]              # 9.78-9.98N lies in the tile whose top edge is 10N
    aoi2 = AOI("x", (21.80, 88.60, 22.10, 88.90))          # crosses the 22N parallel
    assert gmw_tile_names(aoi2) == ["N22E088", "N23E088"]
    aoi3 = AOI("s", (-1.5, -60.5, -0.5, -59.5))            # bands -2..-1 (top -1 -> S01) and -1..0 (top 0 -> N00)
    assert gmw_tile_names(aoi3) == ["S01W061", "S01W060", "N00W061", "N00W060"]


def test_target_grid_is_utm_and_snapped():
    aoi = AOI("kerala-coast", (9.778, 76.272, 9.978, 76.472))
    g = TargetGrid.for_aoi(aoi, 10.0)
    assert g.crs.to_epsg() == 32643
    assert g.transform.a == 10.0 and g.transform.e == -10.0
    assert g.transform.c % 10 == 0 and g.transform.f % 10 == 0
    assert 2100 < g.width < 2300 and 2100 < g.height < 2300           # ~22 km at 10 m
