# -*- coding: utf-8 -*-
"""Scene list for the EcoConnectAI technical walkthrough video.

Every number here was read from the repository on 2026-09-25 (outputs/, data/, configs/, code).
kind: "slide" (HTML body) | "screen" (app screenshot + annotation side panel) | "image" (repo artefact image)
"""
SHOTS = "/private/tmp/claude-501/-Users-kuldeepraj-Major-Project-EconnectAI/f1c6a345-205b-4a98-a2aa-d3d68866068a/scratchpad/shots"
REPO = "/Users/kuldeepraj/Major-Project-EconnectAI"

def chips(*items):
    return "".join(f'<span class="chip {c}">{t}</span>' for t, c in items)

LABELS = chips(("PUBLISHED BASELINE — NOT OUR RESULT", "grey"), ("PROTOTYPE / SYNTHETIC", "amber"),
               ("DEVELOPMENT-SUBSET — NOT FINAL", "blue"), ("NOT YET RUN", "red"))

SCENES = []
def add(section, title, kind, body, narration, **kw):
    SCENES.append(dict(section=section, title=title, kind=kind, body=body, narration=" ".join(narration.split()), **kw))

# ---------------------------------------------------------------- 1. INTRODUCTION
add("Introduction", "EcoConnectAI — technical walkthrough", "title", f"""
<div class="kicker">Final-year CSE major project · MESA evaluation preparation</div>
<h1 class="big">EcoConnectAI</h1>
<h2 class="sub">A Satellite-Driven Framework for Coastal Ecosystem Connectivity<br>and Conservation Decision Support</h2>
<p class="muted" style="margin-top:40px">Technical walkthrough of the <b>current repository</b> — audited 25 Sept 2026 (commit 6444dcb)</p>
""", """
This is a technical walkthrough of EcoConnectAI, as it exists in the repository today.
It is not a marketing video. Every number you will see was read from the project's own output files, configuration and code.
Where something exists only in the research paper, or only as a plan, I will say so clearly.
The aim is simple: after watching this, you should be able to explain every stage of the system to the panel, and defend it honestly.
""")

add("Introduction", "How to read every number in this project", "slide", f"""
<p class="lead">Every result in the repository carries one of these labels. Keep them separate in the viva.</p>
<table class="t">
<tr><th>Label</th><th>Meaning</th><th>Example</th></tr>
<tr><td><span class="chip grey">PUBLISHED BASELINE — NOT OUR RESULT</span></td><td>Numbers from the foundation paper (Ghorbanian et al., IEEE JSTARS 2025)</td><td>UNB7 overall accuracy 95.56 %, κ 0.94</td></tr>
<tr><td><span class="chip amber">PROTOTYPE / SYNTHETIC</span></td><td>Exact maths over the old prototype's generated geometry</td><td>Paper Tables VI–VIII, patch "P16"</td></tr>
<tr><td><span class="chip blue">DEVELOPMENT-SUBSET — NOT FINAL</span></td><td>Real satellite data, real training, small EfficientNet-B0 model</td><td>Everything the app shows today</td></tr>
<tr><td><span class="chip red">NOT YET RUN</span></td><td>Implemented in code, never executed</td><td>UNB7 (EfficientNet-B7) training on a GPU</td></tr>
</table>
<p class="note">Source: docs/RESULTS_PROVENANCE.md · ecoconnect/ml/training/trainer.py (RESULT_LABEL) · every manifest.json</p>
""", """
Before any result, one rule. The project uses four provenance labels, and the panel will test whether you mix them up.
First, published baseline. The ninety five point five six percent overall accuracy comes from the foundation study by Ghorbanian and colleagues. It is their result, on their data. It is not ours.
Second, prototype or synthetic. The paper's Tables six to eight, including the famous patch P16, were computed on synthetic geometry from the early prototype.
Third, development subset, not final. This is real Sentinel-1 data, real training, and a small EfficientNet-B0 model. Everything the application shows today is in this class.
Fourth, not yet run. The full UNB7 model with an EfficientNet-B7 encoder is implemented in code, but it has never been trained.
""")

add("Introduction", "Problem and motivation", "slide", """
<div class="two">
<div><h3>The gap</h3><ul>
<li>Mangrove maps (e.g. Global Mangrove Watch) say <b>where</b> habitat is.</li>
<li>They do not say <b>which patches hold the network together</b>.</li>
<li>Area alone is a poor proxy: a small patch can be the only link between two regions.</li>
<li>Managers need to compare interventions: <i>what if this patch is lost? what if that site is restored?</i></li>
</ul></div>
<div><h3>What EcoConnectAI does</h3><ul>
<li>Segments mangrove from Sentinel-1 radar</li>
<li>Turns the mask into habitat <b>patches</b></li>
<li>Builds a patch <b>connectivity graph</b></li>
<li>Ranks patches by <b>exact connectivity loss on removal</b></li>
<li>Runs <b>what-if</b> scenarios, <b>explains</b> rankings, ranks <b>restoration</b> candidates</li>
</ul></div></div>
""", """
The problem. Existing mangrove maps, such as Global Mangrove Watch, tell you where habitat is. They do not tell you which patches hold the landscape together.
Area is a poor proxy for importance. A small patch can be the only stepping stone between two larger regions. If it is lost, the network splits.
Conservation managers therefore need to ask what-if questions. What if this patch disappears? What if we restore that site?
EcoConnectAI answers these questions quantitatively. It segments mangrove from Sentinel-1 radar, converts the mask into patches, builds a connectivity graph, ranks patches by the exact connectivity loss when each one is removed, runs scenarios, explains every ranking, and ranks restoration candidates.
""")

# ---------------------------------------------------------------- 2. ARCHITECTURE
ARCH = [
 ("Satellite data", "Sentinel-1 RTC (Planetary Computer) · Sentinel-2 L2A (Earth Search)", "ecoconnect/gee/stac_acquire.py"),
 ("Acquisition + preprocessing", "temporal median · dB · UTM 10 m · GMW labels", "scripts/acquire_study_area.py · gee/gmw_labels.py"),
 ("Tiling + dataset", "256² tiles · spatial-block split", "scripts/build_tiles.py · ml/datasets/tiles.py"),
 ("Segmentation model", "U-Net + EfficientNet (B0 trained, B7 = UNB7 not run)", "ml/models/unet.py · ml/training/trainer.py"),
 ("Probability map", "sliding window, Hann blending", "ml/inference/predict.py · scripts/predict.py"),
 ("Patch extraction", "threshold → 8-connected components → MMU 2 ha", "geospatial/patch_extraction/extract.py"),
 ("Connectivity graph", "k = 3 nearest, d ≤ τ = 5 km", "graph/construction.py"),
 ("Connectivity metric", "IIC (headline) · PC · ECA", "graph/connectivity.py"),
 ("Criticality", "exact leave-one-out ΔC, S", "graph/criticality.py"),
 ("What-if scenarios", "remove / restore / τ / threshold / periods", "graph/what_if.py · backend/scenarios.py"),
 ("Explainability", "rule-based text from computed evidence", "graph/explain.py"),
 ("Restoration ranking", "R = C(G+v) − C(G); cost optional", "graph/restoration.py"),
 ("Decision-support UI", "FastAPI + SQLite · Next.js + Leaflet + React Flow", "backend/ · frontend/app/"),
]
arch_rows = "".join(f'<div class="arow"><div class="abox">{a}</div><div class="adesc">{b}</div><div class="apath">{c}</div></div>' for a, b, c in ARCH)
add("Architecture", "System architecture → repository", "slide", f"""
<div class="arch">{arch_rows}</div>
<p class="note">Orchestration: ecoconnect/pipeline/analysis.py · scripts/run_graph_analysis.py · scripts/run_all_areas.py · run artefacts in outputs/runs/&lt;area&gt;/&lt;run_id&gt;/</p>
""", """
Here is the complete architecture, with each block mapped to the actual file in the repository.
Satellite data is fetched without credentials from public STAC catalogues, in stac acquire dot py.
Scenes are composited, converted to decibels, reprojected to a ten metre UTM grid, and aligned with Global Mangrove Watch labels.
The scene is cut into two hundred and fifty six pixel tiles with a spatial block split.
A U-Net with an EfficientNet encoder segments mangrove. The trained encoder is B0. The B7 version, which is UNB7, is configured but not yet trained.
Inference produces a probability map. Thresholding and connected components give patches. Patches become nodes of a graph. The graph gives a connectivity index, and removing each node gives criticality.
The same graph powers what-if scenarios, rule-based explanations and restoration ranking.
Finally, a FastAPI backend with a SQLite database serves everything to a Next J S interface.
The Python package is called ecoconnect, and each run writes its artefacts to outputs slash runs.
""")

add("Architecture", "Technology stack (verified from code)", "slide", """
<table class="t">
<tr><th>Layer</th><th>Actual technology</th><th>Where</th></tr>
<tr><td>Frontend</td><td>Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn UI</td><td>frontend/package.json</td></tr>
<tr><td>GIS map</td><td>Leaflet 1.9 + react-leaflet 5; Esri imagery basemap; Sentinel quicklooks from our rasters</td><td>frontend/components/maps/</td></tr>
<tr><td>Graph view / charts</td><td>React Flow 11 · Recharts 3</td><td>frontend/components/graph/, charts/</td></tr>
<tr><td>Backend</td><td>FastAPI + Uvicorn, SQLAlchemy 2, JWT (PyJWT) + bcrypt, 6 roles</td><td>backend/</td></tr>
<tr><td>Database</td><td>SQLite (outputs/ecoconnect.db), 15 tables; rasters stay on disk</td><td>backend/db.py</td></tr>
<tr><td>ML</td><td>PyTorch 2.13 + segmentation_models_pytorch (smp.Unet)</td><td>ecoconnect/ml/</td></tr>
<tr><td>Raster / GIS</td><td>rasterio, pyproj, shapely, scipy.ndimage, pystac-client, planetary-computer</td><td>ecoconnect/geospatial/, gee/</td></tr>
<tr><td>Graph maths</td><td><b>Own pure-Python implementation</b> — no NetworkX</td><td>ecoconnect/graph/</td></tr>
<tr><td>Tests</td><td>pytest — 44 tests pass (graph maths, patches, ML plumbing, API, workflow)</td><td>tests/</td></tr>
</table>
""", """
The technology stack, verified from the code.
The frontend is Next J S sixteen with React nineteen and TypeScript. Maps use Leaflet. The graph view uses React Flow, and charts use Recharts.
The backend is Fast A P I, with SQLAlchemy over a SQLite database, and J W T authentication with six roles.
The machine learning uses PyTorch and the segmentation models pytorch library.
Raster work uses rasterio, pyproj, shapely and scipy.
One important detail: the graph mathematics is our own pure Python implementation. There is no NetworkX. That makes every formula traceable to a few lines of code.
Forty four automated tests pass, covering the graph maths, patch extraction, the machine learning plumbing and the API.
""")

# ---------------------------------------------------------------- 3. DATA
add("Data", "Actual data sources", "slide", """
<table class="t">
<tr><th>Data source</th><th>Purpose</th><th>Format</th><th>Resolution</th><th>Used for</th></tr>
<tr><td><b>Sentinel-1 RTC</b> (γ⁰, from IW GRDH) — Microsoft Planetary Computer</td><td>Model input</td><td>GeoTIFF bands s1_vv_db, s1_vh_db</td><td>10 m</td><td><b>Reported model (E1)</b>, S1 basemap</td></tr>
<tr><td><b>Sentinel-2 L2A</b> — Element84 Earth Search (AWS)</td><td>Ancillary / ablation</td><td>6 bands + NDVI + NDWI</td><td>10 m (B11/B12 resampled)</td><td>E2/E3 ablations, RGB/NDVI basemaps, NDWI feasibility rule</td></tr>
<tr><td><b>Global Mangrove Watch v3.0, 2020</b> — Zenodo 6894273, CC-BY-4.0</td><td>Weak labels</td><td>Binary GeoTIFF, aligned to scene</td><td>resampled to 10 m grid</td><td>Training + agreement metrics</td></tr>
<tr><td>configs/study_areas.yaml</td><td>AOI metadata</td><td>YAML (bbox, name, protection)</td><td>—</td><td>Acquisition extent, UI</td></tr>
<tr><td>patches.geojson / graph.json / criticality.csv …</td><td>Analysis outputs</td><td>GeoJSON, JSON, CSV</td><td>WGS84 vectors</td><td>UI, reports, scenarios</td></tr>
</table>
<p class="note">No Kaggle dataset, no Landsat, no field-survey data, no Google Earth Engine run (GEE code path exists but is optional and unused).</p>
""", """
Now, exactly where the data comes from.
Sentinel-1 is the model input. We use the radiometrically terrain corrected gamma nought product, derived from interferometric wide swath G R D scenes, served by Microsoft Planetary Computer without any account.
Sentinel-2 level 2 A comes from Element eighty four Earth Search on AWS. It is ancillary. It is used for two ablation models, for the true colour and N D V I basemaps, and for one feasibility rule in restoration.
Labels come from Global Mangrove Watch version three, year twenty twenty, downloaded from Zenodo.
Study area boundaries come from a YAML configuration. Analysis outputs are GeoJSON, JSON and CSV files.
Be clear on what is not used. There is no Kaggle dataset, no Landsat, no field survey, and no Google Earth Engine run. An Earth Engine code path exists, but it is optional and was not used.
""")

