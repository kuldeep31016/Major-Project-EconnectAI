# Restoration candidates — generation, gain, feasibility, review

> Restoration candidates are **computational**: areas where a development model's probability is marginal.
> They are not surveyed sites. Every candidate needs **field and legal assessment** before any decision; the
> connectivity gain is a **simulation** and no cost, ownership, legal-status, hydrology or salinity data are
> loaded. No validated restoration costs exist in this project.

Code: `ecoconnect/pipeline/sources.py` (generation), `ecoconnect/graph/restoration.py` (gain, Eqs. 11–12),
`ecoconnect/pipeline/restoration_rules.py` (candidate category, re-exported by `backend/restoration_rules.py`),
`backend/scenarios.py::restoration_feasibility` (rule-based feasibility), `backend/workflow_api.py` (human review).

## 1. Candidate generation (`from_probability_raster`)

| Parameter (`configs/graph.yaml → restoration`) | Value | Meaning |
|---|---|---|
| `candidate_source` | `sub_threshold` | candidates come from the probability raster (alternatives: `geojson`, `none`) |
| `candidate_threshold` | 0.30 | lower edge of the marginal band |
| habitat threshold | the run's threshold (0.70 for LATEST Kerala) | upper edge (exclusive) |
| `candidate_min_area_ha` | 1.0 | MMU for candidates (habitat patches use 2 ha) |
| `candidate_max_count` | 12 | largest 12 kept (ids `C01…` by descending area, per run) |

Pixels with `0.30 ≤ p < threshold` form a "marginal" raster; connected components (8-connectivity) ≥ 1 ha become
candidates with area, centroid, mean probability (`confidence`, also used as `quality`) and polygon. Rationale in
code: "places the model considers plausible but not confident habitat". This is a design choice; it has not been
tested against any restoration outcome. Known flaw: nodata pixels are counted as valid here (audit bug 28).

## 2. Gain (`evaluate_candidates`, paper Eqs. 11–12)

For each candidate v_i independently:

R_i = C(G + v_i) − C(G),  `gain_pct` = 100 · R_i / C(G)

G + v_i adds the candidate as a node linked to its **k nearest existing patches within τ** (existing edges
unchanged; `rebuild_edges_on_insert: false`). C = IIC in all stored runs. Outputs per candidate: `connectivity_gain`,
`gain_pct`, `new_links`, `linked_patch_ids`, `components_before/after`, `cost`, `gain_per_cost`, `ranking_basis`.
Because baseline IIC is small, percentage gains can be large (a 159 ha candidate adds +220.7 % on Kerala LATEST).
The gain of several candidates together is not the sum (Scenario Lab `restore_multi`, [SCENARIOS.md](SCENARIOS.md)).

## 3. The uncertain-habitat rule (`restoration_rules.classify`)

A candidate is **`uncertain_habitat`** when

**area > 5 ha AND area > 10 % of the mapped habitat area of the run**

otherwise `restoration_site`. Label: "Uncertain habitat — field check". Reason: with a calibrated threshold such
as 0.70, the 0.30–0.70 band also captures large areas that are most likely existing mangrove the model was unsure
about. Such candidates are **never shown as a restoration gain**: the feasibility verdict is `field_check`, the
template assistant lists them separately, the LLM evidence pack carries the category plus an instruction not to
present their gain as a benefit, alerts create an `uncertain_habitat` ("field check") alert instead of a
`restoration_opportunity`, and the PDF report shows a Class column. `restoration.json` itself stores the raw
ranking; the category is applied when read.

Kerala LATEST (`kerala-coast_multi_E1_s1_b0_dev_t0.70`, habitat 204.58 ha → cut-off 20.46 ha, raw-gain order):

| Candidate | Area ha | Gain % IIC | Links | Category |
|---|---|---|---|---|
| C01 | 158.76 | +220.7 | P03 P06 P10 | uncertain habitat |
| C02 | 118.41 | +167.6 | P01 P02 P08 | uncertain habitat |
| C03 | 69.94 | +65.3 | P03 P06 P10 | uncertain habitat |
| C04 | 20.93 | +16.50 | P03 P04 P07 | uncertain habitat |
| **C05** | **17.97** | **+16.45** | P01 P02 P05 | **restoration site (first)** |
| C09 | 8.38 | +6.73 | P05 P11 P12 | restoration site; joins isolated P12 (3 → 2 components) |
| C06, C12, C07, C08, C10, C11 | 4.9–10.3 | +0.20 to +6.49 | 1–3 | restoration sites |

