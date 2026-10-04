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

### Who is EcoConnectAI for? Who will use this app?
It is designed for the people who plan and protect coastal mangroves: state forest department officers (senior and
range officers) who decide what to protect first; field officers who visit sites and record GPS and photo evidence;
GIS officers and research analysts who run and check the analysis; and conservation teams who plan restoration.
Researchers and reviewers can also use it to inspect how each result was produced. The app has role-based accounts
(administrator, senior officer, range officer, field officer, GIS officer, research analyst), and each role sees the
tools it needs. Today it is a research prototype, not a system adopted by any agency.

### How do I use the app? What can I do here?
Start on the Dashboard: the map shows the mangrove patches of the selected study area, and the cards show patches,
links, mangrove area and restoration options. Click a patch to see its area, importance and confidence. The
Interactive Map compares the habitat map with a sensitivity view; Analysis Tools show the connectivity network and the
patch importance ranking; Scenarios lets you simulate losing a patch or restoring a site; Restoration ranks candidate
sites; Field Reports manages field checks; Reports gives a plain-language report per analysis; Alerts lists rule-based
warnings. You can ask this assistant about any of them.

### What problem does EcoConnectAI solve?
A normal habitat map shows where mangroves are, but not which pieces hold the whole system together or what would be
lost if one disappeared. EcoConnectAI adds that: it links patches into a network, ranks how much the network depends on
each patch, simulates losses and restoration, and sends every suggestion for a field check before any decision.

### What are the future plans (roadmap)?
Planned next steps are field validation with partners, tracking change over time with the same model on several
years, combining radar with optical satellite data, training the stronger EfficientNet-B7 model from the foundation
study, and adding cost, ownership and land-use layers to restoration planning. These are plans, not finished work.

### How do I simulate losing a patch?
On the Dashboard, click the patch on the map, then press **Remove Patch** in the What-if card (or "Simulate Removal" in
the patch card). The map flies to the patch, it flashes and fades, and the card shows the recomputed result: the drop in
connectivity (IIC), the habitat share removed and whether the network splits into more groups. On the Connectivity
graph page the same "Remove" button animates the network. Scenario Lab (Scenarios) offers more options. Every result is
an exact recomputation on the stored network — a simulation, not a forecast. Undo restores the real network.

### What scenarios can I run in the Scenario Lab?
Eleven kinds, in three groups. Lose habitat: A remove patch, B remove everything inside a drawn area, E reduce a patch's
area. Add habitat: C restore one candidate, D restore several candidates, F add a hypothetical patch. Test the
assumptions: G change the connection radius, H sensitivity grid (radius × neighbours), I compare 3 / 5 / 8 km, J compare
probability thresholds, K compare two observation periods. Pick one, set it up, press Run, and the map animates the
change before the before/after numbers appear. Results are labelled SIMULATED.

### What happens when I change the connection radius?
The connection radius (τ, 5 km by default) is the longest gap across which two patches count as linked. A smaller radius
removes links, so the network breaks into more groups; a larger one adds links. The patch ranking is recomputed for each
setting, and Scenario Lab shows how stable the ranking is (Compare τ 3/5/8 km and the sensitivity grid). A patch that
stays important at every radius is a more robust priority than one that is important at only one setting.

### How are alerts generated?
Alerts are created by fixed rules over the stored results of each analysis — not by the AI model writing warnings.
Current rules: a critical-patch alert when a patch's criticality score is 0.25 or more (critical at 0.4); a
low-confidence alert when a patch's mean model probability is below 0.60; habitat-change and connectivity-change alerts
when two runs of the same area differ by at least 5 % in habitat area or 10 % in IIC; uncertain-habitat ("field check")
alerts for large marginal-probability areas; restoration-opportunity alerts for candidates that add at least 1 %
connectivity (at most 3 of each per run); and a pending-verification alert when detections await review. Each alert
stores the numbers that triggered it. Thresholds are operational settings, not ecological facts. Officers acknowledge,
assign, resolve or dismiss alerts.

### Can the AI confirm its own detections?
No. A detection moves AI DETECTED → UNDER REVIEW → FIELD ASSIGNED → FIELD VERIFIED → CONFIRMED or REJECTED, and it can be
verified or confirmed only when a field task holds evidence that an officer has ACCEPTED. Field officers submit GPS and
photo evidence; senior or range officers (or the administrator) accept or reject it. AI output never verifies itself.
Accepted evidence that contradicts the model is recorded as a model disagreement for a future experiment; the model is
never retrained automatically.