add("Data", "Sentinel-1 — the model input", "slide", """
<div class="two"><div>
<table class="t small">
<tr><th>Question</th><th>Actual implementation</th></tr>
<tr><td>Product</td><td>sentinel-1-rtc (IW, GRDH, dual-pol 1SDV source scenes)</td></tr>
<tr><td>Polarisations</td><td>VV and VH → 10·log10 → dB. <b>No VV/VH ratio band</b></td></tr>
<tr><td>Terrain correction</td><td>Yes — done by the provider (RTC γ⁰)</td></tr>
<tr><td>Speckle</td><td>No spatial filter; per-pixel <b>temporal median</b> of the year's scenes</td></tr>
<tr><td>Dates (2020)</td><td>Kerala 6 desc. (Jan–Oct) · Sundarbans 4 mixed · Gulf 4 desc. · Odisha 4 asc.</td></tr>
<tr><td>Grid</td><td>Reprojected to local UTM, 10 m, snapped grid</td></tr>
<tr><td>Normalisation</td><td>1–99 % clip, z-score; stats from <b>training tiles only</b></td></tr>
</table></div>
<div><h3>Proof it is S1-only</h3>
<pre class="code">configs/dataset.yaml
  bands: [0, 1]        # E1 S1 VV/VH only  &lt;- default

outputs/segmentation/multi_E1_s1_b0_dev/experiment.json
  "in_channels": 2,
  "bands": [0, 1]      # s1_vv_db, s1_vh_db</pre>
<p>Why SAR: radar sees through the cloud cover that dominates monsoon coasts, and mangrove canopy has a distinctive VH (volume) scattering.</p>
</div></div>
""", """
Sentinel-1 details, because the panel will ask.
The collection is sentinel one R T C. The source scenes are interferometric wide swath, G R D high resolution, dual polarisation.
We use V V and V H, converted to decibels. There is no V V over V H ratio band.
Terrain correction is done by the provider, which is what R T C means.
There is no explicit spatial speckle filter. Instead, we take a per-pixel temporal median over the year's scenes, which reduces speckle. Kerala uses six descending passes from January to October twenty twenty. The other areas use four scenes each.
Everything is reprojected to local UTM at ten metres. Normalisation is a one to ninety nine percentile clip followed by a z-score, with statistics computed only on training tiles.
And the proof that the reported model is Sentinel-1 only: the dataset configuration selects bands zero and one, and the experiment file records two input channels.
Why radar? Monsoon coasts are cloudy, and radar sees through cloud. Mangrove canopy also gives a distinctive V H volume scattering signal.
""")

add("Data", "Sentinel-2 — ancillary, not the reported model", "slide", """
<table class="t">
<tr><th>Question</th><th>Actual implementation</th></tr>
<tr><td>Bands</td><td>B02 blue, B03 green, B04 red, B08 NIR, B11 SWIR1.6, B12 SWIR2.2 + NDVI + NDWI (computed)</td></tr>
<tr><td>Cloud masking</td><td>Scene filter ≤ 40 % cloud, then per-pixel SCL mask (nodata, saturated, dark, shadow, cloud medium/high, cirrus, snow)</td></tr>
<tr><td>Temporal selection</td><td>Least-cloudy scenes of 2020, per MGRS granule with AOI-overlap filter; per-pixel median</td></tr>
<tr><td>Resolution</td><td>10 m grid (20 m SWIR bands resampled)</td></tr>
<tr><td>Where it is used</td><td>E2 (S2-only) and E3 (S1+S2 early fusion) <b>ablations</b>; RGB/NDVI basemaps; NDWI rule in restoration feasibility</td></tr>
<tr><td>Where it is <b>not</b> used</td><td>The reported model and every analysis run on screen (S1 VV/VH only)</td></tr>
</table>
<p class="note">configs/acquisition.yaml · ecoconnect/gee/stac_acquire.py (sentinel2_composite) · configs/dataset_s2.yaml, dataset_s1s2.yaml</p>
""", """
Sentinel-2 is ancillary, and you should never say it is part of the reported model's input.
We take six bands: blue, green, red, near infrared and two short wave infrared bands, and we compute N D V I and N D W I.
Clouds are handled twice. Scenes above forty percent cloud are rejected, and then every pixel is masked with the scene classification layer.
The least cloudy twenty twenty scenes are combined with a per-pixel median on the same ten metre grid.
Sentinel-2 is used in the E 2 and E 3 ablation experiments, in the basemaps, and in the restoration feasibility rules. It is not used by the model behind the analysis runs you will see.
""")

add("Data", "Labels — Global Mangrove Watch as weak supervision", "slide", """
<div class="two"><div>
<table class="t">
<tr><th>Study area</th><th>GMW 2020 mangrove</th><th>% of AOI</th></tr>
<tr><td>Kerala — Vembanad–Kol</td><td>102.1 ha</td><td>0.21 %</td></tr>
<tr><td>Sundarbans — W. delta block</td><td>58 903 ha</td><td>55.9 %</td></tr>
<tr><td>Gulf of Mannar</td><td>44.0 ha</td><td>0.03 %</td></tr>
<tr><td>Odisha — Bhitarkanika</td><td>10 793 ha</td><td>16.2 %</td></tr>
</table>
<p class="note">data/labels/&lt;area&gt;/gmw_2020.{tif,json} — computed from the aligned label rasters</p>
</div><div>
<div class="callout"><b>Say it exactly like this:</b><br>"These are reference, weak labels from an existing published map. They are used for training and comparison. They are <u>not</u> field-survey ground truth, so every accuracy number is <i>agreement with GMW</i>."</div>
<p>Binary task: mangrove vs non-mangrove (num_classes = 1, sigmoid).</p>
<p class="warn">Paper discrepancy: the paper names Forest Survey of India / wetland inventory labels and ≈14 000 tiles of 512². The code uses GMW and 256² tiles.</p>
</div></div>
""", """
Labels. The project trains against Global Mangrove Watch version three, twenty twenty. This is weak supervision: an existing published map, used as a reference.
Say it exactly like this in the viva. These are reference, weak labels. They are not field survey ground truth. So every accuracy figure is agreement with Global Mangrove Watch, not true accuracy.
Look at how different the four landscapes are. Kerala has only one hundred and two hectares of mangrove, about zero point two percent of the area. Gulf of Mannar has forty four hectares. Sundarbans has nearly fifty nine thousand hectares, more than half the area. Odisha has about ten thousand eight hundred.
The task is binary: mangrove versus non-mangrove.
And note a paper discrepancy. The paper mentions Forest Survey of India labels and about fourteen thousand tiles. The implementation uses Global Mangrove Watch and far fewer tiles.
""")

add("Data", "Dataset construction — tiles and splits", "slide", """
<table class="t">
<tr><th>Area (2020 scene)</th><th>Tiles written</th><th>With mangrove</th><th>Train / val / test</th><th>Mangrove px in train</th></tr>
<tr><td>Kerala</td><td>256</td><td>81</td><td>176 / 32 / 48</td><td>0.19 %</td></tr>
<tr><td>Sundarbans</td><td>575</td><td>543</td><td>387 / 92 / 96</td><td>64.5 %</td></tr>
<tr><td>Gulf of Mannar</td><td>200 (625 empty tiles dropped)</td><td>50</td><td>139 / 25 / 36</td><td>0.12 %</td></tr>
<tr><td>Odisha</td><td>342</td><td>225</td><td>252 / 46 / 44</td><td>20.6 %</td></tr>
<tr><td><b>Total</b></td><td><b>1 373</b></td><td><b>899</b></td><td><b>954 / 195 / 224</b></td><td></td></tr>
</table>
<ul class="compact">
<li>Tiles 256 × 256 px (2.56 km), stride 128; nodata → ignore index 255</li>
<li><b>Spatial-block split</b>: blocks of 4 × 4 tiles assigned 70/15/15 (seed 42) — limits leakage between overlapping neighbours</li>
<li>Development mode caps the subset deterministically: <b>800 train / 195 val / 200 test</b> tiles were actually used</li>
<li>Augmentation (train only): horizontal flip, vertical flip, 90° rotation, p = 0.5</li>
</ul>
<p class="note">logs/phase2_all_areas.log · configs/dataset.yaml · ecoconnect/geospatial/preprocessing/tiling.py · ml/datasets/tiles.py</p>
""", """
How the training dataset was built.
Each scene is cut into tiles of two hundred and fifty six by two hundred and fifty six pixels, which is two point five six kilometres, with a stride of one hundred and twenty eight.
Across the four landscapes, one thousand three hundred and seventy three tiles were written. Eight hundred and ninety nine contain mangrove.
The split is spatial. Blocks of four by four tiles are assigned together to train, validation or test, seventy, fifteen and fifteen percent, with seed forty two. This matters, because overlapping neighbouring tiles would otherwise leak between train and test.
Development mode caps the subset, so the actual run used eight hundred training tiles, one hundred and ninety five validation tiles and two hundred test tiles.
Augmentation is only flips and ninety degree rotations, on the training split only.
Notice the imbalance: Sundarbans is sixty four percent mangrove, while Kerala and Gulf of Mannar are about zero point one to zero point two percent.
""")

# ---------------------------------------------------------------- 4. MODEL
add("Model", "The segmentation model — U-Net + EfficientNet", "slide", """
<div class="unet">
 <div class="ucol"><div class="ub in">Input tile<br>2 × 256 × 256<br><small>VV dB, VH dB (z-scored)</small></div></div>
 <div class="ucol"><div class="ub enc">Encoder<br>EfficientNet<br><small>ImageNet-pretrained · downsamples 256→8</small></div><div class="ulab">feature extraction</div></div>
 <div class="ucol"><div class="ub bot">Bottleneck<br><small>deepest, most abstract features</small></div></div>
 <div class="ucol"><div class="ub dec">U-Net decoder<br><small>upsamples 8→256<br>channels 256/128/64/32/16</small></div><div class="ulab">+ skip connections from each encoder stage</div></div>
 <div class="ucol"><div class="ub out">Logit → sigmoid<br>P(mangrove) per pixel</div></div>
 <div class="ucol"><div class="ub mask">Threshold<br>→ binary mask</div></div>
</div>
<div class="two" style="margin-top:26px"><div>
<p><b>UNB7</b> = U-Net decoder + EfficientNet-<b>B7</b> encoder (foundation study).</p>
<p><b>What we trained</b> = the same U-Net with EfficientNet-<b>B0</b> (6.25 M parameters) — a resource-driven choice on a 16 GB Apple M3 laptop.</p>
</div><div>
<p>Transfer learning: ImageNet-pretrained encoder, first conv adapted to 2 channels by smp, <b>full fine-tuning</b> (nothing frozen).</p>
<p>Why encoder–decoder: the encoder learns <i>what</i> is in the tile; skip connections restore <i>where</i>, which keeps thin 1–3-pixel mangrove fringes.</p>
</div></div>
""", """
Now the model. The architecture is a U-Net decoder on an EfficientNet encoder.
The input is a two channel tile: V V and V H in decibels, normalised.
The encoder, EfficientNet, is pretrained on ImageNet. It repeatedly downsamples the tile, from two hundred and fifty six pixels to eight, learning what is in the image.
At the bottom is the bottleneck, the most abstract representation.
The U-Net decoder upsamples back to full resolution. Skip connections copy features from each encoder stage into the decoder, which restores where things are. That is essential for thin mangrove fringes that are only one to three pixels wide.
The output is one logit per pixel. A sigmoid turns it into the probability of mangrove, and a threshold turns probability into a binary mask.
Now the honest part. UNB7 means this U-Net with an EfficientNet B7 encoder. That is the foundation study's model. What we actually trained is the same U-Net with an EfficientNet B0 encoder, six point two five million parameters, because it fits a sixteen gigabyte laptop. The encoder is pretrained, the first convolution is adapted to two channels, and the whole network is fine tuned. Nothing is frozen.
""")

