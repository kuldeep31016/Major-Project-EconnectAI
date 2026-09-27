"""Regression tests: stored results must be reproducible from stored inputs, deterministically.

1. The worked example of the current Kerala development run (P17: small, cut vertex, ~27 % IIC loss) and the
   restoration candidate C1 are recomputed from ``patches_input.json`` + the run's config and compared with the
   stored ``criticality.json`` / ``restoration.json``.
2. The synthetic prototype geometry reproduces ``docs/legacy_experiment/results_synthetic_prototype.json``
   (the paper's Tables VI-VIII) for all four landscapes.
These are DEVELOPMENT / SYNTHETIC results - the tests pin reproducibility, not ecological truth.
"""
import json
from pathlib import Path

import pytest

from ecoconnect.graph import Patch, build_graph, compute_criticality, evaluate_candidates, simulate_removal, summarise
from ecoconnect.pipeline import sources

REPO = Path(__file__).resolve().parents[1]
KERALA_RUN = REPO / "outputs" / "runs" / "kerala-coast" / "kerala-coast_20260920T182222Z"
LEGACY = REPO / "docs" / "legacy_experiment" / "results_synthetic_prototype.json"


def _patch(d: dict) -> Patch:
    return Patch(**{**d, "centroid": tuple(d["centroid"]), "bbox": tuple(d["bbox"]) if d.get("bbox") else None})


@pytest.fixture(scope="module")
def kerala():
    if not KERALA_RUN.exists():
        pytest.skip("stored Kerala development run not present")
    m = json.loads((KERALA_RUN / "manifest.json").read_text())
    inp = json.loads((KERALA_RUN / "patches_input.json").read_text())
    g = m["config"]["graph"]
    graph = build_graph([_patch(p) for p in inp["patches"]], k=g["k_neighbors"], tau_km=g["tau_km"],
                        distance_mode=g["distance_mode"])
    return graph, [_patch(c) for c in inp["candidates"]], inp["landscape_area_ha"]


def test_kerala_criticality_matches_stored(kerala):
    graph, _, a_l = kerala
    rows, c_base = compute_criticality(graph, a_l, "iic")
    stored = {r["patch_id"]: r for r in json.loads((KERALA_RUN / "criticality.json").read_text())}
    assert len(rows) == len(stored) == 24
    for r in rows:
        s = stored[r.patch_id]
        assert r.rank == s["rank"] and r.is_cut_vertex == s["is_cut_vertex"], r.patch_id
        assert r.criticality_score == pytest.approx(s["criticality_score"], rel=1e-9)
        assert r.c_before == pytest.approx(s["c_before"], rel=1e-9)


def test_p17_worked_example(kerala):
    graph, _, a_l = kerala
    res = simulate_removal(graph, ["P17"], a_l, "iic")
    stored = next(r for r in json.loads((KERALA_RUN / "criticality.json").read_text()) if r["patch_id"] == "P17")
    assert res.loss_fraction == pytest.approx(stored["criticality_score"], rel=1e-9)
    assert res.loss_pct == pytest.approx(26.95, abs=0.01)                 # ~27 % IIC loss
    assert res.habitat_area_removed_ha == pytest.approx(3.13, abs=1e-6)   # 1.4 % of habitat
    assert (res.components_before, res.components_after) == (2, 3)        # cut vertex
    assert stored["rank"] == 3 and stored["rank_by_area"] == 17 and stored["degree"] == 4


def test_restoration_c1_matches_stored(kerala):
    graph, cands, a_l = kerala
    rows, _ = evaluate_candidates(graph, cands, a_l, "iic")
    stored = {r["candidate_id"]: r for r in json.loads((KERALA_RUN / "restoration.json").read_text())["candidates"]}
    c1 = next(r for r in rows if r.candidate_id == "C1")
    assert c1.rank == stored["C1"]["rank"] == 1
    assert c1.gain_pct == pytest.approx(stored["C1"]["gain_pct"], rel=1e-9)
    assert c1.gain_pct == pytest.approx(1.29, abs=0.005) and c1.area_ha == pytest.approx(1.61)


def test_scenarios_are_deterministic(kerala):
    graph, _, a_l = kerala
    a = simulate_removal(graph, ["P17", "P01"], a_l, "iic")
    b = simulate_removal(graph, ["P01", "P17"], a_l, "iic")
    assert a.c_after == b.c_after and a.components_after == b.components_after
    r1, _ = compute_criticality(graph, a_l, "iic")
    r2, _ = compute_criticality(graph, a_l, "iic")
    assert [(r.patch_id, r.criticality_score) for r in r1] == [(r.patch_id, r.criticality_score) for r in r2]


@pytest.mark.parametrize("area", ["kerala-coast", "sundarbans", "gulf-of-mannar", "odisha-coast"])
def test_synthetic_prototype_reproduces_paper_tables(area):
    ref = json.loads(LEGACY.read_text())["landscapes"][area]
    patches, _, a_l, _, _ = sources.from_prototype_mock(area)
    graph = build_graph(patches, k=3, tau_km=5.0)
    s = summarise(graph, a_l)
    assert (s.n_patches, s.n_edges, s.n_components) == (ref["patches"], ref["edges"], ref["components"])
    assert s.iic == pytest.approx(ref["IIC"], rel=1e-9)
    assert s.pc == pytest.approx(ref["PC"], rel=1e-9)
    assert s.eca_ha == pytest.approx(ref["ECA_ha"], rel=1e-9)
    rows, _ = compute_criticality(graph, a_l, "iic")
    got = {r.patch_id: r for r in rows}
    for e in ref["sensitivity"]:
        assert got[e["id"]].rank == e["rank"], e["id"]
        assert got[e["id"]].criticality_score == pytest.approx(e["S"], rel=1e-9)
