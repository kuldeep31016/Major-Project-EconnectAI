# EcoConnectAI — Basic Understanding (learning guide)

This file explains the whole project in simple words, from the satellite image to the chatbot: what each part does,
which modules are used, how the formulas work (with a small example you can calculate by hand), and where each piece
lives in the code. Read it top to bottom. Every section ends with "Where in the code" so you can open the real file.

---

## 0. The project in one paragraph

Mangrove forests along the coast are broken into separate pieces ("patches"). Existing satellite maps tell us *where*
the mangroves are. EcoConnectAI asks the next question: **which pieces hold the whole forest network together?** It
(1) maps mangroves from free satellite radar images with a deep-learning model, (2) cuts the map into patches,
(3) connects nearby patches into a network (a graph), (4) measures how well connected the network is with a formula
called IIC, (5) removes each patch one at a time to see how much connectivity drops — that is the patch's
**criticality**, (6) lets you simulate "what if this patch is lost?", (7) finds places where restoration would
reconnect the network, and (8) sends results to people for field verification and reports. An AI assistant answers
questions about all of this using only the project's own data.

The key idea: **a small patch can be more important than a big one** if it is the only bridge between two groups.

```
Satellite image → AI model → probability map → habitat mask → patches → network (graph)
  → connectivity (IIC) → criticality (remove one patch at a time) → what-if → restoration candidates
  → field verification → reports            (+ AI assistant that explains all of it)
```

---

## 1. The technology stack (which modules we use)

| Layer | Technology | What it does here |
|---|---|---|
| Satellite data | Sentinel-1 (radar), Sentinel-2 (optical), Global Mangrove Watch | free images + an existing mangrove map used as training labels |
| Data download | STAC APIs (Microsoft Planetary Computer, Earth Search) | search and download scenes by area and date |
| Image processing | `rasterio`, `numpy`, `shapely`, `pyproj` | read/write rasters, polygons, coordinate systems |
| Deep learning | PyTorch + `segmentation-models-pytorch` (U-Net, EfficientNet-B0 encoder) | pixel-by-pixel mangrove probability |
| Graph maths | our own code in `ecoconnect/graph/` (`numpy`) | network, IIC, criticality, what-if, restoration |
| Backend API | Python **FastAPI**, **SQLAlchemy** (database), **Alembic** (database migrations) | serves data, runs scenarios, users, jobs |
| Database | SQLite (development/tests), **PostgreSQL** (production on Neon) | users, runs, alerts, tasks, chat index |
| Frontend | **Next.js 16 / React 19**, Tailwind CSS, **Leaflet** (maps), React Flow (graph), framer-motion | the website |
| Auth | JWT tokens + refresh tokens, 6 roles | login and permissions |
| AI assistant | local embeddings (`fastembed`, model `BAAI/bge-small-en-v1.5`), BM25 search, optional **Claude** (Anthropic) | the chatbot (RAG) |
| Deployment | Vercel (frontend), Render (API in Docker), Neon (PostgreSQL), GitHub Actions (CI) | the live demo |

Folder map:
```
ecoconnect/   the science library (data, ML, patches, graph maths, pipeline)
backend/      the FastAPI server (API, database, auth, jobs, scenarios, alerts, chatbot)
backend/rag/  the chatbot's retrieval system
frontend/     the Next.js website
scripts/      command-line tools (download data, train, predict, analyse, tests)
outputs/runs/ stored analysis results ("runs"), one folder per study area and run
docs/         documentation (this file)
tests/        automated tests
```

---

## 2. Step 1 — Satellite data