add("Model", "Code: where the model is instantiated", "code", """
<div class="codehead">ecoconnect/ml/models/unet.py</div>
<pre class="code big">ENCODER_ALIASES = {
    "unb7": "efficientnet-b7",          # PRIMARY — the paper's UNB7   (configs/train_full.yaml)
    "unb0": "efficientnet-b0",          # DEV — what was actually trained (configs/train_dev.yaml)
    "swin-t": "tu-swin_tiny_patch4_window7_224",   # recorded alternative, not trained
}

def build_model(encoder, in_channels, num_classes, *, encoder_weights="imagenet",
                decoder_channels=(256, 128, 64, 32, 16)):
    enc = ENCODER_ALIASES.get(encoder, encoder)
    model = smp.Unet(encoder_name=enc, encoder_weights=encoder_weights,
                     in_channels=in_channels, classes=num_classes,
                     decoder_channels=decoder_channels)
    model.eco_meta = {..., "paper_name": "UNB7" if enc == "efficientnet-b7"
                                  else f"U-Net/{enc} (dev or alt config)"}
    return model</pre>
<p class="note">Every checkpoint records eco_meta, so a B0 model can never be reported as "UNB7". The trained checkpoints all say "U-Net/efficientnet-b0 (dev or alt config)".</p>
""", """
Here is the code that proves it. build model in unet dot py calls smp dot Unet with an encoder name.
The alias U N B 7 maps to efficientnet b7, and that is what the full training configuration uses. The development configuration uses efficientnet b0.
The function also stamps metadata into every checkpoint. If the encoder is B7, the paper name is UNB7. Otherwise it is recorded as a development configuration. Every trained checkpoint in the repository is labelled U-Net efficientnet b0. So the code itself prevents us from calling our model UNB7.
""")

add("Model", "Training pipeline (actual configuration)", "slide", """
<div class="two"><div>
<table class="t small">
<tr><th>Setting</th><th>Value (multi_E1_s1_b0_dev)</th></tr>
<tr><td>Config</td><td>configs/train_dev.yaml + dataset.yaml</td></tr>
<tr><td>Optimiser</td><td>AdamW, lr 3e-4, weight decay 1e-4</td></tr>
<tr><td>Scheduler</td><td>Cosine annealing over 40 epochs (to 1 % of lr)</td></tr>
<tr><td>Loss</td><td>BCE (pos_weight 25) + Dice; ignore index 255</td></tr>
<tr><td>Batch size</td><td>8</td></tr>
<tr><td>Epochs</td><td>40 run, best epoch 32 (by val IoU)</td></tr>
<tr><td>Early stopping</td><td>patience 12 on val IoU — not triggered</td></tr>
<tr><td>Other</td><td>grad clip 1.0, seed 42, AMP only on CUDA (off)</td></tr>
<tr><td>Hardware</td><td>Apple M3 16 GB, PyTorch MPS</td></tr>
<tr><td>Time</td><td>1 777 s ≈ 30 min</td></tr>
<tr><td>Checkpoints</td><td>best_model.pth (best val IoU), last_model.pth</td></tr>
</table></div><div>
<h3>Why these choices</h3><ul class="compact">
<li><b>Dice</b> term: optimises overlap directly — robust when mangrove is rare</li>
<li><b>pos_weight 25</b>: chosen for Kerala's 0.2 % positives; on the Sundarbans-heavy mix it pushes toward <b>over-prediction</b> (val recall 0.97, precision 0.78)</li>
<li><b>AdamW + cosine</b>: standard stable fine-tuning of a pretrained encoder</li>
<li><b>Monitor IoU</b>, not accuracy: accuracy is meaningless at 0.2 % positives</li>
</ul>
<p class="note">ecoconnect/ml/training/trainer.py · ml/evaluation/metrics.py (BCEDiceLoss) · outputs/segmentation/multi_E1_s1_b0_dev/{config.yaml, experiment.json, history.csv}</p>
</div></div>
""", """
Training, with the real configuration of the main model, called multi E 1 S 1 B zero dev.
Optimiser AdamW, learning rate three times ten to the minus four, weight decay ten to the minus four, cosine annealing over forty epochs. Batch size eight.
The loss is binary cross entropy plus Dice. The Dice term optimises overlap directly, which is robust when the positive class is rare. The positive class weight is twenty five.
That weight was chosen for Kerala, where only zero point two percent of pixels are mangrove. On the four area mix, which is dominated by Sundarbans, it pushes the model toward over prediction. You can see that in validation: recall zero point nine seven, precision zero point seven eight.
The best checkpoint is selected by validation I O U, not by accuracy, because accuracy is meaningless when positives are rare. Early stopping had patience twelve and was not triggered. All forty epochs ran, and the best epoch was thirty two.
Training ran on an Apple M3 laptop using the M P S backend, in about thirty minutes.
""")

# ---------------------------------------------------------------- 5. EVALUATION
add("Evaluation", "Evaluation — what we measured, and against what", "slide", f"""
<table class="t small">
<tr><th>Model (all EfficientNet-B0, S1 unless noted)</th><th>Train data</th><th>Test tiles</th><th>Test IoU</th><th>Dice / F1</th><th>Precision</th><th>Recall</th><th>κ</th><th>Label</th></tr>
<tr class="hl"><td><b>multi_E1_s1_b0_dev</b> (S1 VV/VH)</td><td>4 areas, 800 tiles</td><td>200</td><td><b>0.842</b></td><td><b>0.914</b></td><td>0.878</td><td>0.954</td><td>0.894</td><td><span class="chip blue">DEV — NOT FINAL</span></td></tr>
<tr><td>kerala_E1_s1_b0_dev (S1)</td><td>Kerala, 176</td><td>48</td><td>0.023</td><td>0.045</td><td>0.033</td><td>0.072</td><td>0.044</td><td><span class="chip blue">DEV</span></td></tr>
<tr><td>kerala_E2_s2_b0_dev (S2 only)</td><td>Kerala, 176</td><td>48</td><td>0.054</td><td>0.102</td><td>0.063</td><td>0.279</td><td>0.101</td><td><span class="chip blue">DEV</span></td></tr>
<tr><td>kerala_E3_s1s2_b0_dev (fusion)</td><td>Kerala, 176</td><td>48</td><td>0.053</td><td>0.101</td><td>0.066</td><td>0.209</td><td>0.100</td><td><span class="chip blue">DEV</span></td></tr>
<tr><td>kerala-coast_development (S1)</td><td>Kerala, 176</td><td>48</td><td>0.031</td><td>0.061</td><td>0.056</td><td>0.066</td><td>0.060</td><td><span class="chip blue">DEV</span></td></tr>
<tr><td>UNB7 — Ghorbanian et al. 2025</td><td colspan="6">their data: OA 95.56 %, κ 0.94, F1 0.95</td><td></td><td><span class="chip grey">PUBLISHED — NOT OURS</span></td></tr>
<tr><td>UNB7 (EfficientNet-B7) — ours</td><td colspan="7">configs/train_full.yaml + notebooks/colab_train_unb7.ipynb exist</td><td><span class="chip red">NOT YET RUN</span></td></tr>
</table>
<p class="note">Metrics are for the mangrove class at threshold 0.5 vs GMW (agreement, not field accuracy) · outputs/segmentation/*/metrics.json · experiments.csv</p>
""", """
Evaluation. This table is the most important one in the viva, so learn its structure.
The main model, trained on all four areas, scores a test I O U of zero point eight four two, Dice or F 1 of zero point nine one four, precision zero point eight seven eight and recall zero point nine five four, on two hundred held-out test tiles. That is our development result, not final.
The Kerala-only models are very weak. Test I O U is between zero point zero two and zero point zero five. Among them, Sentinel-2 alone and fusion did slightly better than Sentinel-1 alone. These are also development results, and they are honest.
The foundation study's ninety five point five six percent is shown separately. It is their result on their data.
And our own UNB7 run is not yet run. The configuration and a Colab notebook exist, but no B7 model has been trained.
All metrics are for the mangrove class, measured against Global Mangrove Watch. They are agreement with a weak label, not field accuracy.
""")

add("Evaluation", "Caveat: the 0.842 IoU is dominated by Sundarbans", "slide", """
<div class="two"><div>
<table class="t">
<tr><th>Test tiles by area</th><th>Tiles</th><th>Tiles with any correctly predicted mangrove</th><th>Mean per-tile IoU</th></tr>
<tr><td>Sundarbans</td><td>86</td><td>76</td><td>0.591</td></tr>
<tr><td>Odisha</td><td>43</td><td>3</td><td>0.026</td></tr>
<tr><td>Gulf of Mannar</td><td>28</td><td>9</td><td>0.022</td></tr>
<tr><td>Kerala</td><td>43</td><td>1</td><td>0.001</td></tr>
</table>
<p class="note">Computed from outputs/segmentation/multi_E1_s1_b0_dev/test_results.csv (200 rows)</p>
</div><div>
<ul>
<li>The headline IoU is <b>pixel-pooled</b> over all 200 test tiles.</li>
<li>Most mangrove pixels are in Sundarbans (55.9 % mangrove), so the pooled score mostly measures Sundarbans.</li>
<li>For thin-fringe landscapes (Kerala, Gulf of Mannar) the model is <b>not reliable</b>.</li>
<li>Also: the 4-area tile set was later overwritten by a Kerala-only rebuild (data/ecoconnect_tiles now 176/32/48). Re-evaluating needs <code>scripts/phase2_all_areas.sh</code> to rebuild tiles.</li>
</ul>
<div class="callout">If asked "what is your IoU?": <b>"0.84 on our pooled development test split, against GMW. It is driven by Sundarbans; on Kerala-type fringes it is near zero. It is not the paper's 95.56 %."</b></div>
</div></div>
""", """
A caveat you must know before the panel finds it.
The zero point eight four I O U is pooled over all test pixels. Most mangrove pixels are in Sundarbans, so the pooled number mostly measures Sundarbans.
Break the test tiles down by area. In Sundarbans, seventy six of eighty six tiles contain correctly predicted mangrove, with a mean per-tile I O U of about zero point five nine. In Kerala, only one of forty three test tiles has any correctly predicted mangrove. Odisha and Gulf of Mannar are also near zero per tile.
So for thin fringing mangroves, like Kerala and Gulf of Mannar, the model is not reliable yet.
There is also a reproducibility point. The four-area tile set was later overwritten by a Kerala-only rebuild. To re-evaluate, you must rebuild the tiles with the phase two script.
If asked for your I O U, say: zero point eight four on our pooled development test split, against Global Mangrove Watch, driven by Sundarbans, near zero on Kerala-type fringes, and not the paper's ninety five point five six percent.
""")

add("Evaluation", "Training curves (repository artefact)", "image", f"""
<div class="imgpair"><img src="file://{REPO}/outputs/segmentation/multi_E1_s1_b0_dev/training_curve.png"><img src="file://{REPO}/outputs/segmentation/multi_E1_s1_b0_dev/confusion_matrix.png"></div>
<p class="note">outputs/segmentation/multi_E1_s1_b0_dev/training_curve.png · confusion_matrix.png — generated by ecoconnect/ml/evaluation/plots.py</p>
""", """
These are the real training curves and confusion matrix for that model, written automatically by the training and evaluation scripts.
Training loss falls steadily, from about one point eight to zero point three four. Validation loss falls early and then flattens, while validation I O U climbs to its best at epoch thirty two.
The confusion matrix confirms the pattern we discussed: very few missed mangrove pixels, but more false positives than misses. The model over predicts.
""")

