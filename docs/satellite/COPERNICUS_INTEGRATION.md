# Near-real-time satellite layer — Sentinel-1 providers (Planetary Computer default, Copernicus Data Space)

EcoConnectAI can find the **latest available Sentinel-1 observation** of a study area and run the existing pipeline on
it. This is *near-real-time satellite imagery*: Sentinel-1 images an area on each pass (every ~12 days over our Indian
study areas with one satellite), the product is published hours later, and EcoConnectAI analyses it on request. It
is not live video and nothing streams continuously.

The existing flow is unchanged. Stored analyses (the 2020 composite the model was trained on) stay the dashboard
default; near-real-time analyses are stored as additional runs and are only shown when a user opens them.

## Data providers (2026-10-04)

`SATELLITE_PROVIDER` selects where the latest Sentinel-1 observations come from. Both serve real ESA Copernicus
Sentinel-1 data; nothing is simulated.

| | `planetary` (**default**) | `copernicus` |
|---|---|---|
| Service | Microsoft Planetary Computer STAC, collection `sentinel-1-rtc` | Copernicus Data Space Ecosystem OData + Processing API |
| Product | Radiometrically terrain-corrected gamma0 (RTC) — **the exact product the model was trained on** | GRD processed on the fly to gamma0 terrain (`backCoeff` GAMMA0_TERRAIN) |
| Account | none (anonymous signed URLs) | OAuth client (`COPERNICUS_CLIENT_ID/SECRET`) for retrieval; catalogue is public |
| Latency after a pass | about 1 day (the 2026-10-03 12:19 UTC Odisha pass was listed on 2026-10-04) | about 3 h (NRT GRD) |
| Retrieval code | `backend/satellite/planetary.py` -> the training reader `stac_acquire._read_asset_to_grid` | `backend/satellite/processing.py` |

Same-model comparison (`multi_E1_s1_b0_dev_r2`, median of the latest 8 same-orbit passes, IoU vs GMW 2020 weak label):
Sundarbans **0.861** (Planetary Computer) vs 0.884 (Copernicus); Odisha **0.676** vs 0.651. The two are equivalent
within the noise of a weak label; Planetary Computer is the default because it needs no credentials and removes any
processing difference between training and near-real-time input. Scene files carry a `_pc` tag so the two providers
never overwrite each other.

Other free sources assessed (not integrated): **NASA/ASF OPERA RTC-S1** (30 m, within ~12 h; coarser than the 10 m
training data), **NISAR L-band** (public since 2026-07-20 via ASF; L-band penetrates canopy and could help mangroves,
but a new model would have to be trained), **Sentinel-2** optical (10 m, 5-day revisit, but monsoon cloud makes it
unreliable as the only source). Since mid-2026 Sentinel-1C and 1D give a 6-day revisit; no free source provides
continuous video of an area.

## Architecture

```
Satellite Monitor (/satellite)            FastAPI /api/satellite/*                 existing code, reused unchanged
──────────────────────────────           ─────────────────────────                ───────────────────────────────
mode: Stored | Latest observation  ──►  catalog.py   public OData catalogue    ┌► ecoconnect.gee.stac_acquire
latest-observation card                  (no credentials)                      │   TargetGrid.for_aoi, write_scene
observation history                      copernicus.py OAuth2 token cache,      │
[Analyze latest scene] ───────────────►  timeouts, retries                     │
progress checklist ◄── job state ──────  service.py  job "satellite_analyze":  │
provenance + input check                   1 observation   (catalogue)        │
map: footprint / VV / mask / patches       2 retrieval     processing.py ──────┘  Processing API, training grid
"Open in dashboard" (run selector)         3 preprocessing preprocessing.py       dB + median, same writer
                                           4 inference     scripts/predict.py     trained U-Net checkpoint
                                           5 habitat       sources.from_probability_raster
                                           6 patches          "
                                           7-9 graph, criticality, restoration    pipeline.analysis.run_graph_analysis
                                               (write_latest_pointer=False → LATEST unchanged)
                                         tables satellite_observations, satellite_analyses (migration 0009)
```

