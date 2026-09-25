# EcoConnectAI — MESA viva question bank

Every answer below uses only the current repository, audited 25 Sept 2026. Paths are relative to the repo root.

**Format for each question**

* **S**: short answer (say this first)
* **D**: detailed answer (if they probe)
* **Where**: where it's implemented
* **Show**: screen or file to open

---

## Part 1 — Question bank by category (A–Z)

### A. Problem definition
**A1. What problem are you solving?**
- **S:** Mangrove maps show *where* habitat is, not *which patches hold the network together*. We rank patches by
  their functional importance for connectivity and support what-if and restoration decisions.
- **D:** Area-based prioritisation misses small stepping-stone patches. We model the landscape as a graph and
  measure the exact connectivity loss when each patch is removed.
- **Where:** whole pipeline; `ecoconnect/graph/criticality.py`.
- **Show:** `/analysis?scene=kerala-coast&patch=P17` evidence drawer.

**A2. Who is the user?**
- **S:** Conservation and forest officers and GIS analysts. The platform has 6 roles.
- **D:** The roles are state admin, senior officer, range officer, field officer, GIS officer and analyst.
  - The workflow runs from alert to field task to evidence to verification.
  - Only demo users exist. It isn't deployed with any department.
- **Where:** `backend/auth.py`, `backend/db.py`.
- **Show:** `/login` role cards, `/field`.

### B. Research contribution
**B1. What is novel?**
- **S:** Four things:
  1. An end-to-end, provenance-labelled chain from SAR segmentation to an exact patch-graph criticality ranking.
  2. What-if analysis on that same graph.
  3. Rule-based explanations.
  4. Gain-based restoration ranking.
- **D:** Each part exists separately in the literature: UNB7 segmentation, and IIC/PC connectivity from Saura et al.
  - Our contribution is integrating them over real Sentinel-1 predictions.
  - We use *exact* recomputation in an interactive tool.
  - Every number is labelled by provenance.
  - Don't claim to be the first.
- **Where:** `ecoconnect/pipeline/analysis.py`.
- **Show:** architecture slide, `/scenario`.

**B2. What is your main result?**
- **S:** On real data, criticality differs from size. In the Kerala run, P17 (3.1 ha, 17th of 24 by area) is the
  #3 most critical patch because it is a cut vertex.
- **D:** Removing P17 cuts IIC by 27.0 %, versus 30.7 % for the largest patch, which is 11× bigger.
  - In Odisha, P09 (55.6 ha) outranks P04 (910 ha).
  - Segmentation: 4-area dev model, test IoU 0.842 against GMW, Sundarbans-driven.
- **Where:** `outputs/runs/kerala-coast/kerala-coast_20260920T182222Z/criticality.csv`.
- **Show:** evidence drawer for P17.

### C. Dataset
**C1. What dataset did you use?**
- **S:** Our own dataset:
  - Sentinel-1 RTC 2020 composites for 4 Indian landscapes.
  - Global Mangrove Watch v3.0 2020 labels.
  - 1,373 tiles of 256 × 256 px.
- **D:** Tiles per area: Kerala 256, Sundarbans 575, Gulf 200, Odisha 342. 899 of them contain mangrove.
  - The spatial-block split gives 954 train / 195 val / 224 test tiles.
  - Development mode used 800 / 195 / 200.
  - No Kaggle dataset.
- **Where:** `scripts/build_tiles.py`, `logs/phase2_all_areas.log`.
- **Show:** dataset slide / `data/labels/*/gmw_2020.json`.

**C2. How did you split train and test?**
- **S:** By spatial blocks of 4 × 4 tiles, 70/15/15, seed 42.
- **D:** Tiles overlap by half (stride 128). A random split would leak neighbouring pixels into test, so whole
  blocks go to one split.
- **Where:** `ecoconnect/geospatial/preprocessing/tiling.py`.
- **Show:** `metadata.json` split_strategy.

### D. Satellite imagery
**D1. Where does the imagery come from?**
- **S:** Public STAC catalogues, with no account needed.
  - Sentinel-1 RTC from Microsoft Planetary Computer.
  - Sentinel-2 L2A from Element84 Earth Search on AWS.
- **D:** Only the AOI window of each cloud-optimised GeoTIFF is streamed.
  - Scenes are reprojected to local UTM at 10 m.
  - Scene JSON sidecars record every scene ID.