add("Evaluation", "Screen: Data & Models page", "screen", dict(img="experiments_multi.png",
    see="Model list, validation and held-out test metrics, threshold calibration for multi_E1_s1_b0_dev",
    data="GET /api/models, /api/models/{id} → metrics.json, experiment.json, history.csv, threshold_calibration.json",
    code="frontend/app/experiments/page.tsx · backend/main.py",
    why="Every metric comes from the evaluation files. Note: the green “Validated Model” badge is hard-coded — say “development model” instead.",
    ), """
This is the Data and Models page in the application. It lists five trained models, all EfficientNet B0.
For the selected model it shows the validation metrics at the best epoch, and the held-out test metrics at threshold zero point five. Below is the threshold calibration.
These numbers come straight from metrics dot json and experiment dot json through the models API.
One warning. The green badge saying validated model is hard-coded in the frontend. It is not a validation claim. In the viva, call it a development model.
""")

# ---------------------------------------------------------------- 6. PROBABILITY + THRESHOLD
add("Probability map", "From probability map to habitat mask", "slide", """
<div class="flow">
<div class="fb">Scene GeoTIFF<br><small>2 bands, whole AOI</small></div><div class="fa">→</div>
<div class="fb">Sliding window<br><small>256 px tiles, overlap 64,<br>Hann-window blending</small></div><div class="fa">→</div>
<div class="fb">Probability raster<br><small>P(mangrove) ∈ [0,1] per pixel<br>*_prob.tif</small></div><div class="fa">→</div>
<div class="fb">Threshold t<br><small>p ≥ t</small></div><div class="fa">→</div>
<div class="fb">Binary habitat mask</div>
</div>
<div class="two" style="margin-top:24px"><div>
<h3>Threshold calibration (Exp. 2)</h3>
<table class="t small"><tr><th>t</th><th>0.30</th><th>0.40</th><th>0.50</th><th>0.60</th><th>0.70</th></tr>
<tr><td>F1 (4-area model)</td><td>0.912</td><td>0.919</td><td>0.924</td><td>0.929</td><td><b>0.933</b></td></tr>
<tr><td>IoU</td><td>0.838</td><td>0.850</td><td>0.859</td><td>0.867</td><td>0.875</td></tr>
<tr><td>Habitat (ha, test)</td><td>83 967</td><td>82 738</td><td>81 613</td><td>80 482</td><td>79 165</td></tr></table>
<p class="note">outputs/segmentation/multi_E1_s1_b0_dev/threshold_calibration.csv — 224 test tiles pooled over 4 rasters</p>
</div><div>
<ul class="compact">
<li>Selected <b>t = 0.70</b> by F1 → used for the four-area analysis runs.</li>
<li>0.70 is the <b>edge of the swept range</b>; higher values were not tested.</li>
<li>The paper's fixed 0.5 was not optimal for any trained model (Kerala E2 chose 0.45).</li>
<li>Why it matters: a higher t shrinks and splits patches → fewer nodes, fewer links, different criticality ranks.</li>
<li>The current Kerala 2025 run on screen uses t = 0.5 (kerala-coast_development model, not calibrated).</li>
</ul></div></div>
""", """
From model output to habitat mask.
Inference runs a sliding window over the whole scene: two hundred and fifty six pixel windows, sixty four pixels of overlap, blended with a Hann window so that tile borders do not show. The result is a probability raster, one value between zero and one per pixel.
A threshold turns probability into a binary habitat mask.
The threshold was calibrated, which the paper did not do. We swept from zero point three to zero point seven on held out test tiles. F 1 rises steadily, from zero point nine one two to zero point nine three three, so zero point seven was selected and used for the four-area runs.
Be careful: zero point seven is the edge of the range we tested. A higher threshold might be better, and that was not tested.
Why does this matter? A higher threshold shrinks and splits patches. That changes the number of nodes and links, and therefore changes the criticality ranking. The scenario lab can show this directly.
Also note that the Kerala twenty twenty five run currently on screen uses a threshold of zero point five with an uncalibrated model.
""")

# ---------------------------------------------------------------- 7. PATCHES
add("Patches", "Patch extraction", "slide", """
<div class="flow">
<div class="fb">Probability map</div><div class="fa">→</div>
<div class="fb">Threshold → mask</div><div class="fa">→</div>
<div class="fb">8-connected components<br><small>scipy.ndimage.label</small></div><div class="fa">→</div>
<div class="fb">Drop &lt; MMU 2 ha<br><small>(counted, reported)</small></div><div class="fa">→</div>
<div class="fb">Patches + attributes<br><small>patches.geojson</small></div>
</div>
<div class="two" style="margin-top:24px"><div>
<h3>Stored per patch (actual fields)</h3>
<table class="t small">
<tr><td>id</td><td>P01…, numbered by area (largest first)</td></tr>
<tr><td>area_ha</td><td>from true pixel areas</td></tr>
<tr><td>centroid</td><td>WGS84 lat, lon</td></tr>
<tr><td>confidence = quality</td><td>mean probability inside the patch</td></tr>
<tr><td>habitat_class</td><td>"mangrove"</td></tr>
<tr><td>geometry, bbox, perimeter_km</td><td>polygon simplified in local UTM</td></tr>
<tr><td>added by analysis</td><td>degree, neighbours, cut-vertex flag, ΔC, S, rank</td></tr>
</table></div><div>
<h3>Example — Kerala 2025 run</h3>
<p>60 components → <b>24 patches</b> kept, 36 dropped below 2 ha<br>219.6 ha habitat in a 48 929 ha landscape (0.49 %)</p>
<div class="callout"><b>Large ≠ important.</b> Size is a patch attribute. Importance is a property of the patch's <i>position in the network</i> — computed later by removing it.</div>
<p class="note">ecoconnect/geospatial/patch_extraction/extract.py · manifest.json extraction_report</p>
</div></div>
""", """
Patch extraction, the bridge between remote sensing and graph theory.
The mask is split into connected components using eight-connectivity with scipy. Each component is a candidate patch. Components smaller than the minimum mapping unit of two hectares are dropped, and the number dropped is recorded.
For each patch we store an identifier numbered by area, the area in hectares from true pixel areas, the centroid in latitude and longitude, the confidence, which is the mean model probability inside the patch, the habitat class, and the polygon geometry. The analysis later adds degree, neighbours, cut vertex status, connectivity loss and criticality.
In the current Kerala run, sixty components were found, twenty four patches were kept and thirty six were below two hectares. Total habitat is about two hundred and twenty hectares.
Keep this distinction in mind. Size is an attribute of a patch. Importance is a property of its position in the network, and we only know it after building the graph.
""")

# ---------------------------------------------------------------- 8. GRAPH
add("Graph", "Connectivity graph construction", "slide", """
<div class="two"><div>
<svg viewBox="0 0 560 330" class="svg">
 <g class="edges"><line x1="90" y1="90" x2="250" y2="150"/><line x1="250" y1="150" x2="420" y2="90"/><line x1="250" y1="150" x2="330" y2="270"/><line x1="90" y1="90" x2="120" y2="250"/><line x1="120" y1="250" x2="250" y2="150"/></g>
 <line x1="420" y1="90" x2="520" y2="240" class="dash"/>
 <g class="nodes"><circle cx="90" cy="90" r="30"/><circle cx="250" cy="150" r="16"/><circle cx="420" cy="90" r="38"/><circle cx="330" cy="270" r="22"/><circle cx="120" cy="250" r="26"/><circle cx="520" cy="240" r="20" class="far"/></g>
 <g class="lbl"><text x="90" y="95">A</text><text x="250" y="155">B</text><text x="420" y="95">C</text><text x="330" y="275">D</text><text x="120" y="255">E</text><text x="520" y="245">F</text></g>
 <text x="455" y="185" class="small">d &gt; τ → no edge</text>
</svg>
<p>Node = patch (circle size ∝ area) · Edge = spatial relationship</p>
</div><div>
<h3>Edge rule (graph/construction.py)</h3>
<ul class="compact">
<li>For every patch, take its <b>k = 3 nearest</b> patches by centroid distance (haversine, km)</li>
<li>Keep a link only if <b>d<sub>ij</sub> ≤ τ = 5 km</b>; union → undirected graph</li>
<li>Weight <b>w<sub>ij</sub> = √(q<sub>i</sub>q<sub>j</sub>) · e<sup>−d<sub>ij</sub>/τ</sup></b> (paper Eq. 6), q = patch confidence</li>
<li>Sensitivity τ ∈ {3, 5, 8} km run automatically for every analysis</li>
</ul>
<p><b>Why distance?</b> Propagules, fauna and water exchange move more easily between nearby patches; τ is a <i>design parameter</i> standing in for dispersal distance — no species was calibrated.</p>
<p class="note">configs/graph.yaml: k_neighbors 3 · tau_km 5.0 · tau_sensitivity_km [3, 5, 8]</p>
</div></div>
""", """
Now the graph. Each patch becomes a node. An edge represents a plausible spatial relationship between two patches.
The rule is in construction dot py. For every patch we take its three nearest patches by centroid distance, measured as great circle distance in kilometres. We keep a link only if the distance is at most tau, which is five kilometres. The union of these links gives an undirected graph.
Each edge also gets a weight: the geometric mean of the two patch confidences, times e to the minus distance over tau. Close, confident patches get strong links.
In the diagram, patch F is more than tau away from C, so no edge exists and F is isolated.
Why distance? Mangrove propagules, animals and water exchange move more easily between nearby patches. Tau stands in for a dispersal distance. It is a design parameter. No species was calibrated, and that is why every run automatically repeats the analysis at three, five and eight kilometres.
This step converts a geographic map into a network, which we can analyse with graph theory.
""")

add("Graph", "Code: edge construction", "code", """
<div class="codehead">ecoconnect/graph/construction.py</div>
<pre class="code big">def build_edges(patches, *, k, tau_km, distance_mode="haversine"):
    # k nearest neighbours subject to d_ij &lt;= tau, symmetrised by union
    dist = distance_fn(distance_mode)
    edges = {}
    for p in patches:
        cand = sorted((dist(p.centroid, q.centroid), q.id) for q in patches if q.id != p.id)
        for d, j in cand[:k]:                     # k = 3 nearest
            if d &lt;= tau_km:                        # tau = 5 km
                key = (p.id, j) if p.id &lt; j else (j, p.id)
                if key not in edges:
                    edges[key] = Edge(key[0], key[1], d,
                                      edge_weight(p.quality, by_id[j].quality, d, tau_km))
    return list(edges.values())

def edge_weight(q_i, q_j, d_km, tau_km):          # Eq. (6)
    return math.sqrt(q_i * q_j) * math.exp(-d_km / tau_km)</pre>
""", """
And here is that rule in code. For each patch, sort all other patches by distance, take the first k, keep the ones within tau, and store each pair once. The weight function is exactly equation six of the paper.
""")

# ---------------------------------------------------------------- 9. METRIC
add("Connectivity metric", "Measuring connectivity: IIC, PC, ECA", "slide", """
<p class="lead">Goal: one number C(G) for "how connected is the habitat network" — before and after any intervention.</p>
<div class="two"><div>
<h3>IIC — Integral Index of Connectivity (headline)</h3>
<div class="eq">IIC = Σ<sub>i</sub> Σ<sub>j</sub> a<sub>i</sub> a<sub>j</sub> / (1 + nl<sub>ij</sub>)  ÷  A<sub>L</sub><sup>2</sup></div>
<ul class="compact">
<li>a<sub>i</sub> = patch area; A<sub>L</sub> = landscape (valid AOI) area</li>
<li>nl<sub>ij</sub> = number of links on the shortest path; unreachable pairs add 0</li>
<li>Rewards <b>big patches</b> that are <b>reachable in few steps</b></li>
<li>Pascual-Hortal &amp; Saura (2006)</li>
</ul></div><div>
<h3>PC and ECA (reported alongside)</h3>
<ul class="compact">
<li><b>PC</b>: p<sub>ij</sub> = e<sup>−αd</sup>, α = ln2/τ (p = 0.5 at τ), best-path product over the full distance matrix</li>
<li><b>ECA</b> = √PC · A<sub>L</sub> (hectares) — "equivalent connected area"; we compare areas using <b>ECA as % of habitat</b></li>
<li>Interface score (paper Eq. 7, weights .30/.28/.22/.12/.08) is a <b>design choice</b>, not a research metric — it can even <i>rise</i> when a patch is removed (Odisha P01: 56.1 → 62.9)</li>
</ul>
<p class="note">ecoconnect/graph/connectivity.py · configs/graph.yaml research_metric: iic</p>
</div></div>
""", """
Now the connectivity metric. Conceptually, the goal is one number, C of G, that says how connected the habitat network is, so we can compare before and after any intervention.
The headline metric is I I C, the integral index of connectivity. For every pair of patches, multiply their areas and divide by one plus the number of links on the shortest path between them. Pairs that cannot reach each other contribute nothing. Divide by the landscape area squared.
In words, I I C rewards large patches that can reach each other in few steps. A patch counts with itself too, so area still matters, but position matters as well.
We also report P C, the probability of connectivity, where direct dispersal probability decays with distance and equals one half at tau. From P C we get E C A, the equivalent connected area in hectares. Because I I C depends on the size of the study area, we compare landscapes using E C A as a percentage of habitat.
The paper's equation seven interface score is a design choice with hand-picked weights. It is not a research metric. In fact it can go up when a patch is removed. In Odisha, removing patch P01 raises it from fifty six to sixty three. That is why the system uses I I C for every decision.
""")