## Account and OAuth setup (only needed for image retrieval)

Checked against the official documentation on 2026-10-04. Free; takes about 5 minutes.

**What you need in the end:** two values, a *client ID* (starts with `sh-`) and a *client secret*. They go into the
server's `.env`, nothing else. You do not need to give anyone your Copernicus password.

1. **Create the account.** Open https://dataspace.copernicus.eu/, click the person icon (top right) → *Register*.
   Fill in the required fields, accept the terms, submit. Open the e-mail you receive and click *Verify email
   address*. (Registration problems: help-login@dataspace.copernicus.eu.)
2. **Open the Sentinel Hub dashboard:** https://shapps.dataspace.copernicus.eu/dashboard/ and log in with that
   account.
3. **Create the OAuth client.** *User settings* (left menu) → section *OAuth clients* → *Create*.
   - Client name: e.g. `ecoconnectai-backend`
   - Expiry: *Never expire* (or a date, then you must create a new one when it expires)
   - Do **not** tick the single-page-application (SPA) option - this client is used by the server, not the browser
   - Grant type, if asked: *Client Credentials*
   - Click *Create*.
4. **Copy both values immediately.** The pop-up shows the client ID and the client secret; **the secret is shown only
   once**. Copy it before closing (if lost: delete the client and create a new one).
5. **Put them in `.env`** at the repository root (the file is git-ignored; never put them in `frontend/`, in
   `NEXT_PUBLIC_*` variables, in code, in chat messages or in screenshots):
   ```
   COPERNICUS_CLIENT_ID=sh-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   COPERNICUS_CLIENT_SECRET=<the secret>
   ```
6. **Check them** (asks only for a token; downloads nothing, uses no quota, never prints the secret):
   ```
   .venv/bin/python scripts/check_copernicus.py
   ```
7. **Restart the backend.** `GET /api/satellite/status` → `retrieval.configured: true`; the Satellite Monitor shows
   "Image retrieval ✓".
8. **Deployment (Render):** add the same two variables in the Render dashboard → service → *Environment* (they are
   secrets, never in `render.yaml`).

Free-tier quota: processing units reset on the 1st of each month. The documentation pages disagree on the amount
(10,000 vs 40,000 units per month), so read the real number on the dashboard's usage page. One Kerala analysis uses
roughly 37 units per acquisition (estimate, table below), so the free tier covers hundreds of analyses.

Token endpoint used by the server: `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
(grant type `client_credentials`).

## Environment variables

See `.env.example`, section "Near-real-time satellite layer": `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`,
`COPERNICUS_TIMEOUT_S`, `COPERNICUS_CONNECT_TIMEOUT_S`, `COPERNICUS_MAX_RETRIES`, `SATELLITE_SEARCH_DAYS`,
`SATELLITE_MIN_AOI_COVERAGE`, `SATELLITE_CATALOGUE_TTL_S`, `SATELLITE_MODEL_CHECKPOINT`, `SATELLITE_INFERENCE_PYTHON`,
`SATELLITE_INFERENCE_TIMEOUT_S`.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/satellite/status` | public | catalogue / retrieval / inference availability (never secrets) |
| GET | `/api/satellite/latest?area_id=` | public, rate-limited | newest usable observation, real catalogue metadata |
| GET | `/api/satellite/observations?area_id=&days=` | public, rate-limited | history + analysis status per observation |
| POST | `/api/satellite/analyze` | `run_analysis` (GIS officer, analyst, admin) | queue the analysis job (202) |
| GET | `/api/satellite/runs?area_id=` | signed in | provenance records |
| GET | `/api/satellite/runs/{id}` | signed in | record + job state + scene checks |
| GET | `/api/satellite/runs/{id}/scene.png` · `mask.png` | public | WGS84 overlays (bounds in `X-Bounds`) |

