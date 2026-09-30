"""Smoke-test a live EcoConnectAI deployment (read-only; never calls the paid AI assistant).

    .venv/bin/python scripts/check_deployment.py --api https://<render-app>.onrender.com \
        [--frontend https://<app>.vercel.app] [--user admin --password ...]

Checks liveness, readiness (DB + migrations), CORS for the frontend origin, request ids, the data behind /demo,
optional sign-in + admin system view (database type, storage backend, assistant mode). Exit code 1 on any FAIL.
"""
from __future__ import annotations

import argparse
import sys
import time

import httpx

RESULTS: list[tuple[str, str, str]] = []


def check(name: str, ok: bool, detail: str = "", warn: bool = False) -> bool:
    RESULTS.append(("PASS" if ok else ("WARN" if warn else "FAIL"), name, detail))
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", required=True)
    ap.add_argument("--frontend")
    ap.add_argument("--user")
    ap.add_argument("--password")
    ap.add_argument("--study-area", default="kerala-coast")
    a = ap.parse_args()
    api = a.api.rstrip("/")
    c = httpx.Client(timeout=90, follow_redirects=True)

    t0 = time.time()
    r = c.get(f"{api}/api/health", headers={"X-Request-ID": "deploycheck-0001"})
    check("liveness /api/health", r.status_code == 200, f"{r.status_code} in {time.time() - t0:.1f}s (first call may include a cold start)")
    check("request id echoed", r.headers.get("X-Request-ID") == "deploycheck-0001", r.headers.get("X-Request-ID", "missing"))
    r = c.get(f"{api}/api/ready")
    check("readiness /api/ready (DB + schema at head)", r.status_code == 200, r.text[:120])

    if a.frontend:
        origin = a.frontend.rstrip("/")
        r = c.options(f"{api}/api/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
        allowed = r.headers.get("access-control-allow-origin")
        check("CORS allows the frontend origin", allowed == origin, f"allow-origin={allowed!r}")
        r = c.options(f"{api}/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
        foreign = r.headers.get("access-control-allow-origin")
        check("CORS rejects other origins", foreign not in ("https://evil.example", "*"),
              f"allow-origin={foreign!r} - set ECO_CORS_ORIGINS to the exact frontend URL" if foreign else "rejected")
        r = c.get(origin)
        check("frontend reachable", r.status_code == 200, f"{r.status_code}")
        r = c.get(f"{origin}/demo")
        check("frontend /demo route", r.status_code == 200, f"{r.status_code}")

    sa = a.study_area
    top = None
    for part in ("graph", "criticality", "restoration", "manifest"):
        r = c.get(f"{api}/api/runs/{sa}/latest/{part}")
        check(f"run data: {part}", r.status_code == 200, f"{r.status_code}")
        if part == "criticality" and r.status_code == 200 and r.json():
            top = r.json()[0]["patch_id"]  # the run's top-ranked patch; ids differ between runs
    if top:
        r = c.post(f"{api}/api/runs/{sa}/latest/what-if", json={"patch_ids": [top]})
        check(f"what-if engine ({top})", r.status_code == 200, f"loss {r.json().get('loss_pct', '?'):.1f} %" if r.status_code == 200 else r.text[:100])
    r = c.get(f"{api}/api/runs/%2e%2e/%2e%2e/files/.env")
    check("path traversal blocked", r.status_code in (400, 404), f"{r.status_code}")
    r = c.get(f"{api}/api/reports")
    check("official reports need sign-in", r.status_code == 401, f"{r.status_code}")

    if a.user and a.password:
        r = c.post(f"{api}/api/auth/login", json={"username": a.user, "password": a.password})
        if check("sign-in", r.status_code == 200, f"{r.status_code}"):
            j = r.json()
            check("refresh token issued", bool(j.get("refresh_token")), f"access token lifetime {j.get('expires_in')} s")
            s = c.get(f"{api}/api/admin/system", headers={"Authorization": f"Bearer {j['token']}"})
            if s.status_code == 200:
                info = s.json()
                check("database is PostgreSQL (persistent)", info["database"] == "postgresql", info["database"], warn=True)
                check("schema at head", info["schema"]["ok"], str(info["schema"]))
                check("object storage is S3/R2 (photos persist)", info["storage"] == "s3", info["storage"], warn=True)
                check("assistant mode", True, info["assistant"])
                check("no failed jobs in 24 h", not info["jobs"]["failed_24h"], str(len(info["jobs"]["failed_24h"])), warn=True)
            else:
                check("admin system view", False, f"{s.status_code} (user needs the view_audit capability)", warn=True)
            c.post(f"{api}/api/auth/logout", json={"refresh_token": j.get("refresh_token", "x" * 20)})

    width = max(len(n) for _, n, _ in RESULTS)
    for status, name, detail in RESULTS:
        print(f"[{status}] {name.ljust(width)}  {detail}")
    fails = sum(s == "FAIL" for s, _, _ in RESULTS)
    print(f"\n{len(RESULTS)} checks, {fails} failed, {sum(s == 'WARN' for s, _, _ in RESULTS)} warnings")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