# ---------------------------------------------------------------- 10. CRITICALITY
add("Criticality", "Critical patch analysis — exact leave-one-out", "slide", """
<div class="steps">
<div class="st"><b>1</b> Baseline C(G)</div><div class="st"><b>2</b> Pick patch i</div><div class="st"><b>3</b> Delete node + its edges → G − v<sub>i</sub></div>
<div class="st"><b>4</b> Recompute C(G − v<sub>i</sub>)</div><div class="st"><b>5</b> ΔC<sub>i</sub> = C(G) − C(G − v<sub>i</sub>)</div><div class="st"><b>6</b> S<sub>i</sub> = ΔC<sub>i</sub> / C(G)</div><div class="st"><b>7</b> Repeat ∀ i, rank by S</div>
</div>
<div class="two" style="margin-top:20px"><div>
<pre class="code">ecoconnect/graph/criticality.py
c_base = connectivity(graph, A_L, "iic")
for pid in graph.node_ids:
    g_minus = graph.without(pid)          # G - v_i
    c_after = connectivity(g_minus, A_L, "iic")
    d_c = c_base - c_after                 # Eq. 8
    S   = d_c / c_base                     # Eq. 9
    is_cut_vertex = (g_minus.n_components()
                     &gt; graph.n_components())</pre></div><div>
<ul class="compact">
<li><b>Exact</b>: the graph is really rebuilt without the patch — no approximation, no learned model</li>
<li>Also recorded: degree, neighbours + distances, cut-vertex flag, components before/after, rank by area</li>
<li>Presentation bands: critical S ≥ 0.25, high ≥ 0.10, medium ≥ 0.03 (configurable, not ecological facts)</li>
<li>Area-vs-criticality Spearman ρ reported per run (Kerala 2025: 0.85) — tells you how much ranking differs from "just sort by size"</li>
</ul></div></div>
""", """
Critical patch analysis is the core contribution.
Step one, compute the baseline connectivity. Step two, pick one patch. Step three, delete that node and all its edges. Step four, recompute connectivity. Step five, the loss, delta C, is baseline minus after. Step six, normalise it: S equals delta C over the baseline. Step seven, repeat for every patch and rank by S.
This is exact. The graph is really rebuilt without the patch, and the index is really recomputed. There is no approximation and no learned model in this step.
For each patch we also record its degree, its neighbours and distances, whether it is a cut vertex, the number of components before and after removal, and its rank by area.
The labels critical, high and medium are presentation bands at zero point two five, zero point one and zero point zero three. They are configurable, not ecological facts.
Each run also reports the Spearman correlation between area and criticality. For the Kerala run it is zero point eight five, so size explains much of the ranking, but not all of it. The interesting cases are the exceptions.
""")

add("Graph theory", "Graph concepts the panel will ask about", "slide", """
<div class="two"><div>
<svg viewBox="0 0 560 200" class="svg">
 <g class="edges"><line x1="80" y1="100" x2="280" y2="100"/><line x1="280" y1="100" x2="480" y2="100"/></g>
 <g class="nodes"><circle cx="80" cy="100" r="40"/><circle cx="280" cy="100" r="18" class="crit"/><circle cx="480" cy="100" r="40"/></g>
 <g class="lbl"><text x="80" y="106">A</text><text x="280" y="106">B</text><text x="480" y="106">C</text></g>
</svg>
<p style="text-align:center">Remove B ↓</p>
<svg viewBox="0 0 560 200" class="svg">
 <g class="nodes"><circle cx="80" cy="100" r="40"/><circle cx="480" cy="100" r="40"/></g>
 <circle cx="280" cy="100" r="18" class="gone"/>
 <g class="lbl"><text x="80" y="106">A</text><text x="480" y="106">C</text></g>
 <text x="280" y="170" class="small" text-anchor="middle">1 component → 2 components</text>
</svg></div><div>
<table class="t small">
<tr><td><b>Node</b></td><td>a habitat patch</td></tr>
<tr><td><b>Edge</b></td><td>two patches within τ and among each other's k nearest</td></tr>
<tr><td><b>Degree</b></td><td>number of edges at a node</td></tr>
<tr><td><b>Component</b></td><td>a set of patches mutually reachable</td></tr>
<tr><td><b>Cut vertex</b> (articulation point)</td><td>a <i>node</i> whose removal increases the number of components — what the UI calls a "bridge patch"</td></tr>
<tr><td><b>Bridge</b> (graph theory)</td><td>an <i>edge</i> whose removal disconnects the graph (is_bridge_edge in code)</td></tr>
</table>
<p><b>Ecologically:</b> when B disappears, A and C still exist but can no longer exchange propagules or fauna — their populations become isolated.</p>
<p class="note">HabitatGraph.is_cut_vertex / is_bridge_edge / components — ecoconnect/graph/construction.py</p>
</div></div>
""", """
The graph concepts you should be able to define instantly.
A node is a habitat patch. An edge joins two patches within tau that are among each other's nearest neighbours. Degree is the number of edges at a node. A component is a group of patches that can all reach each other.
A cut vertex, also called an articulation point, is a node whose removal increases the number of components. The interface calls this a bridge patch.
Strictly, in graph theory, a bridge is an edge, not a node: an edge whose removal disconnects the graph. The code has both checks. If the panel asks, say that a bridge patch is a cut vertex.
Look at the picture. A, B and C form one component. Patch B is small. Remove it, and A and C are still there, but they are now in separate components. Ecologically, they can no longer exchange propagules, fish or birds, so their populations become isolated. That is why a small patch can matter more than a large one.
""")

add("Criticality", "Worked example from the current Kerala run", "slide", """
<p class="lead">Run <code>kerala-coast_20260920T182222Z</code> — Kerala 2025 Sentinel-1, kerala-coast_development model, t = 0.5, k = 3, τ = 5 km, C(G) = IIC <span class="chip blue">DEV — NOT FINAL</span></p>
<table class="t">
<tr><th>Patch</th><th>Area</th><th>Rank by area</th><th>Degree</th><th>Confidence</th><th>Cut vertex</th><th>C(G)</th><th>C(G−v)</th><th>ΔC</th><th>S</th><th>Rank by S</th></tr>
<tr><td>P01</td><td>35.1 ha (16.0 %)</td><td>#1</td><td>5</td><td>88 %</td><td>no (2 → 2)</td><td>6.524e-6</td><td>4.521e-6</td><td>2.003e-6</td><td>0.307</td><td>#1</td></tr>
<tr><td>P07</td><td>8.8 ha (4.0 %)</td><td>#7</td><td>3</td><td>85 %</td><td>yes (2 → 3)</td><td>6.524e-6</td><td>4.584e-6</td><td>1.940e-6</td><td>0.297</td><td>#2</td></tr>
<tr class="hl"><td><b>P17</b></td><td><b>3.1 ha (1.4 %)</b></td><td><b>#17 of 24</b></td><td>4</td><td>84 %</td><td><b>yes (2 → 3)</b></td><td>6.524e-6</td><td>4.765e-6</td><td>1.759e-6</td><td><b>0.270</b></td><td><b>#3</b></td></tr>
</table>
<div class="two"><div><p><b>P17's neighbours:</b> P14 (0.59 km), P04 (0.85 km), P15 (1.24 km), P07 (2.80 km)</p>
<p><b>Plain English:</b> P17 holds 1.4 % of the habitat but removing it cuts IIC by 27 % — almost as much as removing the largest patch — because it is the only junction joining two groups of patches.</p></div>
<div><div class="callout">Second example — Odisha, 4-area model: <b>P09 (55.6 ha, 0.4 % of habitat, #9 by area)</b> ranks #3 by criticality and is a cut vertex; <b>P04 (910 ha, #4 by area)</b> ranks only #6.</div>
<p class="warn">P16 (the paper's example, 263 ha, S = 0.408) exists only in the synthetic prototype results — do not present it as a real patch.</p></div></div>
<p class="note">outputs/runs/kerala-coast/kerala-coast_20260920T182222Z/criticality.csv · explanations.json · outputs/runs/odisha-coast/odisha-coast_multi_E1_s1_b0_dev_t0.70/</p>
""", """
Now a real example from the current Kerala run.
The largest patch, P01, is thirty five hectares, sixteen percent of the habitat. Removing it lowers I I C by thirty point seven percent, rank one. But it is not a cut vertex. The network stays in two components, because alternative routes exist around it.
Now look at P17. It is only three point one hectares, one point four percent of the habitat, seventeenth of twenty four by size. Yet removing it lowers I I C by twenty seven percent, which ranks it third, almost as damaging as losing the largest patch. The reason is structural. P17 is a cut vertex. It has four links, to P14, P04, P15 and P07, and removing it splits the network from two components into three.
In plain English: P17 is a small junction that joins two groups of patches. Lose it, and those groups can no longer reach each other.
There is a second example in Odisha, from the four-area model. Patch P09, fifty five hectares and only zero point four percent of the habitat, ranks third and is a cut vertex. Meanwhile P04, nine hundred and ten hectares, ranks only sixth.
And one warning. The paper's P16 example exists only in the synthetic prototype results. Do not present P16 as a real patch.
""")

add("Criticality", "Screen: evidence chain for P17", "screen", dict(img="evidence_p17.png",
    see="Interactive Map with P17 selected; right drawer = full evidence chain: decision, verification status, C(G), C(G−v), ΔC, S, geometry, neighbours, parameters",
    data="GET /api/runs/kerala-coast/latest/evidence/patch/P17 → criticality.json, explanations.json, manifest.json, graph.json",
    code="frontend/app/analysis/page.tsx · components/analysis/evidence-drawer.tsx · backend/routers.py (evidence)",
    why="A ranking is never shown without the numbers that produced it — this is what the panel means by explainable."), """
Here is the same patch in the application. On the Interactive Map, P17 is selected, and the evidence drawer is open.
At the top is the decision: priority critical, rank three of twenty four, with the full explanation sentence.
Below it are the exact numbers: C of G, C of G minus v, delta C, and S equals zero point two six nine five. Then the geometry: three point one three hectares, three hundred and thirteen pixels, eighty four percent mean probability. Then the graph neighbourhood: degree four, cut vertex, two components becoming three.
Everything in this drawer comes from the run's stored files through the evidence endpoint. Nothing is generated at display time.
""")

add("Criticality", "Screen: connectivity graph view", "screen", dict(img="graph.png",
    see="React Flow network: 24 nodes, 43 links, 2 clusters; node rings coloured by criticality band; side panel with topology and clusters",
    data="graph.json + criticality from the run bundle (GET /api/runs/{area}/{run}/bundle)",
    code="frontend/app/graph/page.tsx · components/graph/connectivity-graph.tsx",
    why="Known UI inaccuracy: the “3 critical bridges” box lists patches with S ≥ 0.25 (P01, P07, P17). P01 is NOT a cut vertex — only P07 and P17 are."), """
This is the graph view, drawn with React Flow from graph dot json. Twenty four nodes, forty three links, two clusters.
One inaccuracy you must know. The red box says three critical bridges and lists P01, P07 and P17, with the text that they have no redundant route. In fact that box lists every patch with S above zero point two five. P01 is not a cut vertex. Only P07 and P17 are. If the panel points at it, correct it yourself: critical by score, but only P07 and P17 are cut vertices.
""")

