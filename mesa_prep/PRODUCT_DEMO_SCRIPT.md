# EcoConnectAI — product demonstration: script, click plan, panel Q&A, checklist

> **Update (25 Sept 2026, after the videos were recorded): the UI issues flagged below are now fixed in the code.**
> The landing page uses real run values (study-area cards load live from the API; P17/C1 examples; no Landsat).
> The dashboard change chart and KPI deltas only compare runs of the same model and threshold (backend
> `/timeline?run_id=` and the alert rules). The graph page lists only true cut vertices (P07, P17). The model
> badge reads "Development model — not final". The synthetic importance timeline is removed. The Scenario Lab
> no longer invents numbers when the backend is offline. The two videos were recorded **before** these
> fixes, so they still show the old badge, landing figures and deltas; their narration already treats them as caveats.


Companion to `EcoConnectAI_Product_Demo.mp4` (16.0 min, 1080p, recorded from the running app on 25 Sept 2026, Kerala / Vembanad–Kol journey). Every number below was on screen in the recording. The narration is macOS text-to-speech; in the viva, say it in your own voice.


## 1. Complete demo script (exact words, with timestamps)


### 1 · Opening the product

**[00:00–00:22]** Good afternoon. This is EcoConnectAI, a satellite-driven coastal ecosystem intelligence and conservation decision-support platform. Its purpose is not simply to show a habitat map. It converts satellite-derived habitat information into patch-level connectivity analysis, criticality assessment, scenario analysis and restoration support.

**[00:22–00:45]** This is the public overview. The navigation covers the insight behind the project, how it works, its capabilities, the four study areas, restoration, and an about section. The visual on the right is an illustration, and the figures on this public page come from our early prototype. Every operational number I show today comes from inside the platform.

**[00:45–00:57]** Now I click Launch Command Center. This opens the operational side of the platform. Before working with it, I will sign in, because actions like creating field tasks are controlled by role.


### 2 · Sign in

**[00:57–01:16]** I click Sign in. The platform has six roles, from state administrator to field officer, and each role sees only the actions it is allowed to perform. These are demonstration accounts, and clicking a card signs in directly. I click State Administrator, which has access to every module.


### 2 · Command Center

**[01:16–01:37]** This is the Command Center. On the left is the navigation for every module. At the top are the study area selector, currently Kerala, and the analysis period, which is the latest run, from twenty twenty five imagery. The bell shows open alerts. In the centre is the map, and on the right the selected patch, landscape metrics and what-if tools.

**[01:37–02:02]** Notice the label on the map: real data, development model, not final. Every result in the platform carries a label like this. Below the map, the cards show twenty four detected patches, forty three connectivity links, about two hundred and twenty hectares of mangrove, and four restoration opportunities. All of these come from the latest analysis run, served by the backend.


### 2 · Command Center — layers

**[02:02–02:28]** The map is the spatial foundation. Every later analysis links back to a location. Here is the layers panel. Green polygons are mangrove patches, split by model confidence. Orange points are restoration candidates. Red marks the five most critical patches. Blue lines are connectivity links. I will switch off the links, and the candidates, so you can see the patches alone, and then switch them back on.


### 3 · Study areas

**[02:28–02:53]** The platform contains four study areas: Vembanad Kol in Kerala, the Sundarbans in West Bengal, the Gulf of Mannar in Tamil Nadu, and Bhitarkanika in Odisha. If I switch to the Sundarbans, the whole dashboard reloads from that landscape's own run. Here the model found fifty four patches over a much larger mangrove system. Kerala is our primary demonstration, so I switch back.


### 3 · Data context

**[02:53–03:30]** To see the data behind a landscape, I open New Analysis. For Kerala there are four downloaded scenes. Each one shows its date range, pixel size, projection, bands and sensor. The model uses Sentinel-1 radar: six scenes, combined into a temporal median, at ten metres. Sentinel-2 optical data is also downloaded, but it is complementary; the current model does not use it. This panel on the right states what is real: real satellite scenes, and Global Mangrove Watch labels, which are weak reference labels, not field ground truth.

