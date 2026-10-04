"""Near-real-time satellite layer (backend/satellite). Copernicus is mocked with httpx.MockTransport - the suite never
calls the real service. The end-to-end test runs the real preprocessing + habitat/patch extraction + graph +
criticality + restoration code; only the predict.py subprocess is replaced (no torch / checkpoint in CI)."""
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient

from backend.satellite import catalog, copernicus, preprocessing, processing, service

SECRET = "s3cret-client-secret-value"
BBOX = [9.800, 76.300, 9.820, 76.320]          # tiny test AOI (~2.2 km) in place of the real Kerala bbox


def _now(days_ago: float = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _product(pid, start, pol="VV&VH", cover=True, ptype="IW_GRDH_1S", rel=165):
    lo0, la0, lo1, la1 = (BBOX[1] - 0.5, BBOX[0] - 0.5, BBOX[3] + 0.5, BBOX[2] + 0.5) if cover else \
        (BBOX[1] - 0.5, BBOX[0] - 0.5, BBOX[1] + 0.005, BBOX[2] + 0.5)            # partial: covers ~25 % of the AOI
    return {"Id": pid, "Name": f"S1D_IW_GRDH_1SDV_{pid}.SAFE", "PublicationDate": start,
            "ContentDate": {"Start": start, "End": start},
            "GeoFootprint": {"type": "Polygon", "coordinates": [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]]},
            "Attributes": [{"Name": "productType", "Value": ptype}, {"Name": "operationalMode", "Value": "IW"},
                           {"Name": "polarisationChannels", "Value": pol}, {"Name": "orbitDirection", "Value": "DESCENDING"},
                           {"Name": "relativeOrbitNumber", "Value": rel}, {"Name": "timeliness", "Value": "NRT-3h"},
                           {"Name": "platformSerialIdentifier", "Value": "D"}]}


PRODUCTS = [
    _product("p-partial-newest", _now(0.5), cover=False),
    _product("p-vh-only", _now(1), pol="VH"),
    _product("p-latest", _now(2)),
    _product("p-older", _now(14)),
]


def _tiff(w: int, h: int, vv: float, vh: float) -> bytes:
    a = np.stack([np.full((h, w), vv, np.float32), np.full((h, w), vh, np.float32), np.ones((h, w), np.float32)])
    a[0, :3, :3] = 0.0                                    # a few "no backscatter" pixels -> NaN after dB conversion
    with rasterio.MemoryFile() as mf:
        with mf.open(driver="GTiff", width=w, height=h, count=3, dtype="float32") as d:
            d.write(a)
        return mf.read()