# ---------------------------------------------------------------- 11. WHAT-IF
add("What-if", "What-if analysis — five scenarios on the Kerala run", "slide", """
<table class="t small">
<tr><th>#</th><th>Action</th><th>Baseline</th><th>New graph</th><th>Difference</th><th>Label</th></tr>
<tr><td>1</td><td>Remove critical patch P17 (3.1 ha)</td><td>IIC 6.524e-6, 43 links, 2 comp.</td><td>IIC 4.765e-6, 3 comp.</td><td><b>−27.0 % IIC</b> for −1.4 % habitat</td><td>SIMULATED</td></tr>
<tr><td>2</td><td>Remove largest patch P01 (35.1 ha)</td><td>same</td><td>IIC 4.521e-6, 38 links, 2 comp.</td><td><b>−30.7 % IIC</b> for −16.0 % habitat</td><td>SIMULATED</td></tr>
<tr><td>3</td><td>Restore candidate C1 (1.6 ha)</td><td>same</td><td>+3 links (to P01, P06, P13)</td><td><b>+1.29 % IIC</b></td><td>SIMULATED</td></tr>
<tr><td>4</td><td>Change τ: 3 / 5 / 8 km</td><td>τ = 5 km</td><td>41 / 43 / 47 links; 2 / 2 / 1 comp.</td><td>ECA % 65.5 / 75.1 / 82.6; rank ρ vs 5 km 0.96 / 1.00 / 0.97</td><td>SIMULATED</td></tr>
<tr><td>5</td><td>Change habitat threshold 0.4 → 0.7</td><td>t = 0.5, 24 patches</td><td>26 / 24 / 23 / 21 patches</td><td>IIC 7.44e-6 → 3.95e-6; components 2 → 3 at t ≥ 0.6</td><td>SIMULATED</td></tr>
</table>
<div class="flow" style="margin-top:22px"><div class="fb">BASELINE graph</div><div class="fa">→</div><div class="fb">ACTION</div><div class="fa">→</div><div class="fb">rebuild graph exactly</div><div class="fa">→</div><div class="fb">recompute IIC / PC / ECA</div><div class="fa">→</div><div class="fb">DIFFERENCE + explanation</div></div>
<p class="lead" style="margin-top:18px">This is not a forecast. It is a quantitative "what-if" under the current model output and the stated assumptions (k, τ, threshold, IIC).</p>
<p class="note">ecoconnect/graph/what_if.py · backend/scenarios.py (types remove_patches, remove_polygon, restore, restore_multi, tau, threshold, compare_periods)</p>
""", """
The what-if engine. Every scenario follows the same pattern: start from the baseline graph, apply an action, rebuild the graph exactly, recompute the indices, and report the difference with an explanation.
Scenario one: remove the critical patch P17. I I C falls twenty seven percent, while habitat falls only one point four percent, and the network splits into three components.
Scenario two: remove the largest patch, P01. I I C falls thirty point seven percent, but that costs sixteen percent of the habitat. Compare the two: P17 gives almost the same damage for a tenth of the area.
Scenario three: restore candidate C1, one point six hectares. It adds three links and raises I I C by one point two nine percent.
Scenario four: change tau. At three, five and eight kilometres we get forty one, forty three and forty seven links. At eight kilometres the network becomes one component. The ranking stays stable, with rank correlations of zero point nine six and zero point nine seven.
Scenario five: change the habitat threshold. From zero point four to zero point seven, patches drop from twenty six to twenty one, and I I C nearly halves.
Be precise about what this is. It is not a prediction of the future. It is a quantitative what-if analysis, based on the current model output and stated assumptions. Every result is labelled simulated.
""")

add("What-if", "Screen: removing P17 on the dashboard", "screen", dict(img="command_p17_removed.png",
    see="Dashboard (Command Center): P17 selected; 'Remove Patch' pressed; card shows IIC loss −27.0 %, habitat removed 1.4 %, components 2 → 3",
    data="POST /api/runs/{area}/{run}/what-if {remove: [P17]} → exact recomputation in ecoconnect/graph/what_if.py",
    code="frontend/app/command/page.tsx · hooks/use-analysis.tsx · backend/main.py (what-if)",
    why="The paper's prototype used a heuristic what-if in the browser; the current system recomputes exactly on the server."), """
This is the dashboard. I searched for P17, which selected it, and pressed Remove Patch.
The browser posts the removal to the what-if endpoint. The server rebuilds the graph without P17 and recomputes I I C. The card shows the result: I I C loss minus twenty seven percent, habitat removed one point four percent, components two to three.
This is a change from the paper. The paper's prototype used a heuristic what-if in the browser. The current system recomputes exactly on the server.
""")

add("What-if", "Screen: Scenario Lab — τ sensitivity and threshold sensitivity", "screen2", dict(img="scenario_tau.png", img2="scenario_threshold.png",
    see="Scenario Lab types A–G; left: E · Compare τ 3/5/8 km; right: F · Compare thresholds 0.4–0.7 — both labelled SIMULATED",
    data="POST /api/runs/{area}/{run}/scenario → backend/scenarios.py (tau rebuilds graph; threshold re-extracts patches from the probability raster)",
    code="frontend/app/scenario/page.tsx · backend/scenarios.py",
    why="Answers “why 5 km?” and “why this threshold?” with evidence instead of assertion."), """
The Scenario Lab has seven types, A to G. On the left, type E compares tau at three, five and eight kilometres. On the right, type F re-extracts patches from the probability raster at thresholds from zero point four to zero point seven.
Both are labelled simulated, and both come with an explanation built only from the computed values.
These two screens are your best answer to why five kilometres, and why this threshold. The parameters are assumptions, and the system shows how sensitive the result is to each one.
""")

# ---------------------------------------------------------------- 12. EXPLAINABILITY
add("Explainability", "Explainable AI — graph-level, rule-based", "slide", """
<div class="two"><div>
<h3>Evidence used (only computed quantities)</h3>
<ul class="compact"><li>area and share of habitat, rank by area</li><li>degree and neighbour distances</li><li>cut-vertex status, components before → after</li><li>segmentation confidence</li><li>C(G), C(G − v), ΔC, S</li></ul>
<h3>What it is not</h3>
<p><b>No SHAP, no LIME, no Grad-CAM</b> — not implemented. The explanation explains the <i>graph decision</i>, not the pixels of the CNN. The assistant (⌘K) is template-based retrieval, <b>not an LLM</b>.</p>
</div><div>
<div class="quote">"P17 ranks #3 of 24 by criticality (S = 0.270): removing it lowers IIC by 27.0%. It holds 3.1 ha, 1.4% of mapped habitat (#17 by area). Its structural importance exceeds what its size alone would suggest. It maintains 4 links to P14 (0.6 km), P04 (0.9 km), P15 (1.2 km). It is a cut vertex (bridge patch): its removal splits the network from 2 to 3 components. Segmentation confidence for this patch is 84%."</div>
<p class="note">Generated by ecoconnect/graph/explain.py — each sentence is emitted only if its evidence exists (e.g. "cut vertex" only when is_cut_vertex is true)</p>
</div></div>
""", """
Explainability. EcoConnectAI does not just say criticality equals zero point two seven. It says why, using only quantities that were actually computed.
Here is the real explanation for P17, generated by explain dot py. It gives the rank and the I I C loss, the area and its rank by size, the fact that its importance exceeds its size, its four links with distances, that it is a cut vertex splitting two components into three, and the segmentation confidence.
Each sentence appears only when its evidence exists. The cut vertex sentence, for example, only appears when the cut vertex test is true.
Be clear about what this is not. There is no SHAP, no LIME and no Grad-CAM. This is graph-level, rule-based explainability. It explains the graph decision, not the pixels of the neural network. And the assistant in the interface is template-based retrieval over stored results. It is not a large language model.
""")

add("Explainability", "Screen: the assistant answers from stored results", "screen", dict(img="assistant_p17.png",
    see="Assistant panel: 'Why is P17 critical?' → answer lists the top-5 critical patches with S, % loss, cut-vertex flags, run id, and the result label",
    data="POST /api/assistant/ask → regex intent + templates over criticality.json / metrics.json and DB rows",
    code="backend/insight.py · frontend/components/chat/assistant-launcher.tsx",
    why="No generation of figures: every value is quoted from a file, with its source and [DEVELOPMENT-SUBSET RESULT - NOT FINAL]."), """
This is the assistant. I asked why P17 is critical. It matched an intent and filled a template with values read from criticality dot json. You can see the run id, the source files, and the result label at the end.
It never generates figures. If a value is not in the run, it says so.
""")

# ---------------------------------------------------------------- 13. RESTORATION
add("Restoration", "Restoration prioritisation — the reverse question", "slide", """
<div class="two"><div>
<div class="flow v"><div class="fb">Candidate site</div><div class="fa">↓</div><div class="fb">Insert as a node; link to its k = 3 nearest within τ</div><div class="fa">↓</div><div class="fb">Recompute C(G + v)</div><div class="fa">↓</div><div class="fb">R = C(G + v) − C(G)</div><div class="fa">↓</div><div class="fb">Rank by R (or R / cost if a real cost table is uploaded)</div></div>
</div><div>
<p><b>Criticality asks:</b> what if we <i>remove</i> this patch?<br><b>Restoration asks:</b> what if we <i>add</i> this patch?</p>
<h3>Where candidates come from</h3>
<p>Connected components of the probability raster with <b>0.3 ≤ p &lt; threshold</b> (marginal habitat), ≥ 1 ha, top 12 by area. They are model output, <b>not surveyed restoration sites</b>.</p>
<h3>Costs</h3>
<p>None shipped. <b>"Currently candidates are ranked by connectivity gain because validated intervention-cost data is not available."</b> A user can upload a candidate_id,cost CSV → Priority = gain / cost (paper Eq. 12). The paper's INR-lakh costs (Table VIII) were indicative values on synthetic data.</p>
<p class="note">ecoconnect/graph/restoration.py · backend/scenarios.py (feasibility rules)</p>
</div></div>
""", """
Restoration uses the reverse logic of criticality. Criticality asks: what happens if we remove this patch? Restoration asks: what happens if we add this patch?
Each candidate is inserted into the graph as a new node, linked to its three nearest patches within tau. We recompute connectivity, and the gain R is the new value minus the old one. Candidates are ranked by that gain.
Where do candidates come from? They are areas where the model gives a marginal probability, between zero point three and the habitat threshold, at least one hectare in size. They are model output, not surveyed restoration sites.
Costs. The project does not invent them. Say this: currently candidates are ranked by connectivity gain, because validated intervention cost data is not available. If a real cost table is uploaded, the ranking switches to gain per unit cost, which is equation twelve of the paper. The rupee costs in the paper's Table eight were indicative values on synthetic data.
""")

add("Restoration", "Screen: Restoration Planner", "screen", dict(img="restoration_c1.png",
    see="4 candidates for the Kerala 2025 run; C1: 1.6 ha, +1.29 % IIC, 3 new links to P01, P06, P13, 0.58 km to habitat; why / why-not / not-assessed lists",
    data="GET /api/runs/{area}/{run}/restoration/feasibility → restoration.json + rule checks (distance ≤ 2 km, NDWI > 0.3, >50 % overlap, new links)",
    code="frontend/app/restoration/page.tsx · backend/scenarios.py",
    why="'Recommended' is a rule output over available layers, not a field or legal feasibility verdict; legal status, ownership and cost are explicitly 'not assessed'."), """
This is the Restoration Planner for the Kerala run. There are four candidates. C1 is one point six hectares, adds one point two nine percent to I I C, and creates three new links, to P01, P06 and P13.
The right panel separates why recommended, why not, and not assessed. Water status could not be checked because the twenty twenty five scene has no Sentinel-2 band. Legal status, land ownership, settlements and cost are explicitly marked not assessed.
So recommended here means the rules found nothing against it in the available layers. It is not a field or legal feasibility verdict. A field assessment task can be created from here.
""")

