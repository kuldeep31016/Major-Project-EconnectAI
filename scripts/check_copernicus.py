#!/usr/bin/env python
"""Check the Copernicus Data Space credentials in .env without spending quota.

    .venv/bin/python scripts/check_copernicus.py

1. reads COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET from the environment / .env
2. asks the CDSE identity service for an access token (no image request, no processing units)
3. runs one public catalogue query for the Kerala study area
Never prints the secret or the token.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.pipeline.config import load_dotenv  # noqa: E402

load_dotenv()
from backend.satellite import catalog, copernicus  # noqa: E402


def main() -> int:
    cid = (__import__("os").environ.get("COPERNICUS_CLIENT_ID") or "").strip()
    print(f"client id     : {cid[:6] + '…' + cid[-4:] if len(cid) > 10 else ('(not set)' if not cid else cid)}")
    print(f"client secret : {'set' if copernicus.credentials_configured() else '(not set)'}")
    ok = True
    try:
        copernicus.TokenCache().get()
        print("OAuth token   : OK - image retrieval will work")
    except copernicus.SatelliteError as e:
        ok = False
        print(f"OAuth token   : FAILED - {e.user_message}")
    try:
        o = catalog.latest("kerala-coast")
        print(f"catalogue     : OK - latest Kerala observation {o.platform} {o.acquisition_start} ({o.timeliness})")
    except copernicus.SatelliteError as e:
        ok = False
        print(f"catalogue     : FAILED - {e.user_message}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
