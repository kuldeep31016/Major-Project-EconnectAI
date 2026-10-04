"""Copernicus Data Space Ecosystem (CDSE) HTTP layer: OAuth2 client credentials, token cache, bounded retries.

Credentials (COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET) stay on the server: they are read from the environment,
sent only to the CDSE identity service, never logged, never returned by any endpoint. The public catalogue (OData)
needs no credentials; the Processing API (image retrieval) does.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Optional

import httpx

TOKEN_URL = os.environ.get("COPERNICUS_TOKEN_URL",
                           "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token")
CATALOGUE_URL = os.environ.get("COPERNICUS_CATALOGUE_URL", "https://catalogue.dataspace.copernicus.eu/odata/v1/Products")
PROCESS_URL = os.environ.get("COPERNICUS_PROCESS_URL", "https://sh.dataspace.copernicus.eu/api/v1/process")


class SatelliteError(Exception):
    """Base class; ``user_message`` is safe to show in the UI (no secrets, no stack traces)."""
    status_code = 502
    user_message = "The satellite data service could not be reached. Try again later."

    def __init__(self, detail: str = "", user_message: Optional[str] = None):
        super().__init__(detail or self.user_message)
        if user_message:
            self.user_message = user_message


class NotConfigured(SatelliteError):
    status_code = 503
    user_message = ("Copernicus image retrieval is not configured on this server (COPERNICUS_CLIENT_ID / "
                    "COPERNICUS_CLIENT_SECRET). The catalogue search still works.")


class AuthFailed(SatelliteError):
    status_code = 502
    user_message = "Copernicus rejected the server's credentials (OAuth). An administrator must check the client id/secret."


class RateLimited(SatelliteError):
    status_code = 429
    user_message = "The Copernicus service is rate-limiting requests. Please wait a minute and try again."


class ServiceTimeout(SatelliteError):
    status_code = 504
    user_message = "The Copernicus service did not answer in time. Please try again."


class InvalidArea(SatelliteError):
    status_code = 404
    user_message = "Unknown study area, or it has no valid bounding box."


class NoObservation(SatelliteError):
    status_code = 404
    user_message = "No Sentinel-1 observation with VV + VH covers this study area in the search window."


class InvalidProduct(SatelliteError):
    status_code = 422
    user_message = "The selected product is not a Sentinel-1 IW GRD product with VV + VH polarisation."


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


TIMEOUT = httpx.Timeout(_float_env("COPERNICUS_TIMEOUT_S", 120.0), connect=_float_env("COPERNICUS_CONNECT_TIMEOUT_S", 15.0))
MAX_RETRIES = int(os.environ.get("COPERNICUS_MAX_RETRIES", "2"))


_client: Optional[httpx.Client] = None


def set_client(c: Optional[httpx.Client]) -> None:
    """Inject an HTTP client (tests: httpx.Client(transport=httpx.MockTransport(...))); None = real network."""
    global _client
    _client = c


def credentials_configured() -> bool:
    return bool(os.environ.get("COPERNICUS_CLIENT_ID", "").strip() and os.environ.get("COPERNICUS_CLIENT_SECRET", "").strip())


class TokenCache:
    """Client-credentials access token, reused until shortly before it expires, then fetched again (= refresh)."""

    def __init__(self, margin_s: float = 60.0):
        self._token: Optional[str] = None
        self._expires_at = 0.0
        self._lock = threading.Lock()
        self.margin_s = margin_s
        self.fetch_count = 0                       # observable in tests

    def invalidate(self) -> None:
        with self._lock:
            self._token, self._expires_at = None, 0.0

    def get(self, client: Optional[httpx.Client] = None) -> str:
        with self._lock:
            if self._token and time.monotonic() < self._expires_at - self.margin_s:
                return self._token
            if not credentials_configured():
                raise NotConfigured("COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET not set")
            data = {"grant_type": "client_credentials", "client_id": os.environ["COPERNICUS_CLIENT_ID"].strip(),
                    "client_secret": os.environ["COPERNICUS_CLIENT_SECRET"].strip()}
            try:
                r = (client or _client or httpx).post(TOKEN_URL, data=data, timeout=TIMEOUT)
            except httpx.TimeoutException as e:
                raise ServiceTimeout(f"token endpoint timeout: {type(e).__name__}") from e
            except httpx.HTTPError as e:
                raise SatelliteError(f"token endpoint unreachable: {type(e).__name__}") from e
            if r.status_code in (400, 401, 403):
                raise AuthFailed(f"token endpoint answered {r.status_code}")
            if r.status_code == 429:
                raise RateLimited("token endpoint 429")
            if r.status_code >= 400:
                raise SatelliteError(f"token endpoint answered {r.status_code}")
            body = r.json()
            self._token = body["access_token"]
            self._expires_at = time.monotonic() + float(body.get("expires_in", 600))
            self.fetch_count += 1
            return self._token


TOKENS = TokenCache()


def request(method: str, url: str, *, auth: bool = False, client: Optional[httpx.Client] = None, **kw) -> httpx.Response:
    """One CDSE call with bounded retries: 429 honours Retry-After (capped), 5xx/timeouts back off; 401 with a cached
    token re-authenticates once. Raises a ``SatelliteError`` subclass; never returns a 4xx/5xx response."""
    http = client or _client or httpx
    reauthed = False
    last: Optional[Exception] = None
    for attempt in range(MAX_RETRIES + 1):
        headers = dict(kw.pop("headers", None) or {})
        if auth:
            headers["Authorization"] = f"Bearer {TOKENS.get(client)}"
        try:
            r = http.request(method, url, headers=headers, timeout=TIMEOUT, **kw)
        except httpx.TimeoutException as e:
            last = ServiceTimeout(f"{type(e).__name__} on {url.split('?')[0]}")
        except httpx.HTTPError as e:
            last = SatelliteError(f"{type(e).__name__} on {url.split('?')[0]}")
        else:
            if r.status_code < 400:
                return r
            if r.status_code == 401 and auth and not reauthed:
                TOKENS.invalidate()
                reauthed = True
                kw["headers"] = headers
                continue
            if r.status_code in (401, 403):
                raise AuthFailed(f"{url.split('?')[0]} answered {r.status_code}")
            if r.status_code == 429:
                last = RateLimited(f"429 from {url.split('?')[0]}")
                wait = min(float(r.headers.get("Retry-After", 2 ** (attempt + 1)) or 2), 30.0)
            elif r.status_code >= 500:
                last = SatelliteError(f"{r.status_code} from {url.split('?')[0]}")
                wait = 2.0 ** (attempt + 1)
            else:
                detail = r.text[:300]
                raise SatelliteError(f"{r.status_code} from {url.split('?')[0]}: {detail}",
                                     user_message=f"The Copernicus service rejected the request ({r.status_code}).")
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            kw["headers"] = headers
            continue
        kw["headers"] = headers
        if attempt < MAX_RETRIES:
            time.sleep(2.0 ** (attempt + 1))
    raise last or SatelliteError("request failed")
