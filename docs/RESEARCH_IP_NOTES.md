# Research & IP notes

**Status: internal working notes, not legal advice.** Nothing here claims that EcoConnectAI is novel or
patentable. Novelty can only be judged after a professional prior-art search (patent databases such as
Espacenet / Google Patents / Indian Patent Office InPASS, and the scientific literature on landscape
connectivity, e.g. Conefor / Graphab / Circuitscape and remote-sensing mangrove mapping). Any filing decision
must be made with a registered patent agent or IP attorney. Public disclosure (GitHub, demos, papers, talks) can
affect patentability in many jurisdictions — ask the IP professional about timing **before** further disclosure.

This document records what the system actually does, so that an IP professional can assess it.

## 1. Technical problem

Satellite habitat maps say *where* habitat is, but conservation decisions need to know *which fragments hold the
network together*, *what is lost if one disappears*, *where restoration would reconnect it*, and *how far those
conclusions can be trusted*. Existing workflows typically split these steps across separate tools (segmentation,
GIS post-processing, connectivity software, spreadsheets), losing the link between a decision and the evidence
and assumptions behind it.

## 2. Implemented technical workflow (as built, 2026-09-28)

1. **Acquisition** — Sentinel-1 RTC and Sentinel-2 L2A composites via STAC; GMW v3 weak labels
   (`ecoconnect/gee/`).
2. **Segmentation** — U-Net (EfficientNet encoder) → probability raster; calibrated threshold
   (`ecoconnect/ml/`).
3. **Patch extraction** — thresholding, 8-connectivity, minimum mapping unit, per-patch confidence
   (`ecoconnect/geospatial/patch_extraction/`).
4. **Graph construction** — k-nearest neighbours within τ km, quality-weighted edges (`ecoconnect/graph/construction.py`).
5. **Connectivity & exact leave-one-out criticality** — IIC/PC/ECA; S = ΔC/C per patch, cut-vertex detection
   (`ecoconnect/graph/criticality.py`).
6. **Assumption sensitivity** — τ × k grid with Spearman/Kendall rank correlation, top-k overlap and per-patch
   rank ranges, summarised as a stability verdict (`ecoconnect/graph/sensitivity.py`).
7. **What-if simulation** — removal, area reduction, hypothetical patches, radius changes, restoration insertion,
   each recomputed exactly and labelled SIMULATED (`backend/scenarios.py`).
8. **Provenance lineage** — a 12-step evidence chain per result (study area → data → labels → preprocessing →
   model → threshold → raster → patches → graph → metric → result → run) with content hashes, code commit and
   config hash; plus on-demand reproduction that recomputes a stored run and diffs every result
   (`backend/provenance.py`, `backend/job_handlers.py`).
9. **Human-in-the-loop verification** — model recommendation kept separate from human decision; staged
   restoration review (GIS → field → feasibility → decision); field checklist; accepted field evidence that
   contradicts the model is registered as a disagreement and exported as candidate training data **without**
   automatic retraining (`backend/workflow_api.py`).
10. **Evidence-grounded assistant** — retrieval of stored evidence items, LLM answer constrained to a JSON schema,
    citations filtered against the retrieved set, natural-language requests turned into a validated structured
    scenario command that runs only on explicit user confirmation (`backend/assistant_llm.py`).

## 3. Possible differentiating mechanisms (hypotheses for the prior-art search)

These are *candidate* distinguishing features to test against prior art — not claims:

- Coupling of per-patch **exact leave-one-out criticality** with an **assumption-sensitivity grid** that reports
  whether a patch's priority is robust to τ and k, surfaced at the point of decision.
- A **provenance-bound decision record**: every recommendation carries a machine-checkable lineage (hashes, code
  commit, config hash) and can be re-derived on demand, with the reproduction result stored.
- A **staged model-vs-human workflow** in which approval is technically blocked until field verification exists,
  and field disagreements flow into a reviewed (not automatic) retraining dataset.
- An **LLM interface that cannot act**: it may only propose a schema-validated scenario command against real
  object ids; execution requires human confirmation; answers without citations to retrieved evidence are
  replaced by an explicit "not enough evidence" reply.

Known closely related prior work to examine first: Conefor (IIC/PC, Saura & Pascual-Hortal), Graphab, Circuitscape,
Zonation/Marxan (prioritisation), Global Mangrove Watch, Google Earth Engine workflows, and retrieval-augmented
generation systems with citation checking.

## 4. Experimental evidence available today (honest status)

| Evidence | Status |
|---|---|
| 4-area S1 development model | test IoU 0.842 / F1 0.914 vs GMW weak labels (Sundarbans-dominated; Kerala weak) |
| Exact criticality & what-if | reproduces stored results bit-for-bit (`tests/test_regression.py`); all 11 stored runs reproduce |
| Paper tables | synthetic geometry reproduces Tables VI–VIII exactly |
| Sensitivity (Kerala) | rank stable across τ at k = 3 (ρ ≥ 0.96); sensitive to k = 2 (ρ ≈ 0.67) |
| Field validation | **none yet** |
| Restoration costs / feasibility data | **none loaded** |
| Deployment to an agency | **none** |
| LLM assistant | grounding guarantees unit-tested with a stubbed model; live model not yet evaluated |

## 5. What would strengthen a future filing or funding case

- A field campaign on selected patches (e.g. the cut vertices) to validate model outputs and criticality.
- A user study with GIS/forest officers comparing decisions with and without the lineage + sensitivity views.
- Independent validation data (not GMW) so that a model can pass the platform's own VALIDATED workflow.
- A documented prior-art search report and a dated invention disclosure kept outside the public repository.
