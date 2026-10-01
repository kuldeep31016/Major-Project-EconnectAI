# EcoConnectAI

**A Satellite-Driven Framework for Coastal Ecosystem Connectivity and Conservation Decision Support**
Final-year research project · interactive research prototype · paper: [`docs/EcoConnectAI_IEEE_paper.pdf`](docs/EcoConnectAI_IEEE_paper.pdf)

> **From mapping habitat to understanding which habitat matters.**
> Decision support — not automated conservation approval. Results are development results, checked against
> Global Mangrove Watch reference maps, not field-validated. Scenarios are simulations.

Live demo (free tier, first load may take ~1 min while the API wakes): **https://major-project-econnect-ai.vercel.app**
· guided walkthrough: `/demo` · API: https://major-project-econnectai-lzaw.onrender.com/docs

---

## The problem

Mapping mangroves from satellites is well studied. What conservation officers still lack is an answer to the next
question: **once habitat is mapped, which patches hold the network together, what happens if one is lost, and where
would restoration reconnect the most forest?** A small patch can matter more than a large one if it is the only link
between two groups.

## What EcoConnectAI does

```
Sentinel-1 radar (VV+VH, 10 m)  →  temporal median  →  U-Net segmentation  →  probability map  →  habitat mask
   →  habitat patches (≥ 2 ha)  →  connectivity graph (k-NN, τ = 5 km)  →  IIC / PC / ECA
   →  leave-one-patch-out criticality + cut vertices  →  what-if scenarios  →  τ × k sensitivity
   →  restoration candidates  →  human field verification  →  audited reports
```

| Step | What the user gets | Where |
|---|---|---|
| Detect | habitat map + per-patch model confidence | `/analysis`, `/command` |
| Connect | the coast as a network of patches and travel links | `/graph` |
| Prioritise | area rank vs criticality rank, sortable leave-one-out table, "explain this patch" | `/analysis` → Patch importance |
| Simulate | remove / shrink / add patches, draw a threat polygon, change τ or threshold, compare periods (patch tracking: stable / split / merged / new / disappeared) — all labelled SIMULATION or MODEL-ESTIMATED | `/scenario` |
| Restore | candidates ranked by connectivity gain; large uncertain areas routed to a field check; feasibility factors "not assessed" until data exists; no invented costs | `/restoration` |
| Verify | field tasks, photo + GPS evidence (EXIF GPS read, never invented), officer sign-off, model-disagreement register | `/field` |
| Report | PDF with provenance, limitations and verification status | `/reports` |
| Ask | EcoConnectAI Assistant (production RAG): counts and facts from stored data with no AI call; explanations from hybrid retrieval (BM25 + local embeddings, pgvector) over the docs, paper and run results with cited sources; streamed Claude answers only when needed, with validated citations and cost tracking; knows the patch or candidate on screen ([docs/rag](docs/rag/ARCHITECTURE.md)) | chat button (⌘K) |

Plain-language explanations are built into every page ("In plain words" line, glossary tooltips on IIC/PC/ECA/τ).

## Current results (development — not final)

| Item | Value | Label |
|---|---|---|
| Reported model | U-Net + EfficientNet-B0, Sentinel-1 VV+VH, 4 study areas (`multi_E1_s1_b0_dev`) | DEVELOPMENT |
| Test agreement with Global Mangrove Watch | IoU 0.842 · F1 0.914 | vs weak reference labels, **not field accuracy** |
| Kerala run (default) | 12 patches · 204.6 ha · 18 links · 3 components; P07 = 2.7 % of habitat, #7 by area, #3 by criticality, −25.6 % IIC, splits the network | DEVELOPMENT |
| UNB7 (EfficientNet-B7), S2, S1+S2 at 4-area scale | not trained here | NOT YET RUN |
| 95.56 % accuracy | the foundation study's figure | PUBLISHED BASELINE — NOT OUR RESULT |

Details and provenance: [`docs/ML.md`](docs/ML.md), [`docs/RESULTS_PROVENANCE.md`](docs/RESULTS_PROVENANCE.md),
[`docs/PAPER_IMPLEMENTATION_MATRIX.md`](docs/PAPER_IMPLEMENTATION_MATRIX.md).

## Architecture

Next.js 16 frontend → FastAPI API → SQLite (dev) / PostgreSQL (prod, Alembic migrations) · object storage (local or
S3-compatible) · DB-backed job queue + worker · run artefacts with sha256 provenance. Training/inference run off-host
(laptop MPS or Colab/Kaggle GPU). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start