# ---------------------------------------------------------------- 14. CHANGE DETECTION
add("Change detection", "Change detection — what is actually implemented", "screen", dict(img="scenario_compare_periods.png",
    see="Scenario G · Compare periods: kerala_E1 dev model on 2025 vs 2020 S1 scenes (same model, t = 0.70). Habitat 382 → 319 ha, IIC −33.8 %, 9 patches lost / 10 new. Label: OBSERVED (MODEL OUTPUT)",
    data="Two real pipeline runs (2020 + 2025 Sentinel-1 composites); patch matching by centroid < 300 m; timeline = binary-mask difference",
    code="backend/scenarios.py (compare_periods) · backend/main.py (timeline) · backend/alerts.py",
    why="Implemented, but the model has test IoU 0.023 on Kerala — the difference is model output and can be noise, not measured mangrove loss."), """
Change detection. Is it implemented? Partly, and you must describe it carefully.
We downloaded a second Sentinel-1 composite for Kerala, for twenty twenty five. The same model was run on both years at the same threshold. Scenario G compares the two runs. Habitat goes from three hundred and eighty two to three hundred and nineteen hectares, I I C falls by about thirty four percent, nine patches have no counterpart and ten are new. Patches are matched by centroid within three hundred metres.
It is labelled observed, model output. And here is the honest reading: this model's test I O U on Kerala is zero point zero two three. So this difference is model output and may be mostly noise. It is not a measured loss of mangrove, and no cause is attributed.
One more warning. The dashboard's change over time chart currently compares the twenty twenty run of the four-area model with the twenty twenty five run of a different Kerala model, at different thresholds. Those deltas, like plus one hundred percent patches, are not a like-for-like comparison. Use Scenario G with matching runs instead.
""")

# ---------------------------------------------------------------- 15. STUDY AREAS
add("Study areas", "Four study areas — status and real run results", "slide", """
<table class="t small">
<tr><th>Landscape</th><th>Why selected</th><th>Data (2020)</th><th>GMW mangrove</th><th>4-area model run (t = 0.70)</th><th>Status</th></tr>
<tr><td><b>Vembanad–Kol, Kerala</b></td><td>Ramsar backwater wetland, thin fringing mangroves (hard case)</td><td>S1 ×6 desc., S2 2 granules; + 2025 S1 ×6</td><td>102 ha</td><td>12 patches · 18 links · 3 comp. · 205 ha · ECA 80.7 %</td><td>Most complete (timeline, E1–E3)</td></tr>
<tr><td><b>Sundarbans, W. Bengal</b></td><td>UNESCO site; largest contiguous mangrove</td><td>S1 ×4, S2 1 granule</td><td>58 903 ha</td><td>54 · 73 · 13 · 63 830 ha · ECA 48.8 %</td><td>Dev run</td></tr>
<tr><td><b>Gulf of Mannar, T.N.</b></td><td>Marine NP; island reef chain, sparse mangrove</td><td>S1 ×4, S2 2 granules</td><td>44 ha</td><td>16 · 17 · 6 · 118 ha · ECA 54.4 %</td><td>Dev run; unreliable</td></tr>
<tr><td><b>Bhitarkanika, Odisha</b></td><td>Ramsar / NP delta mangroves</td><td>S1 ×4 asc., S2 2 granules</td><td>10 793 ha</td><td>21 · 28 · 4 · 14 944 ha · ECA 70.7 %</td><td>Dev run</td></tr>
</table>
<ul class="compact" style="margin-top:14px">
<li>Predicted habitat exceeds GMW everywhere (205 vs 102 ha; 118 vs 44 ha) — consistent with the model's over-prediction.</li>
<li>Earlier runs applied the Kerala-only model to the other areas without retraining (e.g. Odisha: 2 patches, 4.8 ha) — transfer failure, kept only as history.</li>
<li><span class="warn">Paper Table III lists Sentinel-2 for three areas and Landsat-9 for Gulf of Mannar. The implementation uses Sentinel-1 (+ S2) for all four; no Landsat.</span></li>
<li>Selection reasons above are the paper's designations; no ecological statistics are claimed beyond these files.</li>
</ul>
<p class="note">outputs/runs/&lt;area&gt;/&lt;area&gt;_multi_E1_s1_b0_dev_t0.70/metrics.json · data/scenes/*/…json · data/labels/*/gmw_2020.tif</p>
""", """
The four study areas.
Vembanad Kol in Kerala is a Ramsar backwater wetland with thin fringing mangroves. It is the hardest case, and it is the most complete: three ablation models, a threshold sweep, and a twenty twenty five timeline.
Sundarbans is the largest contiguous mangrove system, a UNESCO site. Gulf of Mannar is a marine national park with an island reef chain and very sparse mangrove. Bhitarkanika in Odisha is a Ramsar delta.
With the four-area model at threshold zero point seven: Kerala has twelve patches and eighty point seven percent E C A. Sundarbans has fifty four patches, seventy three links and thirteen components. Gulf of Mannar has sixteen patches. Odisha has twenty one.
Predicted habitat is larger than Global Mangrove Watch everywhere. Two hundred and five hectares against one hundred and two in Kerala, one hundred and eighteen against forty four in Gulf of Mannar. That is the over prediction we saw in the metrics.
Earlier, the Kerala-only model was applied to the other areas without retraining. In Odisha it found only two patches. That was a transfer failure, and it is kept only as history.
And flag this paper mismatch: the paper lists Sentinel-2 and Landsat 9 as sensors per area. The implementation uses Sentinel-1, plus Sentinel-2, for all four, and no Landsat at all.
""")

# ---------------------------------------------------------------- 16. UI TOUR
add("UI", "Screen: Dashboard (Command Center)", "screen", dict(img="command.png",
    see="Map with patches (high/lower confidence), candidates, top-5 critical, links, AOI; KPIs (24 patches, 43 links, 220 ha, 4 opportunities); landscape metrics; what-if buttons; change chart",
    data="Run bundle of kerala-coast_20260920T182222Z (LATEST); quicklook PNGs rendered from our own S1/S2 rasters; alerts & tasks from SQLite",
    code="frontend/app/command/page.tsx · components/dashboard/app-shell.tsx · backend/main.py",
    why="Strip label 'REAL DATA · development model · not final'. Ignore the % deltas under the KPIs — they compare runs from different models."), """
Now a short tour of the interface, focusing on what powers each screen.
The dashboard, or Command Center, shows the selected landscape and run. The map has patches split by confidence, restoration candidates, the top five critical patches, connectivity links and the study area boundary. The basemaps can switch to Sentinel-2 true colour, N D V I, or Sentinel-1 V V, rendered from our own downloaded rasters.
The cards show twenty four patches, forty three links, two hundred and twenty hectares and four restoration opportunities, all from the run bundle.
The strip on the map says real data, development model, not final. As mentioned, ignore the percentage deltas under the cards, because they compare runs from different models.
""")

add("UI", "Screen: Interactive Map with model probability", "screen", dict(img="analysis.png",
    see="Split view: satellite basemap with the model probability raster, habitat mask, sensitivity heatmap and links; sensitivity explorer (τ · k · metric)",
    data="GET /api/runs/{area}/{run}/probability.png (probability raster reprojected to WGS84) · POST /reanalyse for τ/k/metric",
    code="frontend/app/analysis/page.tsx · components/maps/gis-map.tsx, pixel-inspector.tsx",
    why="Shows the raw model output under the patches, so the panel can see where the model is confident. Note: the pixel inspector's 'importance timeline' mini-chart is synthetic — do not present it."), """
The Interactive Map shows the raw model probability raster, reprojected on the server, underneath the patch polygons and links. You can toggle the habitat mask, the sensitivity heatmap and the graph.
The sensitivity explorer re-runs the analysis with a different tau, k or metric through the reanalyse endpoint.
One caution: the small importance timeline inside the patch inspector is generated from a formula, not from data. Do not present it.
""")

add("UI", "Platform workflow screens", "screen4", dict(imgs=["alerts.png", "field.png", "reports.png", "upload.png"],
    see="Alerts (6 rule-based alerts) · Field Work (tasks, GPS/photo evidence, verification) · Reports (JSON reports per run + official reports) · New Analysis (scene → checkpoint → full pipeline)",
    data="SQLite tables alerts, field_tasks, evidence, detections, reports, audit_log; /api/segment runs predict.py + run_graph_analysis.py",
    code="backend/alerts.py, routers.py, insight.py · frontend/app/{alerts,field,reports,upload}/page.tsx",
    why="Workflow is implemented with demo users; no real field verification data exists and nothing is deployed with a forest department."), """
The platform also has workflow screens.
Alerts are rule based. There are six rules, for example a critical patch when S is at least zero point two five, low confidence below sixty percent, and connectivity degradation of ten percent or more between years.
Field Work lets an officer receive a task, attach GPS and photo evidence, and have it verified. Reports produce a structured JSON report for each run. New Analysis runs the whole pipeline on a downloaded scene: prediction, patches, graph and criticality.
All of this is implemented and works with demo users. But there is no real field verification data, and the system is not deployed with any forest department.
""")

# ---------------------------------------------------------------- 17. BACKEND / DB
add("Backend", "Backend and database — what actually exists", "slide", """
<div class="two"><div>
<h3>SQLite via SQLAlchemy — 15 tables (backend/db.py)</h3>
<table class="t small">
<tr><td>organizations, users</td><td>6 roles: state_admin, senior_officer, range_officer, field_officer, gis_officer, analyst</td></tr>
<tr><td>study_areas, scenes, label_sources, models</td><td>registry mirrored from files on disk (registry.py)</td></tr>
<tr><td>analysis_versions</td><td>one row per pipeline run: model, scene, threshold, τ, k, IIC, PC, ECA…</td></tr>
<tr><td>detections</td><td>AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED → FIELD_VERIFIED / REJECTED → CONFIRMED</td></tr>
<tr><td>alerts, field_tasks, evidence</td><td>rule alerts; tasks; GPS + photo evidence</td></tr>
<tr><td>projects, scenarios, reports</td><td>saved work (scenarios always SIMULATED)</td></tr>
<tr><td>audit_log</td><td>append-only record of actions</td></tr>
</table></div><div>
<h3>Design</h3>
<ul class="compact">
<li>Rasters, checkpoints and run artefacts stay <b>on disk</b>; the DB stores paths, manifests and workflow state</li>
<li>FastAPI serves ≈ 50 endpoints; JWT (HS256) + bcrypt; role capabilities enforced per action</li>
<li>Demo accounts seeded when empty (password from ECO_DEMO_PASSWORD)</li>
<li>Deployment config: Render (Docker API, <b>no torch → cannot run inference</b>) + Vercel frontend</li>
</ul>
<h3>Honest gaps</h3>
<ul class="compact"><li>Most analysis endpoints do not require login; only /api/segment and workflow writes do</li><li>No migrations, no rate limiting, SQLite not production-grade</li><li>Paper §V-A still says "no backend, database or ML runtime" — outdated</li></ul>
</div></div>
""", """
Is there a real backend and database? Yes, and here is exactly what exists.
A Fast A P I backend, with SQLAlchemy over SQLite, in a file called ecoconnect dot db. There are fifteen tables. Users and organisations with six roles. A registry of study areas, scenes, label sources and models, mirrored from the files on disk. Analysis versions, one row per pipeline run with its parameters and indices. Detections with a verification status chain. Alerts, field tasks and evidence. Projects, saved scenarios and reports. And an append-only audit log.
Rasters, model checkpoints and run artefacts stay on disk. The database stores paths, manifests and workflow state.
Authentication uses J W T tokens with bcrypt password hashing, and role capabilities are checked per action.
There is a deployment configuration for Render and Vercel, but the deployed A P I image has no PyTorch, so it cannot run inference.
The honest gaps: most analysis endpoints do not require login, there are no database migrations, and SQLite is not production grade. And the paper still says there is no backend or database, which is now outdated.
""")