class FakeCopernicus:
    def __init__(self):
        self.calls = {"token": 0, "catalogue": 0, "process": 0}
        self.products = list(PRODUCTS)
        self.process_bodies = []
        self.token_status = 200

    def __call__(self, req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        if url.startswith(copernicus.TOKEN_URL):
            self.calls["token"] += 1
            assert SECRET in req.content.decode()          # the secret goes only to the identity service
            return httpx.Response(self.token_status, json={"access_token": "tok-123", "expires_in": 3600})
        if url.startswith(copernicus.CATALOGUE_URL):
            self.calls["catalogue"] += 1
            return httpx.Response(200, json={"value": self.products})
        if url.startswith(copernicus.PROCESS_URL):
            self.calls["process"] += 1
            assert req.headers["Authorization"] == "Bearer tok-123"
            body = json.loads(req.content)
            self.process_bodies.append(body)
            w, h = body["output"]["width"], body["output"]["height"]
            older = "p-older" in json.dumps(body) or body["input"]["data"][0]["dataFilter"]["timeRange"]["from"] < _now(7)
            return httpx.Response(200, content=_tiff(w, h, 0.06 if older else 0.08, 0.017))
        return httpx.Response(404)


@pytest.fixture
def fake(monkeypatch, tmp_path):
    f = FakeCopernicus()
    copernicus.set_client(httpx.Client(transport=httpx.MockTransport(f)))
    copernicus.TOKENS.invalidate()
    catalog.clear_cache()
    monkeypatch.setattr(copernicus.time, "sleep", lambda s: None)
    monkeypatch.setenv("DATA_ROOT", str(tmp_path / "data"))
    from ecoconnect.pipeline import config as pcfg
    real = pcfg.load_study_areas()

    def areas():
        return {**real, "kerala-coast": {**real["kerala-coast"], "bbox": BBOX}}
    monkeypatch.setattr(pcfg, "load_study_areas", areas)
    monkeypatch.setattr(catalog, "load_study_areas", areas)
    yield f
    copernicus.set_client(None)
    copernicus.TOKENS.invalidate()
    catalog.clear_cache()


@pytest.fixture
def creds(monkeypatch):
    monkeypatch.setenv("COPERNICUS_CLIENT_ID", "eco-client")
    monkeypatch.setenv("COPERNICUS_CLIENT_SECRET", SECRET)


@pytest.fixture(scope="module")
def client():
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _auth(c, user):
    return {"Authorization": f"Bearer {c.post('/api/auth/login', json={'username': user, 'password': 'testpass'}).json()['token']}"}


# --------------------------------------------------------------------------- authentication
def test_token_is_cached_and_refreshed_before_expiry(fake, creds):
    tc = copernicus.TokenCache(margin_s=60)
    assert tc.get() == "tok-123" and tc.get() == "tok-123" and fake.calls["token"] == 1     # cached
    tc._expires_at = 0                                                                        # expired -> fetched again
    tc.get()
    assert fake.calls["token"] == 2


def test_missing_credentials_and_rejected_credentials(fake, monkeypatch, creds):
    fake.token_status = 401
    with pytest.raises(copernicus.AuthFailed):
        copernicus.TokenCache().get()
    monkeypatch.delenv("COPERNICUS_CLIENT_SECRET")
    with pytest.raises(copernicus.NotConfigured):
        copernicus.TokenCache().get()


def test_rate_limit_is_retried_and_timeouts_are_reported(monkeypatch):
    monkeypatch.setattr(copernicus.time, "sleep", lambda s: None)
    seq = iter([httpx.Response(429, headers={"Retry-After": "1"}), httpx.Response(200, json={"ok": 1})])
    copernicus.set_client(httpx.Client(transport=httpx.MockTransport(lambda r: next(seq))))
    try:
        assert copernicus.request("GET", copernicus.CATALOGUE_URL).json() == {"ok": 1}

        def boom(r):
            raise httpx.ReadTimeout("slow", request=r)
        copernicus.set_client(httpx.Client(transport=httpx.MockTransport(boom)))
        with pytest.raises(copernicus.ServiceTimeout):
            copernicus.request("GET", copernicus.CATALOGUE_URL)
        copernicus.set_client(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(429))))
        with pytest.raises(copernicus.RateLimited):
            copernicus.request("GET", copernicus.CATALOGUE_URL)
    finally:
        copernicus.set_client(None)


# --------------------------------------------------------------------------- catalogue
def test_latest_scene_selection_filters_coverage_and_polarisation(fake):
    obs = catalog.search("kerala-coast")
    by = {o.product_id: o for o in obs}
    assert by["p-partial-newest"].aoi_coverage < 0.5 and by["p-latest"].aoi_coverage == 1.0
    assert not by["p-vh-only"].has_vv_vh
    assert catalog.pick_latest(obs).product_id == "p-latest"         # newer products skipped: partial / single-pol
    catalog.search("kerala-coast")
    assert fake.calls["catalogue"] == 1                              # cached
    assert [o.product_id for o in catalog.same_track(obs, by["p-latest"], 4)] == ["p-latest", "p-older"]


def test_missing_observation_and_invalid_product(fake):
    fake.products = [PRODUCTS[0], PRODUCTS[1]]
    with pytest.raises(copernicus.NoObservation):
        catalog.latest("kerala-coast")
    with pytest.raises(copernicus.InvalidProduct):
        catalog.validate_product(catalog.parse_product(_product("x", _now(), ptype="EW_GRDM_1S"), "kerala-coast",
                                                       catalog.area_aoi("kerala-coast")[1]))
    with pytest.raises(copernicus.InvalidArea):
        catalog.area_aoi("atlantis")


def test_latest_endpoint_returns_catalogue_metadata(fake, client):
    r = client.get("/api/satellite/latest", params={"area_id": "kerala-coast"})
    assert r.status_code == 200
    d = r.json()
    assert d["product_id"] == "p-latest" and d["polarization"] == ["VV", "VH"] and d["timeliness"] == "NRT-3h"
    assert d["source"] == "Copernicus Data Space Ecosystem" and d["satellite"] == "Sentinel-1D"
    assert client.get("/api/satellite/latest", params={"area_id": "atlantis"}).status_code == 404


# --------------------------------------------------------------------------- processing + preprocessing
def test_tiles_cover_the_grid_below_the_api_limit():
    t = processing.tiles(4100, 2300)
    assert all(w <= processing.MAX_TILE_PX and h <= processing.MAX_TILE_PX for *_, w, h in t)
    assert sum(w * h for *_, w, h in t) == 4100 * 2300