- **Where:** `ecoconnect/gee/stac_acquire.py`.
- **Show:** `data/scenes/kerala-coast/*.json`, `/upload` scene list.

**D2. What resolution, and what dates?**
- **S:** 10 m, calendar year 2020, plus 2025 Sentinel-1 for Kerala.
- **D:** Sentinel-1 scene counts:
  - Kerala: 6 descending (Jan–Oct 2020).
  - Sundarbans: 4 (mixed orbits).
  - Gulf: 4 descending.
  - Odisha: 4 ascending.
  - Kerala 2025: 6.
- **Where:** `configs/acquisition.yaml`.
- **Show:** Sentinel-1 slide.

### E. Sentinel-1
**E1. Which Sentinel-1 product and bands?**
- **S:** RTC gamma-nought from IW GRDH, VV and VH in dB. There is no ratio band.
- **D:** Terrain correction is done by the provider. A per-pixel temporal median replaces speckle filtering.
  Values are z-scored with training statistics.
- **Where:** `stac_acquire.py: sentinel1_composite`.
- **Show:** `configs/acquisition.yaml`.

**E2. Did you apply speckle filtering?**
- **S:** No spatial filter. The temporal median of 4–6 dates reduces speckle.
- **D:** A Lee or refined-Lee filter would be a future option. The median keeps full 10 m detail at edges.
- **Where:** same.
- **Show:** same.

### F. Sentinel-2
**F1. Is Sentinel-2 used by the model?**
- **S:** Not by the reported model. Only in two Kerala ablations (E2 S2-only, E3 fusion), the basemaps, and one
  restoration rule (NDWI).
- **D:** On Kerala, S2 (test IoU 0.054) and fusion (0.053) beat S1 (0.023). All three are weak. Fusion wasn't
  pursued as the final model.
- **Where:** `configs/dataset_s2.yaml`, `dataset_s1s2.yaml`.
- **Show:** evaluation table.

**F2. How did you handle clouds?**
- **S:** Scenes are filtered at ≤ 40 % cloud, then pixels are masked with the SCL layer before the median. The
  model's input, S1, is unaffected by clouds.
- **D:** The SCL classes masked are 0, 1, 2, 3, 8, 9, 10, 11.
- **Where:** `configs/acquisition.yaml`.
- **Show:** same.

### G. Machine learning
**G1. What ML task is this?**
- **S:** Binary semantic segmentation: a mangrove probability for every 10 m pixel.
- **D:** A sigmoid output, trained with BCE + Dice and evaluated with IoU, Dice, precision, recall and κ.
- **Where:** `ecoconnect/ml/`.
- **Show:** `/experiments`.

**G2. How long did training take, and on what hardware?**
- **S:** About 30 minutes, 40 epochs, on an Apple M3 laptop (MPS).
- **D:** 1,777 s, best epoch 32. The Kerala runs took 3–5 minutes each.
- **Where:** `outputs/segmentation/multi_E1_s1_b0_dev/experiment.json`.
- **Show:** training curve.

### H. UNB7
**H1. What is UNB7?**
- **S:** A U-Net decoder with an EfficientNet-B7 encoder, from the foundation study (Ghorbanian et al. 2025).
- **D:** In our code it is the alias `unb7`, used by `configs/train_full.yaml`. It is **implemented but not
  trained**. We trained the same U-Net with EfficientNet-B0.
- **Where:** `ecoconnect/ml/models/unet.py`.
- **Show:** model code slide.

**H2. Why didn't you train UNB7?**
- **S:** Compute. B7 needs a ≥ 16 GB CUDA GPU; our machine is a 16 GB Apple laptop. The Colab notebook is ready.
- **D:** Architecture and pipeline are identical; only the encoder name changes. The B0 run validates the pipeline.
- **Where:** `notebooks/colab_train_unb7.ipynb`.
- **Show:** `configs/train_full.yaml`.

### I. EfficientNet-B7 / encoder
**I1. Why EfficientNet?**
- **S:** It is the foundation study's encoder. It scales depth, width and resolution together and is ImageNet
  pretrained, which helps with limited labels.
- **D:** B0 has 6.25 M parameters in total with our decoder. B7 is much larger. We picked B0 for the laptop.
- **Where:** `unet.py`.
- **Show:** model slide.

