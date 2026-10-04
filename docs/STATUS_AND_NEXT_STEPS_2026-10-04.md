<!-- content_type: planning - status assessment and work plan; not product knowledge, never indexed for the assistant -->
# EcoConnectAI — honest status, weaknesses and the next prompt (2026-10-04)

Principle for the next phase: **depth, not breadth.** Like a product that is known for one thing done extremely well,
EcoConnectAI should not add modules. It should make the existing chain — *satellite → mangrove map → patches →
connectivity → critical patches → restoration → report* — accurate, current and trustworthy enough to hand to a forest
department.

## 0. Update — fixes applied later on 2026-10-04 (read this first)

| Weakness (below) | What was done | Result |
|---|---|---|
| §4.A.4 split leakage (audit bug 21) | Stratified, buffered spatial split (standard spatial cross-validation): whole blocks per split, each area's mangrove shared 70/15/15, tiles crossing into another split's block excluded. Model retrained → `multi_E1_s1_b0_dev_r3` | honest held-out test IoU **0.776** / F1 0.874 (pooled); per area Sundarbans **0.925**, Odisha **0.318**, Kerala / Gulf 0.000 |
| §4.A.4 per-area reliability on training tiles | Reliability level now from each area's held-out test tiles (whole scene only when too little reference, flagged) | Odisha downgraded to **unreliable** (its 0.724 was optimistic) |
| §4.A.5 one threshold for all areas | Per-area threshold chosen on that area's validation tiles (≥ 2,000 reference px), used by the live analysis | Odisha 0.92, others pooled 0.96 |
| §4.B.4 / B.5 domain gap, Copernicus quota | Default near-real-time source = **Microsoft Planetary Computer Sentinel-1 RTC** (the exact training product, no account, ~1 day after a pass); Copernicus kept as an option | equal agreement within noise (Sundarbans 0.861 vs 0.884, Odisha 0.676 vs 0.651 with r2) |
| §4.D.2 model file not backed up | GitHub releases `model-multi_E1_s1_b0_dev_r2` and `_r3` with SHA-256, restore tested | |
| §4.A.6 radar only | S1+S2 fusion trained on the same leakage-free split (`multi_E3_s1s2_b0_dev_r3`) and tested on real 2026 input | better on 2020 test tiles (0.859 vs 0.776; Odisha 0.441) but **worse on 2026 input** (Sundarbans 0.637 vs 0.876, Odisha 0.577 vs 0.622) — optical domain shift; not deployed |
| §4.B.2 no automatic monitoring | `backend/satellite/monitor.py`: scheduled check (`SATELLITE_MONITOR_HOURS`) or cron script → new-pass alert → automatic 8-pass analysis where the model can run → result alert with the change vs the previous comparable analysis (labelled model-output difference) | tested end to end; real check found the latest passes for all 4 areas |
| Interactive Map page | Redesigned: scenario lab + real-time tab + map + patch / network / simulation cards on one screen | verified at 375 to 1920 px |

Still open, in order: training composites that match the near-real-time input (multi-season, multi-year; needed before
fusion can help live), thin fringes (Kerala, Gulf) and Odisha generalisation (larger encoder on GPU), field ground
truth, change detection above a measured noise floor, production inference host (docs/DEPLOYMENT.md §3a).

## 1. What the system does, in plain words

