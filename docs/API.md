# API (FastAPI, `backend/`)

Interactive docs: `http://localhost:8000/docs`. Auth: `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Group | Endpoints |
|---|---|
| Health / discovery | `GET /api/health`, `/api/study-areas`, `/api/runs`, `/api/scenes`, `/api/models`, `/api/models/{id}`, `/api/models/{id}/asset/{png}` |
| Run artefacts | `GET /api/runs/{area}/{run|latest}/bundle|patches|graph|metrics|criticality|explanations|restoration|tau-sensitivity|manifest|files/{name}|probability.png|report` |
| Timeline | `GET /api/runs/{area}/timeline` |
| Interactive analysis | `POST …/what-if`, `POST …/restoration` (optional costs), `POST …/reanalyse` (τ/k/metric), `POST …/scenario` (A–G), `GET …/restoration/feasibility`, `GET …/evidence/{type}/{id}` |
| Pipeline | `POST /api/segment` (auto scene/checkpoint/threshold), `POST /api/registry/sync` |
| Auth / users | `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/roles`, `GET/POST /api/users` |
| Registry / cards | `GET /api/registry/{area}`, `GET /api/model-cards` |
| Alerts | `GET /api/alerts`, `POST /api/alerts/generate/{area}`, `PATCH /api/alerts/{id}` |
| Detections | `GET/POST /api/detections`, `PATCH /api/detections/{id}/status` |
| Field | `GET/POST /api/field-tasks`, `PATCH /api/field-tasks/{id}/status`, `GET/POST /api/field-tasks/{id}/evidence`, `PATCH /api/evidence/{id}/verify`, `GET /api/evidence/photo/{name}` |
| Projects / scenarios / reports | `GET/POST/PATCH /api/projects`, `GET /api/projects/{id}`, `GET/POST /api/scenarios`, `POST /api/reports/generate`, `GET /api/reports` |
| Assistant / audit | `POST /api/assistant/ask`, `GET /api/audit` |
