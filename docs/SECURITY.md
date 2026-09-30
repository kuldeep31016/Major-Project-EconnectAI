# Security

_Last verified against the code: 2026-10-01._ This page lists the controls that exist in the code and the
known gaps. It is a research prototype and has had no external security review or penetration test.

## Controls in place

### Authentication

| Item | Implementation (`backend/auth.py`, `backend/routers.py`) |
|---|---|
| Password hashing | **bcrypt** (`bcrypt.hashpw` with `gensalt()`, default cost 12). Hashes only, never plaintext. |
| Access token | JWT **HS256** signed with `ECO_JWT_SECRET`. Claims: `sub`, `uid`, `role`, `exp`, `typ=access`. Lifetime `ECO_ACCESS_MINUTES` (default 60; the legacy `ECO_TOKEN_HOURS` is still honoured). Sent as `Authorization: Bearer …`. On each request the user is re-loaded from the DB and must still be `active`. |
| JWT secret fallback | If `ECO_JWT_SECRET` is unset, a random secret is generated once and kept in `outputs/.jwt_secret` (gitignored, dockerignored). `render.yaml` sets `generateValue: true` for production. |
| Refresh tokens | Random `token_urlsafe(40)`, stored as a **sha256** hash only (`refresh_tokens` table, migration 0005), lifetime `ECO_REFRESH_DAYS` (default 14). `POST /api/auth/refresh` **rotates**: the old token is revoked and a new one is issued in the same family. **Reuse detection**: presenting a revoked token revokes the whole family and writes the audit event `refresh_token_reuse`. `POST /api/auth/logout` revokes the family. |
| Login rate limiting | `security.LoginThrottle`: 10 failed logins per (client IP, username) in a 5-minute sliding window → HTTP 429. The counter resets on success. |
| Assistant rate limiting | Signed-in Claude answers: `ECO_ASSISTANT_PER_HOUR` (default 30) per user per hour → 429. |

### Authorisation: 6 roles, capabilities checked server-side

Roles: `state_admin`, `senior_officer`, `range_officer`, `field_officer`, `gis_officer`, `analyst`.
Endpoints declare `Depends(require("<capability>"))`. The matrix is `PERMISSIONS` in `backend/auth.py`:

| Capability | Roles |
|---|---|
| `view`, `view_models` | all six |
| `run_analysis`, `change_parameters` | gis_officer, analyst, state_admin |
| `review_detections` | senior_officer, range_officer, state_admin, gis_officer |
| `manage_projects`, `assign_tasks` | senior_officer, range_officer, state_admin |
| `submit_evidence` | field_officer, range_officer, state_admin |
| `verify_evidence` | senior_officer, range_officer, state_admin |
| `manage_alerts` | senior_officer, range_officer, state_admin, gis_officer |
| `generate_report` | senior_officer, range_officer, state_admin, analyst, gis_officer |
| `manage_users` | state_admin |
| `view_audit` | state_admin, senior_officer |
| `manage_models` (DEVELOPMENT/EXPERIMENTAL/CANDIDATE) | state_admin, analyst, gis_officer |
| `validate_models` (the only route to VALIDATED, and it needs evidence) | state_admin |
| `decide_restoration` | senior_officer, state_admin |

Some rules are enforced inside handlers:

- Field officers only see and progress their own tasks and submit evidence only to tasks assigned to them.
- Only reviewing officers may set a task to VERIFIED/REJECTED.
- Jobs are visible only to their creator or to `view_audit` holders.
- Detections cannot reach FIELD_VERIFIED/CONFIRMED without accepted evidence.
- Restoration APPROVED needs a field-verified site.
- The anonymous evidence chain redacts field personal data.

`docs/API.md` lists the requirement for every endpoint.

### Input and path hardening