`POST /analyze` body: `{"area_id": "kerala-coast", "product_id": optional, "composite_scenes": 1..8, "force": false}`.

## Sentinel-1 data flow and "latest observation" rule

Catalogue query: `Collection = SENTINEL-1`, product type `IW_GRDH_1S`, footprint intersects the study-area bbox
(`configs/study_areas.yaml`, the same AOI as the stored runs), last 60 days, newest first. A product is chosen when
it has **VV and VH** and its footprint covers **≥ 90 %** of the bbox; newer partial strips and single-polarisation
products are listed in the history but not analysed. Example (2026-10-03): for the Sundarbans the newest product
(1 Oct) covered 53 % of the area, so the 28 Sep acquisition (100 %) was selected.

Retrieval (Processing API, collection `sentinel-1-grd`): one request per acquisition, time window = that product's
sensing interval ± 30 s, `backCoeff = GAMMA0_TERRAIN`, `orthorectify = true`, DEM `COPERNICUS_30`, bilinear
resampling, FLOAT32 linear backscatter, on the training grid (UTM zone of the AOI centre, 10 m, snapped), split into
≤ 2,000 px tiles.

## Preprocessing (same conventions as training)

| Step | Training (`stac_acquire.sentinel1_composite`) | Near-real-time (`backend/satellite/preprocessing.py`) |
|---|---|---|
| Source | Planetary Computer `sentinel-1-rtc` (gamma0 RTC) | CDSE `sentinel-1-grd`, gamma0 terrain-flattened by the processor |
| Grid | `TargetGrid.for_aoi`, UTM, 10 m | the same function |
| Invalid | values ≤ 0 → NaN | the same rule |
| dB | `10·log10` | the same formula |
| Composite | nanmedian of up to 8 acquisitions spread over 2020 | nanmedian of the latest 8 same-track acquisitions (default; `composite_scenes` 1-8) |
| File | float32 GeoTIFF, bands `s1_vv_db, s1_vh_db`, nodata −9999, JSON sidecar | written with the same `write_scene` |
| Model input | bands [0, 1] + z-score normaliser stored in the checkpoint | unchanged (`predict_scene`) |

Checks recorded with every scene: band names and order vs the model (`check_compatibility`), and an **input
distribution check** — VV/VH dB mean, std, p1, p99 compared with the training normaliser (VV −11.33 ± 5.03 dB,
VH −17.60 ± 5.16 dB); a mean shift > 1 SD or < 50 % valid pixels sets "manual review recommended".

Known differences (not hidden, not corrected silently): different RTC implementation (CDSE vs Planetary Computer);
the training median spans a whole year, the near-real-time median ~3 months (seasonal signal differs); the model was
trained on 2020 imagery, so 2026 scenes are outside its training period. A single acquisition (`composite_scenes = 1`)
is available but over-predicts (see Validation).

## Validation on real near-real-time data (2026-10-04)

Model `multi_E1_s1_b0_dev_r2` (threshold 0.97, MMU 2 ha) on the latest real Copernicus Sentinel-1 data, compared with
the GMW 2020 reference map (weak label; mangroves change slowly, but 2026 vs 2020 is not a like-for-like truth):

| Study area | Input | Habitat mapped | Reference (GMW 2020) | IoU vs reference |
|---|---|---|---|---|
| Sundarbans | 1 date (28 Sep 2026) | 68,949 ha | 58,899 ha | 0.66 |
| Sundarbans | **median of 8 (6 Jul - 28 Sep 2026)** | **57,879 ha** | 58,903 ha | **0.884** |
| Odisha (Bhitarkanika) | 1 date (3 Oct 2026) | 25,325 ha | 10,792 ha | 0.34 |
| Odisha (Bhitarkanika) | **median of 8 (11 Jul - 3 Oct 2026)** | **12,704 ha** | 10,793 ha | **0.651** |
| Kerala (Vembanad-Kol) | 1 date (27 Sep 2026) | 3,550 ha | 102 ha | 0.005 |
| Kerala (Vembanad-Kol) | median of 8 | 102 ha | 102 ha | 0.003 (area matches, locations do not) |

