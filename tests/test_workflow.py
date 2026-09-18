"""Verification workflow, RBAC, alerts, projects and audit over a development-kind run built from the
prototype geometry (result_kind forced to 'development' so the alert engine accepts it; the geometry is
still synthetic - this only tests the workflow machinery)."""
import io

import pytest
from fastapi.testclient import TestClient

from ecoconnect.pipeline import sources
from ecoconnect.pipeline.analysis import run_graph_analysis
from ecoconnect.pipeline.config import OUTPUTS_DIR, load_config, load_study_areas


@pytest.fixture(scope="module")
def client():
    cfg = load_config("graph")
    areas = load_study_areas()
    patches, cands, a_l, src, _ = sources.from_prototype_mock("odisha-coast")
    src = {**src, "type": "probability_raster", "scene_year": 2020, "threshold": 0.5, "mmu_ha": 2.0}
    run_graph_analysis(study_area_id="odisha-coast", study_area_meta=areas["odisha-coast"], patches=patches,
                       landscape_area_ha=a_l, cfg=cfg, data_source=src, result_kind="development",
                       candidates=cands, run_id="wf_test_run", out_root=OUTPUTS_DIR)
    import backend.main as m
    m.RUNS_DIR = OUTPUTS_DIR / "runs"
    with TestClient(m.app) as c:
        yield c


def _auth(c, user):
    r = c.post("/api/auth/login", json={"username": user, "password": "testpass"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_login_and_rbac(client):
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    f = _auth(client, "field")
    assert client.get("/api/auth/me", headers=f).json()["role"] == "field_officer"
    assert client.get("/api/audit", headers=f).status_code == 403
    assert client.post("/api/field-tasks", headers=f, json={"study_area_id": "odisha-coast", "title": "x", "reason": "x", "lat": 20.7, "lon": 86.9}).status_code == 403
    assert client.get("/api/field-tasks").status_code == 401


def test_registry_and_alerts(client):
    reg = client.get("/api/registry/odisha-coast").json()
    assert any(v["id"] == "wf_test_run" and v["result_kind"] == "development" for v in reg["analysisVersions"])
    s = _auth(client, "senior")
    out = client.post("/api/alerts/generate/odisha-coast", headers=s).json()
    assert out["run_id"] == "wf_test_run" and out["generated"] >= 1
    alerts = client.get("/api/alerts?study_area=odisha-coast").json()
    assert all(a["reason"] and a["evidence"] for a in alerts)
    assert any(a["type"] == "critical_patch" for a in alerts)


def test_verification_lifecycle(client):
    s, f = _auth(client, "senior"), _auth(client, "field")
    alert = next(a for a in client.get("/api/alerts?study_area=odisha-coast").json() if a["type"] == "critical_patch")
    field_id = client.get("/api/auth/me", headers=f).json()["id"]
    t = client.post("/api/field-tasks", headers=s, json={
        "study_area_id": "odisha-coast", "title": "Verify " + alert["object_id"], "reason": alert["reason"],
        "lat": alert["lat"], "lon": alert["lon"], "object_type": "patch", "object_id": alert["object_id"],
        "run_id": alert["run_id"], "alert_id": alert["id"], "assignee_id": field_id}).json()
    assert t["status"] == "PENDING" and t["detection_id"]
    det = client.get("/api/detections?study_area=odisha-coast").json()[0]
    assert det["status"] == "FIELD_ASSIGNED"
    # AI output cannot be confirmed without accepted field evidence
    assert client.patch(f"/api/detections/{det['id']}/status", headers=s, json={"status": "CONFIRMED"}).status_code == 409
    # field officer sees only own tasks and can submit evidence with a validated photo
    assert [x["id"] for x in client.get("/api/field-tasks", headers=f).json()] == [t["id"]]
    bad = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f, data={"lat": 20.7, "lon": 86.9, "observed_at": "2026-09-19", "observation": "habitat_present"},
                      files={"photo": ("x.txt", b"not an image", "text/plain")})
    assert bad.status_code == 400
    ev = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f, data={"lat": 20.7, "lon": 86.9, "observed_at": "2026-09-19", "observation": "habitat_present", "notes": "ok"},
                     files={"photo": ("x.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")}).json()
    assert ev["verification"] == "SUBMITTED"
    assert client.get("/api/field-tasks", headers=s).json()[0]["status"] == "SUBMITTED"
    # field officer cannot verify; senior can
    assert client.patch(f"/api/evidence/{ev['id']}/verify", headers=f, json={"verification": "ACCEPTED"}).status_code == 403
    assert client.patch(f"/api/evidence/{ev['id']}/verify", headers=s, json={"verification": "ACCEPTED", "reason": "consistent"}).json()["verification"] == "ACCEPTED"
    det = client.get("/api/detections?study_area=odisha-coast").json()[0]
    assert det["status"] == "FIELD_VERIFIED"
    assert client.patch(f"/api/detections/{det['id']}/status", headers=s, json={"status": "CONFIRMED"}).json()["status"] == "CONFIRMED"
    alerts = {a["id"]: a for a in client.get("/api/alerts?study_area=odisha-coast").json()}
    assert alerts[alert["id"]]["status"] == "RESOLVED"