**[03:30–03:51]** The run panel shows what would execute: this scene, a trained model, and a threshold. Pressing Run pipeline performs the whole chain on the backend: prediction, patch extraction, the graph and criticality. I will not re-run it live, because it would replace the current results. Instead, I will use the latest completed run.


### 4 · Satellite → habitat

**[03:51–04:21]** Back on the dashboard, I can look at the satellite data directly. I select the Sentinel-1 radar layer. This is the actual input the model sees, rendered from our downloaded raster. Now Sentinel-2 N D V I, the complementary optical view, where vegetation appears bright. And back to the normal satellite basemap.

**[04:21–04:48]** Now the habitat detection. I open the interactive map. The bright green here is the model's probability raster: for every ten metre pixel, the probability that it is mangrove. If I switch it off, you see the imagery underneath. Switching it back on. The system thresholds this probability to get a habitat mask, and then groups the mask into individual patches.


### 4 · Model information

**[04:48–05:29]** Which model produced this? I open Data and Models. The research foundation is a U-Net with an EfficientNet B7 encoder, called UNB7. That full model is not trained yet. What runs today is the same U-Net with a smaller EfficientNet B0 encoder, on Sentinel-1 input. This model, used for the Kerala run, is weak on Kerala: test I O U zero point zero three. Our four-area model reaches zero point eight four, but mostly from the Sundarbans. These are measured against weak labels, and the badge here is only a display label. The ninety five percent card is the foundation study's published result, not ours.


### 5 · Habitat patches

**[05:29–05:53]** Now the patches. Back on the dashboard, I zoom into the northern cluster. Instead of treating the habitat as one image, the system has extracted individual patches. Let me click one. The selected patch card shows its area, the connectivity loss if it were removed, its importance rank, and the model's confidence. Each patch is an analysable spatial unit.

**[05:53–06:23]** I can also search by patch I D. P01 is the largest patch, thirty five hectares, with a connectivity loss of about thirty one percent. Now P17. It is only three point one three hectares, yet its connectivity loss is twenty seven percent, and it is ranked third. The card explains why: it is a cut vertex, and removing it splits the network into three components. Patches of very different size can have almost the same structural role.


### 6 · Connectivity graph

**[06:23–06:48]** Now we move from where habitat exists, to how patches are connected. I open the Connectivity tab. Each circle is a patch, sized by area. Each line is a link to one of its nearest neighbours within five kilometres, weighted by distance and confidence. Twenty four nodes, forty three links, and two clusters: a main network of twenty three patches, and one isolated patch.

**[06:48–07:13]** I click patch P17 in the graph. Its panel shows four functional links, to P14, P04, P15 and P07, and marks it as a cut vertex. Now I switch on critical links only. One bridging corridor remains, the dashed link through P17 and P07. That corridor is the only connection between the northern and southern groups of patches.


### 7 · Criticality analysis

**[07:13–07:43]** This is criticality analysis, the main differentiator. The question is not which patch is largest, but which patch matters most to connectivity. For every patch, the system recomputes landscape connectivity with that patch removed, and ranks patches by the loss. Here is the ranking. P01, P07 and P17 are the top three. P01 is the largest patch, but P07 and P17 are small. They rank high because of their position in the network.


### 7 · Criticality evidence

**[07:43–08:20]** Why is P17 critical? I open its evidence. The system identifies it as critical based on the implemented connectivity analysis, and shows the numbers. Connectivity before removal, connectivity after removal, the difference, and the relative loss, zero point two seven. By area it is only seventeenth. Its degree is four, it is a cut vertex, and removing it takes the network from two components to three. Below are its geometry, confidence and the analysis parameters. Nothing here is generated at display time; it is read from the stored run.


### 8 · Back to the map

**[08:20–08:45]** Now I move from the analysis back to geography. On the dashboard, I search for P17, and the map flies to it. The red polygon outlined here is P17, one of the top five critical patches, and it is already selected. An officer does not have to interpret an abstract table; the critical patch is right here, between the northern and southern mangrove groups, with its area, loss and confidence.


### 9 · What-if scenario

**[08:45–09:08]** Now a management question. What happens to the landscape if P17 is lost? I click Remove Patch. The backend rebuilds the graph without P17 and recomputes connectivity. Here is the result: connectivity falls by twenty seven percent, while only one point four percent of the habitat was removed, and the network breaks from two components into three.