Open issue (SESSION_LOG 2026-10-01): the rule is relative, so in large-habitat areas (Odisha, Sundarbans)
candidates of up to 587 ha pass as "restoration sites"; an absolute cap has not been decided.

## 4. Feasibility checks that exist (`GET /api/runs/{area}/{run}/restoration/feasibility`)

Rule outputs over the layers the run actually has (`restoration_feasibility`, defaults `near_km = 2.0`,
`water_ndwi = 0.3`):

| Check | Rule | Effect |
|---|---|---|
| Connectivity gain | always listed | reason for |
| Distance to existing habitat | haversine centroid distance to the nearest patch ≤ 2 km | for; > 2 km → against ("isolated site") |
| Open water (Sentinel-2 NDWI) | mean `s2_ndwi` inside the polygon > 0.3 | against ("needs hydrology/tidal assessment"); ≤ 0.3 → for. Only if the run's scene GeoTIFF exists **and** has an `s2_ndwi` band; otherwise listed under not assessed |
| Overlap with existing patches | > 50 % of the candidate inside patches | against → `not_recommended`; 0–50 % → for ("expansion site") |
| Network benefit | `new_links == 0` | against → `not_recommended` |
| Model signal | mean probability | listed as reason for |

Verdict: `field_check` if uncertain habitat; else `not_recommended` (no link or > 50 % overlap); else
`conditional` if any reason against; else `recommended`. "Recommended" means only "no rule fired against it with
the available layers".

**Always "Not assessed"** (listed in `not_assessed` for every candidate): legal status / protected-area boundary;
land ownership, settlements, infrastructure and accessibility; cost; and water/land status whenever NDWI is
unavailable. **Not represented anywhere in the code:** salinity, tidal inundation regime / hydrology, soil and
sediment, species suitability, community use. Because scene rasters are gitignored, NDWI is unavailable on a fresh
clone and on the hosted API — there every candidate's water status is "not assessed".

## 5. Cost-aware ranking

Priority_i = `gain_pct / cost` is used **only when every candidate has a positive cost** supplied by the user —
`configs/graph.yaml → restoration.cost_csv` (columns `candidate_id,cost`, `cost_unit`) at run time, or
`costs` + `cost_unit` in `POST /api/runs/{area}/{run}/restoration`. A partial table falls back to raw gain
(`ranking_basis = "raw_gain"`). No cost file ships with the repository; every stored run is ranked by raw gain
(`cost_note`: "no cost data supplied").

## 6. Restoration review workflow (`backend/workflow_api.py`, migration 0004)

Model output and human judgement are kept apart: at creation the candidate's rank, gain, area, links and centroid
are copied into `model_recommendation` (labelled "MODEL RECOMMENDATION (simulated connectivity gain)"); everything
after is a human entry with who/when/why, and every step is written to the audit log.

| Stage (derived by `_stage`) | Entered when | Endpoint | Capability |
|---|---|---|---|
| `GIS_REVIEW` | review created | `POST /api/restoration/reviews` (one per run + candidate) | `review_detections` (senior, range, GIS officer, state admin) |
| `FIELD_VERIFICATION` | GIS outcome `PROCEED` (or `HOLD` keeps it in GIS review) | `PATCH …/reviews/{id}/gis` (notes required) | `review_detections` |
| — | field task created at the candidate centroid ("checklist + photo + access notes") | `POST …/reviews/{id}/field-task` | `assign_tasks` |
| `FEASIBILITY` | that field task is `VERIFIED` (evidence accepted — [FIELD_WORKFLOW.md](FIELD_WORKFLOW.md)) | `PATCH …/reviews/{id}/feasibility` for `ownership`, `legal_status`, `water_conditions`, `land_use`, `cost`, `accessibility` — each value needs a `source`; `null` = "Not assessed" | `review_detections` |
| `DECIDED` | decision `APPROVED` / `REJECTED` (`DEFERRED` is recorded but does not close the review) | `PATCH …/reviews/{id}/decision` (reason ≥ 10 chars) | `decide_restoration` (senior officer, state admin) |

`APPROVED` is refused unless the stage is `FEASIBILITY` (GIS PROCEED + verified field task). **Caveats:** approval
does not require any of the six feasibility factors to be filled — the response lists the unfilled ones as
`not_assessed`; and creating a review is not blocked for `uncertain_habitat` candidates. Accepted field evidence
with `mangrove_present = yes` at a candidate is recorded as a `false_negative` model disagreement (HITL register,
`/api/hitl/*`); nothing retrains automatically.

The field checklist (`GET /api/field/checklist`): habitat_present, mangrove_present (yes/no/unsure), condition,
water_condition (tidal / permanently_flooded / dry / unknown), human_disturbance.
