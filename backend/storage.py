"""Object-storage abstraction for platform artefacts.

``ECO_STORAGE=local`` (default): keys are paths under ``OUTPUTS_DIR`` - zero setup, what development uses.
``ECO_STORAGE=s3``: any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO) via boto3;
``ECO_S3_BUCKET``, optional ``ECO_S3_ENDPOINT_URL``, ``ECO_S3_PREFIX``; credentials from the standard AWS env
vars. Nothing vendor-specific; the database only ever stores keys + hashes, never raster bytes.
"""
from __future__ import annotations

import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Protocol

from ecoconnect.pipeline.config import OUTPUTS_DIR

from .security import contained


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def _check_key(key: str) -> str:
    k = key.replace("\\", "/").lstrip("/")
    if not k or any(part in ("", ".", "..") for part in k.split("/")):
        raise ValueError(f"invalid storage key {key!r}")
    return k


class Storage(Protocol):
    name: str

    def put_file(self, key: str, src: Path, content_type: str | None = None) -> str: ...
    def put_bytes(self, key: str, data: bytes, content_type: str | None = None) -> str: ...
    def get_bytes(self, key: str) -> bytes: ...
    def exists(self, key: str) -> bool: ...
    def local_path(self, key: str) -> Path | None: ...       # direct path when the backend is a filesystem
    def url(self, key: str, expires_s: int = 3600) -> str | None: ...


class LocalStorage:
    name = "local"

    def __init__(self, root: Path | None = None):
        self.root = Path(root or OUTPUTS_DIR)

    def _path(self, key: str) -> Path:
        return contained(self.root / _check_key(key), self.root)

    def put_file(self, key, src, content_type=None):
        dst = self._path(key)
        if Path(src).resolve() != dst:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(Path(src).read_bytes())
        return _check_key(key)

    def put_bytes(self, key, data, content_type=None):
        dst = self._path(key)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
        return _check_key(key)

    def get_bytes(self, key):
        return self._path(key).read_bytes()

    def exists(self, key):
        try:
            return self._path(key).exists()
        except Exception:
            return False

    def local_path(self, key):
        return self._path(key)

    def url(self, key, expires_s=3600):
        return None                                     # served by the API, not directly


class S3Storage:
    name = "s3"

    def __init__(self, bucket: str, prefix: str = "", endpoint_url: str | None = None):
        import boto3                                    # optional dependency, only needed for this backend
        self.bucket, self.prefix = bucket, prefix.strip("/")
        self.client = boto3.client("s3", endpoint_url=endpoint_url)

    def _k(self, key: str) -> str:
        k = _check_key(key)
        return f"{self.prefix}/{k}" if self.prefix else k

    def put_file(self, key, src, content_type=None):
        extra = {"ContentType": content_type or mimetypes.guess_type(str(src))[0] or "application/octet-stream"}
        self.client.upload_file(str(src), self.bucket, self._k(key), ExtraArgs=extra)
        return _check_key(key)

    def put_bytes(self, key, data, content_type=None):
        self.client.put_object(Bucket=self.bucket, Key=self._k(key), Body=data,
                               ContentType=content_type or "application/octet-stream")
        return _check_key(key)

    def get_bytes(self, key):
        return self.client.get_object(Bucket=self.bucket, Key=self._k(key))["Body"].read()

    def exists(self, key):
        try:
            self.client.head_object(Bucket=self.bucket, Key=self._k(key))
            return True
        except Exception:
            return False

    def local_path(self, key):
        return None

    def url(self, key, expires_s=3600):
        return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": self._k(key)},
                                                  ExpiresIn=expires_s)


_STORAGE: Storage | None = None


def get_storage() -> Storage:
    global _STORAGE
    if _STORAGE is None:
        kind = os.environ.get("ECO_STORAGE", "local").lower()
        if kind == "s3":
            bucket = os.environ.get("ECO_S3_BUCKET")
            if not bucket:
                raise RuntimeError("ECO_STORAGE=s3 requires ECO_S3_BUCKET")
            _STORAGE = S3Storage(bucket, os.environ.get("ECO_S3_PREFIX", ""), os.environ.get("ECO_S3_ENDPOINT_URL"))
        else:
            _STORAGE = LocalStorage()
    return _STORAGE