- **Path ids**: an app-wide dependency (`security.validate_path_params`) requires `study_area`, `run_id`,
  `experiment_id`, `object_type`, `object_id` and `job_id` to match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` with no
  `..`. Otherwise it returns 400.
- **Path containment**: `security.contained()` resolves a path and returns 404 if it leaves its root.
  `paths.resolve_run` is the only run resolver (it validates the `LATEST` pointer too).
  `GET …/files/{name}` uses only the basename. Model assets are contained in their experiment folder and
  must be `.png`. `storage._check_key` rejects empty, `.` and `..` segments.
- **`POST /api/segment`**: rasters must be `.tif`/`.tiff` under `DATA_ROOT` or `outputs/`. Checkpoints must be
  exactly `outputs/segmentation/<exp>/best_model.pth`. `result_kind` is fixed to `development`.
- **Evidence upload** (`POST /api/field-tasks/{id}/evidence`):
  - The size limit is **8 MB**, read with a hard cap. Larger files get 413.
  - The type is decided by **magic bytes** (JPEG `FFD8FF`, PNG signature, `RIFF….WEBP`), never by the client's
    content type. The stored name is generated server-side (`task<id>_<uuid12><ext>`).
  - Photo **EXIF GPS** is read with Pillow and used as the location only when no coordinates are typed. A
    location is never invented (400 otherwise). Coordinates are range-checked.
  - The checklist is validated against allowed values.
- Request bodies are pydantic models (slug patterns, length limits such as assistant questions of 2–1000 chars).

### CORS

`security.cors_config()`: `ECO_CORS_ORIGINS` is split on commas and whitespace, trailing `/` stripped. The
default is `http://localhost:3000,http://127.0.0.1:3000`. A `*` is dropped unless `ECO_CORS_ALLOW_ALL=1`. A lone
`*` stays permissive so the frontend is never locked out, but startup then logs a loud warning. Optional
`ECO_CORS_ORIGIN_REGEX`. `GET /api/health` reports the effective origins for diagnosis.

### Secrets

Secrets live in environment variables only: `ECO_JWT_SECRET`, `ECO_DATABASE_URL`, `ANTHROPIC_API_KEY`,
`ECO_DEMO_PASSWORD`, `AWS_*`.

- `.env` and `.env.*` are gitignored. `.env.example` documents every variable without values.
- `render.yaml` marks secrets `sync: false` (entered in the dashboard).
- A search of the git history on 2026-10-01 found no committed `.env`, JWT secret, database file or Anthropic key.

### Audit log

`audit_log` table, written through `db.audit()` (user, role, action, object, old/new state, reason, timestamp).
The application never updates or deletes rows. Only `state_admin` and `senior_officer` can read it
(`GET /api/audit`). Actions currently logged:

`login`, `login_failed`, `logout`, `refresh_token_reuse`, `create_user`, `enqueue_job`, `run_analysis`,
`registry_sync`, `generate_alerts`, `update_alert`, `register_detection`, `detection_status`, `create_field_task`,
`field_task_status`, `submit_evidence`, `verify_evidence`, `verification_cascade`, `model_disagreement_flagged`,
`review_disagreement`, `export_hitl_dataset`, `create_project`, `update_project`, `save_scenario`, `model_status`,
`create_restoration_review`, `restoration_gis_review`, `restoration_field_task`, `restoration_feasibility`,
`restoration_decision`, `generate_report`, `download_report_pdf`, `assistant_question` (anonymous questions
included).

Job cancellation is **not** audited.

### Request IDs and logging

`observability.RequestContextMiddleware` accepts a sane incoming `X-Request-ID` (8–64 chars `[A-Za-z0-9._-]`)
or generates one. It is echoed in the response (exposed via CORS) and attached to JSON log lines. 5xx and
requests slower than 5 s are logged with their route.

### Dependency audits (CI)

`.github/workflows/ci.yml` runs:

- `pip-audit -r requirements-api.txt`
- `npm audit --omit=dev --audit-level=high`
- ruff (pyflakes rules)
- pytest on SQLite and on PostgreSQL + PostGIS
- the acceptance test
- tsc, eslint, `next build`
- Docker builds of both images