### What is in a report and how do I download it?
Each analysis has a report written in plain language: the key numbers at a glance, how the result was made (satellite
images → AI habitat map → patches → network → importance → restoration), which patches matter most, what happens if the
most important one is lost (with an animation), how sensitive the result is to the travel-distance assumption, where
restoration helps most, and how far to trust it. The full technical text is kept under "Technical details". Use
**Download PDF** on the report (official reports are generated on the server; run reports print from the browser).

### Who can do what in the app? Who approves restoration?
Everyone can view results and model cards. GIS officers and research analysts can run analyses and change parameters.
Senior and range officers (and the administrator) manage projects, assign field tasks and accept or reject field
evidence; field officers (and range officers) submit evidence. Alerts can be managed by senior, range and GIS officers.
Only a senior officer or the administrator records the final decision on a restoration candidate, and a candidate can
be APPROVED only after it has been field-verified. Only the administrator can mark a model VALIDATED.

### How do I add a new analysis or study area?
GIS officers, research analysts and the administrator can start one from **New Analysis** in the sidebar: choose a
configured study area, a downloaded satellite scene and a trained model, then run the pipeline (habitat map → patches → network →
importance → restoration). Results appear as a new run you can pick in the period selector. A brand-new study area must
first be configured and its Sentinel-1 scenes downloaded (see the data setup documentation).

### How does EcoConnectAI work, step by step?
1) Sentinel-1 radar images of the coast are prepared (median of several dates, 10 m pixels). 2) A U-Net deep-learning
model gives every pixel a probability of being mangrove. 3) Pixels above the model's threshold are joined into patches,
and pieces smaller than 2 ha are dropped. 4) Each patch is linked to its nearest neighbours within the travel distance
(3 neighbours within 5 km by default), giving a network. 5) Connectivity indices (IIC, PC, ECA) are computed, and each
patch is removed in turn to measure how much the network depends on it (criticality). 6) Uncertain areas near the
network are tested as restoration candidates. 7) Alerts, field checks, reports and this assistant help people act on the
results. Every step records its inputs so the result can be reproduced.

### How are habitat patches extracted from the probability map?
The model's output is a probability map. Pixels at or above the model's decision threshold (0.7 for the reported Kerala
development model; it is stored with each run) count as mangrove. Touching mangrove pixels are joined into connected
regions, and regions smaller than the minimum mapping unit (2 ha) are dropped as noise. Each remaining region is a
patch with an id (P01, P02, …), area, centre and mean model confidence.

### How are restoration candidates found?
Candidates come from the same probability map: connected areas whose probability is marginal (between 0.3 and 0.7,
below the habitat threshold) and at least 1 ha are taken, and the 12 largest are kept. For each, the network is
recomputed as if the area were habitat, and its gain is the increase in connectivity (IIC) it would bring. Large
marginal areas are flagged "uncertain habitat — field check", because they are more likely mangrove the model was unsure
about than sites to plant. Candidates are model output, not surveyed or approved sites; cost, ownership, legal status and
hydrology are not assessed.

### How is criticality calculated?
Each patch is removed from the network one at a time and the connectivity index (IIC) is recomputed exactly. The
criticality of a patch is the share of connectivity lost when it is removed (ΔC / C), shown as a 0–100 score relative to
the most critical patch. A patch whose removal splits the network into more groups is also marked as a bridge (cut
vertex). Because a small bridge patch can carry a lot of connectivity, criticality can be high even for small patches.

### What is UNB7 and the 95.56 % figure?
UNB7 is the U-Net with an EfficientNet-B7 encoder from the foundation study (Ghorbanian et al.), which reported 95.56 %
overall accuracy (κ 0.94) on their Sentinel-1 data. That is their published result, not EcoConnectAI's. UNB7 has not been
trained in this project; the reported EcoConnectAI model is a smaller EfficientNet-B0 development model.

### What does the connectivity graph page show?
It draws the coast as a network: each circle is a habitat patch (bigger = larger area), and each line is a link between
patches close enough to be connected (thicker = stronger). Ring colour shows how important a patch is, red halos mark
bridge patches whose loss splits the network, and dashed amber lines are bridge links. The side panel lets you remove a
patch or add a restoration site and see the recomputed result.