### 9 · Scenario Lab

**[09:08–09:39]** For a fuller comparison I open the Scenario Lab. Scenario A, remove patch, already has P17 selected. I click Run scenario. Here is the before state, the baseline, and the simulated after state, side by side: connectivity indices, habitat area, links going from forty three to thirty nine, and components from two to three. Below is an explanation built only from these numbers, and the affected neighbouring patches.

**[09:39–10:08]** This is not a prediction of the future. It is a what-if based on the current model output and our assumptions. One assumption is the five kilometre connection distance, so let me test it. I choose scenario E and run it. At three, five and eight kilometres, the links change from forty one to forty seven, but the ranking correlation stays above zero point nine six. The critical patches do not depend on that single choice.


### 10 · Restoration planner

**[10:08–10:37]** After finding where connectivity is vulnerable, the next question is where restoration would help most. I open the Restoration planner. Candidates are areas where the model saw marginal habitat. For each one, the system adds it to the graph and measures the gain. I click the top candidate, C1. It is one point six hectares, and it would add three new links, to P01, P06 and P13, raising connectivity by one point two nine percent.

**[10:37–11:02]** The panel is honest about what it has not assessed: water status, legal status, land ownership and cost. The current prototype ranks candidates by connectivity benefit. Cost-aware ranking is used only when validated cost data is uploaded here. So recommended means no rule was violated in the available layers. It is a starting point for a field assessment, not a final decision.


### 11 · Change over time

**[11:02–11:43]** Next, change over time. For Kerala we have Sentinel-1 imagery for twenty twenty and twenty twenty five, both processed by the same model at the same threshold. I select the twenty twenty five run in the period selector, go to the Scenario Lab, open scenario G, compare periods, choose the twenty twenty run, and run it. Between twenty twenty and twenty twenty five the model output drops from three hundred and eighty two to three hundred and nineteen hectares. Nine patches have no match, and ten are new. This is labelled observed, model output.

**[11:43–12:05]** The explanation says it clearly: both are model outputs, and no cause is attributed. This development model is weak on Kerala, so I would not report this as a measured loss of mangrove. What the module demonstrates is the workflow: when a stronger model is available, the same comparison becomes a monitoring tool. I switch back to the latest run.


### 12 · Field verification

**[12:05–12:27]** Satellite analysis alone should not be treated as the final truth. A real workflow needs human review and field verification. On the interactive map with P17 selected, I click Send P17 to verification. It is registered as a detection with status A I detected. It cannot be marked confirmed until accepted field evidence exists.

**[12:27–13:05]** Now I open Field Reports. The verification queue shows P17. I click New task and create an assignment: verify critical patch P17, with the reason from the analysis, the patch location, and the field officer as assignee. I click Create task. The task now appears as pending. This is the link from analysis to action.

**[13:05–13:25]** To show the complete loop, here is an earlier task from our workflow testing. A field officer submitted an observation with location, a senior officer accepted it, and the task became verified. This record is demonstration data from testing, not a real field survey. No real field validation has been carried out yet.


### 13 · Reports

**[13:25–13:53]** Reports turn the analysis into something that can be reviewed and shared. I open Reports and select the Kerala assessment. It is generated from the run files: an abstract carrying the result label, then the habitat map, the graph and baseline connectivity, the critical patches, the what-if result, the sensitivity test, restoration candidates, and the data provenance with model and timestamps.

**[13:53–14:10]** I click Generate official report. This version adds a field verification section and is stored in the database with an audit entry. The Download PDF button uses the browser's print to PDF; the backend itself produces the report as structured data.


### 14 · Responsible AI

**[14:10–14:32]** EcoConnectAI is designed as decision support, not autonomous decision making. Even the assistant follows this rule. I ask: why is P17 critical? The answer is assembled from the stored run, with the source files and the result label. It is not a large language model, and it never invents a number.


### 14 · Evidence & audit

**[14:32–14:54]** Every action is recorded. I open the audit trail. At the top are the actions from this demonstration: signing in, registering the detection, creating the field task, and generating the report, each with user, role and time. The platform provides evidence to support an officer. The final management decision remains with the responsible human authority.


