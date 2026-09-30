"""End-to-end acceptance test (spec §59): walks the 20 decision-support steps through the real HTTP API.

    .venv/bin/python scripts/acceptance_test.py [--study-area kerala-coast] [--json out.json]

Runs against a scratch COPY of outputs/ and a fresh SQLite database, so the developer's data is never touched.
The assistant is forced into template mode (no paid API call). Steps that need what is not on this machine
(Sentinel-1 scenes, model checkpoint, PyTorch) are reported SKIP with the reason - never PASS.
Exit code 1 if any step FAILs.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--study-area", default="kerala-coast")
    ap.add_argument("--json", help="write the step results to this file")
    a = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="eco_acceptance_"))
    shutil.copytree(REPO / "outputs", tmp / "outputs", ignore=shutil.ignore_patterns("ecoconnect.db*", "quicklooks"))
    os.environ.update({"ECO_OUTPUTS_DIR": str(tmp / "outputs"), "ECO_DATABASE_URL": f"sqlite:///{(tmp / 'acc.db').as_posix()}",
                       "ECO_DEMO_PASSWORD": "acceptance-pass", "ECO_JWT_SECRET": "acceptance-secret-" + "x" * 24,
                       "ECO_INLINE_WORKER": "0", "ECO_ASSISTANT_LLM": "0", "ECO_STORAGE": "local"})
    os.environ.pop("ANTHROPIC_API_KEY", None)

    from fastapi.testclient import TestClient

    from backend.jobs import work_once
    from backend.main import app

    sa = a.study_area
    results: list[dict] = []

    def step(n: int, name: str, status: str, detail: str) -> None:
        results.append({"step": n, "name": name, "status": status, "detail": detail})

    def run(n: int, name: str, fn) -> object:
        t0 = time.perf_counter()
        try:
            detail, out = fn()
            step(n, name, "PASS", f"{detail}  [{(time.perf_counter() - t0) * 1000:.0f} ms]")
            return out
        except Exception as e:  # noqa: BLE001 - report every failure as a FAIL line
            step(n, name, "FAIL", f"{type(e).__name__}: {e}")
            return None

    with TestClient(app) as c:
        def login(u):
            r = c.post("/api/auth/login", json={"username": u, "password": "acceptance-pass"})
            assert r.status_code == 200, r.text
            return {"Authorization": f"Bearer {r.json()['token']}"}
        H = {u: login(u) for u in ("admin", "senior", "field", "analyst")}

        def s1():
            areas = c.get("/api/study-areas").json()
            ids = [x["id"] for x in areas] if isinstance(areas, list) else list(areas)
            assert sa in ids, ids
            return f"{len(ids)} study areas; selected {sa}", None
        run(1, "Select study area", s1)

        man = c.get(f"/api/runs/{sa}/latest/manifest").json()
        rid = man["run_id"]

        def s2():
            r = c.post(f"/api/runs/{sa}/{rid}/reproduce", headers=H["admin"])
            assert r.status_code == 202, r.text
            job = r.json()["job_id"] if "job_id" in r.json() else r.json()["id"]
            while work_once():
                pass
            j = c.get(f"/api/jobs/{job}", headers=H["admin"]).json()
            assert j["status"] == "COMPLETED", j
            res = j["result"]
            assert res["reproduced"], [x for x in res["checks"] if not x["match"]]
            return f"job {job[:8]} re-ran {rid} from recorded inputs ({res['level']} level, {len(res['checks'])} checks match)", None
        run(2, "Create analysis run (background job)", s2)

        why = "needs Sentinel-1 scenes, the model checkpoint and PyTorch; none are on this machine (see docs/REPRODUCIBILITY.md)"
        step(3, "Acquire / load satellite data", "SKIP", why)
        step(4, "Preprocessing", "SKIP", why)
        step(5, "Run segmentation model", "SKIP", why)
        ds = man["data_source"]
        step(6, "Probability map", "SKIP", f"stored output of this step used instead: {ds.get('path')} (threshold {ds.get('threshold')})")

        crit = c.get(f"/api/runs/{sa}/latest/criticality").json()
        met = c.get(f"/api/runs/{sa}/latest/metrics").json()["research_metrics"]

        def s7():
            fc = c.get(f"/api/runs/{sa}/latest/patches").json()
            n = len(fc["features"])
            assert n == met["n_patches"] == len(crit)
            return f"{n} patches, {met['habitat_area_ha']:.1f} ha (min patch {ds.get('mmu_ha')} ha)", None
        run(7, "Habitat patches", s7)

        def s8():
            g = c.get(f"/api/runs/{sa}/latest/graph").json()
            ne = len(g.get("edges") or g.get("links") or [])
            assert ne == met["n_edges"], (ne, met["n_edges"])
            return f"{ne} links, {met['n_components']} components (k={man['config']['graph']['k_neighbors']}, τ={man['config']['graph']['tau_km']} km)", None
        run(8, "Build connectivity graph", s8)
        run(9, "Calculate IIC", lambda: (f"IIC {met['iic']:.4e}, ECA {met['eca_pct_of_habitat']:.1f} % of habitat", None))

        def s10():
            assert [r["rank"] for r in crit] == list(range(1, len(crit) + 1))
            return f"leave-one-out for {len(crit)} patches; #1 {crit[0]['patch_id']} −{crit[0]['delta_pct']:.1f} %", None
        run(10, "Calculate criticality", s10)

        focus = max((r for r in crit if r["is_cut_vertex"]) or crit, key=lambda r: r["rank_by_area"] - r["rank"])
        run(11, "Select critical patch", lambda: (f"{focus['patch_id']}: #{focus['rank']} by criticality, #{focus['rank_by_area']} by area, cut vertex {focus['is_cut_vertex']}", None))

        def s12():
            w = c.post(f"/api/runs/{sa}/latest/what-if", json={"patch_ids": [focus["patch_id"]]}).json()
            assert abs(w["loss_pct"] - focus["delta_pct"]) < 1e-6, (w["loss_pct"], focus["delta_pct"])
            return f"remove {focus['patch_id']}: IIC −{w['loss_pct']:.2f} % (matches stored criticality), SIMULATION", None
        run(12, "What-if removal", s12)

        def s13():
            r = c.post(f"/api/runs/{sa}/latest/scenario", json={"type": "tau", "taus_km": [3, 5, 8]}).json()
            rows = r.get("variants") or []
            assert len(rows) == 3, r
            rho = ", ".join(f"{v.get('tau_km', '?')} km ρ={v.get('spearman_vs_reference', v.get('rho', float('nan'))):.2f}" for v in rows)
            return f"τ 3/5/8 km recomputed: {rho}", None
        run(13, "Sensitivity analysis", s13)

        def s14():
            f = c.get(f"/api/runs/{sa}/latest/restoration/feasibility").json()
            cands = f["candidates"]
            site = next((x for x in cands if x.get("category") != "uncertain_habitat"), None)
            unc = sum(x.get("category") == "uncertain_habitat" for x in cands)
            assert site is not None
            return f"{site['candidate_id']} {site['area_ha']:.1f} ha +{site['gain_pct']:.2f} % ({site['verdict']}); {unc} uncertain area(s) sent to field check; costs not assessed", None
        run(14, "Evaluate restoration candidate", s14)

        def s15():
            fid = c.get("/api/auth/me", headers=H["field"]).json()["id"]
            p = next(x for x in c.get(f"/api/runs/{sa}/latest/patches").json()["features"] if x["properties"]["id"] == focus["patch_id"])["properties"]
            t = c.post("/api/field-tasks", headers=H["senior"], json={"study_area_id": sa, "title": f"Verify {focus['patch_id']}", "reason": "acceptance test",
                                                                   "lat": p["centroid_lat"], "lon": p["centroid_lon"], "object_type": "patch",
                                                                   "object_id": focus["patch_id"], "run_id": rid, "assignee_id": fid}).json()
            from PIL import Image
            buf = io.BytesIO(); Image.new("RGB", (8, 8)).save(buf, "JPEG")
            ev = c.post(f"/api/field-tasks/{t['id']}/evidence", headers=H["field"], files={"photo": ("x.jpg", buf.getvalue(), "image/jpeg")},
                        data={"lat": p["centroid_lat"], "lon": p["centroid_lon"], "observed_at": "2026-10-01", "observation": "habitat_present",
                              "notes": "ACCEPTANCE TEST - not a field observation"})
            assert ev.status_code == 200, ev.text
            return f"task {t['id']} → field officer, evidence {ev.json()['id']} submitted (test data, not a field observation)", None
        run(15, "Create field verification task", s15)

        rep = run(16, "Generate report", lambda: (lambda r: (f"report {r['id']} status {r['status']}, {len(r['sections'])} sections", r))(
            c.post("/api/reports/generate", headers=H["senior"], json={"study_area": sa, "run_id": rid}).json()))

        ans = run(17, "Ask AI about the result", lambda: (lambda r: (f"[{r.get('mode', 'template')}] {r['answer'][:110]}…", r))(
            c.post("/api/assistant/ask", headers=H["analyst"], json={"question": f"Why is {focus['patch_id']} important?", "study_area": sa}).json()))

        def s18():
            txt = ans["answer"]
            want = [f"{focus['delta_pct']:.1f}", focus["patch_id"]]
            assert all(w in txt for w in want), (want, txt)
            return f"answer quotes {focus['patch_id']} and −{focus['delta_pct']:.1f} % exactly as stored in criticality.json", None
        if ans:
            run(18, "Verify AI answer against stored evidence", s18)
        else:
            step(18, "Verify AI answer against stored evidence", "FAIL", "no answer from step 17")

        def s19():
            acts = {x["action"] for x in c.get("/api/audit?limit=200", headers=H["admin"]).json()}
            need = {"login", "submit_evidence", "generate_report", "assistant_question"}
            assert need <= acts, need - acts
            return f"audit trail has {', '.join(sorted(need))}", None
        run(19, "Check audit log", s19)

        def s20():
            r = c.get(f"/api/reports/{str(rep['id']).split('-')[-1]}/pdf", headers=H["senior"])   # "official-<n>" → n, as the UI does
            assert r.status_code == 200 and r.content[:5] == b"%PDF-", r.status_code
            return f"PDF {len(r.content) / 1024:.0f} KB", None
        if rep:
            run(20, "Open generated report (PDF)", s20)
        else:
            step(20, "Open generated report (PDF)", "FAIL", "no report from step 16")

    w = max(len(r["name"]) for r in results)
    for r in sorted(results, key=lambda r: r["step"]):
        print(f"{r['step']:>2}. [{r['status']}] {r['name'].ljust(w)}  {r['detail']}")
    n = {s: sum(r["status"] == s for r in results) for s in ("PASS", "SKIP", "FAIL")}
    print(f"\n{n['PASS']} passed, {n['SKIP']} skipped (data/model not on this machine), {n['FAIL']} failed")
    if a.json:
        Path(a.json).write_text(json.dumps(sorted(results, key=lambda r: r["step"]), indent=1))
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if n["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
