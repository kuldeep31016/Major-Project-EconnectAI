#!/usr/bin/env python
"""End-to-end API check of every page's data for every study area, stored run AND latest near-real-time run.

    .venv/bin/python scripts/check_all_flows.py [--base http://localhost:8000] [--password demo1234]

Read-only except for compute endpoints that return results without storing them (what-if, scenarios, reanalyse,
restoration). Prints one line per check and a summary; exits 1 if any check fails.
"""
from __future__ import annotations

import argparse
import sys
import time

import httpx

AREAS = ["kerala-coast", "sundarbans", "gulf-of-mannar", "odisha-coast"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--password", default="demo1234")
    a = ap.parse_args()
    c = httpx.Client(base_url=a.base, timeout=180)
    tok = c.post("/api/auth/login", json={"username": "admin", "password": a.password}).json()["token"]
    H = {"Authorization": f"Bearer {tok}"}
    results: list[tuple[str, bool, str]] = []

    def check(name, method, path, ok=lambda r: True, **kw):
        t0 = time.perf_counter()
        try:
            r = c.request(method, path, headers=H, **kw)
            good = r.status_code < 400 and ok(r)
            detail = f"{r.status_code} {1000 * (time.perf_counter() - t0):6.0f} ms"
            if not good:
                detail += "  " + r.text[:160].replace("\n", " ")
        except Exception as e:  # noqa: BLE001
            good, detail = False, f"{type(e).__name__}: {e}"[:200]
        results.append((name, good, detail))
        print(f"{'OK ' if good else 'BAD'} {name:62} {detail}", flush=True)
        return r if good else None

    # global pages
    for p in ["/api/health", "/api/ready", "/api/study-areas", "/api/models", "/api/model-cards", "/api/registry-models",
              "/api/scenes", "/api/runs", "/api/alerts", "/api/field-tasks", "/api/detections", "/api/projects", "/api/reports",
              "/api/users", "/api/audit?limit=20", "/api/admin/system", "/api/satellite/status", "/api/rag/status",
              "/api/chat/diagnostics", "/api/restoration/reviews"]:
        check(f"GET {p}", "GET", p)

    for area in AREAS:
        runs = c.get(f"/api/runs?study_area={area}", headers=H).json()
        runs = runs if isinstance(runs, list) else runs.get("runs", [])
        stored = next((r["runId"] for r in runs if r.get("isLatest")), "latest")
        has_raster = {r["runId"]: r.get("probabilityRaster", True) for r in runs}
        nrt = next((r["runId"] for r in runs if r.get("satellite")), None)
        for label, run in [("stored", stored)] + ([("nrt", nrt)] if nrt else []):
            tag = f"{area[:12]:12} {label:6}"
            check(f"{tag} bundle", "GET", f"/api/runs/{area}/{run}/bundle",
                      ok=lambda r: len((r.json().get("habitatMask") or r.json().get("habitat_mask") or {}).get("patches", [1])) > 0)
            check(f"{tag} manifest", "GET", f"/api/runs/{area}/{run}/manifest")
            check(f"{tag} report", "GET", f"/api/runs/{area}/{run}/report", ok=lambda r: bool(r.json().get("sections")))
            check(f"{tag} timeline", "GET", f"/api/runs/{area}/timeline?run_id={run}")
            crit = c.get(f"/api/runs/{area}/{run}/files/criticality.json", headers=H).json()
            rest = c.get(f"/api/runs/{area}/{run}/files/restoration.json", headers=H).json().get("candidates", [])
            top = crit[0]["patch_id"]
            check(f"{tag} evidence {top}", "GET", f"/api/runs/{area}/{run}/evidence/patch/{top}")
            check(f"{tag} what-if remove {top}", "POST", f"/api/runs/{area}/{run}/what-if", json={"patch_ids": [top]})
            check(f"{tag} restoration ranking", "POST", f"/api/runs/{area}/{run}/restoration", json={})
            check(f"{tag} restoration feasibility", "GET", f"/api/runs/{area}/{run}/restoration/feasibility")
            check(f"{tag} reanalyse tau 3 km", "POST", f"/api/runs/{area}/{run}/reanalyse", json={"tau_km": 3})
            check(f"{tag} probability overlay", "GET", f"/api/runs/{area}/{run}/probability.png")
            sc = [{"type": "remove_patches", "patch_ids": [top]}, {"type": "reduce_area", "patch_ids": [top], "retain_fraction": 0.5},
                  {"type": "radius", "tau_km": 8}, {"type": "tau", "taus_km": [3, 5, 8]}, {"type": "sensitivity", "taus_km": [3, 5], "ks": [2, 3]},
                  ] + ([{"type": "threshold", "thresholds": [0.5, 0.7]}] if has_raster.get(run, True) else [])
            if not has_raster.get(run, True):
                print(f"SKIP {tag} scenario threshold{'':37} raster not on this server (option disabled in the UI)")
            if rest:
                sc += [{"type": "restore", "candidate_ids": [rest[0]["candidate_id"]]},
                       {"type": "restore_multi", "candidate_ids": [x["candidate_id"] for x in rest[:3]]}]
            if label == "nrt":
                sc.append({"type": "compare_periods", "other_run_id": stored})
            for body in sc:
                check(f"{tag} scenario {body['type']}", "POST", f"/api/runs/{area}/{run}/scenario", json=body)
        check(f"{area[:12]:12} alerts", "GET", f"/api/alerts?study_area={area}")
        check(f"{area[:12]:12} scene quicklook S1", "GET", f"/api/scenes/{area}/quicklook.png?kind=s1")
        check(f"{area[:12]:12} hitl disagreements", "GET", f"/api/hitl/disagreements?study_area={area}")
        check(f"{area[:12]:12} satellite latest", "GET", f"/api/satellite/latest?area_id={area}")
        check(f"{area[:12]:12} satellite observations", "GET", f"/api/satellite/observations?area_id={area}")
        sr = check(f"{area[:12]:12} satellite analyses", "GET", f"/api/satellite/runs?area_id={area}")
        done = [x for x in (sr.json() if sr else []) if x["status"] == "COMPLETED"]
        if done:
            check(f"{area[:12]:12} satellite analysis detail", "GET", f"/api/satellite/runs/{done[0]['id']}")
            check(f"{area[:12]:12} satellite scene.png", "GET", f"/api/satellite/runs/{done[0]['id']}/scene.png")
            check(f"{area[:12]:12} satellite mask.png", "GET", f"/api/satellite/runs/{done[0]['id']}/mask.png")

    bad = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    for n, _, d in bad:
        print(f"  FAILED {n}: {d}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