### 14 · How it is built

**[14:54–15:23]** Behind the screens, the flow is simple. The Next J S frontend calls a Fast A P I backend. Workflow data, like users, detections, tasks, reports and this audit log, is stored in a S Q Lite database with fifteen tables. Rasters, model checkpoints and analysis results stay as files, and the database records where they are. The model and graph analysis run in Python, and the results come back to the screen.


### 15 · Recap

**[15:23–16:02]** Back to the Command Center. So the complete workflow is: satellite observation, habitat detection, patch extraction, connectivity analysis, criticality assessment, what-if simulation, restoration prioritisation, field verification, and reporting. The key idea is that EcoConnectAI does not stop at showing where habitat exists. It shows how patches relate to one another, identifies structurally important patches, estimates the consequences of losing them, and supports restoration planning, while being clear about what is real and what is still in development. Thank you.


## 2. Click-by-click screen recording plan

| Time | Page | Click / action | What appears | What to say (first line) | Technical point it proves |
|---|---|---|---|---|---|
| 00:00–00:22 | `/` | — | Public landing page, hero with Vembanad–Kol illustration | Good afternoon. | Introduces the product and its purpose (decision support, not just a map). |
| 00:22–00:45 | `/` | hover top navigation | Navigation: The Insight, How It Works, Capabilities, Study Areas, Restoration, About, Launch Command Center | This is the public overview. | Public overview vs operational platform. |
| 00:45–00:57 | `/ → /command` | Launch Command Center | Command Center opens (read-only until sign-in) | Now I click Launch Command Center. | Entry into the operational side. |
| 00:57–01:16 | `/login` | Sign in → State Administrator demo card (one-click sign-in) | Login page with six demo roles; redirect to Command Center | I click Sign in. | JWT authentication with six roles (state admin, senior officer, range officer, field officer, GIS officer, analyst). |
| 01:16–01:37 | `/command` | hover sidebar, header selectors | Dashboard: sidebar, study-area and period selectors, map, KPIs, landscape metrics, what-if panel | This is the Command Center. | One operational workspace; every panel is fed by the latest analysis run through the API. |
| 01:37–02:02 | `/command` | hover map label and KPI cards | Map strip "REAL DATA · development model · not final"; KPI cards 24 patches, 43 links, 220 ha, 4 opportunities | Notice the label on the map: real data, development model, not final. | Provenance label on every result; numbers come from the run bundle, not hard-coded. |
| 02:02–02:28 | `/command` | Layers panel: Connectivity links, Restoration candidates, Critical patches | Layers toggle on the map | The map is the spatial foundation. | Map layers come from the run: patch polygons (by confidence), candidates, top-5 critical, links, AOI boundary, alerts, tasks. |
| 02:28–02:53 | `/command` | Study-area selector → West Bengal (Sundarbans) → back to Kerala | Map and KPIs switch to the Sundarbans run (54 patches), then back to Kerala | The platform contains four study areas: Vembanad Kol in Kerala, the Sundarbans in West Bengal, the Gulf of Mannar in Tamil Nadu, and Bhitarkanika in Odisha. | Four configured landscapes; each has its own real pipeline run. |
| 02:53–03:30 | `/upload` | Sidebar → New Analysis | Landscapes with downloaded scenes; scene metadata (dates, size, EPSG, bands, sensor); "What is real here" | To see the data behind a landscape, I open New Analysis. | Real satellite data: Sentinel-1 RTC (Planetary Computer), Sentinel-2 L2A (Earth Search); weak labels GMW v3 2020. |
| 03:30–03:51 | `/upload` | hover Run panel (not clicked) | Run panel: landscape, scene, model kerala-coast_development, threshold 0.5 | The run panel shows what would execute: this scene, a trained model, and a threshold. | POST /api/segment runs prediction → patches → graph → criticality on the backend; not re-run live because it replaces the latest run. |
| 03:51–04:21 | `/command` | Dashboard → basemap Sentinel-1 (SAR, VV) → Sentinel-2 (NDVI) → Satellite | Map background switches to our own Sentinel-1 then Sentinel-2 NDVI rasters | Back on the dashboard, I can look at the satellite data directly. | Basemaps rendered from the downloaded scene rasters (quicklook endpoint), not a third-party tile layer. |
| 04:21–04:48 | `/analysis` | Top tab Patches → Interactive Map; Layers: Model probability off/on | Split map with the model probability raster and habitat mask | Now the habitat detection. | Segmentation output: per-pixel P(mangrove) raster → threshold → habitat mask → patches. |
| 04:48–05:29 | `/experiments` | Sidebar → Data & Models → kerala-coast_development → multi_E1_s1_b0_dev | Model list; metrics cards; validation vs held-out test table | Which model produced this? I open Data and Models. | Actual model: U-Net with EfficientNet-B0, input S1 VV/VH; metrics are agreement with GMW. UNB7 (B7) is the research target, not yet trained. |
| 05:29–05:53 | `/command` | Dashboard → scroll-zoom on the northern cluster → click a patch polygon | Map zooms in; Selected Patch card fills with area, connectivity loss, importance, confidence | Now the patches. | Each connected component ≥ 2 ha is one patch — an analysable spatial unit with its own attributes. |
| 05:53–06:23 | `/command` | Search "P01" → Enter, then search "P17" → Enter | Card shows P01 (35.1 ha, 30.7 % loss) then P17 (3.13 ha, 27.0 % loss, critical #3, cut vertex) | I can also search by patch I D. | Two patches of very different size can have similar structural importance. |
| 06:23–06:48 | `/graph` | Top tab Connectivity → graph view | Network: 24 nodes, 43 links, 2 clusters; topology and clusters cards | Now we move from where habitat exists, to how patches are connected. | Patches = nodes; links = nearest neighbours within 5 km, weighted by distance and confidence. |
| 06:48–07:13 | `/graph` | Click node P17; toggle "Critical links only" | P17 panel: 4 links, cut vertex; critical-links filter shows the single bridging corridor | I click patch P17 in the graph. | Per-patch network role: degree, alternative routes, bridging corridor. |
| 07:13–07:43 | `/graph` | Scroll right panel → Patch importance ranking | Ranking: P01 31, P07 30, P17 27, P02 22, P03 21 … | This is criticality analysis, the main differentiator. | Exact leave-one-out: connectivity recomputed with each patch removed; ranking by relative loss. |
| 07:43–08:20 | `/analysis?patch=P17` | Patches tab (map) with P17 → "Why is P17 ranked here? · Evidence" | Evidence drawer: decision, C(G), C(G−v), ΔC, S = 0.2695, rank by area #17, degree 4, cut vertex 2 → 3, neighbours, parameters | Why is P17 critical? I open its evidence. | Transparent evidence instead of an unexplained label; values read from the stored run. |
| 08:20–08:45 | `/command` | Dashboard → search P17 → point at the red P17 polygon (already selected by the search; clicking it again would deselect it) | Map flies to P17; the red critical polygon is selected; card shows P17 details | Now I move from the analysis back to geography. | Analysis result is tied to a physical location an officer can visit. |
| 08:45–09:08 | `/command` | Remove Patch | What-if card: "Removing P17" — IIC loss −27.0 %, habitat removed 1.4 %, components 2 → 3 | Now a management question. | Exact server-side recomputation (POST /what-if). |
| 09:08–09:39 | `/scenario` | Sidebar → Scenarios → A · Remove patch (P17 carried over) → Run scenario | Baseline / scenario / Δ table for IIC, PC, ECA, habitat, links (43 → 39), components (2 → 3); label SIMULATED | For a fuller comparison I open the Scenario Lab. | Before → after comparison with an explanation built from computed values. |
| 09:39–10:08 | `/scenario` | clear → E · Compare τ 3/5/8 km → Run scenario | Table: τ 3/5/8 km → links 41/43/47, components 2/2/1, rank correlation 0.96/1.00/0.97; label SIMULATED | This is not a prediction of the future. | Assumption sensitivity: the 5 km distance is a parameter; ranking stays stable. |
| 10:08–10:37 | `/restoration` | Sidebar → Restoration → #1 C1 | Candidates C1–C4 on the map; C1: 1.6 ha, +1.29 % IIC, 3 new links to P01, P06, P13; why / why not / not assessed | After finding where connectivity is vulnerable, the next question is where restoration would help most. | Reverse of criticality: insert candidate, recompute, rank by gain. No invented costs. |
| 10:37–11:02 | `/restoration` | hover Not assessed list; hover Upload real cost table; hover Create field assessment task | Not-assessed items (water status, legal status, ownership, cost); cost upload control | The panel is honest about what it has not assessed: water status, legal status, land ownership and cost. | Costs only from user-supplied validated data; "Recommended" is a rule output, not a field or legal verdict. |
| 11:02–11:43 | `/scenario` | Period → 2025 kerala_E1 run; Sidebar → Scenarios → G · Compare periods → compare with kerala_E1 2020 → Run | OBSERVED (MODEL OUTPUT): habitat 319 vs 382 ha, IIC difference, 9 patches without counterpart, 10 new | Next, change over time. | Change = difference between two real pipeline runs of the same model and threshold; model output, not measured loss. |
| 11:43–12:05 | `/scenario` | hover explanation; Period → back to latest | Explanation: "Both are model outputs; differences include model uncertainty and no cause is attributed" | The explanation says it clearly: both are model outputs, and no cause is attributed. | Honest limitation: the dev model is weak on Kerala, so this difference may be noise. |
| 12:05–12:27 | `/analysis?patch=P17` | Interactive map with P17 → "Send P17 to verification" | Message: registered as detection (AI_DETECTED) — see Field Reports → verification queue | Satellite analysis alone should not be treated as the final truth. | Satellite result enters a human review chain: AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED → FIELD_VERIFIED → CONFIRMED. |
| 12:27–13:05 | `/field` | Sidebar → Field Reports → New task → fill title, reason, location, assignee → Create task | New PENDING task "Verify critical patch P17" assigned to the Field Officer; verification queue shows P17 | Now I open Field Reports. | Analysis → action: a task stored in the database (field_tasks) and assigned to a role. |
| 13:05–13:25 | `/field` | Open existing Task #1 (VERIFIED) | Task detail with evidence record and verification status (demo test data) | To show the complete loop, here is an earlier task from our workflow testing. | Full loop: task → GPS/photo evidence → senior review → verified; existing record is demonstration data. |
| 13:25–13:53 | `/reports` | Sidebar → Reports → Kerala report; scroll | Scientific report per run: abstract with result label, habitat map, graph, criticality, what-if, τ sensitivity, restoration, provenance | Reports turn the analysis into something that can be reviewed and shared. | Analysis converted into a reviewable document generated from run files. |
| 13:53–14:10 | `/reports` | Generate official report | Official report created and stored (reports table), with field-verification section | I click Generate official report. | Official report stored in the database; PDF via the browser print dialog. |
| 14:10–14:32 | `/command` | ⌘K Ask AI → "Why is P17 critical?" | Assistant answer quoting stored values with sources and [DEVELOPMENT-SUBSET RESULT - NOT FINAL] | EcoConnectAI is designed as decision support, not autonomous decision making. | Assistant is template retrieval over stored results, not an LLM; never invents figures. |
| 14:32–14:54 | `/audit` | Sidebar → Audit | Audit trail with the actions just performed: login, detection registered, task created, report generated | Every action is recorded. | Accountability: every action written to the append-only audit_log table. |
| 14:54–15:23 | `/audit (overlay)` | — (architecture overlay added for this video) | Overlay: Next.js frontend → FastAPI → SQLite (workflow) + run files (rasters, graphs) → analysis/model → result | Behind the screens, the flow is simple. | Database answer: SQLite via SQLAlchemy, 15 tables; rasters and run artefacts on disk. |
| 15:23–16:02 | `/command` | Sidebar → Dashboard | Command Center overview | Back to the Command Center. | End-to-end operational workflow in one product. |

The next action is always the following row. Between rows: move the cursor slowly to the control, pause, click, let the page finish loading, then speak.


---

## 3. Panel questions about what was shown (short spoken answers)

**Where does this data come from?**
"Sentinel-1 radar scenes from Microsoft Planetary Computer, and Sentinel-2 optical scenes from Earth Search on AWS. Both are free, public and need no account. Labels come from Global Mangrove Watch 2020. Everything is visible on the New Analysis page, scene by scene."

**Which satellite does the model use?**
"Sentinel-1 only: the V V and V H polarisations, as a temporal median of the year's scenes, at ten metres. Sentinel-2 is downloaded but complementary: basemaps, two ablation experiments, and one restoration rule."

**Which dataset?**
"Our own. 1,373 tiles of 256 by 256 pixels from the four landscapes, labelled with Global Mangrove Watch. Those are weak reference labels, not field ground truth. No Kaggle data."

**Which model?**
"A U-Net with an EfficientNet-B0 encoder, trained on a laptop. The research target is UNB7, the B7 encoder. It's configured but not trained yet. The Data & Models page shows every trained model and its metrics."

**Why Sentinel-1?**
"Radar sees through monsoon cloud, and mangrove canopy has a distinctive VH scattering signal. It's also the sensor of the foundation study we build on."

**Why Sentinel-2 at all?**
"As optical context. The N D V I basemap, the water check in restoration, and an ablation where optical and fused inputs did slightly better on Kerala. Fusion is future work."

**How is a patch extracted?**
"The probability map is thresholded. Touching mangrove pixels are grouped into connected regions, and regions under two hectares are dropped. Each region becomes a patch with its area, centroid, confidence and polygon."

**How is connectivity calculated?**
"Each patch links to its three nearest patches if they're within five kilometres. Then the Integral Index of Connectivity is computed: large patches that can reach each other in few steps give a high value."

**How is a patch identified as critical?**
"The system removes each patch in turn, recomputes the index, and ranks patches by the loss. P17 is small but third, because removing it splits the network."

**What happens when a patch is removed?**
"The backend rebuilds the graph without it and recomputes. You saw it on the dashboard: minus 27 percent, 2 components becoming 3. Scenario A shows the full before and after."

**How is restoration prioritised?**
"The reverse. Each candidate site is added to the graph, and we measure the gain. Candidates are areas of marginal model probability. There are no costs, because we have no validated cost data. A cost table can be uploaded."

**What is real and what is demonstration?**
* Real: satellite scenes, model predictions, patches, graph, criticality, scenarios, restoration ranking, and the database workflow.
* Development, not final: the model itself.
* Demonstration: the user accounts, the example field task and its evidence, and the landing-page figures.
* Not done: field validation, costs, UNB7.

**What is stored in the database?**
"SQLite, fifteen tables: users and roles, a registry of scenes, models and analysis runs, detections, alerts, field tasks, evidence, projects, saved scenarios, reports, and an append-only audit log. Rasters and analysis files stay on disk; the database stores their paths."

**What happens in the backend?**
"FastAPI in Python. It serves the run results, recomputes what-if and scenarios exactly, runs new analyses with the PyTorch model, and handles login, roles, alerts, tasks, reports and the audit trail."

**How does the frontend talk to the backend?**
"The Next.js frontend calls a REST API over HTTP with JSON. A login token is sent with each request, and the backend checks the role before protected actions."

**How is the model integrated?**
"The New Analysis page calls /api/segment. The backend runs sliding-window inference on the scene, writes a probability raster, then extracts patches, builds the graph and computes criticality. The new run is registered in the database and appears in the period selector."

**How can this scale to another region?**
"Add the area's bounding box to the study-area config and run acquisition. It's credential-free, and Global Mangrove Watch covers all Indian mangroves. Then run the pipeline. For many regions you'd move inference to a GPU and parallelise the criticality step."

**What are the limitations?**
"The model is a development model: strong on Sundarbans, weak on thin fringes like Kerala. Labels are weak. The five-kilometre distance is an assumption. Change detection is model output. There are no costs and no field validation yet."

**How would a forest department use it?**
"A range or senior officer opens the Command Center, reviews critical patches and alerts, tests a what-if before approving land-use change, sends high-priority patches to field verification, and exports a report. The officer decides; the system provides evidence."

**Was the field-verified task real?**
"No. It's demonstration data created while testing the workflow. No real field survey has been done."

**Why are there so many links but only 2 components?**
"Most patches sit in one connected network. The second component is a single isolated patch, more than five kilometres from its neighbours."

**Why is the landing-page figure different from the dashboard?**
"The landing page is a public overview with illustrative figures from our early prototype. The operational numbers come from the analysis runs in the Command Center."

---

## 4. Final end-to-end demo checklist

**Before the panel**
- [ ] Start the backend: `.venv/bin/python -m uvicorn backend.main:app --port 8000`
- [ ] Start the frontend: `cd frontend && npm run dev`
- [ ] Open http://localhost:3000 at 100 % browser zoom, window about 1600 × 900 or larger.
- [ ] Keep the backend running the whole time. If it's offline, the Scenario Lab falls back to placeholder numbers.
- [ ] Sign out first so the sign-in step is clean. Clear localStorage or use a private window.
- [ ] Optional: back up `outputs/ecoconnect.db` so the demo tasks and reports you create can be undone.

**Live demo**
- [ ] Landing page: purpose, navigation, "figures here are illustrative"
- [ ] Launch Command Center, then sign in as State Administrator (one-click card)
- [ ] Command Center tour: sidebar, Kerala, 2025 latest run, alerts bell, REAL DATA label, KPI cards
- [ ] Layers: links and candidates off, then on
- [ ] Switch to West Bengal (Sundarbans, 54 patches), then back to Kerala
- [ ] New Analysis: scene metadata, "What is real here" (don't press Run pipeline)
- [ ] Basemaps: Sentinel-1 VV, then Sentinel-2 NDVI, then Satellite
- [ ] Interactive Map: model probability off and on
- [ ] Data & Models: kerala-coast_development (test IoU 0.031), multi_E1 (0.842, Sundarbans-driven), UNB7 card = published result
- [ ] Dashboard: zoom in, click a patch, Selected Patch card
- [ ] Search P01, then P17 (3.13 ha, −27 %, critical #3, cut vertex)
- [ ] Connectivity tab: 24 nodes, 43 links, 2 clusters; click node P17; "Critical links only"
- [ ] Patch importance ranking: P01, P07, P17
- [ ] Interactive Map, P17, Evidence drawer: C(G), C(G−v), ΔC, S = 0.27, rank by area 17, cut vertex 2 → 3
- [ ] Dashboard: search P17, click the red polygon
- [ ] Remove Patch: −27.0 % IIC, 1.4 % habitat, 2 → 3 components
- [ ] Scenarios, A (P17 carried over), Run: before/after table, links 43 → 39
- [ ] clear, E · τ 3/5/8, Run: ρ ≥ 0.96
- [ ] Restoration, C1: +1.29 %, 3 links, why / why not / not assessed, no costs
- [ ] Period: kerala_E1 2025 run, then Scenario G vs kerala_E1 2020 run: 382 → 319 ha, "OBSERVED (MODEL OUTPUT)"; switch the period back to latest
- [ ] Interactive Map, P17, "Send P17 to verification"
- [ ] Field Reports, New task: "Verify critical patch P17", Field Officer, Create task
- [ ] Open Task #1 (VERIFIED): say it's demonstration test data
- [ ] Reports, Kerala report: scroll the sections; Generate official report
- [ ] Ask AI (⌘K): "Why is P17 critical?" — answer with sources and label
- [ ] Audit: today's actions listed
- [ ] Explain the architecture: browser → FastAPI → SQLite + run files → analysis
- [ ] Back to the Dashboard and recap

**Avoid during the live demo**
- Don't quote landing-page numbers (P16, 95.6 %, 18 patches, C1 +2.73 %, Landsat-9); they're prototype illustrations.
- Don't rely on the dashboard's "Change Over Time" chart or its KPI % deltas. They compare runs from two different models. Use Scenario G with the two kerala_E1 runs instead.
- If asked about the "3 critical bridges" box on the graph page: only P07 and P17 are cut vertices. P01 is critical by score but has alternative routes.
- The "Validated Model" badge and the patch inspector's small "importance timeline" are display elements, not results.
- Don't press "Run pipeline" live. It replaces the latest Kerala run.