def test_preprocessing_matches_training_conventions():
    lin = np.array([[[0.1, 0.0, -1.0]], [[0.01, 1.0, np.nan]]], np.float32)
    db = preprocessing.to_db(lin)
    assert np.allclose(db[0, 0, 0], -10.0) and np.isnan(db[0, 0, 1]) and np.isnan(db[0, 0, 2]) and np.allclose(db[1, 0, :2], [-20, 0])
    ref = preprocessing.training_reference(Path(__file__).resolve().parents[1])
    assert ref["bands"] == ["s1_vv_db", "s1_vh_db"] and ref["band_indices"] == [0, 1]
    assert preprocessing.check_compatibility(preprocessing.BAND_NAMES, ref)["compatible"] is True
    assert preprocessing.check_compatibility(["s1_vh_db", "s1_vv_db"], ref)["compatible"] is False
    near = np.stack([np.full((20, 20), -11.3), np.full((20, 20), -17.6)]).astype(np.float32)
    assert preprocessing.distribution_check(near, ref)["review_recommended"] is False
    assert preprocessing.distribution_check(near + 12, ref)["review_recommended"] is True


# --------------------------------------------------------------------------- access + configuration
def test_analyze_needs_permission_and_configuration(fake, client, monkeypatch):
    monkeypatch.delenv("COPERNICUS_CLIENT_ID", raising=False)
    assert client.post("/api/satellite/analyze", json={"area_id": "kerala-coast"}, headers=_auth(client, "field")).status_code == 403
    r = client.post("/api/satellite/analyze", json={"area_id": "kerala-coast"}, headers=_auth(client, "gis"))
    assert r.status_code == 503 and "not configured" in r.json()["detail"]
    s = client.get("/api/satellite/status").json()
    assert s["retrieval"]["configured"] is False and "inference" in s


# --------------------------------------------------------------------------- end to end
def _fake_predict(calls):
    """Stands in for `python scripts/predict.py`: records the invocation, writes a probability + binary raster on the
    scene grid with four ~6 ha habitat blobs and one sub-threshold candidate area."""
    def run(cmd):
        a = {cmd[i]: cmd[i + 1] for i in range(len(cmd) - 1) if cmd[i].startswith("--")}
        calls.append(a)
        with rasterio.open(a["--input"]) as src:
            prof, h, w = src.profile, src.height, src.width
        p = np.full((h, w), 0.05, np.float32)
        for r0, c0 in [(20, 20), (20, 120), (120, 20), (120, 120)]:
            p[r0:r0 + 25, c0:c0 + 25] = 0.92
        p[70:90, 60:100] = 0.5
        prof.update(count=1, dtype="float32", nodata=None)
        out = Path(a["--output"])
        with rasterio.open(out, "w", **prof) as d:
            d.write(p, 1)
        prof.update(dtype="uint8", nodata=255)
        with rasterio.open(out.with_name(out.stem.replace("_prob", "") + f"_binary_t{float(a['--threshold']):.2f}.tif"), "w", **prof) as d:
            d.write((p >= float(a["--threshold"])).astype(np.uint8), 1)
        return subprocess.CompletedProcess(cmd, 0, "ok", "")
    return run


