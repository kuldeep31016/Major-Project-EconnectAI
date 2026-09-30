# Scenario Lab — simulations and period comparison

> **Every scenario output is a SIMULATION** over a stored model-derived habitat map: "what would the index be
> if …". It is not a forecast, not a prediction of loss, and not field-verified. Period comparison is a
> comparison of two **model outputs**; its result is "model-estimated change", **never "confirmed loss"**.

Code: `backend/scenarios.py::run_scenario` (maths from `ecoconnect/graph/`), period tracking in
`ecoconnect/graph/temporal.py`. Graph and index definitions: [CONNECTIVITY.md](CONNECTIVITY.md).

## 1. How to call it

| Route | What it does |
|---|---|
| `POST /api/runs/{area}/{run_id}/scenario` (body `ScenarioBody`, `backend/main.py`) | synchronous, returns the result |
| `POST /api/jobs` with `{"type": "scenario", "params": {"study_area", "run_id", "body", "other_run_id"?}}` (signed in; `backend/jobs_api.py`, handler in `backend/job_handlers.py`) | same computation as an async job (use for τ/threshold sweeps and period comparison) |
| `POST /api/scenarios` (`backend/routers.py`, signed in) | saves a scenario; the server **recomputes** it from `params` (a client-sent `result` is ignored) and writes an audit entry |
| `POST /api/runs/{area}/{run_id}/what-if` | exact removal (Eq. 10) for a list of patch ids |
| `POST /api/runs/{area}/{run_id}/reanalyse` | rebuild the graph with another τ / k / metric, full criticality |
| `POST /api/runs/{area}/{run_id}/restoration` | restoration gain ranking, optionally with user costs ([RESTORATION.md](RESTORATION.md)) |

Every scenario loads the run's `manifest.json` + `patches_input.json`, rebuilds the baseline graph with the run's
own k, τ, distance mode and research metric, and recomputes — nothing is interpolated or cached.

## 2. Common output fields