**I2. Pretrained or from scratch? Frozen?**
- **S:** ImageNet-pretrained encoder, fully fine-tuned, nothing frozen.
- **D:** smp adapts the first conv from 3 channels to 2.
- **Where:** `configs/train_dev.yaml` (`encoder_weights: imagenet`).
- **Show:** same.

### J. U-Net
**J1. Why U-Net?**
- **S:** Encoder–decoder with skip connections. It is precise at the pixel level, which keeps 1–3 px mangrove
  fringes.
- **D:** The encoder captures context. The decoder upsamples. Skips restore spatial detail lost in downsampling.
- **Where:** `smp.Unet`.
- **Show:** U-Net diagram.

**J2. What does the model output?**
- **S:** One logit per pixel. A sigmoid turns it into a probability, and a threshold into a mask.
- **D:** Whole scenes use a 256 px sliding window, 64 px overlap, Hann blending → `*_prob.tif`.
- **Where:** `ml/inference/predict.py`.
- **Show:** `/analysis` probability layer.

### K. Weak supervision
**K1. Where do your labels come from?**
- **S:** Global Mangrove Watch v3.0, 2020, from Zenodo record 6894273.
- **D:** It is a published global map. It is resampled to our 10 m grid and aligned to each scene.
- **Where:** `ecoconnect/gee/gmw_labels.py`.
- **Show:** `data/labels/*/gmw_2020.json`.

**K2. Are your labels ground truth?**
- **S:** No. They are weak reference labels. Every metric is agreement with GMW, not field accuracy.
- **D:** GMW has its own errors, especially for thin fringes, and they propagate into our model. Field validation
  is future work.
- **Where:** label JSON (`"supervision": "WEAK"`).
- **Show:** labels slide.

### L. Segmentation results
**L1. What is your IoU / F1?**
- **S:** Test IoU 0.842, F1 0.914 for the 4-area development model, against GMW.
- **D:** The number is pixel-pooled and driven by Sundarbans. In Kerala, 1 of 43 test tiles has any correct
  mangrove. Kerala-only models score 0.02–0.05.
- **Where:** `outputs/segmentation/multi_E1_s1_b0_dev/metrics.json`, `test_results.csv`.
- **Show:** `/experiments` → multi_E1_s1_b0_dev.

**L2. Why is accuracy 99 % but IoU 0.02 for Kerala?**
- **S:** Only 0.2 % of pixels are mangrove. Predicting "no mangrove" everywhere gives ~99.8 % accuracy, so we
  report IoU and Dice.
- **D:** That's why training monitors IoU.
- **Where:** `configs/train_dev.yaml` (`monitor: iou`).
- **Show:** Kerala rows in the evaluation table.

### M. Patch extraction
**M1. How do you get patches?**
- **S:** Threshold the probability map, take 8-connected components, and drop those under 2 ha.
- **D:** Each patch has id, area, centroid, confidence (mean probability), class and polygon. The Kerala run has
  60 components, of which 24 are kept.
- **Where:** `ecoconnect/geospatial/patch_extraction/extract.py`.
- **Show:** `patches.geojson`.

**M2. Why 2 ha?**
- **S:** It is the paper's minimum mapping unit: a design parameter that suppresses tiny noisy fragments.
- **D:** It is not ecologically calibrated. The threshold scenario (F) shows how the patch set changes with the
  threshold. MMU is configurable.
- **Where:** `extract_patches(mmu_ha=2.0)`.
- **Show:** manifest `extraction_report`.

### N. Graph theory
**N1. What are nodes and edges?**
- **S:** Nodes are patches. Edges link each patch to its 3 nearest patches if they are within 5 km.
- **D:** Distance is centroid-to-centroid, great-circle. The union of the neighbour lists is undirected. Edge
  weight is √(qᵢqⱼ)·e^(−d/τ).
- **Where:** `ecoconnect/graph/construction.py`.
- **Show:** `/graph`.

**N2. What is a cut vertex, and what is a bridge?**
- **S:** A cut vertex is a node whose removal increases the number of components; the UI calls it a "bridge patch".
  A bridge in graph theory is an edge whose removal disconnects the graph.
- **D:** The code checks both: `is_cut_vertex` and `is_bridge_edge`.
- **Where:** `construction.py`.
- **Show:** graph-concepts slide.