# ---------------------------------------------------------------- 18. FILE MAP
add("File map", "Where everything lives", "slide", """
<div class="three">
<div><h4>DATA</h4><p>ecoconnect/gee/stac_acquire.py — S1/S2 STAC composites<br>ecoconnect/gee/gmw_labels.py — GMW labels<br>scripts/acquire_study_area.py<br>scripts/build_tiles.py · geospatial/preprocessing/tiling.py<br>configs/acquisition.yaml, study_areas.yaml, dataset*.yaml</p>
<h4>ML</h4><p>ml/models/unet.py — U-Net/EfficientNet<br>ml/datasets/tiles.py — loader<br>ml/training/trainer.py — loop<br>ml/evaluation/metrics.py — loss, IoU…<br>ml/inference/predict.py — sliding window<br>scripts/train.py, evaluate.py, predict.py, threshold_sweep.py<br>configs/train_dev*.yaml, train_full*.yaml<br>notebooks/colab_train_unb7.ipynb</p></div>
<div><h4>GRAPH / ANALYSIS</h4><p>geospatial/patch_extraction/extract.py<br>graph/construction.py — nodes, edges<br>graph/connectivity.py — IIC, PC, ECA<br>graph/criticality.py — leave-one-out<br>graph/what_if.py — removal<br>graph/explain.py — explanations<br>graph/restoration.py — gain ranking<br>pipeline/analysis.py · scripts/run_graph_analysis.py<br>configs/graph.yaml</p>
<h4>OUTPUTS</h4><p>outputs/segmentation/&lt;exp&gt;/ — metrics, curves, checkpoints<br>outputs/runs/&lt;area&gt;/&lt;run&gt;/ — manifest, patches.geojson, graph.json, criticality.csv, restoration.csv, tau_sensitivity.json</p></div>
<div><h4>BACKEND</h4><p>backend/main.py — runs, what-if, segment<br>backend/routers.py — auth, alerts, field, projects, reports<br>backend/scenarios.py — Scenario Lab + feasibility<br>backend/db.py, auth.py, registry.py, alerts.py, insight.py<br>pipeline/report.py — report JSON</p>
<h4>FRONTEND</h4><p>frontend/app/* — 17 routes<br>lib/api.ts — API client<br>hooks/use-analysis.tsx — run state<br>components/maps, graph, analysis, charts, chat</p>
<h4>TESTS &amp; DOCS</h4><p>tests/ — 44 pytest<br>docs/ — RESULTS_PROVENANCE, EXPERIMENTS, PAPER_IMPLEMENTATION_GAP, MODEL_CARD…</p></div>
</div>
""", """
This slide is your map of the repository. Pause the video here if you need to.
Data acquisition is in the gee folder and the acquire and build tiles scripts. The machine learning is in ecoconnect slash ml: the model, dataset, trainer, metrics and inference. The graph analysis is in ecoconnect slash graph: construction, connectivity, criticality, what-if, explain and restoration. The backend has main, routers and scenarios. The frontend has seventeen routes under app. And all results live under outputs.
""")

# ---------------------------------------------------------------- 19. PAPER GAP
add("Paper alignment", "Paper vs implementation", "slide", """
<div class="three">
<div class="col ok"><h4>Implemented and matches paper</h4><ul class="compact">
<li>Patch tuple (Eq. 2), MMU 2 ha</li><li>k = 3, τ = 5 km, weight Eq. 6</li><li>IIC headline; PC, ECA; Eq. 7 as interface only</li><li>Leave-one-out ΔC, S (Eqs. 8–9)</li><li>What-if ΔC (Eq. 10)</li><li>Rule-based explanations</li><li>Restoration R and R/cost (Eqs. 11–12)</li><li>τ ∈ {3,5,8} sensitivity</li><li>Synthetic Tables VI–VIII reproduced (max |Δ| 5e-16)</li></ul></div>
<div class="col upd"><h4>Implemented — paper is outdated</h4><ul class="compact">
<li>"No model trained" → 5 B0 models trained, real metrics</li><li>"No backend/database/ML runtime" → FastAPI + SQLite + inference</li><li>Synthetic data → real S1/S2 scenes, GMW labels, real runs for 4 areas</li><li>Heuristic UI what-if → exact server recomputation</li><li>Threshold fixed 0.5 → calibrated sweep (0.70)</li><li>Labels: FSI/wetland inventory, ≈14 000 tiles 512² → GMW v3, 1 373 tiles 256²</li><li>Sensors: S2 / Landsat-9 per area → S1 (+S2) for all four</li><li>3-class Eq. 1 → binary</li><li>"Standard library only" → rasterio, torch, etc.</li></ul></div>
<div class="col no"><h4>In paper — not implemented</h4><ul class="compact">
<li>UNB7 (EfficientNet-B7) training</li><li>Own accuracy comparable to 95.56 %</li><li>Field validation</li><li>Species-calibrated τ</li><li>Real restoration costs (Table VIII values were indicative)</li><li>Test-time augmentation in evaluation (code exists, off)</li><li>S1/S2 fusion as final model (only ablation E3)</li><li>Near-real-time monitoring</li><li>Temporal GNN, uncertainty modelling</li></ul></div>
</div>
""", """
Now the research paper alignment. There are three categories.
Implemented and matching the paper: the patch definition, the two hectare unit, k equals three and tau equals five kilometres, the edge weight, I I C with P C and E C A, leave-one-out criticality, the what-if loss, rule-based explanations, restoration gain, and the tau sensitivity. The code even reproduces the paper's synthetic tables to within five times ten to the minus sixteen.
Implemented, but the paper is outdated. The paper says no model was trained. Five models are now trained. It says there is no backend, database or machine learning runtime. All three now exist. It describes synthetic data, but there are now real scenes and real runs for four areas. The heuristic what-if is now exact. The threshold is calibrated. The labels, tile counts, sensors and number of classes all differ from the paper.
Described in the paper but not implemented: UNB7 training, an accuracy of our own comparable to ninety five percent, field validation, a species-calibrated tau, real restoration costs, near real-time monitoring, and the temporal graph network and uncertainty modelling from future work.
""")

# ---------------------------------------------------------------- 20. LIMITATIONS
add("Limitations", "Limitations — say them before the panel does", "slide", """
<ol class="compact big2">
<li><b>Development model only</b>: EfficientNet-B0, ≈30 min on a laptop; UNB7 not trained.</li>
<li><b>Weak labels</b>: GMW is a map, not field truth; errors in GMW propagate.</li>
<li><b>Uneven accuracy</b>: pooled IoU 0.84 is Sundarbans-driven; thin fringes (Kerala, Gulf of Mannar) are near zero.</li>
<li><b>Over-prediction</b>: predicted habitat ≈ 2× GMW in Kerala; pos_weight 25 is not tuned for the 4-area mix.</li>
<li><b>Threshold</b> 0.70 at the edge of the swept range.</li>
<li><b>τ = 5 km and k = 3 are assumptions</b>, not species dispersal data; centroid distance ignores patch shape and water barriers.</li>
<li><b>Change detection</b> is a difference of noisy model outputs; the dashboard chart mixes models.</li>
<li><b>Restoration</b> candidates are marginal-probability areas; no costs, no field feasibility.</li>
<li><b>No field validation</b>, no deployment, demo users only; several analysis endpoints unauthenticated.</li>
<li><b>Reproducibility</b>: 4-area tile set was overwritten; re-run phase2 script to regenerate.</li>
</ol>
""", """
Limitations. Say them before the panel does. It shows you understand your own system.
One. This is a development model, EfficientNet B0. UNB7 is not trained.
Two. The labels are weak. Global Mangrove Watch is a map, not field truth, and its errors propagate.
Three. Accuracy is uneven. The pooled I O U is driven by Sundarbans. Thin fringes are near zero.
Four. The model over predicts, roughly double the reference area in Kerala.
Five. The chosen threshold is at the edge of the tested range.
Six. Tau and k are assumptions, not species dispersal data. Centroid distance also ignores patch shape and barriers.
Seven. Change detection is a difference of noisy model outputs.
Eight. Restoration candidates are model output, with no costs and no field feasibility.
Nine. There is no field validation and no deployment.
Ten. The four-area tile set must be regenerated to reproduce the evaluation.
""")

# ---------------------------------------------------------------- 21. SIMPLE EXPLANATION
add("Summary", "How does it actually work? (for a CS professor)", "slide", """
<div class="loop">
<div class="lb"><b>OBSERVE</b><br>Sentinel-1 radar, 2020 (and 2025 for Kerala)</div>
<div class="lb"><b>UNDERSTAND</b><br>U-Net labels each 10 m pixel: mangrove probability</div>
<div class="lb"><b>CONNECT</b><br>patches become nodes; nearby patches get edges</div>
<div class="lb"><b>IDENTIFY</b><br>delete each node, measure IIC loss → criticality</div>
<div class="lb"><b>SIMULATE</b><br>remove / restore / change τ or threshold, recompute</div>
<div class="lb"><b>PRIORITISE</b><br>add candidate nodes, rank by connectivity gain</div>
<div class="lb"><b>ACT</b><br>evidence, alerts, field tasks, reports — officers decide</div>
</div>
""", """
Now the whole project in simple language, as you might explain it to a computer science professor who is not a remote sensing expert.
EcoConnectAI takes satellite radar images of a coastline. Observe.
A neural network, a U-Net, looks at every ten metre pixel and outputs the probability that it is mangrove. Understand.
We group mangrove pixels into patches, and treat each patch as a node in a graph. Two patches are connected if they are close enough, within five kilometres, and among each other's three nearest neighbours. Connect.
We measure how connected the whole graph is, using a standard landscape ecology index. Then we delete each node in turn and measure how much connectivity drops. The patches whose loss hurts most are the critical ones, and they are not always the biggest. Identify.
We let a user try interventions, removing patches, restoring sites, or changing assumptions, and recompute exactly. Simulate.
We add candidate restoration sites as new nodes and rank them by how much connectivity they add. Prioritise.
Finally, the platform turns this into evidence, alerts, field tasks and reports, so that an officer, not the algorithm, makes the decision. Act.
""")

add("Summary", "Things you must NOT claim", "slide", """
<div class="two"><div><ul class="compact nope">
<li>"Our model achieves 95.56 % accuracy"</li>
<li>"We trained UNB7 / EfficientNet-B7"</li>
<li>"Our labels are ground truth"</li>
<li>"The model is validated" (badge is hard-coded)</li>
<li>"P16 is a critical patch in Kerala" (synthetic)</li>
<li>"Sentinel-2 / fusion is our model input"</li>
<li>"We use Landsat-9" / "Kaggle dataset"</li>
<li>"Restoration costs are INR X lakh"</li>
</ul></div><div><ul class="compact nope">
<li>"Mangroves in Kerala declined 16 % since 2020"</li>
<li>"Real-time satellite monitoring"</li>
<li>"Deployed / used by a forest department"</li>
<li>"Field-verified predictions"</li>
<li>"The assistant is AI / an LLM"</li>
<li>"We use SHAP / Grad-CAM"</li>
<li>"The landing-page numbers are our results" (they are hard-coded synthetic values)</li>
<li>"0.84 IoU on every study area"</li>
</ul></div></div>
""", """
Here is the list of things you must not claim. Read it twice tonight.
Do not say our model achieves ninety five point five six percent. Do not say we trained UNB7. Do not say our labels are ground truth, or that the model is validated. Do not present P16 as a real Kerala patch. Do not say Sentinel-2 or fusion is the model input, and do not mention Landsat or Kaggle. Do not quote restoration costs in rupees.
Do not say mangroves in Kerala declined sixteen percent. Do not claim real-time monitoring, deployment with a forest department, or field verified predictions. Do not call the assistant an L L M, and do not claim SHAP or Grad-CAM.
And do not present the landing page numbers as results. They are hard-coded values from the synthetic prototype.
""")

add("Summary", "The 60-second answer: what is EcoConnectAI?", "slide", """
<div class="quote big">
EcoConnectAI is a satellite-driven conservation decision-support framework. It maps coastal mangrove from Sentinel-1 radar with a U-Net segmentation model trained against Global Mangrove Watch weak labels, converts the map into habitat patches, and represents those patches as a connectivity graph. By deleting each patch and recomputing the Integral Index of Connectivity exactly, it identifies patches whose loss would most damage connectivity — which are often not the largest ones. It lets users run what-if scenarios, explains every ranking from computed evidence, and ranks restoration candidates by connectivity gain. The current system runs on real 2020 data for four Indian landscapes with a development EfficientNet-B0 model; the full UNB7 model, field validation and cost data are the next steps. The goal is to move from mapping habitat to understanding which parts of the landscape are functionally important.
</div>
""", """
Finally, the sixty second answer to: what is EcoConnectAI?
EcoConnectAI is a satellite-driven conservation decision support framework. It maps coastal mangrove from Sentinel-1 radar, with a U-Net segmentation model trained against Global Mangrove Watch weak labels. It converts the map into habitat patches and represents them as a connectivity graph. By deleting each patch and recomputing the integral index of connectivity exactly, it identifies the patches whose loss would most damage connectivity, and these are often not the largest ones. It lets users run what-if scenarios, explains every ranking from computed evidence, and ranks restoration candidates by connectivity gain.
The current system runs on real twenty twenty data for four Indian landscapes, with a development EfficientNet B0 model. The full UNB7 model, field validation and cost data are the next steps.
The goal is to move from simply mapping habitat, to understanding which parts of the landscape are functionally important for conservation decisions.
Good luck tomorrow.
""")
