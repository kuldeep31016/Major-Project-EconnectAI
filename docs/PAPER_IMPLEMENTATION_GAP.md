# Paper ↔ implementation gap register

Format: CURRENT PAPER CLAIM · IMPLEMENTATION STATUS · REQUIRED CHANGE · SCIENTIFIC IMPACT · RECOMMENDED REVISION.
The paper is `docs/EcoConnectAI_IEEE_paper.pdf`. Nothing in the implementation changes the methodology; the
gaps are about *status statements* and *configuration details* that the paper fixed before experiments ran.

| # | Current paper claim | Implementation status (2026-09-19) | Required change | Scientific impact | Recommended revision |
|---|---|---|---|---|---|
| 1 | Table II: segmentation "not implemented; no model trained" | Dev models trained on Kerala (B0, S1/S2/S1+S2); UNB7 final not yet run | none to method; update status | none | Update Table II to "development runs executed; UNB7 pending GPU", cite `RESULTS_PROVENANCE.md` |
| 2 | Table V reports foundation-study accuracy only | unchanged; our dev metrics exist (IoU 0.02–0.05 vs GMW) | keep separation | none | Add a row block "our development result (weak-label agreement)" clearly separated; never merge |
| 3 | §IV-A: threshold 0.5, MMU 2 ha, "uncalibrated" | threshold sweep implemented; E1 → 0.70, E2 → 0.45 on Kerala | report calibrated values per model | strengthens the paper (turns an admitted gap into an experiment) | Add "threshold calibrated by sweep against the reference map on held-out tiles" |
| 4 | Table III: Gulf of Mannar uses Landsat-9 OLI-2, 30 m | acquisition uses Sentinel-2 L2A 10 m for all four areas | either revise the table or add a Landsat path | none to method; a data-table inconsistency | Revise Table III to Sentinel-2 for all areas (decision Q15) |
| 5 | §VI-A: results computed over synthetic patch geometry | real-patch runs exist for Kerala (dev model); other areas in progress | replace/add real-geometry results with labels | changes the evidence base of §VI-C–F from synthetic to real (dev) geometry | Present both: synthetic instance (method validation) and real dev-model instance (pipeline validation, NOT FINAL) |
| 6 | §VI-F: τ sensitivity ρ ≈ 0.49 on Kerala synthetic | on real dev geometry: ρ = 0.86 (3 km) / 1.00 (8 km) for the E1 run | report both | shows τ sensitivity is landscape-dependent | Add the real-geometry τ result with its label |
| 7 | §IV-A: S1 drives segmentation, S2 complementary, not fused | E1 = S1-only reported model; E2/E3 exist as labelled ablations | none | none | Add ablation table labelled "multisource ablation, not the proposed model" |
| 8 | §V-C: acquisition window, scene count, split, hardware "unfixed" | now fixed for Kerala (2020, S1×6, S2×6; 176/32/48 spatial blocks; Apple M3 MPS for dev) | fill in | none | Fill Table IV/§V-C from `experiment.json` / scene sidecars |
| 9 | Composite interface score Eq. 7 | implemented; found non-monotone under patch removal | none | minor; supports the paper's own caveat | Add one sentence: "the composite may increase after a removal because quality/redundancy terms are averages; it is displayed only as a UI score" |
| 10 | Landscape area A_L = configured footprint | real runs use valid-pixel AOI extent (~489 km² for Kerala vs 486 configured) | document | none | State A_L definition for real runs |
| 11 | What-if exact only offline | exact in the interface via backend recomputation | update status | none | Update Table II / §VII third limitation (now resolved) |
| 12 | Restoration candidates: source unspecified; Table VIII costs "indicative" | candidates = marginal-probability components; no costs shipped | document | none | Add candidate-generation sentence; state costs are user-supplied |
| 13 | New platform features (field verification, alerts, projects, audit) | not in the paper | none required for the paper | none — outside the paper's scope | Mention as "decision-support platform extensions" in future work, not as results |
