"""Phase 3: model registry status ladder, experiment comparison, provenance lineage, reproducibility."""
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import jobs
from ecoconnect.pipeline.config import OUTPUTS_DIR

REPO = Path(__file__).resolve().parents[1]
KERALA = REPO / "outputs" / "runs" / "kerala-coast" / "kerala-coast_20260920T182222Z"


@pytest.fixture(scope="module")
def client():
    if not KERALA.exists():
        pytest.skip("stored Kerala run not present")
    dst = OUTPUTS_DIR / "runs" / "kerala-coast" / KERALA.name
    if not dst.exists():
        shutil.copytree(KERALA, dst)
    import backend.main as m
    with TestClient(m.app) as c:
        from backend.db import Model, SessionLocal
        with SessionLocal() as db:
            for mid in ("reg_dev_a", "reg_dev_b"):
                if not db.get(Model, mid):
                    db.add(Model(id=mid, encoder="efficientnet-b0", mode="development", status="DEVELOPMENT",
                                 input_bands=[0, 1], n_train=10, n_val=2, n_test=2,
                                 metrics={"test": {"iou": 0.5, "f1": 0.6}}))
            db.commit()
        yield c


def _auth(c, user):
    return {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": user, "password": "testpass"}).json()["token"]}


def test_status_ladder_and_validation_rules(client):
    gis, adm = _auth(client, "gis"), _auth(client, "admin")
    url = "/api/models/reg_dev_a/status"
    assert client.patch(url, headers=_auth(client, "field"), json={"status": "EXPERIMENTAL", "reason": "x" * 5}).status_code == 403
    assert client.patch(url, headers=gis, json={"status": "CANDIDATE", "reason": "skip a level"}).status_code == 409
    assert client.patch(url, headers=gis, json={"status": "EXPERIMENTAL", "reason": "ablation"}).json()["status"] == "EXPERIMENTAL"
    assert client.patch(url, headers=gis, json={"status": "CANDIDATE", "reason": "best so far"}).json()["status"] == "CANDIDATE"
    # validation: only admin, only with independent evidence, never with the training reference labels
    ev = {"dataset": "2027 field survey, 120 GPS plots", "metrics": {"f1": 0.8}, "notes": "independent plots, stratified"}
    assert client.patch(url, headers=gis, json={"status": "VALIDATED", "reason": "try", "validation": ev}).status_code == 403
    assert client.patch(url, headers=adm, json={"status": "VALIDATED", "reason": "try"}).status_code == 400
    gmw = {**ev, "dataset": "Global Mangrove Watch 2020"}
    assert client.patch(url, headers=adm, json={"status": "VALIDATED", "reason": "try", "validation": gmw}).status_code == 400
    ok = client.patch(url, headers=adm, json={"status": "VALIDATED", "reason": "field campaign", "validation": ev}).json()
    assert ok["status"] == "VALIDATED" and ok["validation"]["by"] == "admin"
    # demotion clears the validation record; every change is audited
    assert client.patch(url, headers=gis, json={"status": "DEVELOPMENT", "reason": "revert"}).json()["validation"] is None
    log = client.get("/api/audit", headers=adm).json()
    assert sum(r["action"] == "model_status" and r["object_id"] == "reg_dev_a" for r in log) >= 4


def test_compare_experiments(client):
    out = client.get("/api/experiments/compare?ids=reg_dev_a,reg_dev_b").json()
    assert [e["id"] for e in out["experiments"]] == ["reg_dev_a", "reg_dev_b"] and "reference labels" in out["note"]
    assert client.get("/api/experiments/compare?ids=nope").status_code == 404


def test_provenance_chain_for_p17(client):
    lin = client.get("/api/provenance/kerala-coast/kerala-coast_20260920T182222Z?object_type=patch&object_id=P17").json()
    steps = {s["step"]: s for s in lin["steps"]}
    assert list(steps)[0] == "study_area" and list(steps)[-1] == "run"
    r = steps["result"]["detail"]
    assert r["rank"] == 3 and r["is_cut_vertex"] and r["S"] == pytest.approx(0.2695, abs=1e-4)
    assert steps["threshold"]["detail"]["value"] == 0.5
    assert steps["run"]["status"] == "partial"          # this run predates code/config fingerprints - said explicitly
    assert any("field-validated" in x for x in lin["limitations"])
    # the evidence drawer gets the same lineage
    ev = client.get("/api/runs/kerala-coast/kerala-coast_20260920T182222Z/evidence/patch/P17").json()
    assert [s["step"] for s in ev["lineage"]["steps"]] == list(steps)


def test_reproduce_stored_run(client):
    h = _auth(client, "analyst")
    j = client.post("/api/runs/kerala-coast/kerala-coast_20260920T182222Z/reproduce", headers=h).json()
    assert jobs.work_once("test")
    res = client.get(f"/api/jobs/{j['id']}", headers=h).json()
    assert res["status"] == "COMPLETED", res["error"]
    out = res["result"]
    assert out["reproduced"] is True and out["level"] == "graph"
    names = {c["name"] for c in out["checks"]}
    assert {"iic", "n_edges", "criticality (rank, S, cut vertex) for every patch"} <= names


def test_new_runs_record_code_and_config_fingerprints(tmp_path):
    from ecoconnect.pipeline import sources
    from ecoconnect.pipeline.analysis import run_graph_analysis
    from ecoconnect.pipeline.config import load_config, load_study_areas
    from ecoconnect.pipeline.provenance import config_sha256
    patches, cands, a_l, src, kind = sources.from_prototype_mock("kerala-coast")
    cfg = load_config("graph")
    run_dir = run_graph_analysis(study_area_id="kerala-coast", study_area_meta=load_study_areas()["kerala-coast"],
                                 patches=patches, landscape_area_ha=a_l, cfg=cfg, data_source=src, result_kind=kind,
                                 candidates=cands, run_id="fp", out_root=tmp_path)
    import json
    m = json.loads((Path(run_dir) / "manifest.json").read_text())
    assert m["config_sha256"] == config_sha256(cfg) and "git_commit" in m["code"]
    assert "manifest.json" in m["files"]