The same 8-pass medians with the **default model since 2026-10-04, `multi_E1_s1_b0_dev_r3`** (leakage-free split,
per-area thresholds; docs/MODEL_REBUILD_2026-10-04.md): Sundarbans IoU 0.902 (Copernicus input) / 0.876 (Planetary
Computer input), 59,138 / 58,712 ha mapped; Odisha 0.610 / 0.622, 16,725 / 15,825 ha mapped (over-predicts ~50 %);
Kerala 0.013 and Gulf of Mannar 0.011.

Conclusions, applied in the code:
- **Default input = median of the latest 8 same-orbit acquisitions** (`composite_scenes = 8`, 120-day search window) -
  the same temporal-median convention as the training scenes. A single date over-predicts strongly (speckle, season).
- **Per-area reliability** (`scripts/area_reliability.py` -> `<experiment>/area_reliability.json`): the level comes
  from the area's **held-out test tiles** when they hold >= 2,000 reference pixels, else from the whole 2020 scene
  (incl. training tiles, flagged). r3: Sundarbans 0.925 held-out (reliable); Odisha 0.318 held-out (unreliable; the
  whole-scene score 0.659 was optimistic); Kerala and Gulf of Mannar unreliable (102 ha / 44 ha of thin mangrove
  fringes are below what this 10 m radar model can map). The Satellite Monitor and Interactive Map show this before
  an analysis is run.
- **Per-area threshold**: `threshold_calibration.json` `per_area` (chosen on that area's validation tiles; Odisha 0.92,
  else the pooled 0.96) is used by `service.model_status(area)` and reported in `/api/satellite/status`.
- **Post-inference check**: predicted habitat area vs the reference area; outside 1/3x - 3x is flagged for manual
  review (the earlier single-date Kerala run was 35x).
- These scores include training-tile pixels for 2020 and use a weak label; they are not field accuracy.

## Model inference

`scripts/predict.py` with the trained checkpoint of the selected experiment (`SATELLITE_MODEL_EXPERIMENT`; default the
first of `multi_E1_s1_b0_dev_r2` — the 2026-10-04 rebuild of the lost original — and `multi_E1_s1_b0_dev` whose
`best_model.pth` exists; U-Net with EfficientNet-B0, 2 input channels) and that experiment's calibrated threshold from
`threshold_calibration.json` (`selected_threshold`, MMU 2 ha). Nothing is retrained and the threshold is never changed silently.
The API Docker image has no PyTorch; set `SATELLITE_INFERENCE_PYTHON` to a Python with `requirements.txt` installed
and make the checkpoint available. When either is missing the job stops at the inference stage with that reason;
the retrieved scene is kept and reused (no second Copernicus request).

## Provenance

`satellite_analyses` row per analysis: id, area, product ids and names, satellite, product type, acquisition time,
composite size, preprocessing version, scene path, model version and checkpoint, threshold, MMU, graph k and τ,
software version (git commit), status, stage, error, job id, run id, summary, created / processed / finished times.
The run's `manifest.json` carries the same satellite block under `data_source.satellite`.

## Caching and rate limits

- Catalogue answers cached 10 min per area (`SATELLITE_CATALOGUE_TTL_S`) and persisted in `satellite_observations`.
- OAuth tokens cached until 60 s before expiry, then fetched again.
- Retrieved scenes are cached on disk (`data/scenes/<area>/<area>_s1nrt_<time>_r<orbit>_n<k>.tif`, keyed by product
  ids + preprocessing version) and reused; a completed analysis with the same products, checkpoint and threshold is
  returned instead of re-running (`force: true` overrides).