### O. Connectivity
**O1. Why does connectivity depend on distance?**
- **S:** Propagules, fauna and tidal exchange move more easily between nearby patches, and τ stands in for
  dispersal distance.
- **D:** τ = 5 km is an assumption, not species-calibrated. Every run repeats the analysis at 3 and 8 km.
- **Where:** `configs/graph.yaml`.
- **Show:** Scenario E.

**O2. Does the graph use edge weights?**
- **S:** They are stored and shown, but IIC uses only topology (link counts) and areas. PC uses distance-decay
  probabilities.
- **D:** This is a point to state clearly in the paper.
- **Where:** `connectivity.py`.
- **Show:** code.

### P. IIC / PC / ECA
**P1. Explain IIC.**
- **S:** The sum over patch pairs of aᵢaⱼ divided by (1 + number of links between them), divided by the landscape
  area squared. Big patches reachable in few steps score high.
- **D:** Unreachable pairs contribute 0. It comes from Pascual-Hortal & Saura (2006). It is dimensionless and depends
  on AOI size.
- **Where:** `connectivity.py: iic`.
- **Show:** metric slide.

**P2. Explain ECA and why you use it across areas.**
- **S:** ECA = √PC × landscape area, in hectares: "equivalent connected area". Divided by habitat area, it is
  comparable across AOIs.
- **D:** Raw IIC/PC scale with A_L, so we don't compare them between landscapes.
- **Where:** `connectivity.py`.
- **Show:** landscape metrics card (ECA / habitat 75.1 %).

### Q. Criticality
**Q1. How is criticality calculated?**
- **S:** Remove the patch and its edges, recompute IIC, and take S = (C(G) − C(G − v)) / C(G). Repeat for every
  patch and rank.
- **D:** It is exact: the graph is rebuilt each time. We also record degree, cut-vertex flag, components before and
  after, and rank by area.
- **Where:** `criticality.py`.
- **Show:** evidence drawer.

**Q2. Show a patch that is small but critical.**
- **S:** P17 in the Kerala run.
  - 3.13 ha, 17th of 24 by area.
  - S = 0.270, rank 3.
  - Cut vertex (2 → 3 components), degree 4.
- **D:** Its neighbours are P14 (0.59 km), P04 (0.85 km), P15 (1.24 km) and P07 (2.80 km).
  - C(G) 6.524e-6 → C(G−v) 4.765e-6.
- **Where:** `criticality.csv`.
- **Show:** `/analysis?scene=kerala-coast&patch=P17`.

### R. What-if
**R1. What scenarios can you run?**
- **S:** Seven types, A–G:
  - A: remove a patch.
  - B: remove inside a polygon.
  - C: restore one candidate.
  - D: restore several.
  - E: compare τ 3/5/8 km.
  - F: compare thresholds.
  - G: compare periods.
- **D:** A–F are labelled SIMULATED; G is OBSERVED (MODEL OUTPUT). All are exact recomputations.
- **Where:** `backend/scenarios.py`.
- **Show:** `/scenario`.

**R2. Is this a prediction of the future?**
- **S:** No. It is a quantitative what-if under the current model output and stated assumptions (k, τ, threshold,
  IIC).
- **D:** It doesn't model dynamics, sea-level change or recolonisation.
- **Where:** —.
- **Show:** what-if slide.

### S. Explainable AI
**S1. How is the system explainable?**
- **S:** Every ranking comes with a sentence and the evidence behind it: area, rank by area, degree, neighbour
  distances, cut-vertex status, confidence, C(G), C(G − v), ΔC, S.
- **D:** A sentence is emitted only if its evidence exists. It is graph-level and rule-based.
- **Where:** `ecoconnect/graph/explain.py`.
- **Show:** P17 explanation.

**S2. Do you use SHAP or Grad-CAM?**
- **S:** No, neither is implemented. Our explanations cover the graph decision, not CNN pixels.
- **D:** Grad-CAM on the U-Net would be a future addition for segmentation explainability.
- **Where:** —.
- **Show:** —.

### T. Restoration
**T1. How do you rank restoration candidates?**
- **S:** Insert each candidate as a node, recompute IIC, and rank by the gain R = C(G + v) − C(G).
- **D:** Candidates are marginal-probability components (0.3 ≤ p < threshold, ≥ 1 ha). Kerala C1 gives +1.29 % IIC
  with 3 new links.
