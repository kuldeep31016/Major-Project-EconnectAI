"""Verification workflow, RBAC, alerts, projects and audit over a development-kind run built from the
prototype geometry (result_kind forced to 'development' so the alert engine accepts it; the geometry is
still synthetic - this only tests the workflow machinery)."""

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
    import backend.paths
    backend.paths.RUNS_DIR = OUTPUTS_DIR / "runs"
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
    det = next(d for d in client.get("/api/detections?study_area=odisha-coast").json() if d["id"] == t["detection_id"])
    assert det["status"] == "FIELD_ASSIGNED"
    # AI output cannot be confirmed without accepted field evidence
    assert client.patch(f"/api/detections/{det['id']}/status", headers=s, json={"status": "CONFIRMED"}).status_code == 409
    # field officer sees only own tasks and can submit evidence with a validated photo
    mine = client.get("/api/field-tasks", headers=f).json()
    assert t["id"] in [x["id"] for x in mine] and all(x["assignee_id"] == field_id for x in mine)
    bad = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f, data={"lat": 20.7, "lon": 86.9, "observed_at": "2026-09-19", "observation": "habitat_present"},
                      files={"photo": ("x.txt", b"not an image", "text/plain")})
    assert bad.status_code == 400
    ev = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f, data={"lat": 20.7, "lon": 86.9, "observed_at": "2026-09-19", "observation": "habitat_present", "notes": "ok"},
                     files={"photo": ("x.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")}).json()
    assert ev["verification"] == "SUBMITTED"
    assert next(x for x in client.get("/api/field-tasks", headers=s).json() if x["id"] == t["id"])["status"] == "SUBMITTED"
    # field officer cannot verify; senior can
    assert client.patch(f"/api/evidence/{ev['id']}/verify", headers=f, json={"verification": "ACCEPTED"}).status_code == 403
    assert client.patch(f"/api/evidence/{ev['id']}/verify", headers=s, json={"verification": "ACCEPTED", "reason": "consistent"}).json()["verification"] == "ACCEPTED"
    det = next(d for d in client.get("/api/detections?study_area=odisha-coast").json() if d["id"] == t["detection_id"])
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


def test_evidence_assistant_and_official_report(client):
    s = _auth(client, "senior")
    crit = client.get("/api/runs/odisha-coast/wf_test_run/criticality").json()
    pid = crit[0]["patch_id"]
    ch = client.get(f"/api/runs/odisha-coast/wf_test_run/evidence/patch/{pid}", headers=s).json()
    assert ch["decision"]["rank"] == 1 and ch["criticality_calculation"]["S_i"] == crit[0]["criticality_score"]
    assert ch["field_verification"] and ch["verification_status"] == "CONFIRMED"      # from the lifecycle test
    a = client.post("/api/assistant/ask", json={"question": "Which patches are most critical?", "study_area": "odisha-coast", "run_id": "wf_test_run"}).json()
    assert a["intent"] == "critical" and pid in a["answer"] and a["label"]
    w = client.post("/api/assistant/ask", json={"question": f"what happens if {pid} is removed", "study_area": "odisha-coast", "run_id": "wf_test_run"}).json()
    assert w["intent"] == "whatif" and f"{crit[0]['delta_pct']:.1f}" in w["answer"]
    anon = client.get(f"/api/runs/odisha-coast/wf_test_run/evidence/patch/{pid}").json()
    assert anon["redacted"] and "lat" not in str(anon["field_verification"]) and "user_id" not in str(anon["field_verification"])
    assert client.get("/api/projects").status_code == 401 and client.get("/api/reports").status_code == 401
    p = client.get("/api/projects", headers=s).json()[0]
    rep = client.post("/api/reports/generate", headers=s, json={"study_area": "odisha-coast", "run_id": "wf_test_run", "project_id": p["id"]}).json()
    assert rep["status"] == "draft" and any(sec["id"] == "verification" for sec in rep["sections"]) and rep["sections"][0]["id"] == "project"
    assert client.get("/api/reports?study_area=odisha-coast", headers=s).json()[0]["id"] == rep["id"]
    assert client.post("/api/reports/generate", headers=_auth(client, "field"), json={"study_area": "odisha-coast"}).status_code == 403


