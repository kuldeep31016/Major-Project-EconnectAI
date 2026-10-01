# EcoConnectAI — assistant FAQ

Curated answers used by the EcoConnectAI Assistant (retrieved like any other document; returned verbatim when the
LLM is off). Every statement here must stay true of the repository — update this file when the facts change.
Run-specific numbers are NOT written here: the assistant reads them from the current run at answer time.

### What is EcoConnectAI?
EcoConnectAI is a research prototype that turns free satellite images into a map of mangrove patches, links the
patches into a connectivity network, and shows which patches the network depends on, what happens if one is lost
(simulation), and where restoration could reconnect habitat. Results then move into a human field-verification and
reporting workflow. It is decision support: it provides evidence, and officers decide.

### Why does mangrove connectivity matter?
Mangroves protect coasts from storms, support fisheries and store carbon, and they are lost a few hectares at a time.
A habitat map shows where forest is; it does not show which pieces keep the rest connected. Connectivity analysis
adds that second question, so protection and restoration can be prioritised by the role a patch plays in the
network rather than by its size alone. EcoConnectAI measures structural connectivity from patch geometry; it does
not observe or predict animal movement.

### Why do we use Sentinel-1?
Sentinel-1 is a radar satellite: it images the coast through monsoon cloud and at night, every few days, free of
charge. The foundation study the project builds on mapped mangroves from Sentinel-1 time series. The reported
EcoConnectAI model therefore uses Sentinel-1 VV and VH backscatter (temporal median, 10 m grid). Sentinel-2 optical
imagery is used for visual context and in small ablation experiments only.

### What data does the project use?
Sentinel-1 radiometrically terrain-corrected scenes (Microsoft Planetary Computer), Sentinel-2 L2A optical scenes
for context (Earth Search), and Global Mangrove Watch v3 (2020) as weak reference labels. The labels are an existing
map, not field ground truth. Four Indian coastal study areas are configured: Vembanad–Kol (Kerala), Sundarbans
(West Bengal), Gulf of Mannar (Tamil Nadu) and Bhitarkanika (Odisha).

### What are the limitations of the current model?
It is a development model (U-Net with an EfficientNet-B0 encoder), not a final or production model. Its scores are
agreement with Global Mangrove Watch weak labels, not field accuracy. The four-area score is dominated by the
Sundarbans; in Kerala the model found mangrove in very few test tiles, so Kerala results are weak. The decision
threshold was chosen on the test split, tiles overlap across split borders (possible leakage), and no result has been
field-validated. The EfficientNet-B7 (UNB7) model from the paper has not been trained.

### Is the model accurate or field-validated?
No result is field-validated. The reported development model agrees with Global Mangrove Watch reference labels on
held-out tiles (the assistant quotes the stored IoU and F1 when asked which model is used), which measures agreement
with another map, not truth on the ground. The 95.56 % accuracy that appears in the literature belongs to the
foundation study, on its data — it is not EcoConnectAI's result.

### What does criticality mean?
Criticality measures how much the network depends on a patch. Each patch is removed in turn, the connectivity index
(IIC) is recomputed exactly, and the percentage drop is recorded; patches are ranked by that drop. A patch whose
removal splits the network into more groups is also flagged as a cut vertex.

### Why can a small patch be more important than a large one?
Because importance comes from position in the network, not only area. A small patch that is the only link between
two groups of patches carries all the connectivity between them; removing it splits the network, so the drop in
connectivity can be larger than for a much bigger patch with alternative routes around it. In the current Kerala run
P07 is the worked example. This holds under the baseline assumptions (3 nearest neighbours, 5 km); the sensitivity
grid shows P07 stays in the top five in only some of the tested settings, which should be stated when presenting it.

### Does EcoConnectAI predict animal movement?
No. It measures structural connectivity: how habitat patches are arranged and how close they are, under an assumed
travel distance. It does not track, observe or predict the movement of animals, seeds or fish. Species-specific
dispersal distances are not calibrated, which is why results are tested across several distances.

### What is the 5 km assumption and how sensitive are the results?
Patches are linked to their nearest neighbours within a travel distance τ (baseline 5 km, 3 neighbours). The true
distance depends on species and is not calibrated, so the analysis is repeated at 3, 5 and 8 km (and for other
neighbour counts) and the rankings are compared with a rank correlation. The Sensitivity explorer and the network
summary show, for each run, how stable the top patches are across these assumptions.

### Are what-if results predictions?
No. What-if results are simulations: they recompute the current network under an assumed change (a patch removed,
shrunk, added, or a different distance) and report the difference. They do not forecast whether the change will
happen or what it would mean ecologically.

### What is the purpose of restoration analysis?
It asks where restoring habitat would reconnect the network the most. Candidate areas are places where the model's
probability is marginal (between 0.3 and the habitat threshold); each is inserted into the network and the gain in
connectivity is computed. Candidates are ranked by that gain. It identifies computational candidates only.

### Are restoration candidates approved restoration sites?
No. They are potential candidates that require field and legal assessment. Land ownership, legal status, water
availability, salinity and cost are not assessed in the data, and no cost figures are invented; cost-aware ranking is
used only when a validated cost table is supplied. Large candidates (over 5 ha and over 10 % of the mapped habitat)
are classed as uncertain habitat — likely existing mangrove the model was unsure about — and sent for a field check.

### What changed between 2020 and 2025?
Only runs made with the same model, threshold and patch rules can be compared; the platform warns when they differ.
Differences between two runs are model-estimated change, not confirmed mangrove loss or gain: they include model
uncertainty, and no cause is attributed. Use Scenario Lab → Compare periods to see patches matched by overlap
(stable, grown, shrunk, split, merged, new, disappeared).

### How does field verification work?
An officer sends a patch or candidate for verification, which creates a detection and a field task. Detections move
through AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED → FIELD_VERIFIED or REJECTED → CONFIRMED. Field officers submit an
observation with GPS (typed or read from the photo) and an optional photo; a senior officer accepts or rejects the
evidence. Only accepted evidence makes a result field-verified. Demonstration records are labelled as such.

### Who makes the decisions?
People do. EcoConnectAI identifies and explains; officers review, request field verification and decide. It is not
automated conservation approval, and nothing in the platform approves or funds an action.

### Is EcoConnectAI deployed by a government agency?
No. It is a research prototype with a free-tier public demo (Vercel frontend, Render API, Neon PostgreSQL). There is
no government deployment and no production claim.

### How does the assistant answer questions?
Counts and facts (patches, links, a patch's area or connectivity loss, the model in use) are read directly from the
stored run and database — no AI model is called. Explanations are found by searching the project documentation, the
research paper and the run results (keyword search combined with a small local language-understanding model), and the
answer shows its sources. A language model (Claude) writes the answer only when it is enabled, the user is signed in and
a written explanation is needed; it may use only the retrieved sources and must cite them. If the evidence is weak, the
assistant says it does not know. This is retrieval, not training: no model is trained on project data.

### What would make the project stronger?
Training the EfficientNet-B7 model and the Sentinel-2 / fused ablations on a GPU at four-area scale, fixing the split
leakage and threshold selection, multi-year inference with one model, a field campaign with a forest department to
validate maps, and ownership, legal and cost layers for restoration.