- **Where:** `ecoconnect/graph/restoration.py`.
- **Show:** `/restoration`.

**T2. Where do costs come from?**
- **S:** Nowhere. We ship none. Candidates are ranked by connectivity gain because validated cost data isn't
  available.
- **D:** If every candidate gets a cost in an uploaded CSV, ranking switches to gain/cost (paper Eq. 12). The
  paper's INR values were indicative, on synthetic data.
- **Where:** same.
- **Show:** "Upload real cost table".

### U. Software architecture
**U1. Describe the architecture.**
- **S:** A Python package (`ecoconnect`) for acquisition, ML and graph work, a FastAPI backend with SQLite, and a
  Next.js frontend. Run artefacts live on disk.
- **D:** `scripts/` are the command-line interface. `outputs/runs/<area>/<run>/` holds manifest, patches, graph,
  criticality, restoration and τ-sensitivity. 44 pytest tests.
- **Where:** repo layout.
- **Show:** architecture slide.

**U2. How does a new analysis run?**
- **S:** POST `/api/segment` does five things:
  1. Picks the scene.
  2. Picks a checkpoint: prefer full > S1-only > calibrated > newest.
  3. Runs `predict.py`.
  4. Runs `run_graph_analysis.py`.
  5. Registers the run in the DB.
- **D:** It is protected by the `run_analysis` capability and a run lock. The band count is checked against the
  checkpoint.
- **Where:** `backend/main.py`.
- **Show:** `/upload`.

### V. Database / backend
**V1. Is there a database?**
- **S:** Yes. SQLite via SQLAlchemy with 15 tables.
- **D:** The tables are users/organisations, the study-area/scene/label/model registry, analysis_versions,
  detections, alerts, field_tasks, evidence, projects, scenarios, reports and audit_log.
  - Rasters and checkpoints stay on disk.
  - Postgres is possible via `ECO_DATABASE_URL`.
- **Where:** `backend/db.py`.
- **Show:** DB slide.

**V2. How is security handled?**
- **S:** JWT (HS256), bcrypt passwords, and six roles with per-action capabilities.
- **D:** Honest gaps:
  - Many analysis and read endpoints are unauthenticated.
  - No rate limiting.
  - SQLite isn't production grade.
- **Where:** `backend/auth.py`.
- **Show:** `docs/SECURITY.md`.

### W. Frontend
**W1. What is the frontend stack?**
- **S:** Next.js 16, React 19, TypeScript, Tailwind. Maps use Leaflet, the graph view uses React Flow, and charts
  use Recharts.
- **D:** State lives in React Context. `lib/api.ts` is the client and fails soft.
- **Where:** `frontend/`.
- **Show:** `/command`.

**W2. Are all UI numbers real?**
- **S:** Yes, on the operational pages: they come from run files via the API.
- **D:** Exceptions to know:
  - The landing page is hard-coded, with synthetic prototype numbers.
  - The "Validated Model" badge.
  - The patch inspector's importance timeline.
  - The scenario page's offline fallback.
  - The dashboard's change deltas compare different models.
- **Where:** see the guide, §0.
- **Show:** —.

### X. GIS
**X1. What GIS operations are used?**
- **S:** Reprojection to UTM, windowed COG reads, raster alignment, connected-component vectorisation, polygon
  simplification, great-circle distances, and WGS84 GeoJSON output.
- **D:** Libraries: rasterio, pyproj, shapely, scipy.ndimage. Area uses true pixel area.
- **Where:** `ecoconnect/geospatial/`.
- **Show:** `/analysis` map.

**X2. How is this different from a normal GIS?**
- **S:** A GIS maps and overlays. We compute the network role of each patch, re-simulate interventions exactly, and
  explain rankings.
- **D:** The outputs could be exported into QGIS as GeoJSON.
- **Where:** —.
- **Show:** Scenario Lab.

### Y. Limitations
**Y1. What is the biggest limitation?**
- **S:** Segmentation quality outside Sundarbans. The development B0 model is near zero IoU on thin fringes, and
  everything downstream inherits that.
- **D:** Also: weak labels, over-prediction, a threshold at the edge of the sweep, τ as an assumption, no field
  validation, no costs.