def test_login_throttled(client):
    codes = [client.post("/api/auth/login", json={"username": "throttle-probe", "password": "x"}).status_code
             for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_segment_rejects_foreign_paths(client):
    h = _auth(client, "admin")
    bad = [{"study_area": "kerala-coast", "probability_tif": "/etc/passwd"},
           {"study_area": "kerala-coast", "scene_tif": "data/x.tif", "checkpoint": "/tmp/evil.pth"},
           {"study_area": "../x", "probability_tif": "outputs/x.tif"},
           {"study_area": "kerala-coast", "probability_tif": "outputs/x.tif", "result_kind": "experiment"}]
    for body in bad:
        assert client.post("/api/segment", json=body, headers=h).status_code in (400, 404, 422), body


def test_rejected_evidence_reopens_task_and_keeps_alert(client):
    s, f = _auth(client, "senior"), _auth(client, "field")
    client.post("/api/alerts/generate/odisha-coast", headers=s)
    alert = next(a for a in client.get("/api/alerts?study_area=odisha-coast").json() if a["status"] == "OPEN")
    field_id = client.get("/api/auth/me", headers=f).json()["id"]
    t = client.post("/api/field-tasks", headers=s, json={
        "study_area_id": "odisha-coast", "title": "t", "reason": "r", "lat": alert["lat"], "lon": alert["lon"],
        "alert_id": alert["id"], "assignee_id": field_id}).json()
    # a fake image (right MIME, wrong bytes) is refused
    fake = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f, data={"lat": 1, "lon": 1, "observed_at": "d", "observation": "o"},
                       files={"photo": ("x.png", b"GIF89a....", "image/png")})
    assert fake.status_code == 400
    ev = client.post(f"/api/field-tasks/{t['id']}/evidence", headers=f,
                     data={"lat": 1, "lon": 1, "observed_at": "d", "observation": "o"}).json()
    client.patch(f"/api/evidence/{ev['id']}/verify", headers=s, json={"verification": "REJECTED"})
    task = next(x for x in client.get("/api/field-tasks", headers=s).json() if x["id"] == t["id"])
    assert task["status"] == "IN_PROGRESS"
    alerts = {a["id"]: a for a in client.get("/api/alerts?study_area=odisha-coast").json()}
    assert alerts[alert["id"]]["status"] == "ASSIGNED"
    # regenerating alerts must not break the task's reference
    assert client.post("/api/alerts/generate/odisha-coast", headers=s).status_code == 200


def test_task_and_detection_reference_validation(client):
    s = _auth(client, "senior")
    base = {"study_area_id": "odisha-coast", "title": "t", "reason": "r", "lat": 1, "lon": 1}
    assert client.post("/api/field-tasks", headers=s, json={**base, "assignee_id": 99999}).status_code == 400
    assert client.post("/api/field-tasks", headers=s, json={**base, "study_area_id": "nowhere"}).status_code == 400
    assert client.post("/api/detections", headers=s, json={"study_area_id": "odisha-coast", "run_id": "nope",
                                                           "object_type": "patch", "object_id": "P01"}).status_code == 400


def test_saved_scenario_is_recomputed_server_side(client):
    s = _auth(client, "senior")
    pid = client.get("/api/runs/odisha-coast/wf_test_run/criticality").json()[0]["patch_id"]
    out = client.post("/api/scenarios", headers=s, json={
        "study_area_id": "odisha-coast", "run_id": "wf_test_run", "type": "remove_patches",
        "params": {"patch_ids": [pid]}, "result": {"difference": {"loss_pct": 99.9}}}).json()
    real = client.post("/api/runs/odisha-coast/wf_test_run/scenario", json={"type": "remove_patches", "patch_ids": [pid]}).json()
    assert out["result"]["difference"] == real["difference"] and out["label"] == real["label"]


def test_official_report_pdf(client):
    s = _auth(client, "senior")
    rep = client.post("/api/reports/generate", headers=s, json={"study_area": "odisha-coast", "run_id": "wf_test_run"}).json()
    rid = int(rep["id"].split("-")[1])
    assert client.get(f"/api/reports/{rid}/pdf").status_code == 401
    r = client.get(f"/api/reports/{rid}/pdf", headers=s)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content[:5] == b"%PDF-"
    assert len(r.content) > 3000
    arts = client.get("/api/artifacts?kind=report_pdf").json()
    assert any(a["meta"]["report_id"] == rid and len(a["sha256"]) == 64 for a in arts)


def test_refresh_rotation_reuse_detection_and_logout(client):
    r = client.post("/api/auth/login", json={"username": "gis", "password": "testpass"}).json()
    assert r["expires_in"] > 0 and r["refresh_token"]
    r2 = client.post("/api/auth/refresh", json={"refresh_token": r["refresh_token"]}).json()
    assert r2["token"] and r2["refresh_token"] != r["refresh_token"]
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer " + r2["token"]}).json()["username"] == "gis"
    # presenting the rotated token again = theft signal: the whole family is revoked
    assert client.post("/api/auth/refresh", json={"refresh_token": r["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": r2["refresh_token"]}).status_code == 401
    r3 = client.post("/api/auth/login", json={"username": "gis", "password": "testpass"}).json()
    assert client.post("/api/auth/logout", json={"refresh_token": r3["refresh_token"]}).json()["ok"]
    assert client.post("/api/auth/refresh", json={"refresh_token": r3["refresh_token"]}).status_code == 401


def test_request_ids_and_admin_system(client):
    r = client.get("/api/health", headers={"X-Request-ID": "trace-abc-12345"})
    assert r.headers["X-Request-ID"] == "trace-abc-12345" and r.json()["uptime_s"] >= 0
    assert len(client.get("/api/health").headers["X-Request-ID"]) == 16
    assert client.get("/api/admin/system", headers=_auth(client, "field")).status_code == 403
    sysinfo = client.get("/api/admin/system", headers=_auth(client, "admin")).json()
    assert sysinfo["schema"]["ok"] and sysinfo["counts"]["users"] >= 6 and sysinfo["requests"]["total_requests"] > 0
    assert any(x["route"].startswith("GET /api/health") for x in sysinfo["requests"]["routes"])


def _jpeg(gps=None) -> bytes:
    import io

    from PIL import Image
    img, exif = Image.new("RGB", (8, 8), (20, 120, 60)), Image.Exif()
    if gps:
        (lat, lon) = gps
        dms = lambda v: (abs(int(v)), int(abs(v) * 60 % 60), round(abs(v) * 3600 % 60, 2))  # noqa: E731
        exif[0x8825] = {1: "N" if lat >= 0 else "S", 2: dms(lat), 3: "E" if lon >= 0 else "W", 4: dms(lon)}
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif.tobytes())
    return buf.getvalue()