def test_end_to_end_latest_observation_to_connectivity_run(fake, creds, client, monkeypatch):
    from backend.jobs import work_once
    from backend.paths import RUNS_DIR
    latest_ptr = RUNS_DIR / "kerala-coast" / "LATEST"
    latest_ptr.parent.mkdir(parents=True, exist_ok=True)
    latest_ptr.write_text("kerala-coast_stored_run")
    calls: list = []
    monkeypatch.setattr(service, "model_status", lambda: {
        "available": True, "reason": None, "experiment": "multi_E1_s1_b0_dev", "model_version": "U-Net/efficientnet-b0 multi_E1_s1_b0_dev",
        "checkpoint": "outputs/segmentation/multi_E1_s1_b0_dev/best_model.pth", "checkpoint_present": True, "torch_available": True,
        "threshold": 0.7, "mmu_ha": 2.0})
    monkeypatch.setattr(service, "run_predict", _fake_predict(calls))
    h = _auth(client, "gis")

    r = client.post("/api/satellite/analyze", json={"area_id": "kerala-coast", "composite_scenes": 2}, headers=h)
    assert r.status_code == 202, r.text
    aid = r.json()["analysis"]["id"]
    while work_once():
        pass

    d = client.get(f"/api/satellite/runs/{aid}", headers=h).json()
    assert d["status"] == "COMPLETED", d.get("error")
    assert d["job"]["status"] == "COMPLETED" and d["stages"][0] == "observation"
    # provenance record
    assert d["product_ids"] == ["p-latest", "p-older"] and d["composite_scenes"] == 2 and d["satellite"] == "Sentinel-1D"
    assert d["threshold"] == 0.7 and d["mmu_ha"] == 2.0 and d["tau_km"] == 5.0 and d["k_neighbors"] == 3
    assert d["preprocessing_version"] == preprocessing.PREPROCESSING_VERSION and d["software_version"].startswith("ecoconnect")
    assert d["acquisition_time"] and d["processed_at"] and d["run_id"].startswith("kerala-coast_nrt_")
    # retrieval: one Process API request per acquisition, terrain-corrected gamma0 on a UTM grid
    assert fake.calls["process"] == 2
    body = fake.process_bodies[0]
    assert body["input"]["data"][0]["processing"]["backCoeff"] == "GAMMA0_TERRAIN"
    assert body["input"]["data"][0]["dataFilter"]["polarization"] == "DV" and "EPSG/0/326" in body["input"]["bounds"]["properties"]["crs"]
    # the model was invoked on the preprocessed scene with the recorded checkpoint + threshold
    assert calls and calls[0]["--threshold"] == "0.7" and calls[0]["--checkpoint"].endswith("best_model.pth")
    assert d["scene"]["bands"] == ["s1_vv_db", "s1_vh_db"] and d["scene"]["model_compatibility"]["compatible"] is True
    with rasterio.open(calls[0]["--input"]) as src:
        vv = src.read(1)
    assert np.isclose(np.median(vv[vv != -9999]), 10 * np.log10(np.median([0.08, 0.06])), atol=0.8)   # dB median of 2 dates
    # the existing ecological pipeline produced a normal run; the dashboard's LATEST did not move
    run_dir = RUNS_DIR / "kerala-coast" / d["run_id"]
    m = json.loads((run_dir / "manifest.json").read_text())
    assert m["data_source"]["satellite"]["product_ids"] == ["p-latest", "p-older"]
    assert (run_dir / "criticality.json").exists() and (run_dir / "restoration.json").exists()
    assert d["summary"]["run"]["nPatches"] == 4 and d["summary"]["run"]["nEdges"] >= 3      # the 4 synthetic blobs
    assert latest_ptr.read_text() == "kerala-coast_stored_run"
    # overlays
    png = client.get(f"/api/satellite/runs/{aid}/scene.png")
    assert png.status_code == 200 and png.headers["X-Bounds"].count(",") == 3
    assert client.get(f"/api/satellite/runs/{aid}/mask.png").status_code == 200
    # cached: the same analysis is not re-run and Copernicus is not asked again
    again = client.post("/api/satellite/analyze", json={"area_id": "kerala-coast", "composite_scenes": 2}, headers=h).json()
    assert again["reused"] == "completed" and fake.calls["process"] == 2
    # no credential ever leaves the server
    for txt in (r.text, json.dumps(d), client.get("/api/satellite/status").text, json.dumps(again)):
        assert SECRET not in txt and "eco-client" not in txt


def test_model_unavailable_keeps_the_scene_and_explains(fake, creds, client, monkeypatch):
    from backend.jobs import work_once
    monkeypatch.setattr(service, "model_status", lambda: {
        "available": False, "reason": "The trained checkpoint is not on this server.", "experiment": "x", "model_version": "m",
        "checkpoint": "c", "checkpoint_present": False, "torch_available": False, "threshold": 0.7, "mmu_ha": 2.0})
    h = _auth(client, "gis")
    aid = client.post("/api/satellite/analyze", json={"area_id": "kerala-coast", "force": True}, headers=h).json()["analysis"]["id"]
    while work_once():
        pass
    d = client.get(f"/api/satellite/runs/{aid}", headers=h).json()
    assert d["status"] == "FAILED" and "inference cannot run" in d["error"] and d["stage"] == "inference"
    assert d["scene"]["available"] is True                     # retrieval + preprocessing happened and are kept
    n = fake.calls["process"]
    aid2 = client.post("/api/satellite/analyze", json={"area_id": "kerala-coast", "force": True}, headers=h).json()["analysis"]
    assert aid2["mode"] == "cached"
    while work_once():
        pass
    assert fake.calls["process"] == n                          # the stored scene is reused, no second retrieval
