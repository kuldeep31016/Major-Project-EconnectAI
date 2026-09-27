"""Phase 4: sensitivity engine and new scenario types (reduce area, hypothetical patch, radius)."""
from pathlib import Path

import pytest

from ecoconnect.graph import Patch
from ecoconnect.graph.sensitivity import jaccard, kendall_tau, scale_areas, sensitivity

KERALA = Path(__file__).resolve().parents[1] / "outputs" / "runs" / "kerala-coast" / "kerala-coast_20260920T182222Z"


def test_rank_statistics():
    assert kendall_tau([1, 2, 3, 4], [1, 2, 3, 4]) == 1.0
    assert kendall_tau([1, 2, 3, 4], [4, 3, 2, 1]) == -1.0
    assert jaccard(["a", "b"], ["b", "c"]) == pytest.approx(1 / 3)


def test_sensitivity_reference_variant_is_identity():
    ps = [Patch(id=f"P{i}", area_ha=10 + i, centroid=(0.0, 0.01 * i)) for i in range(6)]   # a line of patches ~1.1 km apart
    r = sensitivity(ps, 1000.0, taus_km=[1.0, 5.0], ks=[2, 3], reference=(5.0, 3), top_n=3)
    ref = next(v for v in r["variants"] if v["tau_km"] == 5.0 and v["k"] == 3)
    assert ref["spearman"] == 1.0 and ref["kendall"] == 1.0 and ref["top_overlap"] == 1.0
    assert len(r["variants"]) == 4 and all(s["of"] == 4 for s in r["stability"])


def test_scale_areas_only_touches_selected():
    ps = [Patch(id="A", area_ha=10, centroid=(0, 0)), Patch(id="B", area_ha=10, centroid=(0, 0.01))]
    out = scale_areas(ps, ["A"], 0.25)
    assert [p.area_ha for p in out] == [2.5, 10] and ps[0].area_ha == 10


@pytest.mark.skipif(not KERALA.exists(), reason="stored Kerala run not present")
def test_new_scenarios_on_kerala_run():
    from backend.scenarios import run_scenario
    shrink = run_scenario(KERALA, {"type": "reduce_area", "patch_ids": ["P17"], "retain_fraction": 0.5})
    assert shrink["label"] == "SIMULATED" and shrink["difference"]["n_edges"] == 0
    assert shrink["difference"]["habitat_area_ha"] == pytest.approx(-3.13 / 2, abs=1e-6)
    add = run_scenario(KERALA, {"type": "add_patch", "lat": 9.93, "lon": 76.34, "area_ha": 5})
    assert add["difference"]["n_patches"] == 1 and add["added"][0]["extra"]["hypothetical"]
    with pytest.raises(ValueError):
        run_scenario(KERALA, {"type": "add_patch", "lat": 20.0, "lon": 86.0, "area_ha": 5})     # outside the study area
    rad = run_scenario(KERALA, {"type": "radius", "tau_km": 3})
    assert rad["difference"]["n_edges"] == rad["scenario"]["n_edges"] - rad["baseline"]["n_edges"]
    sens = run_scenario(KERALA, {"type": "sensitivity", "taus_km": [3, 5, 8], "ks": [3]})
    assert len(sens["variants"]) == 3 and sens["min_spearman"] is not None and "stable" in sens["verdict"].lower()