def test_evidence_location_from_photo_gps_never_invented(client):
    s, f = _auth(client, "senior"), _auth(client, "field")
    field_id = client.get("/api/auth/me", headers=f).json()["id"]
    t = client.post("/api/field-tasks", headers=s, json={"study_area_id": "odisha-coast", "title": "gps", "reason": "gps",
                                                          "lat": 20.7, "lon": 86.9, "assignee_id": field_id}).json()
    base = {"observed_at": "2026-10-01", "observation": "habitat_present"}
    url = f"/api/field-tasks/{t['id']}/evidence"
    # no coordinates and a photo without GPS -> refused, not guessed
    r = client.post(url, headers=f, data=base, files={"photo": ("a.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 400 and "Location unavailable" in r.json()["detail"]
    # no coordinates, photo with GPS -> the photo's position (Bhitarkanika, southern/western signs handled)
    ev = client.post(url, headers=f, data=base, files={"photo": ("b.jpg", _jpeg((20.7123, 86.9456)), "image/jpeg")}).json()
    assert ev["location_source"] == "photo_exif" and abs(ev["lat"] - 20.7123) < 1e-3 and abs(ev["lon"] - 86.9456) < 1e-3
    # typed coordinates win; the photo's GPS is still recorded for comparison
    ev = client.post(url, headers=f, data={**base, "lat": 20.8, "lon": 86.8}, files={"photo": ("c.jpg", _jpeg((-8.5, -35.2)), "image/jpeg")}).json()
    assert ev["location_source"] == "submitted" and ev["lat"] == 20.8 and ev["photo_gps"][0] < 0 and ev["photo_gps"][1] < 0


def test_public_compute_is_bounded(client):
    R = "/api/runs/odisha-coast/latest"
    assert client.post(R + "/scenario", json={"type": "tau", "taus_km": [1, 2, 3, 4, 5, 6, 7]}).status_code == 400   # > 6 values
    assert client.post(R + "/scenario", json={"type": "tau", "taus_km": [500]}).status_code == 400                   # out of range
    assert client.post(R + "/reanalyse", json={"k": 500}).status_code == 400
    # a drawn area that touches no patch is an error, never "the nearest patch"
    far = [[0.0, 0.0], [0.0, 0.01], [0.01, 0.01]]
    r = client.post(R + "/scenario", json={"type": "remove_polygon", "polygon": far})
    assert r.status_code == 400 and "does not overlap" in r.json()["detail"]
    from starlette.requests import Request

    from backend.security import CallLimiter
    lim, req = CallLimiter(2, 60, "test"), Request({"type": "http", "client": ("1.2.3.4", 1), "headers": []})
    lim.hit(req); lim.hit(req)
    import pytest as _p
    with _p.raises(Exception) as e:
        lim.hit(req)
    assert getattr(e.value, "status_code", None) == 429


def test_field_officer_sees_only_own_evidence_and_password_policy(client):
    s, a = _auth(client, "senior"), _auth(client, "admin")
    # a task assigned to nobody: a field officer must not read its evidence or photos
    t = client.post("/api/field-tasks", headers=s, json={"study_area_id": "odisha-coast", "title": "other", "reason": "x",
                                                          "lat": 20.7, "lon": 86.9}).json()
    client.post(f"/api/field-tasks/{t['id']}/evidence", headers=_auth(client, "range"), data={"lat": 20.7, "lon": 86.9, "observed_at": "2026-10-01",
                                                                         "observation": "habitat_present"},
                files={"photo": ("p.jpg", _jpeg(), "image/jpeg")})
    f = _auth(client, "field")
    assert client.get(f"/api/field-tasks/{t['id']}/evidence", headers=f).status_code == 403
    photo = client.get(f"/api/field-tasks/{t['id']}/evidence", headers=s).json()[0]["photo_path"]
    assert client.get(f"/api/evidence/photo/{photo}", headers=f).status_code == 403
    assert client.get(f"/api/evidence/photo/{photo}", headers=s).status_code == 200
    body = {"username": "pw_test", "full_name": "PW", "role": "analyst"}
    assert client.post("/api/users", headers=a, json={**body, "password": "short"}).status_code == 400
    assert client.post("/api/users", headers=a, json={**body, "password": "x" * 80}).status_code == 400   # was a 500 (bcrypt)
    assert client.post("/api/users", headers=a, json={**body, "password": "a-valid-password"}).status_code == 200