- **Where:** —.
- **Show:** limitations slide.

**Y2. Is change detection reliable?**
- **S:** No. It is a difference of two model outputs. The Kerala E1 model has a test IoU of 0.023, so the
  −16 % could be noise.
- **D:** The dashboard chart even compares different models. Scenario G with matched runs is the right tool.
- **Where:** `backend/main.py` timeline, `scenarios.py`.
- **Show:** Scenario G.

### Z. Future work
**Z1. What would you do with six more months?**
- **S:**
  1. Train UNB7 on a GPU with per-area balanced sampling and a tuned loss.
  2. Field-validate on a sample of patches.
  3. Calibrate τ from species dispersal literature.
  4. Add real cost layers.
  5. Build a proper multi-year time series.
- **D:** Also: per-area evaluation reporting, uncertainty maps, a Postgres/PostGIS deployment, auth on all
  endpoints.
- **Where:** —.
- **Show:** —.

**Z2. How would this scale to all of India?**
- **S:** Acquisition is AOI-driven and credential-free. Tiling and inference are windowed, and the graph maths is
  O(n²) per metric evaluation.
- **D:** Leave-one-out over n patches is O(n·n²) for IIC via BFS. For thousands of patches you'd parallelise, use
  incremental updates, or partition by component.
  - GMW covers all Indian mangroves, so labels exist nationally.
- **Where:** `scripts/run_all_areas.py`.
- **Show:** —.

---

## Part 2 — 45 difficult questions (answers from the current implementation)

1. **Why Sentinel-1?**
   - It's radar, so it sees through monsoon cloud.
   - Mangrove canopy gives distinctive VH volume scattering.
   - It's free, 10 m, with regular revisit. It's also the foundation study's sensor.
2. **Why not Sentinel-2?**
   - Clouds break optical time series on these coasts.
   - We did test it: on Kerala, S2 (IoU 0.054) and fusion (0.053) beat S1 (0.023). All three are weak.
   - The reported model stays S1 to follow the foundation design. S2 fusion is an ablation and future work.
3. **Why SAR in mangrove environments?**
   - Cloud-independence, sensitivity to canopy structure and moisture, and consistent multi-date acquisition.
   - The temporal median also stabilises speckle.
4. **Why EfficientNet-B7?**
   - The foundation study used it (UNB7) and reported 95.56 % OA on their data.
   - We haven't trained B7. We trained B0 with the identical pipeline because of our 16 GB laptop.
5. **Why U-Net?**
   - Skip connections give precise boundaries.
   - It's the standard for remote-sensing segmentation and works with limited labels.
6. **Why weak supervision?**
   - No field-labelled mangrove dataset exists for these AOIs.
   - GMW is the best open reference, and the foundation study also used weak labels.
7. **What is the source of your labels?** Global Mangrove Watch v3.0, 2020, Zenodo 6894273, CC-BY-4.0.
8. **Are your labels ground truth?**
   - No. They're weak reference labels.
   - Our metrics are agreement with GMW, not field accuracy.
9. **How did you validate the segmentation?**
   - Held-out test tiles from a spatial-block split, evaluated against GMW with IoU, Dice, P, R, κ, confusion matrix
     and per-tile results.
   - No field validation.
10. **What is your IoU?**
    - 0.842 on the pooled development test split (200 tiles, 4 areas), against GMW.
    - Driven by Sundarbans; Kerala is near zero.
11. **What is your F1?** 0.914 at threshold 0.5, and 0.933 at the calibrated 0.70 (224-tile sweep).
12. **How did you choose the threshold?**
    - A sweep from 0.30 to 0.70 on held-out test tiles, picking the one that maximises F1. That gave 0.70.
    - Caveat: it's the edge of the range. Scenario F shows how patches change with threshold.
13. **Why 2 hectares?**
    - It's the paper's minimum mapping unit, used to suppress sub-pixel-scale noise fragments.
    - It's a design parameter, and it's configurable.
14. **Why 5 km?**
    - A stand-in for dispersal distance, taken from the paper's design. It isn't species-calibrated.
    - We test 3 and 8 km on every run. Kerala's ranking correlation is 0.96 and 0.97 against 5 km (stable). In
      Odisha it's 0.69 and 0.76 (less stable).
