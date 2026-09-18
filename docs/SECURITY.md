# Security

| Control | Implementation | Notes |
|---|---|---|
| Authentication | JWT bearer tokens (HS256), bcrypt password hashes (`backend/auth.py`) | `ECO_JWT_SECRET` must be set in any shared deployment; ephemeral secret otherwise (tokens die on restart) |
| RBAC | explicit capability → roles matrix; `require(...)` dependency on every mutating endpoint | field officers cannot assign tasks, verify evidence, change parameters or read the audit log |
| Verification integrity | detections cannot reach FIELD_VERIFIED/CONFIRMED without an ACCEPTED evidence row (409 otherwise) | enforced server-side |
| Input validation | pydantic models; status enums; coordinate ranges; file type (JPEG/PNG/WebP) and size (≤ 8 MB) for photos; path confinement for served files | `segment` endpoint only accepts paths resolvable under the repository/outputs |
| Audit | append-only `audit_log` (user, role, action, object, old/new state, reason, timestamp) | never updated or deleted by the application |
| Secrets | environment variables only (`.env` git-ignored, `.env.example` documented) | STAC sources are anonymous; no API keys in code |
| CORS | `ECO_CORS_ORIGINS` allow-list | default localhost |
| Transport | none in the dev server | terminate TLS at a reverse proxy in deployment (see DEPLOYMENT.md) |
| Demo accounts | seeded only when the users table is empty; password from `ECO_DEMO_PASSWORD` | delete or change before any real use |

Not implemented: rate limiting, password policy/rotation, session revocation list, CSRF (token in header, not cookie), external IdP, encryption at rest.