- One Process API request per acquisition per ≤ 2,000 px tile (computed from the real grids):

  | Area | Grid (10 m) | Requests / acquisition | Processing units / acquisition (estimate) |
  |---|---|---|---|
  | Kerala Coast | 2,203 × 2,221 px, EPSG:32643 | 4 | ~37 |
  | Sundarbans | 3,137 × 3,358 px, EPSG:32645 | 4 | ~80 |
  | Gulf of Mannar | 4,415 × 3,343 px, EPSG:32644 | 6 | ~113 |
  | Odisha Coast | 2,502 × 2,659 px, EPSG:32645 | 4 | ~51 |

  The estimate uses the Sentinel Hub rule of thumb (512 × 512 px = 1 unit, FLOAT32 doubles it); the CDSE dashboard
  shows the real usage. Do not poll: a new Sentinel-1 product over these areas appears every ~12 days.
- HTTP 429 → retried after `Retry-After` (capped 30 s); still limited → "please wait" message.

## Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| "image retrieval is not configured" (503) | no OAuth client | set `COPERNICUS_CLIENT_ID/SECRET`, restart |
| "rejected the server's credentials" | wrong or revoked secret | create a new OAuth client |
| "rate-limiting requests" (429) | quota/rate limit | wait; check the CDSE dashboard |
| "did not answer in time" (504) | network / CDSE slow | retry; raise `COPERNICUS_TIMEOUT_S` only if needed |
| "No Sentinel-1 observation with VV + VH covers this study area" | partial strips only / no pass in window | widen `SATELLITE_SEARCH_DAYS` |
| "AI inference cannot run on this server" | checkpoint or torch missing | copy the checkpoint, set `SATELLITE_INFERENCE_PYTHON` |
| "manual review recommended" | input statistics differ from training | expected for single dates / other seasons; compare with a 4-scene median |

## Demo instructions

1. Start the stack (`./start.sh`). Open **Satellite Monitor** in the sidebar.
2. *Stored analysis (static data)*: the existing 2020 analysis — the dashboard default.
3. *Latest observation (Copernicus NRT)*: real catalogue metadata for the selected area — satellite, acquisition and
   publication time, timeliness, orbit, coverage, previous pass; **View observation footprint** shows the satellite's
   imaging strip over the study area; the history lists recent passes.
4. With an OAuth client and the model available, sign in as `gis` and press **Analyze latest scene**: the checklist
   follows the backend job; when it completes, the map shows the retrieved VV image, the predicted mask, patches and
   critical patches, and **Open in dashboard** opens the new run in the existing pages.

Say "latest available satellite observation", "model prediction", "model-output difference", "potential restoration
candidate". Do not say live video, confirmed loss, field-validated detection or confirmed restoration feasibility.

## Automatic monitoring (2026-10-04)

`backend/satellite/monitor.py` turns the layer into a monitor that needs no click:

1. **Check** (job `satellite_monitor`): for every study area, search the catalogue; a pass not seen before raises a
   `new_observation` alert (once per product).
2. **Analyse**: if this server can run the model (`/api/satellite/status` → `inference.available`), the standard 8-pass
   same-track analysis is queued with `trigger: monitor` for the areas in `SATELLITE_MONITOR_AREAS` (default: areas where
   the model is not rated unreliable — currently the Sundarbans; `all` or a comma list to override).
3. **Report**: when it completes, a `satellite_update` alert gives patches, habitat area, plausibility and reliability,
   and the change versus the previous completed analysis of the same area with the same model and threshold —
   explicitly a model-output difference between two 3-month composites, not a verified habitat change.

Schedule: `SATELLITE_MONITOR_HOURS=12` (API process; a check is enqueued when the last one is older; safe with several
instances because the job queue claims atomically), or cron: `python scripts/satellite_monitor.py` (`--no-analyse` for
alerts only). `SATELLITE_MONITOR_ANALYSE=0` disables automatic analyses. API: `GET /api/satellite/monitor` (schedule +
last per-area report), `POST /api/satellite/monitor/run` (role with `run_analysis`). The Satellite Monitor page shows the
schedule and last check; alerts appear in the Alerts module. Monitoring alerts are kept when stored-run alerts are
regenerated.