`type`, `label`, `parameters`, `baseline` and (where applicable) `scenario`, each with
`n_patches, n_edges, n_components, habitat_area_ha, iic, pc, eca_ha, eca_pct_of_habitat, metric, c`
(c = the run's research metric, IIC in all stored runs); `difference` = scenario − baseline for each of those
keys, plus `<key>_pct` for float-valued keys; `explanation` (plain-language sentence built from the computed
numbers); usually `edges_after`. `label` is **`"SIMULATED"`** for every type except `compare_periods` (§4).

## 3. Scenario types

| `type` | Parameters | What is recomputed | Extra output fields |
|---|---|---|---|
| `remove_patches` | `patch_ids` | graph without those nodes and incident edges (no re-linking); indices; `simulate_removal` | `removed_patch_ids`, `affected_patch_ids`, `severed_edges`, `newly_isolated_patch_ids` |
| `remove_polygon` | `polygon` [[lat, lon], …] (≥ 3 points) | patches whose polygon intersects the drawn polygon (or whose centroid lies inside; both coordinate orders are tried), then as `remove_patches` | as above. **Gotcha:** if nothing intersects, the patch **nearest the polygon centroid** is removed. |
| `restore` / `restore_multi` | `candidate_ids` | candidates inserted one after another with `with_patch` (links to k nearest within τ, existing edges unchanged unless `rebuild_edges_on_insert`); joint indices; individual gains one at a time | `individual` (per-candidate `RestorationRow`), `added`. The explanation states the joint gain is not the sum of individual gains and that feasibility is not implied. |
| `reduce_area` | `patch_ids`, `retain_fraction` ∈ (0, 1) | listed patches scaled to that fraction of their area (location unchanged → same links); indices | `affected_patch_ids`. Hypothetical degradation, not a forecast. |
| `add_patch` | `lat`, `lon`, `area_ha` (0.1–10 000; within study bbox ± 0.25°) | hypothetical patch (quality 1.0) added and the **whole k-NN graph rebuilt** (existing links can rewire, unlike `restore`) | `added`, `new_links`, `affected_patch_ids`. User-defined; not a detection or recommendation. |
| `radius` | `tau_km` ∈ [0.5, 50] | graph rebuilt at the new τ (k unchanged) | `links_added`, `links_removed` |
| `tau` | `taus_km` (default [3, 5, 8]) | graph + full criticality at each τ (k fixed) | `variants[]` with summary, `top5`, `spearman_vs_reference`, `edges` |
| `sensitivity` | `taus_km` (≤ 6 values, [0.5, 50]), `ks` (≤ 4 values, [1, 10], default [2, 3, 4]) | τ × k grid, exact criticality per variant | `variants` (edges, components, density, C, top-5, Spearman, Kendall τ-b, top-5 Jaccard), `stability`, `robust_top`, `min_spearman`, `verdict` |
| `threshold` | `thresholds` (default [0.4, 0.5, 0.6, 0.7]) | patches **re-extracted** from the run's probability raster at each threshold (same MMU, no candidates), graph + indices | `variants[]`. Needs the probability GeoTIFF on disk — fails on a fresh clone / the hosted API (rasters are not in git). |
| `compare_periods` | `other_run_id` | see §4 | see §4 |

Example (run 2026-10-01 on the LATEST Kerala run): `{"type": "remove_patches", "patch_ids": ["P07"]}` →
label `SIMULATED`, `difference.c_pct` = −25.57 %, components 3 → 4, affected P02, P03, P04 — identical to P07's
row in `criticality.json`, as it must be (same function).

## 4. `compare_periods` — model-estimated change between two stored runs

1. The second run's graph is built with **its own** stored configuration and summarised.
2. **Patch tracking by polygon overlap** (`track_patches`): both runs' `patches.geojson` polygons are projected
   to EPSG:6933 (equal area). A link A_i ↔ B_j exists when intersection area ≥ **10 % of the smaller polygon**
   (`min_overlap = 0.1`). Connected groups of the bipartite link graph are classified:

   | Group | Class |
   |---|---|
   | 1 A ↔ 0 B | **disappeared** |
   | 0 A ↔ 1 B | **new** |
   | 1 A ↔ 1 B | **stable** if \|ΔA\|/A ≤ 10 % (`area_tol = 0.10`), else **grown** / **shrunk** |
   | 1 A ↔ n B | **split** |
   | n A ↔ 1 B | **merged** |
   | n A ↔ m B | **reorganised** |

   Patch ids are never matched by name (they are reassigned per run).
3. **Comparability rule** (`comparability`): the comparison is like-for-like only if both manifests have the
   **same `data_source.model` (checkpoint path), same `threshold` and same `mmu_ha`**. Otherwise the reasons are
   listed and the note says the differences "mix model/setting differences with landscape change and must not be
   read as habitat change".
4. Criticality is recomputed for both runs; for 1 ↔ 1 matches the output gives S and rank in both runs.

Output: `label` = **`"MODEL-ESTIMATED CHANGE"`** when comparable, **`"NOT LIKE-FOR-LIKE (DIFFERENT MODEL/SETTINGS)"`**
otherwise; `baseline` (run A), `scenario` (run B), `difference`, `lost_patch_ids` (disappeared),
`gained_patch_ids` (new), `matched` (patch_a, patch_b, change, area_a, area_b, S_a, S_b, rank_a, rank_b),
`tracking` (`events`, `counts`, `links`, `rule`), `comparability`, `explanation`. The explanation always adds
that "disappeared" may mean shrunk below the 2 ha MMU and that **no cause is attributed**.

Example on stored runs (computed 2026-10-01 with the functions above): `kerala_E1_s1_b0_dev_t0.70` (2020) vs
`kerala_E1_s1_b0_dev_2025_t0.70` (2025) — same checkpoint, threshold 0.70, MMU 2 ha → comparable; 24 → 25
patches, 381.9 → 319.1 ha; 1 stable, 3 grown, 5 shrunk, 3 split, 1 merged, 1 reorganised, 8 disappeared, 6 new.
That model's test IoU vs GMW is 0.023, so these differences are dominated by model noise and must not be read as
mangrove loss. Comparing the LATEST Kerala run (`multi_E1` model) with either is flagged "different model
checkpoints".

**Gotcha:** the model check compares the checkpoint **path string**; older manifests store repo-relative paths
and newer ones absolute paths, so the same checkpoint recorded differently would be reported as different
(conservative, never the other way round).

Related features use a similar but not identical rule: the Timeline (`GET /api/runs/{area}/timeline`) groups runs
by (experiment id = checkpoint folder name, threshold); the template assistant's "change" intent and the
`habitat_change` / `connectivity_degradation` alerts filter by (registry `model_id`, threshold). None of these
three checks MMU. The timeline change figure is a binary-mask difference between the runs' probability rasters
(needs the rasters on disk).

## 5. Wording rules

Say "simulated", "what-if", "model-estimated change", "modelled habitat change". Never "confirmed loss",
"predicted loss", "deforestation" or a cause. τ and k are assumptions; a stable ranking across them is
structural robustness, not ecological validation.

**Code-comment inconsistency:** the docstrings of `backend/scenarios.py` and the `/scenario` endpoint say
`compare_periods` is labelled "OBSERVED (MODEL OUTPUT)"; the code returns the labels listed in §4.