### What is the connectivity model? Explain the connectivity model.
EcoConnectAI models the coast as a network (graph). Each mangrove patch is a node, sized by its area. Each patch is
linked to its nearest neighbours (3 by default) that lie within the travel distance τ (5 km by default); a link's weight
falls with distance, so close patches are strongly connected and distant ones weakly. Three indices summarise the
network: IIC (how well the whole network hangs together, counting patch areas and links), PC (like IIC, but each link
counts by how likely it is to be crossed) and ECA (the size of one unbroken forest that would be equally connected).
Removing each patch in turn and recomputing IIC gives its criticality. The model is structural - it uses patch geometry
and distance only; it does not observe or predict animal movement, and τ is an assumption that is tested at 3, 5 and 8 km.

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
Training the EfficientNet-B7 model and the Sentinel-2 / fused ablations on a GPU at four-area scale, a model that can
map thin mangrove fringes (Kerala, Gulf of Mannar) and generalises better in Odisha, multi-year inference with one model, a field campaign with a forest department to
validate maps, and ownership, legal and cost layers for restoration.

### Can EcoConnectAI use the latest satellite images?
Yes, through the Satellite Monitor page. It searches a public Sentinel-1 catalogue (by default Microsoft Planetary Computer's Sentinel-1 RTC collection, the same product the model was trained on and available about a day after each pass; Copernicus Data Space can be selected instead) for the latest available Sentinel-1 observation (radar, VV + VH, 10 m) covering the selected study area and shows its real acquisition time, publication time, timeliness, orbit and coverage, plus the recent passes (every 2 to 12 days depending on the area). This is near-real-time satellite imagery, not live video. "Analyze latest scene" retrieves the latest 8 acquisitions from the same orbit, combines them into a median like the training data, runs the trained U-Net (model multi_E1_s1_b0_dev_r3, trained on 2026-10-04 on a leakage-free split) with the study area's own calibrated threshold, and then the same patch, connectivity, criticality and restoration steps, and stores the result as a separate run with full provenance. A single date over-predicts, so the 8-acquisition median is the default. Tested on real 2026 data, the near-real-time map agreed with the Global Mangrove Watch 2020 map at IoU 0.88 to 0.90 for the Sundarbans and 0.61 to 0.62 for Bhitarkanika (Odisha), where it maps about 50 % more habitat than the reference. The model is not reliable for Kerala (Vembanad-Kol) or the Gulf of Mannar, whose mangroves are thin fringes of about 100 ha and 44 ha that this 10 m radar model cannot map; the page and the reports say so. The stored 2020 analysis stays the dashboard default. Results are model predictions, not field-validated; differences from earlier runs are model-output differences, not confirmed habitat change.

### How was the AI model rebuilt, and how accurate is it now?
The trained file of the original model (multi_E1_s1_b0_dev) was lost on 2026-10-04 when the old project folder was deleted with no backup, so the model was rebuilt the same way: the 2020 Sentinel-1 radar data (an 8-scene yearly median) and Global Mangrove Watch 2020 labels were downloaded again for the four study areas, the same 800/195/200 training/validation/test tiles were built, and the same U-Net with an EfficientNet-B0 encoder was trained with identical settings (40 epochs, seed 42). The rebuilt model is called multi_E1_s1_b0_dev_r2. Three known issues were fixed at the same time: the probability threshold is now chosen on the validation tiles instead of the test tiles, evaluation uses the model's own normalisation, and stale statistics can no longer be reused. Its held-out test score is IoU 0.873 and F1 0.932 at the calibrated threshold 0.97 (at threshold 0.5 it scores IoU 0.788, versus 0.842 for the lost original). By area, it agrees with the 2020 reference map at IoU 0.913 in the Sundarbans and 0.724 in Bhitarkanika, but cannot map the thin mangrove fringes of Kerala (0.000) or the Gulf of Mannar (0.008). These scores measure agreement with an existing map, not field accuracy.

### Was there data leakage in the model evaluation, and what are the honest accuracy numbers?
Yes, in the earlier models. Training tiles are 256 pixels wide but placed every 128 pixels, so a tile at the edge of a training block overlapped the neighbouring test block: some test pixels had been seen in training. On 2026-10-04 the split was rebuilt the standard way: tiles are grouped into spatial blocks, the blocks of each study area are dealt out so that training, validation and test each get their share of that area's mangrove (a stratified spatial split), and every tile that reaches into a block of another split is left out (a buffer). The model retrained on this split is multi_E1_s1_b0_dev_r3. Its held-out test score is IoU 0.776 and F1 0.874 at the threshold 0.96 chosen on the validation tiles. Per study area, on test tiles it never saw: Sundarbans IoU 0.925 (reliable), Odisha 0.318 (unreliable - the earlier 0.724 included tiles the model had trained on), Kerala and Gulf of Mannar 0.000 (their held-out tiles contain under 7 ha of reference mangrove, too little to score, and the model does not map them). The Satellite Monitor and the Interactive Map show these levels. All scores are agreement with the Global Mangrove Watch 2020 map, not field accuracy.
