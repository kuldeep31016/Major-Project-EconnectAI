"""Patch tracking between runs: every change class on hand-made polygons with known answers."""
from ecoconnect.graph.temporal import comparability, track_patches


def _sq(pid, x0, y0, w, h=None):
    h = h or w
    ring = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]]
    return {"type": "Feature", "properties": {"id": pid}, "geometry": {"type": "Polygon", "coordinates": [ring]}}


def _fc(*f):
    return {"type": "FeatureCollection", "features": list(f)}


D = 0.01  # ~1.1 km at the equator
A = _fc(_sq("A1", 0, 0, D), _sq("A2", 0.1, 0, D), _sq("A3", 0.2, 0, D), _sq("A4", 0.3, 0, D), _sq("A5", 0.3 + 1.2 * D, 0, D),
        _sq("A6", 0.5, 0, D))
B = _fc(_sq("B1", 0, 0, D),                                     # A1 stable
        _sq("B2", 0.1, 0, D / 2), _sq("B3", 0.1 + D / 2, 0, D / 2),  # A2 split into two halves
        _sq("B4", 0.3, 0, 2.2 * D),                              # A4 + A5 merged
        _sq("B5", 0.5, 0, D, 2 * D),                             # A6 grown (double area)
        _sq("B6", 0.7, 0, D))                                    # new; A3 disappeared


def test_track_patches_classifies_every_change():
    t = track_patches(A, B)
    by = {tuple(e["patches_a"]): e for e in t["events"] if e["patches_a"]}
    assert by[("A1",)]["type"] == "stable"
    assert by[("A2",)]["type"] == "split" and by[("A2",)]["patches_b"] == ["B2", "B3"]
    assert by[("A3",)]["type"] == "disappeared"
    assert by[("A4", "A5")]["type"] == "merged"
    assert by[("A6",)]["type"] == "grown" and abs(by[("A6",)]["area_b_ha"] / by[("A6",)]["area_a_ha"] - 2) < 0.01
    assert t["counts"] == {"stable": 1, "split": 1, "disappeared": 1, "merged": 1, "grown": 1, "new": 1}


def test_comparability_flags_different_models():
    same = {"data_source": {"model": "m.pth", "threshold": 0.7, "mmu_ha": 2}}
    other = {"data_source": {"model": "n.pth", "threshold": 0.5, "mmu_ha": 2}}
    assert comparability(same, same)["comparable"]
    c = comparability(same, other)
    assert not c["comparable"] and "different model checkpoints" in c["reasons"] and "must not be read as habitat change" in c["note"]


def test_comparability_ignores_where_the_run_was_produced():
    rel = {"data_source": {"model": "outputs/segmentation/m/best_model.pth", "threshold": 0.7, "mmu_ha": 2}}
    ab = {"data_source": {"model": "/Users/someone/repo/outputs/segmentation/m/best_model.pth", "threshold": 0.7, "mmu_ha": 2}}
    assert comparability(rel, ab)["comparable"]