15. **Why is a smaller patch sometimes more important?**
    - Connectivity depends on position. A small cut-vertex patch is the only path between two groups.
    - Example: P17 is 3.1 ha, but removing it splits the network (2 → 3 components) and costs 27 % of IIC.
16. **How do you calculate criticality mathematically?**
    - Sᵢ = (C(G) − C(G − vᵢ)) / C(G), with C = IIC = ΣΣ aᵢaⱼ/(1 + nlᵢⱼ) / A_L².
    - It's exact leave-one-out.
17. **Why is graph theory necessary?**
    - Connectivity is a property of relationships, not of individual pixels.
    - Graphs give reachability, shortest paths, components and cut vertices, which make "importance" computable.
18. **What happens if a patch is removed?**
    - Its node and edges are deleted and IIC is recomputed.
    - We report the loss, the severed links, newly isolated patches and the component change.
19. **How do you identify a bridge patch?**
    - Remove it and count connected components. If the count increases, it's a cut vertex (`is_cut_vertex`).
20. **How do you rank restoration candidates?**
    - By the IIC gain when each is inserted as a node linked to its 3 nearest within τ.
    - By gain/cost only if real costs are uploaded.
21. **Where do restoration costs come from?**
    - We have none. Ranking is by connectivity gain because validated cost data isn't available.
    - The paper's INR figures were indicative, on synthetic data.
22. **Is this a real deployed government system?**
    - No. It's a working prototype with demo users and role-based workflows.
    - There's a deployment configuration for Render and Vercel, but no departmental deployment and no real users.
23. **What part is AI?** The U-Net segmentation: a deep learning model that outputs a mangrove probability per pixel.
24. **What part is GIS?**
    - Acquisition, reprojection, raster alignment, tiling, and vectorising components into patches.
    - Distances, the map UI, GeoJSON outputs.
25. **What part is graph theory?**
    - Graph construction, IIC/PC reachability, leave-one-out criticality, cut vertices, what-if, and restoration by
      node insertion.
26. **What part is explainable AI?**
    - The rule-based explanation of each graph ranking, built from computed evidence.
    - Not SHAP or Grad-CAM.
27. **What is actually implemented?**
    - The full chain from acquisition to UI, on real data for 4 areas with a B0 development model.
    - Exact graph analytics, scenarios, restoration, backend, DB and workflow.
28. **What is still future work?**
    - UNB7 training, field validation, species τ, costs, S1/S2 fusion as a final model.
    - A reliable time series, uncertainty maps, a production deployment.
29. **What are the limitations?**
    - Dev model; weak labels; Sundarbans-driven accuracy; over-prediction; τ and threshold assumptions.
    - Noisy change detection; no costs; no field data.
30. **How would this scale to all of India?**
    - Acquisition is AOI-driven and GMW is national.
    - Batch AOIs with `run_all_areas.py`, use windowed inference on a GPU, and partition graphs by component.
    - Leave-one-out is O(n³) for IIC, so parallelise it.
31. **How would you deploy it in a forest department?**
    - Postgres/PostGIS, authentication on every endpoint, and a GPU inference worker.
    - A scheduled acquisition job, SSO for department accounts, field-app evidence capture (the workflow already
      exists).
32. **How would you update satellite data?**
    - Re-run `acquire_study_area.py` for a new date range; it's credential-free via STAC.
    - Then run predict and graph analysis. Each run is versioned in `analysis_versions`.
33. **How would you handle cloud cover?**
    - The model input is SAR, so clouds don't matter for it.
    - S2 uses scene filtering plus SCL pixel masking and a median.
34. **How would you prevent false positives?**
    - Calibrate the threshold (done), use the MMU filter (done), and tune pos_weight for the area mix.
    - Train UNB7 and add S2 fusion. Field-verify flagged patches: the detection status chain requires accepted
      evidence before CONFIRMED.
35. **How would field officers verify predictions?**
    - Assign a field task from an alert, patch or candidate.
    - The officer uploads GPS plus photo evidence, and a senior officer accepts or rejects it.
    - The detection moves to FIELD_VERIFIED or CONFIRMED only with accepted evidence.
36. **Why should someone trust the system?**
    - Every number is traceable to a file and labelled by provenance.
    - Rankings are exact and explained, and the parameters are visible and testable.
    - It says what it hasn't assessed. It supports decisions; it doesn't make them.
