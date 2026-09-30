"""Phase 5: restoration decision workflow, field checklist, model-disagreement register (HITL)."""
import json

import pytest
from fastapi.testclient import TestClient

from ecoconnect.pipeline import sources
from ecoconnect.pipeline.analysis import run_graph_analysis
from ecoconnect.pipeline.config import OUTPUTS_DIR, load_config, load_study_areas

RUN = "p5_run"


@pytest.fixture(scope="module")
def client():
    patches, cands, a_l, src, _ = sources.from_prototype_mock("gulf-of-mannar")
    src = {**src, "type": "probability_raster", "scene_year": 2020, "threshold": 0.5, "mmu_ha": 2.0}
    run_graph_analysis(study_area_id="gulf-of-mannar", study_area_meta=load_study_areas()["gulf-of-mannar"], patches=patches,
                       landscape_area_ha=a_l, cfg=load_config("graph"), data_source=src, result_kind="development",
                       candidates=cands, run_id=RUN, out_root=OUTPUTS_DIR)
    import backend.main as m
    with TestClient(m.app) as c:
        yield c


def _auth(c, user):
    return {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": user, "password": "testpass"}).json()["token"]}


def _evidence(c, h, task_id, checklist):
    return c.post(f"/api/field-tasks/{task_id}/evidence", headers=h, data={
        "lat": 9.1, "lon": 79.1, "observed_at": "2026-09-28", "observation": "site_check", "checklist": json.dumps(checklist)}).json()


def test_checklist_template_and_validation(client):
    t = client.get("/api/field/checklist").json()
    assert "mangrove_present" in t["fields"] and "unsure" in t["fields"]["mangrove_present"]
    s, f = _auth(client, "senior"), _auth(client, "field")
    fid = client.get("/api/auth/me", headers=f).json()["id"]
    task = client.post("/api/field-tasks", headers=s, json={"study_area_id": "gulf-of-mannar", "title": "t", "reason": "r",
                                                            "lat": 9.1, "lon": 79.1, "assignee_id": fid}).json()
    bad = client.post(f"/api/field-tasks/{task['id']}/evidence", headers=f, data={
        "lat": 9.1, "lon": 79.1, "observed_at": "d", "observation": "o", "checklist": json.dumps({"mangrove_present": "maybe"})})
    assert bad.status_code == 400


def test_restoration_review_lifecycle(client):
    s, g, f, a = _auth(client, "senior"), _auth(client, "gis"), _auth(client, "field"), _auth(client, "analyst")
    cand = json.loads((OUTPUTS_DIR / "runs" / "gulf-of-mannar" / RUN / "restoration.json").read_text())["candidates"][0]["candidate_id"]
    r = client.post("/api/restoration/reviews", headers=g, json={"study_area": "gulf-of-mannar", "run_id": RUN, "candidate_id": cand}).json()
    assert r["stage"] == "GIS_REVIEW" and r["model_recommendation"]["label"].startswith("MODEL RECOMMENDATION")
    assert set(r["not_assessed"]) == {"ownership", "legal_status", "water_conditions", "land_use", "cost", "accessibility"}
    rid = r["id"]
    assert client.post("/api/restoration/reviews", headers=g, json={"study_area": "gulf-of-mannar", "run_id": RUN, "candidate_id": cand}).status_code == 409
    # order is enforced: no field task / feasibility / approval before the previous step
    assert client.post(f"/api/restoration/reviews/{rid}/field-task", headers=s, json={}).status_code == 409
    assert client.patch(f"/api/restoration/reviews/{rid}/decision", headers=s, json={"decision": "APPROVED", "reason": "looks good on paper"}).status_code == 409
    assert client.patch(f"/api/restoration/reviews/{rid}/decision", headers=a, json={"decision": "DEFERRED", "reason": "analyst cannot decide"}).status_code == 403
    assert client.patch(f"/api/restoration/reviews/{rid}/gis", headers=g, json={"outcome": "PROCEED", "notes": "imagery consistent"}).json()["stage"] == "FIELD_VERIFICATION"
    fid = client.get("/api/auth/me", headers=f).json()["id"]
    r = client.post(f"/api/restoration/reviews/{rid}/field-task", headers=s, json={"assignee_id": fid}).json()
    tid = r["field_task"]["id"]
    ev = _evidence(client, f, tid, {"mangrove_present": "no", "water_condition": "tidal", "human_disturbance": "low"})
    client.patch(f"/api/evidence/{ev['id']}/verify", headers=s, json={"verification": "ACCEPTED"})
    r = client.get("/api/restoration/reviews?study_area=gulf-of-mannar", headers=s).json()[0]
    assert r["stage"] == "FEASIBILITY"
    assert client.patch(f"/api/restoration/reviews/{rid}/feasibility", headers=g, json={"factor": "ownership", "value": "state land"}).status_code == 400
    r = client.patch(f"/api/restoration/reviews/{rid}/feasibility", headers=g, json={"factor": "ownership", "value": "state land", "source": "revenue office record 12/2026"}).json()
    assert "ownership" not in r["not_assessed"] and r["feasibility"]["ownership"]["by"] == "gis"
    r = client.patch(f"/api/restoration/reviews/{rid}/decision", headers=s, json={"decision": "APPROVED", "reason": "field-verified, state land, tidal"}).json()
    assert r["stage"] == "DECIDED" and r["decision"] == "APPROVED"
    actions = {x["action"] for x in client.get("/api/audit", headers=_auth(client, "admin")).json()}
    assert {"create_restoration_review", "restoration_gis_review", "restoration_field_task", "restoration_feasibility", "restoration_decision"} <= actions


def test_disagreement_flag_review_and_export(client):
    s, f = _auth(client, "senior"), _auth(client, "field")
    fid = client.get("/api/auth/me", headers=f).json()["id"]
    pid = client.get(f"/api/runs/gulf-of-mannar/{RUN}/criticality").json()[0]["patch_id"]
    t = client.post("/api/field-tasks", headers=s, json={"study_area_id": "gulf-of-mannar", "title": "verify", "reason": "r", "lat": 9.1, "lon": 79.1,
                                                         "object_type": "patch", "object_id": pid, "run_id": RUN, "assignee_id": fid}).json()
    ev = _evidence(client, f, t["id"], {"mangrove_present": "no", "habitat_present": "no"})
    assert client.get("/api/hitl/disagreements", headers=s).json() == [] or all(d["evidence_id"] != ev["id"] for d in client.get("/api/hitl/disagreements", headers=s).json())
    client.patch(f"/api/evidence/{ev['id']}/verify", headers=s, json={"verification": "ACCEPTED"})
    dis = [d for d in client.get("/api/hitl/disagreements", headers=s).json() if d["evidence_id"] == ev["id"]]
    assert len(dis) == 1 and dis[0]["kind"] == "false_positive" and dis[0]["status"] == "OPEN"
    assert client.get("/api/hitl/disagreements", headers=f).status_code == 403
    assert client.patch(f"/api/hitl/disagreements/{dis[0]['id']}", headers=s, json={"status": "INCLUDED", "note": "clear photo, no mangrove"}).json()["status"] == "INCLUDED"
    fc = client.get("/api/hitl/export", headers=s).json()
    assert any(x["properties"]["label_mangrove"] == 0 for x in fc["features"]) and "Not used automatically" in fc["note"]


def test_candidate_rule_and_startup_alerts(client):
    from backend.restoration_rules import classify
    assert classify(158.8, 204.6) == "uncertain_habitat"          # Kerala multi-model C01: bigger than the habitat itself
    assert classify(1.6, 219.6) == "restoration_site"            # Kerala dev-model C1
    assert classify(229.8, 63830) == "restoration_site"          # large but small relative to Sundarbans' habitat
    rest = client.get(f"/api/runs/gulf-of-mannar/{RUN}/restoration").json()["candidates"]
    assert all(c["category"] in ("restoration_site", "uncertain_habitat") and c["category_label"] for c in rest)
    from backend.alerts import ensure_alerts
    from backend.db import SessionLocal
    with SessionLocal() as db:
        ensure_alerts(db)
        again = ensure_alerts(db)
    assert again == 0                                            # idempotent: never duplicates alerts
    from backend.alerts import RULES_VERSION
    from backend.db import Alert
    with SessionLocal() as db:
        al = db.query(Alert).all()
    assert al and all((a.evidence or {}).get("rules_version") == RULES_VERSION for a in al)
    # restoration alerts only for restoration-sized sites; uncertain areas get their own field-check alert
    for a in al:
        if a.type == "restoration_opportunity":
            assert "Restoring" in a.title and "Suggested next step" in a.reason


def test_template_assistant_and_report_separate_uncertain_areas(client):
    from backend.db import SessionLocal
    from backend.insight import answer
    from ecoconnect.pipeline.report import build_report
    from pathlib import Path
    rd = Path(__file__).resolve().parents[1] / "outputs" / "runs" / "kerala-coast" / "kerala-coast_multi_E1_s1_b0_dev_t0.70"
    if not rd.exists():
        pytest.skip("stored Kerala run not present")
    with SessionLocal() as db:
        rest = answer(db, "What restoration candidates rank highest?", "kerala-coast", rd)
        cut = answer(db, "Which patches hold the network together?", "kerala-coast", rd)
    head = rest["answer"].split("classed as uncertain habitat")[0]
    assert head.index("C05") < head.index("C01")                 # real sites first; C01 (159 ha) only as uncertain
    assert "C01 (" not in head and "uncertain habitat" in rest["answer"]
    assert cut["intent"] == "cut" and set(cut["objects"]) == {"P02", "P07"}
    sec = next(s for s in build_report(rd, load_study_areas()["kerala-coast"])["sections"] if s["id"] == "restoration")
    assert sec["table"]["columns"][-1] == "Class" and "uncertain habitat" in sec["body"][0]