def test_projects_and_audit(client):
    s, a = _auth(client, "senior"), _auth(client, "admin")
    p = client.post("/api/projects", headers=s, json={"name": "Bhitarkanika 2026", "study_area_id": "odisha-coast", "run_id": "wf_test_run", "priority_patches": ["odisha-coast-p07"]}).json()
    assert p["status"] == "PLANNED"
    assert client.patch(f"/api/projects/{p['id']}", headers=s, json={"status": "ACTIVE", "reason": "approved"}).json()["status"] == "ACTIVE"
    assert client.patch(f"/api/projects/{p['id']}", headers=s, json={"status": "BOGUS"}).status_code == 400
    log = client.get("/api/audit", headers=a).json()
    actions = {r["action"] for r in log}
    assert {"login", "generate_alerts", "create_field_task", "submit_evidence", "verify_evidence", "detection_status", "create_project", "update_project"} <= actions
    assert all(r["username"] for r in log)


def test_model_cards_keep_categories_separate(client):
    mc = client.get("/api/model-cards").json()
    assert "NOT OURS" in mc["foundationPaper"]["label"]
    assert mc["prototype"]["label"].startswith("PROTOTYPE")
    assert isinstance(mc["ours"], list)


def test_scenarios_and_feasibility(client):
    R = "/api/runs/odisha-coast/wf_test_run"
    crit = client.get(R + "/criticality").json()
    r = client.post(R + "/scenario", json={"type": "remove_patches", "patch_ids": [crit[0]["patch_id"]]}).json()
    assert r["label"] == "SIMULATED" and r["difference"]["c"] < 0 and "lowers" in r["explanation"]
    assert abs(r["difference"]["c_pct"] + crit[0]["delta_pct"]) < 1e-6          # scenario == criticality row
    t = client.post(R + "/scenario", json={"type": "tau", "taus_km": [3, 5, 8]}).json()
    assert [v["tau_km"] for v in t["variants"]] == [3, 5, 8] and t["variants"][1]["spearman_vs_reference"] == 1.0
    fe = client.get(R + "/restoration/feasibility").json()
    assert fe["candidates"] and all(c["verdict"] in ("recommended", "conditional", "not_recommended") for c in fe["candidates"])
    assert all("cost not assessed" in " ".join(c["not_assessed"]) for c in fe["candidates"])
    ids = [c["candidate_id"] for c in fe["candidates"][:2]]
    m = client.post(R + "/scenario", json={"type": "restore_multi", "candidate_ids": ids}).json()
    assert m["difference"]["c"] > 0 and len(m["individual"]) == 2
    assert client.post(R + "/scenario", json={"type": "threshold"}).status_code == 400   # synthetic geometry has no raster