**What**: For each study area (Kerala's Vembanad–Kol wetland, Sundarbans, Gulf of Mannar, Bhitarkanika/Odisha) we
download **Sentinel-1** radar images. Radar is used because it **sees through clouds and works at night** — important
in the monsoon tropics where optical images are often cloudy.

**Bands**: Sentinel-1 gives two measurements per pixel: **VV** and **VH** (how strongly the radar signal bounces back
in two polarisations). Mangroves (dense trees standing in water) reflect radar differently from water, fields or towns.

**Temporal median**: several images over a period are stacked and, for every pixel, the **median** value is taken.
This removes noise (radar "speckle") and one-off events. Pixel size is **10 m × 10 m**.

**Labels**: we have no field survey data, so we use **Global Mangrove Watch (GMW) 2020** — an existing global
mangrove map — as "weak labels" (the answer key used for training). It is not perfect and is **not ground truth**.

Where in the code: `ecoconnect/gee/` and `scripts/acquire_study_area.py` (download), `ecoconnect/geospatial/preprocessing/`
(cleaning, median), `configs/study_areas.yaml` (the four areas). Docs: `docs/GEOSPATIAL_PIPELINE.md`.

---

## 3. Step 2 — The AI model (mangrove detection)

**Task**: "semantic segmentation" — for every pixel, predict the probability (0 to 1) that it is mangrove.

**Model**: **U-Net** with an **EfficientNet-B0** encoder.
- *Encoder* (EfficientNet-B0): a pre-built image network that shrinks the image step by step and learns features
  (edges, textures, patterns).
- *Decoder* (U-Net): grows the image back to full size; "skip connections" copy fine details from the encoder so the
  output map stays sharp.
- Input: 2 channels (VV, VH), tiles of 256 × 256 pixels. Output: one probability per pixel.

**Training**: the four areas give 1,373 tiles in total; the reported development model used a capped split of
800 training, 195 validation and 200 test tiles, with GMW labels. During training the model adjusts its weights to make
its predictions match the labels (the loss function measures the mistake; the optimiser reduces it). Validation tiles
are used to pick the best version; test tiles are only used once at the end to report the scores.

**Threshold**: probability ≥ **0.70** → "habitat", otherwise "not habitat". This gives the **habitat mask** (a map of
yes/no pixels).

**How we measure the model** (on test tiles it never saw), using TP = correctly predicted mangrove pixels,
FP = predicted mangrove but GMW says no, FN = missed mangrove:
- **IoU** (Intersection over Union) = TP / (TP + FP + FN) → our result **0.842**
- **F1 / Dice** = 2·TP / (2·TP + FP + FN) → our result **0.914**
- Precision = TP / (TP + FP); Recall = TP / (TP + FN)

Honest meaning: these numbers measure **agreement with the GMW map**, not real-world accuracy. The good score comes
mostly from the Sundarbans; Kerala is weak. The famous **95.56 %** belongs to the foundation research paper, not to us.
The bigger EfficientNet-B7 model ("UNB7") has **not** been trained.

Where in the code: `ecoconnect/ml/` (dataset, model, training, evaluation), `scripts/train.py`, `scripts/evaluate.py`,
`scripts/predict.py`. Docs: `docs/ML.md`, `docs/MODEL_CARD.md`.

---

## 4. Step 3 — From pixels to habitat patches

**Connected components**: neighbouring habitat pixels (including diagonal neighbours — "8-connectivity") are grouped
into one **patch**. Think of it like a flood fill in a paint program.

**Minimum mapping unit (MMU)**: patches smaller than **2 ha** are dropped as noise. (1 ha = 100 m × 100 m = 100 pixels
of 10 m.)

**Patch attributes** saved for every patch: ID (P01, P02, … numbered by area, largest first), area (ha), centroid
(centre point), perimeter, polygon outline, and **confidence** = average model probability inside the patch.

Important: patch IDs are given **per run**. "P07" in one run is not the same place as "P07" in another run.

Where in the code: `ecoconnect/geospatial/patch_extraction/`. Docs: `docs/GEOSPATIAL_PIPELINE.md` §5.

---

## 5. Step 4 — Building the network (graph)

A **graph** has **nodes** (here: patches) and **edges** (links between patches).

**Distance**: d_ij = distance in km between the centres of patch i and patch j (the "haversine" formula measures
distance on the Earth's curved surface).

**Linking rule** (two assumptions):
- **k = 3**: each patch is linked to its **3 nearest** patches…
- **τ (tau) = 5 km**: …but only if they are at most **5 km** apart.
So a link means "close enough that seeds, fish or birds could plausibly move between them". This is a **structural**
proxy; we do not track real animals.

**Components**: groups of patches connected to each other through links. If the network has 3 components, there are
3 separate groups with no link between them.

(An "edge weight" w_ij = √(q_i·q_j)·e^(−d_ij/τ) is stored for display only — it is not used by the connectivity formula.)

Where in the code: `ecoconnect/graph/construction.py`, `ecoconnect/graph/types.py`. Settings: `configs/graph.yaml`.

---

## 6. Step 5 — Measuring connectivity: the IIC formula

**IIC = Integral Index of Connectivity** — one number for "how well connected is the whole habitat network".

```
        Σ_i Σ_j  ( a_i × a_j ) / ( 1 + nl_ij )
IIC = ─────────────────────────────────────────
                     A_L²
```
- a_i, a_j = areas of patches i and j (ha)
- nl_ij = number of links on the shortest path between i and j (0 when i = j; if there is no path, the pair adds 0)
- A_L = area of the whole landscape (ha) — this just scales the number
- the sum goes over **all pairs**, including each patch with itself

Intuition: big patches that are connected by **few steps** add a lot. Patches that cannot reach each other add nothing.
So IIC rises when habitat is large **and** well linked.

### Worked example (calculate it yourself)

Three patches in a line, each 10 ha, A_L = 100 ha: **A — B — C** (A–B linked, B–C linked, A–C not directly).

| Pair | a_i × a_j | nl | contribution |
|---|---|---|---|
| A–A, B–B, C–C (itself) | 100 each | 0 | 100 + 100 + 100 = 300 |
| A–B and B–A | 100 | 1 | 50 + 50 = 100 |
| B–C and C–B | 100 | 1 | 50 + 50 = 100 |
| A–C and C–A | 100 | 2 | 33.3 + 33.3 = 66.7 |
| **Total** | | | **566.7** |

IIC = 566.7 / 100² = **0.0567**

**ECA** (Equivalent Connected Area) = √PC × A_L: "how big one single, perfectly connected forest would have to be to give
the same connectivity". Shown as % of habitat. **PC** (Probability of Connectivity) is like IIC but uses probabilities
that decrease with distance instead of link counts.

Where in the code: `ecoconnect/graph/connectivity.py` (`iic`, `pc`, `eca_ha`). Docs: `docs/CONNECTIVITY.md` §2.

---

## 7. Step 6 — Criticality (the heart of the project)

**Leave-one-out**: for every patch, remove it (with its links), recompute IIC, and measure the drop.

```
ΔC_i = IIC(full network) − IIC(network without patch i)
S_i  = ΔC_i / IIC(full network)           ← criticality score (0 to 1)
loss % = 100 × S_i
```
Patches are ranked by S_i: rank #1 = the patch the network depends on most.

**Cut vertex**: a patch whose removal **splits** the network into more groups (components go up). It is a bridge.

### Continue the example

- Remove **B** (the middle): A and C are now isolated → only self-pairs remain: 100 + 100 = 200 → IIC = 0.02.
  Loss = (0.0567 − 0.02) / 0.0567 = **64.7 %**. Components 1 → 2, so **B is a cut vertex**.
- Remove **A** (an end): B–C remain: 100 + 100 + 50 + 50 = 300 → IIC = 0.03. Loss = **47.1 %**. Not a cut vertex.

All three patches have the **same area**, but B is the most critical because it is the bridge. That is the project's
main idea.

### The real example: P07 in the Kerala run

Kerala's current run (`kerala-coast_multi_E1_s1_b0_dev_t0.70`): 12 patches, 204.6 ha, 18 links, 3 components.
**P07** is only 5.49 ha (2.7 % of the habitat, 7th by size) but ranks **#3** by criticality: removing it lowers IIC by
**25.6 %** and splits the network from 3 into 4 groups (cut vertex). Honest caveat: P07 stays in the top 5 only for
some assumptions (it is top 5 at 5 km and 8 km but not at 3 km).

Where in the code: `ecoconnect/graph/criticality.py` (`compute_criticality`), `ecoconnect/graph/explain.py` (the
plain-language explanation text). Frontend: Analysis → Patch importance tab (`frontend/components/analysis/patch-importance.tsx`).

---

## 8. Step 7 — What-if scenarios (simulation)

The same calculation for any change: remove one or several patches, shrink a patch, add a hypothetical patch, draw a
polygon (all patches it touches are removed), change τ or the threshold. Output: before → after → difference
(IIC, PC, ECA, links, components) and which patches are affected.

These are **simulations** ("what would the current network look like if…"), not predictions of the future.

Where in the code: `ecoconnect/graph/what_if.py`, `backend/scenarios.py` (all 11 scenario types). Frontend: `/scenario`.
Docs: `docs/SCENARIOS.md`.

---

## 9. Step 8 — Sensitivity (are our assumptions too important?)

k = 3 and τ = 5 km are assumptions. We re-run the analysis with τ = 3, 5, 8 km (and k = 2, 3, 4) and compare the
patch rankings with **Spearman rank correlation ρ** (1 = identical order, 0 = unrelated order). In Kerala: ρ = 0.81 at
3 km and 0.99 at 8 km compared with 5 km — fairly stable, but some patches (like P07) move.

Where in the code: `ecoconnect/graph/sensitivity.py`. Frontend: sensitivity explorer on `/analysis`.

---

## 10. Step 9 — Restoration candidates

**Candidates** = areas where the model's probability is "almost mangrove" (between 0.3 and the 0.7 threshold), at
least 1 ha. Each candidate is added to the network as a new patch and IIC is recomputed:

```
R_i = IIC(network + candidate i) − IIC(network)        gain % = 100 × R_i / IIC(network)
```
Candidates are ranked by gain. If (and only if) a real cost table is supplied: priority = gain / cost.

**Uncertain-habitat rule** (honesty): a candidate bigger than **5 ha AND bigger than 10 % of the mapped habitat** is
probably existing mangrove the model was unsure about, not a restoration site → labelled "field check", its gain is
not advertised. In Kerala, C01–C04 are uncertain; **C05** (18 ha, +16.45 %) is the first real candidate.

Candidates are **computational suggestions**: ownership, legal status, water, salinity and cost are not assessed.

Where in the code: `ecoconnect/graph/restoration.py`, `ecoconnect/pipeline/restoration_rules.py`,
`backend/scenarios.py` (`restoration_feasibility`). Docs: `docs/RESTORATION.md`.

---

## 11. Step 10 — Comparing years (temporal change)

Two runs (e.g. 2020 and 2025) are compared only if they used the **same model, threshold and patch rules**; otherwise
the app warns "not like-for-like". Patches are matched by **polygon overlap** (≥ 10 % of the smaller patch) and
classified: stable, grown, shrunk, split, merged, new, disappeared. Differences are **model-estimated change**, never
"confirmed loss".

Where in the code: `ecoconnect/graph/temporal.py`, `backend/scenarios.py` (`compare_periods`).

---

## 12. The pipeline and "runs"

`ecoconnect/pipeline/analysis.py` (`run_graph_analysis`) runs steps 4–9 and writes a **run folder**
`outputs/runs/<area>/<run_id>/` with files: `manifest.json` (settings, model, data source, git commit — provenance),
`metrics.json`, `patches.geojson`, `graph.json`, `criticality.json`, `explanations.json`, `restoration.json`,
`tau_sensitivity.json`, `what_if_top1.json`, `frontend_bundle.json`. A file `LATEST` in each area folder points to the
run the app shows by default. Every number in the app comes from these files.

---

## 13. The backend (FastAPI server)

**How a request works**: the browser calls a URL (e.g. `GET /api/runs/kerala-coast/latest/criticality`) → FastAPI
finds the function for that URL → the function reads the run files or the database → returns JSON.

Main parts:
- `backend/main.py` — creates the app; at startup it upgrades the database (Alembic), syncs runs/models into the
  registry, creates demo users, generates alerts, queues the chatbot indexing job; run-data and scenario endpoints.
- `backend/db.py` — all database tables (SQLAlchemy models): users, study areas, runs, models, alerts, detections,
  field tasks, evidence, projects, reports, audit log, jobs, chat tables, RAG tables.
- `backend/auth.py` — login with password (hashed with bcrypt), **JWT access token** (60 min) + **refresh token**
  (rotates; reusing an old one cancels the whole session family). 6 roles (State Administrator, Senior Officer, Range
  Officer, Field Officer, GIS Officer, Analyst) and a capability table checked on the server.
- `backend/routers.py` — alerts, detections, field tasks, evidence upload (photo type/size checks, GPS from photo
  EXIF), projects, reports, audit log.
- `backend/scenarios.py` — Scenario Lab engine. `backend/alerts.py` — rule-based alerts with plain titles.
- `backend/jobs.py`, `backend/job_handlers.py` — background jobs stored in the database (reproduce a run, ingest
  documents for the chatbot, segment imagery).
- `backend/security.py` — rate limits, path-traversal protection, CORS. `backend/storage.py` — local disk or S3.
- `backend/observability.py` — request IDs, JSON logs, timing metrics (`/system` page).

**Human in the loop (field verification)**: a detection moves AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED →
FIELD_VERIFIED or REJECTED → CONFIRMED. Field officers upload GPS + photo; a senior officer accepts or rejects.

---

## 14. The frontend (website)

- `frontend/lib/api.ts` — every call from the browser to the backend (one function per endpoint).
- `frontend/hooks/use-analysis.tsx` — shared state: selected study area, run, patch (so all pages agree).
- `frontend/hooks/use-auth.tsx` — the logged-in user and their permissions.
- Pages in `frontend/app/`: `/command` (dashboard + map), `/analysis` (map + Patch importance), `/graph`
  (network view), `/scenario` (what-if), `/restoration`, `/field`, `/alerts`, `/reports`, `/system` (admin),
  `/demo` (guided story), `/login`.
- `frontend/components/maps/` (Leaflet map), `frontend/components/chat/eco-assistant.tsx` (the chatbot panel).

---

## 15. The AI assistant (RAG chatbot)

**RAG = Retrieval-Augmented Generation**: before answering, the system *retrieves* relevant facts from the project's
own data and documents; an LLM may then *generate* an answer only from those facts. No model is trained on our data.

**The path of one question** (`backend/chat.py` → `backend/rag/`):
1. **Classify** (rules, no AI): is it a greeting, a prompt-injection attempt ("ignore instructions…" → refused),
   ambiguous ("tell me about this" → asks which), a follow-up ("and Sundarbans?" → rewritten from the previous question)?
   "This" means the patch you have selected on the map.
2. **Structured tools** (no AI): counts and facts ("how many patches?", "P07's area?", "which model?") are read directly
   from the run files/database. Cost: zero.
3. **Cache**: if the same question (or a reworded version) was answered for the same run and role, reuse it.
4. **Retrieve** (hybrid search) over ~530 text pieces ("chunks") from the docs, paper, FAQ, glossary and run results:
   - **BM25** (keyword search): scores chunks by matching words, giving rare words more weight. Good for exact terms
     like "P07", "IIC".
   - **Dense / vector search**: each chunk is turned into a list of 384 numbers (an **embedding**) by a small local
     model (`bge-small`); the question too. Similar meaning → similar numbers. Similarity = **cosine** of the angle
     between the two vectors: cos = (q · d) / (|q| |d|).
   - **RRF (Reciprocal Rank Fusion)** combines both lists: score = Σ 1 / (60 + rank). A chunk ranked high by both wins.
   - Chunks the user's role may not see are removed **before** scoring.
5. **Rerank + confidence**: a simple scorer checks how many of the question's words each chunk covers; if the best
   evidence is weak, the assistant says "I don't have enough verified information" instead of guessing.
6. **Context builder**: removes duplicates, keeps within a token budget, removes instruction-like text hidden in
   documents, labels each chunk [S1], [S2]…
7. **Generate**: if Claude is enabled and you are signed in, it writes a short answer citing [S1]… Citations that do not
   exist are deleted; an answer without any valid citation is not shown. Otherwise (or if Claude fails), the answer is
   quoted directly from the best chunk.
8. **Log**: tier, model, tokens, cost, latency → `chat_events` table; shown on `/system`.

**Indexing** (`backend/rag/ingest.py`, background job): read sources → split into chunks by headings/paragraphs/records
(`chunking.py`) → compute a **content hash** (a fingerprint); unchanged documents are skipped; changed ones get new
chunks and a new version; vectors come from a cache so identical text is never embedded twice.

**Cost**: most questions cost $0 (structured or retrieval). A Claude answer costs about $0.005 (Haiku) to $0.009 (Sonnet).

Evaluation: 64 test questions, all pass with the local model (`docs/rag/EVALUATION.md`).

Where in the code: `backend/chat.py`, `backend/chat_api.py`, `backend/rag/*.py`. Docs: `docs/rag/`.

---

## 16. Security in simple words

- Passwords are stored hashed (never plain). Tokens expire; refresh tokens rotate.
- Every important API checks the user's role **on the server** (hiding a button is not security).
- Field officers see only their own tasks and photos. Public visitors cannot see field data, reports or audit.
- File uploads: type checked from the file bytes, size limits, safe names.
- Heavy public endpoints and the chatbot have rate limits; the LLM has per-user and per-session caps.
- API keys live only on the server (`.env` / Render settings), never in the website code.
- Every important action (login, scenario, evidence, report, AI question) is written to the **audit log**.

---

## 17. Testing and checking

- `tests/` — pytest tests (143): graph maths with known answers, regression (stored results must reproduce), API,
  security, workflow, chatbot, RAG failure cases.
- `scripts/acceptance_test.py` — 20-step end-to-end check (select area → … → AI answer verified → PDF report).
- `scripts/rag_eval.py` — the chatbot's 64-question evaluation.
- `make test`, `make acceptance`, `make rag-eval`, `make lint`, `make build`.

---

## 18. Glossary

| Term | Meaning |
|---|---|
| Patch | one connected piece of mangrove habitat (≥ 2 ha) |
| Graph / node / edge | network / a patch / a link between two patches |
| Component | a group of patches connected to each other |
| Cut vertex | a patch whose removal splits the network |
| IIC | Integral Index of Connectivity (connectivity of the whole network) |
| PC / ECA | Probability of Connectivity / Equivalent Connected Area |
| Criticality S_i | share of IIC lost when patch i is removed |
| τ (tau), k | max link distance (5 km), number of nearest neighbours (3) |
| Spearman ρ | how similar two rankings are (1 = same order) |
| Threshold | probability above which a pixel counts as mangrove (0.70) |
| MMU | minimum mapping unit, smallest patch kept (2 ha) |
| IoU / F1 | overlap scores between prediction and labels |
| GMW | Global Mangrove Watch, the reference map used as labels |
| Run | one complete stored analysis (a folder in `outputs/runs`) |
| Provenance | the record of exactly how a result was made (data, model, settings, code version) |
| RAG | retrieve facts first, then generate an answer only from them |
| Embedding | a list of numbers representing the meaning of a text |
| BM25 | keyword search scoring |
| RRF | method to merge two ranked lists |
| Chunk | a small piece of a document used for retrieval |
| JWT | signed login token |

---

## 19. What we must not claim

- 95.56 % accuracy (that is the foundation study's result).
- That the EfficientNet-B7 / UNB7 model was trained.
- Field validation, government deployment, or validated restoration costs.
- That change between years is confirmed mangrove loss.
- That the system tracks or predicts animal movement.
- That restoration candidates are approved sites.

---

## 20. How to study with this file

Paste one section at a time into ChatGPT and ask: "Explain this like I am new to it, then give me 3 questions to test
myself." Then open the file listed under "Where in the code" and ask: "Explain this file line by line." Recommended
order: sections 0 → 6 → 7 (with the worked example) → 5 → 9 → 10 → 15.