| Term | Plain meaning |
|---|---|
| **Mangrove map** | The AI looks at radar satellite images and marks every 10 m × 10 m square as "mangrove" or "not mangrove". |
| **Habitat patch** | A connected block of mangrove of at least 2 ha (about 3 football fields). Smaller specks are ignored as noise. |
| **Link** | Two patches count as connected when they are close enough (within 5 km, to each patch's 3 nearest neighbours) for seeds, fish and crabs to move between them. |
| **Connectivity (IIC)** | One number for how well the whole forest network holds together: big patches with short links score high. |
| **Critical patch** | We remove each patch one at a time and recompute connectivity. The patch whose loss hurts most is the most critical. |
| **Bridge (cut vertex)** | A patch that is the only route between two groups; losing it splits the network. Can be small but very important. |
| **Sensitivity** | We re-run the network with other assumptions (3 / 5 / 8 km; 2 / 3 / 4 neighbours). A patch that stays important under every setting is a robust finding; one that changes is assumption-dependent. |
| **What-if** | "What happens if this patch is lost / this site is restored?" — an exact recomputation, labelled as a simulation, not a forecast. |
| **Restoration candidate** | An area where the model sees *almost*-mangrove; if restored, how much would connectivity rise? Large ones are sent for a field check first. |
| **Near-real-time** | The latest satellite pass over the area (every 2–12 days), not live video. |

## 2. What is implemented and verified (2026-10-04)

| Area | Status | Evidence |
|---|---|---|
| Stored analyses, 4 study areas | ✅ every dashboard tab, map, graph, scenarios, restoration, alerts, reports | `scripts/check_all_flows.py`: 200/200 API checks; 24/24 dashboard tabs; screenshots |
| Near-real-time Copernicus layer | ✅ catalogue → retrieval (OAuth) → 8-acquisition median → U-Net → patches → graph → criticality → restoration → provenance → dashboard | all 4 areas run on real 2026 Sentinel-1 data |
| AI model | ✅ rebuilt `multi_E1_s1_b0_dev_r2` (lost original) | held-out test IoU 0.873 / F1 0.932 at threshold 0.97 |
| Per-area reliability + result checks | ✅ shown on page, in reports and in the assistant | Sundarbans 0.913, Odisha 0.724, Kerala 0.000, Gulf 0.008 (IoU vs GMW 2020) |
| Assistant (RAG) | ✅ tools for data questions, hybrid BM25 + pgvector search, citations, refusals; Haiku / Opus routing | 12/12 realistic questions correct; 8/12 free; $0.105 for 12 |
| Tests | ✅ 197 backend tests, lint clean, frontend build clean | |

## 3. Issues hit in this phase (and what was done)

| Issue | Resolution |
|---|---|
| Trained model file lost (folder deleted, Trash emptied, no backup) | Rebuilt with the identical recipe; 3 audit bugs fixed on the way (normaliser cache, threshold on validation, evaluation normaliser). **Still not backed up off this machine.** |
| One satellite date over-predicted 30–100× (Kerala 3,550 ha vs 102 ha reference) | Input now = median of the latest 8 same-orbit acquisitions (as in training) + post-inference area check. |
| Model cannot map thin mangrove fringes (Kerala, Gulf of Mannar) | Measured and disclosed per area; not solved (see §4.A). |
| Stored runs lost their probability rasters | "Thresholds" scenario disabled for those runs with an explanation. |
| Existing bugs found while testing | CORS hid map overlay bounds (overlays never showed); Reports opened the newest run; page race conditions; API frozen during compositing; assistant refused style-worded questions and missed data questions. All fixed with tests. |
| Dev machine | Disk at 99 % (fixed by cleanup); Mac sleep stalls long jobs (`caffeinate` added). |

## 4. Limitations and weak areas (most important first)

### A. Accuracy of the mangrove map — the core weakness
1. **Thin fringes are invisible to this model.** 10 m radar + a small U-Net (EfficientNet-B0) cannot map Kerala's or the
   Gulf of Mannar's 1–3-pixel-wide mangrove strips (IoU ≈ 0). Two of four study areas are therefore demonstration-only.
2. **Trained on weak labels.** The "truth" is Global Mangrove Watch 2020, itself a model output. All scores are
   agreement with that map, not field accuracy. Nothing is field-validated.
3. **Development-scale training.** 800 training tiles, B0 encoder, one seed; the larger B7 model was never trained.
4. ~~**Optimistic metrics.**~~ **Fixed 2026-10-04 (§0):** leakage-free split; per-area reliability from held-out tiles.
5. ~~**One threshold for all areas.**~~ **Fixed 2026-10-04 (§0):** per-area thresholds where the validation tiles allow.
6. **Radar only.** Sentinel-2 optical (which helps with thin, green fringes) is downloaded but not used by this model.

### B. "Real-time" — what is and is not possible
1. **No satellite provides live video of a mangrove forest.** Sentinel-1 revisits every 6–12 days; our accurate mode uses
   the median of the last 8 passes, so a map summarises roughly the **last 3 months**, refreshed each new pass.
   Single-date maps are fast but inaccurate.
2. **No automatic monitoring yet.** A person must press "Analyze"; Copernicus subscriptions / a scheduler are not wired.
3. **Change detection is not a model.** Comparing two runs gives a "model-output difference", which mixes real change
   with model noise; there is no change-specific model or significance test.
4. **Domain gap.** Training used 2020 yearly medians from Microsoft Planetary Computer; near-real-time input is a 3-month
   median from Copernicus' own terrain correction. Close, not identical.
5. **Free-tier dependence.** Copernicus processing quota (monthly); a heavy demo month could exhaust it.

### C. Science and method
1. Connectivity is **structural** (distance-based), not measured animal or seed movement.
2. Results depend on τ (link distance) and k (neighbours); sensitivity shows some "critical" findings change with k.
3. Patch IDs are re-numbered every run, so "P07" in one run is not "P07" in the next — no tracking over time.
4. Restoration candidates ignore land ownership, legal status, hydrology and cost.

### D. Production readiness
1. **The deployed server (Render free, 512 MB, no PyTorch) cannot run the AI.** Near-real-time analysis only works where
   a PyTorch worker and the model file exist (today: this laptop).
2. **Single points of failure:** model file not backed up; long jobs run inside the API process; rate limits are
   per process.
3. CI (GitHub Actions) is blocked by the account's billing lock; demo accounts use a shared password.

### E. Assistant
1. Good for explanation and exact data look-ups; it cannot reason over a near-real-time run beyond the summary tools.
2. Quality was checked on ~120 questions (golden set + probes) — a small, self-written set; no human expert review.

## 5. What to do next — in order, measurable

| Priority | Goal | Done when |
|---|---|---|
| P0 ✅ | **Protect the model** | checkpoint + calibration in object storage / release; checksum recorded; restore tested |
| P0 ✅ | **Honest accuracy baseline** | leakage-free split (buffered spatial blocks); per-area held-out IoU reported; per-area thresholds chosen on validation |
| P1 | **Train for the input we actually use** | training composites built exactly like near-real-time input (3-month, 8-pass medians, several seasons and years); single-date gap measured |
| P1 | **Map thin fringes** | S1+S2 fusion and/or larger encoder evaluated; Kerala and Gulf IoU > 0.5 vs GMW **or** formally declared out of scope |
| P1 | **Ground truth** | a field-verified sample (forest department / published survey) for at least one area; accuracy vs field, not just vs GMW |
| P2 | **Automatic monitoring** | scheduler / Copernicus subscription: new pass → analysis → comparison → alert, without a click |
| P2 | **Change with confidence** | stable patch IDs across runs (spatial matching); change flagged only when above run-to-run noise measured on stable areas |
| P3 | **Production inference** | separate PyTorch worker (GPU or CPU) next to the API; deployment can run the full chain |

Satellite sources worth evaluating for accuracy and timeliness (verify access terms before relying on them):
Sentinel-1 (current), Sentinel-2 L2A (optical, 5-day revisit, clouds), Landsat 8/9 (30 m, long archive), NISAR
(NASA–ISRO L-band SAR, well suited to forests — check data availability), ISRO Bhoonidhi (Indian EO data portal; access
for government partners), commercial daily imagery (paid; licence needed for government use).

## 6. Detailed prompt for the next phase (copy into a new session)

```
You are working on EcoConnectAI (repo: kuldeep31016/Major-Project-EconnectAI). Read docs/context/README.md,
docs/context/PROJECT_CONTEXT.md, the top of docs/context/SESSION_LOG.md, docs/STATUS_AND_NEXT_STEPS_2026-10-04.md,
docs/satellite/COPERNICUS_INTEGRATION.md and docs/MODEL_REBUILD_2026-10-04.md first.

GOAL
Make the existing near-real-time mangrove-connectivity pipeline ACCURATE and TRUSTWORTHY enough to hand to a state
forest department. Do NOT add new modules or pages. Improve the accuracy, robustness and honesty of what exists:
Copernicus Sentinel-1 retrieval -> preprocessing -> U-Net segmentation -> habitat patches -> connectivity graph ->
criticality -> restoration -> provenance -> dashboard / report / assistant.

HARD RULES
- Never fabricate results, accuracy, validation, deployment or costs. Metrics vs Global Mangrove Watch are "agreement
  with a reference map", not field accuracy. Label simulations as simulations. Say "near-real-time / latest satellite
  observation", never "live video".
- Keep the existing flows working: stored runs stay the dashboard default; every existing test must pass; add tests
  for every fix. Run .venv/bin/python -m pytest -q, ruff (F), and the frontend tsc / lint / build.
- Keep the model file safe: never delete outputs/segmentation/*/best_model.pth; back it up before any retraining.
- Spend API / processing quota deliberately; state estimated Copernicus processing units and Claude cost before runs.
- Commit only when asked; then update docs/context (SESSION_LOG, PROJECT_CONTEXT, ROADMAP, audit statuses).

PHASE 1 - Honest accuracy baseline (no new training yet)
1. Fix audit bug 21: build spatial-block splits with a buffer so no test pixel appears in a training tile.
2. Report held-out IoU / F1 / precision / recall PER STUDY AREA (not pooled) for multi_E1_s1_b0_dev_r2.
3. Calibrate thresholds per area on the validation split; store them; make inference use the area's threshold;
   record which threshold was used in provenance.
4. Measure run-to-run noise: analyse two consecutive non-overlapping 8-pass medians for each area; report how much
   habitat area and patch count change with no real change expected. This is the noise floor for change detection.
Acceptance: a table of per-area held-out scores and noise floors in docs/; the UI and assistant use these numbers.

PHASE 2 - Train for the input we actually use
1. Build training composites the same way as near-real-time input: 8 same-orbit Sentinel-1 passes (~3 months) from
   Copernicus (gamma0 terrain, dB), for several seasons of 2020 and at least one other year, on the training grid.
2. Retrain the same U-Net B0 (then try B4/B7 if time allows) with the leakage-free split; compare to r2 per area.
3. Evaluate Sentinel-1 + Sentinel-2 fusion for thin fringes (Kerala, Gulf of Mannar); keep the fused model only if it
   improves held-out per-area IoU. If thin fringes stay below IoU 0.5, declare them out of scope in UI and reports.
4. Register each model with checksum, data recipe, metrics and status (Development -> Experimental -> Candidate).
Acceptance: the selected model beats r2 on per-area held-out IoU for the near-real-time input; single-date and 8-pass
results reported; nothing promoted beyond "Candidate" without field data.

PHASE 3 - Ground truth and change you can trust
1. Add a field-validation workflow using the existing Field Work module: sample points stratified by predicted class,
   officers mark mangrove / not mangrove with GPS + photo; compute accuracy vs field with confidence intervals.
2. Stable patch identity across runs (match patches by overlap), so "P07" means the same place over time.
3. Change detection: flag a habitat change only when it exceeds the measured noise floor and persists in the next pass;
   label it "model-detected change, needs field check".
Acceptance: field-accuracy table for at least one area; change alerts tested on synthetic and real pairs.

PHASE 4 - Automatic near-real-time monitoring
1. Scheduler (or Copernicus subscription) checks each area daily; when a new full-coverage VV+VH pass appears,
   it runs the analysis with the area's model + threshold, compares to the previous run, and raises alerts only for
   changes above the noise floor. Respect quota: one retrieval per new pass; reuse cached scenes.
2. Separate PyTorch inference worker (Docker) so the deployed system can run the chain; the API stays light.
Acceptance: an area updates automatically after a new pass with no click; job history, quota use and failures visible.

REPORT AT THE END
Per-area accuracy (held-out and, where available, field), noise floors, what improved vs r2, remaining limitations,
cost (Copernicus units, Claude dollars), and exactly what a forest department can and cannot rely on.
```
