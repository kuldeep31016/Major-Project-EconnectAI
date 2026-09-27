"""Phase-2 platform: migrations, artifact registry, storage abstraction, background jobs."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from backend import jobs
from backend.migrate import _config, upgrade
from alembic.script import ScriptDirectory
from backend.storage import LocalStorage, sha256_file
from ecoconnect.pipeline import sources
from ecoconnect.pipeline.analysis import run_graph_analysis
from ecoconnect.pipeline.config import OUTPUTS_DIR, load_config, load_study_areas

HEAD = ScriptDirectory.from_config(_config()).get_current_head()


@pytest.fixture(scope="module")
def client():
    patches, cands, a_l, src, _ = sources.from_prototype_mock("sundarbans")
    src = {**src, "type": "probability_raster", "scene_year": 2020, "threshold": 0.5, "mmu_ha": 2.0}
    run_graph_analysis(study_area_id="sundarbans", study_area_meta=load_study_areas()["sundarbans"], patches=patches,
                       landscape_area_ha=a_l, cfg=load_config("graph"), data_source=src, result_kind="development",
                       candidates=cands, run_id="plat_run", out_root=OUTPUTS_DIR)
    import backend.main as m
    with TestClient(m.app) as c:
        yield c


def _auth(c, user):
    return {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": user, "password": "testpass"}).json()["token"]}


def test_fresh_and_legacy_databases_reach_head(tmp_path):
    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    upgrade(fresh)
    assert {"jobs", "artifacts", "alembic_version", "users"} <= set(inspect(fresh).get_table_names())
    # a pre-Alembic database (create_all of the baseline tables) is stamped, then upgraded, keeping its data
    legacy = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    upgrade(legacy, "0001_baseline")            # the exact pre-Alembic schema, then forget Alembic ever ran
    with legacy.begin() as c:
        c.exec_driver_sql("DROP TABLE alembic_version")
        c.exec_driver_sql("INSERT INTO organizations (name) VALUES ('keep me')")
    upgrade(legacy)
    with legacy.connect() as c:
        assert c.exec_driver_sql("SELECT name FROM organizations").scalar() == "keep me"
        assert c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar() == HEAD


def test_artifacts_registered_with_hashes(client):
    from backend.db import Artifact, SessionLocal
    with SessionLocal() as db:
        arts = db.query(Artifact).filter_by(run_id="plat_run").all()
        kinds = {a.kind for a in arts}
        assert {"run_manifest", "patches_geojson", "graph", "criticality"} <= kinds
        man = next(a for a in arts if a.kind == "run_manifest")
        assert man.sha256 == sha256_file(OUTPUTS_DIR / man.key) and man.storage == "local"


def test_local_storage_rejects_traversal(tmp_path):
    s = LocalStorage(tmp_path)
    assert s.put_bytes("a/b.txt", b"x") == "a/b.txt" and s.get_bytes("a/b.txt") == b"x"
    for bad in ("../x", "a/../../x", "a//b", ""):
        with pytest.raises(Exception):
            s.put_bytes(bad, b"x")


def test_scenario_job_lifecycle(client):
    s = _auth(client, "senior")
    pid = client.get("/api/runs/sundarbans/plat_run/criticality").json()[0]["patch_id"]
    body = {"type": "scenario", "params": {"study_area": "sundarbans", "run_id": "plat_run",
                                           "body": {"type": "remove_patches", "patch_ids": [pid]}}}
    assert client.post("/api/jobs", json=body).status_code == 401
    j = client.post("/api/jobs", headers=s, json=body).json()
    assert j["status"] == "QUEUED"
    assert jobs.work_once("test") is True
    done = client.get(f"/api/jobs/{j['id']}", headers=s).json()
    assert done["status"] == "COMPLETED" and done["progress"] == 1.0
    sync = client.post("/api/runs/sundarbans/plat_run/scenario", json={"type": "remove_patches", "patch_ids": [pid]}).json()
    assert done["result"]["difference"] == sync["difference"]
    # another user cannot see it; an auditor can
    assert client.get(f"/api/jobs/{j['id']}", headers=_auth(client, "field")).status_code == 404
    assert client.get(f"/api/jobs/{j['id']}", headers=_auth(client, "admin")).status_code == 200


def test_failed_job_records_error_and_worker_survives(client):
    s = _auth(client, "senior")
    j = client.post("/api/jobs", headers=s, json={"type": "scenario", "params": {
        "study_area": "sundarbans", "run_id": "plat_run", "body": {"type": "no_such_type"}}}).json()
    assert jobs.work_once("test")
    out = client.get(f"/api/jobs/{j['id']}", headers=s).json()
    assert out["status"] == "FAILED" and out["error"]
    assert jobs.work_once("test") is False          # queue empty, worker still fine


def test_cancel_queued_job(client):
    s = _auth(client, "senior")
    j = client.post("/api/jobs", headers=s, json={"type": "scenario", "params": {
        "study_area": "sundarbans", "body": {"type": "remove_patches", "patch_ids": ["P01"]}}}).json()
    assert client.post(f"/api/jobs/{j['id']}/cancel", headers=s).json()["status"] == "CANCELLED"
    assert jobs.work_once("test") is False


def test_segment_is_queued_not_run_inline(client):
    a = _auth(client, "admin")
    tif = str(OUTPUTS_DIR / "none.tif")
    r = client.post("/api/segment", headers=a, json={"study_area": "sundarbans", "probability_tif": tif})
    assert r.status_code == 202 and r.json()["type"] == "segment" and r.json()["status"] == "QUEUED"
    assert client.post("/api/segment", headers=a, json={"study_area": "sundarbans", "probability_tif": tif}).status_code == 409
    assert jobs.work_once("test")        # fails (no raster), but is recorded, and the lock clears
    assert client.get(f"/api/jobs/{r.json()['id']}", headers=a).json()["status"] == "FAILED"


def test_ready_and_artifact_listing(client):
    assert client.get("/api/ready").json() == {"status": "ready", "schema": HEAD}
    arts = client.get("/api/artifacts?run_id=plat_run&kind=graph").json()
    assert len(arts) == 1 and len(arts[0]["sha256"]) == 64
