# Product requirements — EcoConnectAI platform

**Vision:** a Coastal Ecosystem Intelligence and Decision-Support Platform for forest departments. Loop:
OBSERVE → ANALYSE → UNDERSTAND → SIMULATE → PRIORITISE → ACT → VERIFY → LEARN.
**Design principle:** AI recommends · Evidence explains · GIS contextualises · Scenarios quantify · Officers decide · Field verification confirms.

## Questions the platform answers (and where)
| # | Question | Where | Status |
|---|---|---|---|
| 1 | What is happening? | Command Center attention queue, alerts | done |
| 2 | Where? | map workspace, alert/task coordinates | done |
| 3 | How confident are we? | patch confidence, model card, provenance labels, low-confidence alerts | done |
| 4 | Why does it matter? | criticality explanation, evidence drawer | done |
| 5 | What if nothing is done? | period comparison (observed model outputs), change alerts | done (2 dates for Kerala) |
| 6 | What if this patch is lost? | Scenario Lab A/B, exact | done |
| 7 | Where would restoration improve connectivity? | Restoration Planner (gain ranking) | done |
| 8 | Which candidate is feasible? | feasibility rules with why / why-not / not-assessed | done (limited layers) |
| 9 | What should the field officer verify? | field tasks with AI reason and required evidence | done |
| 10 | What evidence supports the recommendation? | evidence drawer, report provenance | done |
| 11 | What happened after the intervention? | field evidence, verification statuses, later-period runs | done (workflow); post-intervention imagery runs are user-initiated |

## Users and roles (RBAC capability matrix in `backend/auth.py`)
State Administrator · Senior Forest/Conservation Officer · Division/Range Officer · Field Officer · GIS/Technical Officer · Research/Analyst.
Field officers see only their tasks; technical controls (parameters, models, run analysis) are limited to GIS/analyst/admin.

## Functional requirements (implemented)
Command Center · digital-twin registry (versioned analysis runs with scene/model/parameters) · real satellite pipeline (S1 primary, S2 complementary, GMW weak labels) · change detection (area, patch loss/creation by centroid matching, connectivity and criticality change) · connectivity engine (IIC/PC/ECA, degree, cut vertices, exact criticality, τ 3/5/8) · explanations · Scenario Lab A–G · Restoration Planner with feasibility and why/why-not · human-in-the-loop verification with six statuses · field module (GPS, observation, photo) · evidence chain drawer · append-only audit · provenance manifests · model cards · alert engine · projects · official reports · professional GIS map (layers, opacity, identify, coordinates, draw) · GIS-aware retrieval assistant · auth/RBAC/validation.

## Non-functional
Scientific honesty labels on every screen · no fabricated data · files for rasters, DB for state · SQLite → PostgreSQL by connection string · runs reproducible from public data · tests (44).

## Out of scope / not implemented
Measure tool on the map; administrative/protected-area/settlement layers (feasibility says "not assessed"); mobile native app (responsive web only); multi-organisation tenancy; external identity provider; scheduled acquisition.