37. **What happens if the model is wrong?**
    - Wrong patches mean a wrong graph, and rankings inherit the errors. That's why results are labelled
      development.
    - Low-confidence patches (< 60 %) raise alerts.
    - Field verification is required before confirmation.
38. **What is your research novelty?**
    - Integrating SAR segmentation with an exact patch-graph criticality, what-if and restoration analysis.
    - Rule-based explanations and strict provenance labelling, all in one interactive tool.
    - Don't say "first".
39. **How is this different from a normal GIS?**
    - A GIS stores and displays layers.
    - We compute the network role of each patch, simulate interventions and explain rankings.
40. **How is this different from Global Mangrove Watch?**
    - GMW is a map, and we use it as our label.
    - We add patch-level connectivity analysis, criticality, scenarios and restoration ranking.
41. **How is this different from a normal segmentation model?**
    - Segmentation stops at the mask.
    - We turn the mask into a graph and answer decision questions on it.
42. **What is the biggest limitation?**
    - Segmentation quality on thin fringes (Kerala and Gulf of Mannar are near zero IoU).
    - Everything downstream depends on it.
43. **What would you improve with six more months?**
    - UNB7 on a GPU with balanced sampling, and per-area reporting.
    - Field validation, species-calibrated τ, cost data, multi-year time series.
44. **What would you do if your model accuracy falls?**
    - Check per-area and per-tile metrics and the threshold calibration.
    - Look for label and scene mismatches.
    - Retrain with more local tiles or S2 fusion. Downstream runs record their model, so affected analyses can be
      re-run.
45. **What happens when habitat changes over time?**
    - Run the pipeline on a new year's composite and compare runs (Scenario G, timeline).
    - The same model and threshold are needed for a fair comparison. Alerts fire on ≥ 5 % area or ≥ 10 % IIC change.

---

## Part 3 — 20 quick "if they ask X → say Y"

| If they ask… | Say… |
|---|---|
| What is it, in one line? | A satellite-to-graph decision-support system that finds which mangrove patches hold coastal habitat networks together. |
| What's your accuracy? | Test IoU 0.84 and F1 0.91 against Global Mangrove Watch on our pooled development split. It's driven by Sundarbans and weak on thin fringes. 95.56 % is the foundation study's result. |
| Which model? | U-Net with an EfficientNet-B0 encoder. UNB7 (B7) is configured but not yet trained. |
| Input? | Sentinel-1 VV and VH, in dB, as 2020 temporal medians at 10 m. |
| Labels? | Global Mangrove Watch v3 2020: weak labels, not ground truth. |
| Dataset size? | 1,373 tiles of 256² across 4 areas. The run used 800 train, 195 val and 200 test. |
| Threshold? | Calibrated by an F1 sweep: 0.70 for the 4-area model. |
| Why 5 km? | It's an assumed dispersal distance. We test 3 and 8 km on every run, and Kerala's ranking is stable (ρ 0.96 and 0.97). |
| How is criticality computed? | Remove the patch, recompute IIC, and S = ΔC / C(G). It's exact leave-one-out. |
| Example? | P17: 3.1 ha, 17th by size, but 3rd by criticality, with −27 % IIC. It's a cut vertex that splits 2 components into 3. |
| What's a bridge patch? | A cut vertex: removing it increases the number of connected components. |
| What-if? | Remove, restore, or change τ or the threshold; the graph is rebuilt and recomputed exactly. It's labelled simulated, not a forecast. |
| Explainable AI? | Rule-based explanations from computed evidence. No SHAP or Grad-CAM. |
| Restoration? | Insert the candidate, recompute, rank by IIC gain. No costs, because no validated cost data exists. |
| Backend / database? | FastAPI with SQLite (15 tables) and JWT with 6 roles. Rasters stay on disk. |
| Frontend? | Next.js, React, Leaflet, React Flow, Recharts. |
| Is it deployed? | No departmental deployment. It's a working prototype with demo users. |
| Change detection? | We compare pipeline runs across years. It's model output, and for Kerala it's not reliable enough to claim real loss. |
| Biggest limitation? | Segmentation on thin fringes, plus weak labels. That's why UNB7 on a GPU and field validation come next. |
| Novelty? | An integrated, exact and explained chain from radar to patch-graph criticality, scenarios and restoration, with every number provenance-labelled. |
