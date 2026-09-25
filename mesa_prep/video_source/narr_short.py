# Concise narration, one entry per scene in scenes.SCENES order (46 scenes).
N = [
# 0 title
"""This is a technical walkthrough of EcoConnectAI as it exists in the repository today. It is not a marketing video. Every number comes from the project's own output files, configuration and code. Where something exists only in the paper, or only as a plan, I will say so.""",
# 1 labels
"""First, one rule. Every result carries one of four labels, and you must never mix them. Published baseline: the ninety five point five six percent accuracy belongs to the foundation study by Ghorbanian and colleagues, not to us. Prototype or synthetic: the paper's Tables six to eight, including patch P16, were computed on synthetic geometry. Development subset, not final: real data, a small EfficientNet B0 model. Everything the app shows today is in this class. And not yet run: the full UNB7 model.""",
# 2 problem
"""The problem. Mangrove maps tell you where habitat is, but not which patches hold the landscape together. A small patch can be the only stepping stone between two regions. EcoConnectAI segments mangrove from Sentinel-1 radar, turns the mask into patches, builds a connectivity graph, and ranks patches by the exact connectivity loss when each one is removed. It then runs what-if scenarios, explains rankings, and ranks restoration sites.""",
# 3 architecture
"""Here is the architecture, mapped to real files. Sentinel data comes from public STAC catalogues. Scenes are composited and tiled. A U-Net with an EfficientNet encoder produces a probability map. Thresholding and connected components give patches, which become graph nodes. The graph gives connectivity, criticality, what-if, explanations and restoration. A Fast A P I backend with SQLite serves a Next J S interface.""",
# 4 stack
"""The stack, verified from code. Frontend: Next J S, React, TypeScript, Leaflet maps, React Flow for the graph, Recharts. Backend: Fast A P I, SQLAlchemy over SQLite, J W T authentication. Machine learning: PyTorch with the segmentation models library. Raster work: rasterio, pyproj, shapely. The graph mathematics is our own pure Python code, with no NetworkX. Forty four automated tests pass.""",
# 5 data sources
"""Where the data comes from. Sentinel-1 radiometrically terrain corrected backscatter, from Microsoft Planetary Computer, is the model input. Sentinel-2 level 2 A, from Earth Search, is ancillary. Labels are Global Mangrove Watch version three, twenty twenty. There is no Kaggle dataset, no Landsat, no field survey, and Google Earth Engine was not used.""",
# 6 S1
"""Sentinel-1 details. The product is R T C gamma nought from interferometric wide swath scenes. We use V V and V H in decibels, with no ratio band. Terrain correction is done by the provider. There is no spatial speckle filter; instead a per-pixel temporal median over the year's scenes reduces speckle. Everything is on a ten metre UTM grid, z-score normalised using training statistics only. The proof it is Sentinel-1 only: the dataset config selects bands zero and one, and the experiment records two input channels. Radar is chosen because it sees through monsoon cloud.""",
# 7 S2
"""Sentinel-2 is ancillary. Six bands plus N D V I and N D W I, cloud masked with the scene classification layer, median composited. It is used in two ablation experiments, the basemaps, and a restoration rule. It is not the input of the reported model.""",
# 8 labels
"""Labels. We train against Global Mangrove Watch, which is weak supervision. Say it exactly: these are reference labels from a published map, not field ground truth, so every accuracy figure is agreement with G M W. The areas differ hugely: Kerala has about one hundred hectares of mangrove, Sundarbans nearly fifty nine thousand. Note the paper mentions Forest Survey of India labels; the code uses G M W.""",
# 9 tiles
"""The dataset. Scenes are cut into two hundred and fifty six pixel tiles. One thousand three hundred and seventy three tiles were written across four areas. The split is by spatial blocks, so overlapping neighbours cannot leak between train and test. Development mode used eight hundred training, one hundred and ninety five validation and two hundred test tiles. Augmentation is flips and rotations only.""",
# 10 model
"""The model is a U-Net decoder on an EfficientNet encoder. The encoder, pretrained on ImageNet, downsamples the two channel radar tile to learn what is present. The decoder upsamples back, and skip connections restore where things are, which preserves thin mangrove fringes. A sigmoid gives per-pixel probability. UNB7 means the B7 encoder, from the foundation study. What we actually trained is the same U-Net with a B0 encoder, six point two five million parameters, fully fine tuned on a laptop.""",
# 11 code model
"""This is where the model is built. The alias U N B 7 maps to efficientnet b7, used by the full config. The development config uses b0. Every checkpoint stores its encoder name, and all our trained checkpoints say efficientnet b0. So the code itself stops us calling our model UNB7.""",
# 12 training
"""Training of the main model. AdamW, learning rate three times ten to the minus four, cosine schedule, batch eight, forty epochs. The loss is binary cross entropy plus Dice, which handles rare positives. The positive weight of twenty five was set for Kerala and makes the four area model over predict: validation recall zero point nine seven, precision zero point seven eight. The best checkpoint, by validation I O U, came at epoch thirty two. Training took about thirty minutes on an Apple M3.""",
# 13 evaluation
"""Evaluation, the key table. The four area model scores test I O U zero point eight four two and F 1 zero point nine one four on two hundred held-out tiles. That is our development result. The Kerala-only models are weak, with I O U between zero point zero two and zero point zero five. The ninety five point five six percent is shown separately as the published baseline. Our UNB7 run is not yet run. All metrics are agreement with G M W.""",
# 14 caveat
"""A caveat you must know. The zero point eight four is pooled over pixels, and most mangrove pixels are in Sundarbans. By area, Sundarbans has correct mangrove in seventy six of eighty six test tiles, but Kerala has it in only one of forty three. So for thin fringes the model is not reliable yet. If asked for your I O U: zero point eight four on our pooled development split against G M W, driven by Sundarbans, and not the paper's ninety five percent.""",
# 15 curves
"""These are the real curves and confusion matrix. Training loss falls from one point eight to zero point three four, and validation I O U peaks at epoch thirty two. The confusion matrix shows few missed mangrove pixels but more false positives: the model over predicts.""",
# 16 screen models
"""In the app, the Data and Models page shows these metrics, read from the evaluation files. One warning: the green validated model badge is hard-coded. Call it a development model.""",
# 17 threshold
"""From probability to mask. Inference uses an overlapping sliding window with smooth blending to produce a probability raster. A threshold makes it binary. We calibrated the threshold on test tiles: F 1 rises from zero point nine one two at zero point three to zero point nine three three at zero point seven, so zero point seven was chosen. But it is the edge of the tested range. The threshold matters because it changes patch shapes, and therefore the graph.""",
# 18 patches
"""Patch extraction. The mask is split into eight-connected components, and components under two hectares are dropped. Each patch stores an id, area, centroid, confidence, which is the mean probability, class and polygon. In the current Kerala run, sixty components gave twenty four patches. Remember: size is an attribute. Importance comes from position in the network.""",
# 19 graph
"""The graph. Each patch is a node. For every patch we take its three nearest patches by centroid distance, and keep a link only if it is within tau, five kilometres. Each edge is weighted by confidence and decays with distance. Tau stands in for dispersal distance. It is an assumption, not calibrated for a species, so every run also repeats the analysis at three and eight kilometres.""",
# 20 code edges
"""In code: sort by distance, take the first k, keep those within tau, store each pair once. The weight is exactly equation six of the paper.""",
# 21 metric
"""The metric. We want one number for how connected the network is. The headline is I I C, the integral index of connectivity. For every pair of patches, multiply their areas and divide by one plus the number of links between them; unreachable pairs add nothing. So I I C rewards large patches that reach each other in few steps. We also report P C and E C A. The paper's equation seven score is only an interface score; it can even rise when a patch is removed, so decisions use I I C.""",
# 22 criticality
"""Criticality, the core contribution. Compute baseline connectivity. Remove one patch and its edges. Recompute. The loss divided by the baseline is S. Repeat for every patch and rank. This is exact: the graph is really rebuilt each time, with no approximation. We also record degree, neighbours, and whether the patch is a cut vertex.""",
# 23 graph theory
"""Graph terms. A node is a patch, an edge a link, degree the number of links, a component a group that can reach each other. A cut vertex is a node whose removal increases the number of components; the interface calls it a bridge patch. Strictly, a bridge in graph theory is an edge. In the picture, removing small patch B separates A and C. Ecologically, they can no longer exchange propagules or fauna.""",
# 24 worked example
"""A real example from the current Kerala run. The largest patch, P01, thirty five hectares, ranks first with a thirty one percent loss, but it is not a cut vertex. Now P17: only three point one hectares, seventeenth by size, yet removing it cuts I I C by twenty seven percent, ranking third, because it is a cut vertex splitting two components into three. In Odisha, patch P09, fifty five hectares, outranks P04 at nine hundred and ten hectares. And remember: P16 exists only in the synthetic results.""",
# 25 evidence screen
"""Here is P17 in the app, with the evidence drawer open: the decision, then C of G, C of G minus v, delta C and S, then geometry and neighbours. Everything is read from stored run files, not generated.""",
# 26 graph screen
"""The graph view, drawn with React Flow. One inaccuracy: the critical bridges box lists every patch with S above zero point two five, including P01, which is not a cut vertex. Only P07 and P17 are. Correct it yourself if asked.""",
# 27 what-if slide
"""The what-if engine: baseline, action, exact rebuild, recompute, difference. Removing P17 costs twenty seven percent of I I C for one point four percent of habitat. Removing P01 costs thirty one percent, but sixteen percent of habitat. Restoring C1 adds one point three percent. Changing tau from three to eight kilometres keeps the ranking stable. Raising the threshold drops patches from twenty six to twenty one. This is not a forecast. It is a what-if under stated assumptions, and it is labelled simulated.""",
# 28 command removed
"""On the dashboard I selected P17 and pressed remove. The server rebuilt the graph and returned minus twenty seven percent I I C and two to three components. The paper's prototype did this heuristically in the browser; now it is exact.""",
# 29 scenario screens
"""The Scenario Lab has seven types. Here, tau sensitivity and threshold sensitivity, both labelled simulated, each with an explanation built from computed values. These are your evidence-based answers to why five kilometres and why this threshold.""",
# 30 xai
"""Explainability. The system does not just print a score. Here is P17's real explanation: rank, loss, area, links with distances, cut vertex status and confidence. Each sentence appears only if its evidence exists. There is no SHAP, LIME or Grad-CAM. This is graph-level, rule-based explainability.""",
# 31 assistant
"""The assistant answers by matching an intent and filling templates from stored files, with sources and the result label. It is not a large language model, and it never invents figures.""",
# 32 restoration
"""Restoration asks the reverse question: what if we add a patch? Each candidate is inserted as a node linked to its nearest patches, connectivity is recomputed, and candidates are ranked by gain. Candidates are areas of marginal model probability, not surveyed sites. There are no invented costs: candidates are ranked by connectivity gain because validated cost data is not available. Uploading a real cost table switches to gain per cost.""",
# 33 restoration screen
"""The planner for Kerala: C1 adds one point three percent I I C with three new links. The panel separates why recommended, why not, and not assessed, such as legal status, ownership and cost. Recommended is a rule output, not a field verdict.""",
# 34 change detection
"""Change detection is partly implemented. Kerala has a second Sentinel-1 composite for twenty twenty five. Running the same model on both years gives three hundred and eighty two versus three hundred and nineteen hectares. It is labelled observed, model output. But this model's Kerala I O U is zero point zero two, so this may be noise, not measured loss. Also, the dashboard change chart currently compares runs of different models, so ignore its deltas.""",
# 35 study areas
"""The four study areas. Kerala, a Ramsar backwater with thin fringes, is the hardest and most complete case. Sundarbans is the largest mangrove system, with fifty four patches in our run. Gulf of Mannar has very sparse mangrove, and Odisha is a delta. Predicted habitat exceeds G M W everywhere, which confirms over prediction. And note the paper lists Landsat 9 for Gulf of Mannar; the implementation uses Sentinel-1 for all four.""",
# 36 command
"""A short U I tour. The dashboard shows patches, candidates, critical patches and links on real imagery, with basemaps from our own Sentinel rasters. The cards come from the run bundle. The map strip says real data, development model, not final.""",
# 37 analysis
"""The interactive map overlays the raw model probability raster under the patches, and the sensitivity explorer re-runs the analysis with another tau, k or metric. The small importance timeline in the inspector is synthetic, so do not present it.""",
# 38 workflow
"""Workflow screens: rule-based alerts, field tasks with photo evidence and verification, JSON reports, and a New Analysis page that runs the full pipeline. These work with demo users. There is no real field data, and no deployment with a forest department.""",
# 39 backend
"""The backend is real. Fast A P I with SQLite and fifteen tables: users and roles, a registry of scenes and models, analysis versions, detections, alerts, field tasks, evidence, projects, scenarios, reports and an audit log. Rasters stay on disk. The gaps: many analysis endpoints need no login, there are no migrations, and the paper still says there is no backend.""",
# 40 file map
"""This slide maps every stage to its folder. Data acquisition lives in the gee folder and the acquisition and tiling scripts. The machine learning lives in ecoconnect slash ml. The graph analysis lives in ecoconnect slash graph, one file per stage. The backend is in the backend folder, the interface in frontend slash app, and every result in outputs. Pause here if you need to.""",
# 41 paper
"""Paper alignment. Matching: the equations for patches, edges, I I C, criticality, what-if and restoration, and the synthetic tables reproduce exactly. Paper outdated: it says no model, no backend and synthetic data, but now there are trained models, a backend and real runs; labels, sensors and classes also differ. Not implemented: UNB7 training, field validation, species-calibrated tau and real costs.""",
# 42 limitations
"""Limitations, which you should state first. A development B0 model. Weak labels. Accuracy driven by Sundarbans. Over prediction. A threshold at the edge of the sweep. Tau and k as assumptions. Noisy change detection. Restoration without costs or field checks. No field validation or deployment.""",
# 43 simple
"""In simple words. Observe: satellite radar. Understand: a U-Net gives mangrove probability per pixel. Connect: patches become nodes, nearby patches get edges. Identify: delete each node and measure connectivity loss. Simulate: try interventions and recompute. Prioritise: rank restoration sites by gain. Act: evidence, alerts and field tasks, so that officers decide.""",
# 44 must not
"""Things you must not claim. Not ninety five percent accuracy. Not UNB7. Not ground truth labels. Not P16 as real. Not Landsat or Kaggle. Not rupee costs. Not a measured sixteen percent mangrove decline. Not real-time monitoring, deployment, or field verification. Not an L L M or SHAP. And not the landing page numbers, which are hard-coded synthetic values.""",
# 45 60 seconds
"""The sixty second answer. EcoConnectAI is a satellite-driven conservation decision support framework. It maps mangrove from Sentinel-1 radar with a U-Net trained on Global Mangrove Watch weak labels, converts the map into patches and a connectivity graph, and finds the patches whose removal most reduces connectivity, which are often not the largest. It runs what-if scenarios, explains every ranking, and ranks restoration by connectivity gain. Today it runs on real data for four Indian landscapes with a development model; UNB7, field validation and costs are next. Good luck tomorrow.""",
]