Both audits are **advisory**: they emit a warning and do not fail the build. The GitHub account is currently
billing-locked, so these jobs are **not running**.

## Known gaps

The items below were checked in the code on 2026-10-01.

1. **Demo accounts on the public demo.** Six demo accounts, including `state_admin`, are seeded into an empty
   DB with `ECO_DEMO_PASSWORD`. The login page's demo buttons send `NEXT_PUBLIC_DEMO_PASSWORD` (default
   `demo1234`), which is compiled into the public JavaScript bundle. If the two values match on the live
   deployment (they must for the demo buttons to work), **anyone can sign in as State Administrator**. They can
   then create users, read the audit log and make workflow decisions. Before any real use, remove or disable the
   demo accounts and stop exposing the password.
2. **Tokens in web storage.** Access and refresh tokens are kept in `localStorage` ("Remember me") or
   `sessionStorage` (`frontend/lib/api.ts`). Bearer tokens in headers mean no CSRF exposure, but any XSS can
   read the tokens. There is no Content-Security-Policy or other security headers from the API or
   `next.config.ts`.
3. **Rate limits are in-memory and per process.** The login throttle and assistant quota reset on restart and
   are not shared across instances or workers. The throttle is keyed by (IP, username), so attempts spread
   across usernames or IPs are not limited, and there is no account lockout. Behind a proxy `request.client.host`
   may be the proxy address. Other endpoints have **no rate limit**. Public compute endpoints (what-if,
   reanalyse, scenario, restoration) and the anonymous assistant, which writes an audit row per question, can
   be called without limit.
4. **Much of the API is readable without signing in.** Run artefacts, alerts, detections, saved scenarios,
   registry, model cards, artifacts, provenance and the evidence chain are public by design for the demo (see
   `docs/API.md`). There is no organisation or tenant scoping: every signed-in user sees all organisations' data.
5. **Evidence access is not scoped to the task.** `GET /api/field-tasks/{id}/evidence` and
   `GET /api/evidence/photo/{name}` only require sign-in. A field officer can read other officers' evidence,
   including coordinates and notes, if they know or guess the task id or photo name. Photos are stored with
   their original EXIF metadata; GPS is not stripped.
6. **Machine paths leak through two endpoints.** `GET /api/runs/{area}/{run}/files/manifest.json` and
   `GET /api/registry/{area}` return absolute paths recorded on the producing machine (`/Users/<name>/…`).
   Low severity: this is information disclosure only. The `manifest`/`bundle` endpoints already rewrite these
   paths.
7. **No MFA, no password reset, no password policy.** "Forgot password" tells the user to ask the State
   Administrator. `POST /api/users` has no minimum password length. With bcrypt ≥ 5 (installed locally: 5.0.0), a password over
   72 bytes raises in `hash_password`, so user creation fails with a 500 instead of a clear 400. Login takes less
   time for unknown usernames because bcrypt is skipped, which allows timing-based username
   enumeration.
8. **Access tokens cannot be revoked before expiry.** Logout and deactivation stop refresh. A still-valid
   access token keeps working until `exp` (up to `ECO_ACCESS_MINUTES`) unless the user is set inactive.
9. **Transport and container.** TLS is terminated by the host (Render, Vercel). The dev server has none. The API
   container runs as root (no `USER` in `Dockerfile`). There is no encryption at rest beyond what the providers
   supply.
10. **Dependencies are not pinned** (`>=` ranges in the requirements files), and the CI audits are advisory and
    currently not running.

## Reporting a vulnerability

Please do not open a public issue. Contact the maintainer privately through GitHub (`kuldeep31016`, repository
`kuldeep31016/Major-Project-EconnectAI`, using "Report a vulnerability" under the Security tab if enabled) with
steps to reproduce. This is a student research project with no bug bounty and no guaranteed response time.