```bash
make setup            # .venv with API deps + frontend packages   (make setup-ml adds PyTorch for training/inference)
cp .env.example .env  # optional: ECO_DATABASE_URL, ANTHROPIC_API_KEY, storage settings
make run              # API :8000 + frontend :3000  → http://localhost:3000  (demo users are created on first start)
make test             # backend + library tests
make acceptance       # 20-step end-to-end acceptance test on a scratch copy of the data
make rag-eval         # assistant golden-set evaluation (64 questions) -> docs/rag/EVAL_RESULTS.md
make lint typecheck build
docker compose up --build            # containers; --profile postgres for PostGIS, --profile worker for a separate worker
```

Real data pipeline (needs `make setup-ml`; no credentials required for the public STAC sources):
`scripts/acquire_study_area.py` → `scripts/build_tiles.py` → `scripts/train.py` → `scripts/evaluate.py` / `threshold_sweep.py` → `scripts/predict.py` →
`scripts/run_graph_analysis.py` — see [`docs/GEOSPATIAL_PIPELINE.md`](docs/GEOSPATIAL_PIPELINE.md) and
[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md).

## Testing

`make test` (unit, regression pins of stored results, API, RBAC, security, workflow, temporal tracking, EXIF GPS) and
`make acceptance` (select area → re-run analysis job → graph → IIC → criticality → what-if → sensitivity →
restoration → field task → report → AI answer checked against stored numbers → audit log → PDF). Steps that need
satellite scenes, checkpoints or PyTorch report **SKIP** when those are not present — never PASS.

## Deployment

Free-tier demo: Vercel (frontend) + Render (API, Docker) + Neon (PostgreSQL). CI: GitHub Actions (lint, tests,
acceptance, type-check, build, dependency audit, Docker build, deploy hook). [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) ·
`make deploy-check API=… FRONTEND=…`

## Limitations (read before presenting)

Weak reference labels (GMW) · development model · study areas differ strongly (Kerala has few positive test tiles) ·
no field validation · connectivity is a structural spatial proxy, not observed animal movement · τ = 5 km is an
assumption (sensitivity shown) · restoration candidates need field and legal assessment · no validated cost data ·
temporal differences are model outputs · model confidence ≠ ecological certainty. Full list:
[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Documentation

| Topic | File |
|---|---|
| Audit & status | [`AUDIT.md`](docs/AUDIT.md) · [`IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) · [`PAPER_IMPLEMENTATION_MATRIX.md`](docs/PAPER_IMPLEMENTATION_MATRIX.md) |
| Science | [`ML.md`](docs/ML.md) · [`GEOSPATIAL_PIPELINE.md`](docs/GEOSPATIAL_PIPELINE.md) · [`CONNECTIVITY.md`](docs/CONNECTIVITY.md) · [`SCENARIOS.md`](docs/SCENARIOS.md) · [`RESTORATION.md`](docs/RESTORATION.md) · [`MODEL_CARD.md`](docs/MODEL_CARD.md) · [`EXPERIMENTS.md`](docs/EXPERIMENTS.md) |
| Platform | [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`API.md`](docs/API.md) · [`docs/rag/`](docs/rag/ARCHITECTURE.md) (RAG: architecture, setup, ingestion, retrieval, evaluation, security, cost) · [`ASSISTANT_FAQ.md`](docs/ASSISTANT_FAQ.md) · [`SECURITY.md`](docs/SECURITY.md) · [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`FIELD_WORKFLOW.md`](docs/FIELD_WORKFLOW.md) |
| Reproducibility & honesty | [`REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) · [`RESULTS_PROVENANCE.md`](docs/RESULTS_PROVENANCE.md) · [`LIMITATIONS.md`](docs/LIMITATIONS.md) · [`IP_READINESS.md`](docs/IP_READINESS.md) (no patentability claim) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) · project memory for maintainers: [`docs/context/`](docs/context/README.md) |

Result labels used everywhere: `PUBLISHED BASELINE — NOT OUR RESULT` · `PROTOTYPE / SYNTHETIC RESULT` ·
`DEVELOPMENT-SUBSET RESULT — NOT FINAL` · `OUR EXPERIMENTAL RESULT` · `NOT YET RUN` · `SIMULATION` · `REQUIRES VERIFICATION`.

## Future work

UNB7 and S2 / S1+S2 ablations on a GPU at 4-area scale · fix tiling leakage and re-evaluate · multi-year inference
with one model · field campaign with a forest department · ownership / legal / cost layers · patches as database rows
with geometry · a live-LLM evaluation of the assistant's generated answers · live job progress streaming.

Licence and citation: not yet chosen — the project owner will add `LICENSE` and `CITATION.cff`.
