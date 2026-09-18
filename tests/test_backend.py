"""API tests over a run produced from prototype geometry (labelled synthetic)."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ecoconnect.pipeline import sources
from ecoconnect.pipeline.analysis import run_graph_analysis
from ecoconnect.pipeline.config import load_config, load_study_areas


@pytest.fixture(scope="module")
def client(tmp_path_factory, monkeypatch_module=None):
    out = tmp_path_factory.mktemp("outputs")
    cfg = load_config("graph")
    areas = load_study_areas()
    patches, cands, a_l, src, kind = sources.from_prototype_mock("kerala-coast")
    run_graph_analysis(study_area_id="kerala-coast", study_area_meta=areas["kerala-coast"], patches=patches,
                       landscape_area_ha=a_l, cfg=cfg, data_source=src, result_kind=kind, candidates=cands,
                       run_id="t1", out_root=out)
    import backend.main as m
    m.RUNS_DIR = out / "runs"
    return TestClient(m.app)


def test_health_and_areas(client):
    assert client.get("/api/health").json()["status"] == "ok"
    areas = client.get("/api/study-areas").json()
    k = next(a for a in areas if a["id"] == "kerala-coast")
    assert k["latestRun"]["runId"] == "t1" and k["latestRun"]["resultKind"] == "synthetic"


def test_bundle_shape(client):
    b = client.get("/api/runs/kerala-coast/latest/bundle").json()
    assert b["provenance"]["resultLabel"].startswith("PROTOTYPE / SYNTHETIC")
    assert len(b["habitatMask"]["patches"]) == 18 and len(b["graph"]["edges"]) == 18
    assert b["connectivity"]["research"]["iic"] == pytest.approx(0.005376, abs=1e-6)
    top = min(b["habitatMask"]["patches"], key=lambda p: p["criticalityRank"])
    assert top["id"] == "kerala-coast-p16" and top["isCutVertex"]


def test_exact_what_if_matches_criticality(client):
    crit = client.get("/api/runs/kerala-coast/latest/criticality").json()
    top = crit[0]
    r = client.post("/api/runs/kerala-coast/latest/what-if", json={"patch_ids": [top["patch_id"]]}).json()
    assert r["delta_connectivity"] == pytest.approx(top["delta_connectivity"])
    assert r["components_after"] == top["component_count_after"] == 5
    assert len(r["severed_edges"]) == top["degree"]
    bad = client.post("/api/runs/kerala-coast/latest/what-if", json={"patch_ids": ["nope"]})
    assert bad.status_code == 400


def test_restoration_with_and_without_costs(client):
    raw = client.post("/api/runs/kerala-coast/latest/restoration", json={}).json()
    assert raw["ranking_basis"] == "raw_gain" and len(raw["candidates"]) == 8
    costs = {c["candidate_id"]: 100.0 + i for i, c in enumerate(raw["candidates"])}
    priced = client.post("/api/runs/kerala-coast/latest/restoration", json={"costs": costs, "cost_unit": "INR lakh"}).json()
    assert priced["ranking_basis"] == "gain_per_cost"
    assert all(c["gain_per_cost"] is not None for c in priced["candidates"])


def test_404s(client):
    assert client.get("/api/runs/nowhere/latest/bundle").status_code == 404
    assert client.get("/api/runs/kerala-coast/zzz/bundle").status_code == 404
