# IP readiness — EcoConnectAI

_Written 2026-10-01. Based on `docs/RESEARCH_IP_NOTES.md`, restructured for a prior-art and IP review.
Companion file: `docs/PAPER_IMPLEMENTATION_MATRIX.md`._

> **This is NOT a legal opinion and makes NO claim of novelty or patentability.**
> It is an engineering description, written so that a registered patent agent or IP attorney can assess the
> work quickly. Only a professional prior-art search, followed by legal advice, can say whether anything here
> is new, non-obvious, or protectable. The labels "Potentially novel combination" and "may be differentiated"
> below are **hypotheses to test**, not conclusions.

**Disclosure status (matters for any filing).** The GitHub repository `kuldeep31016/Major-Project-EconnectAI` is
**public**. The first commit is dated **2026-09-18**, and later pushes, including this file, are public from their
push dates. A live demo is deployed (Vercel frontend plus a Render API). The paper draft exists at
`docs/EcoConnectAI_IEEE_paper.pdf`. Public disclosure can destroy or limit patentability in many jurisdictions, and
grace-period rules differ between them. Take the first-push date, the deploy dates, and any demo, talk or submission
dates to the consultation **before** disclosing anything further.

**Evidence status (applies to every section).**

- The reported model is `multi_E1_s1_b0_dev`, a U-Net with an EfficientNet-B0 encoder on Sentinel-1 VV+VH. Test
  IoU is 0.842 and F1 is 0.914 **measured against Global Mangrove Watch weak labels**. This is a development
  result, not field truth.
- There is **no field validation**, **no government or agency deployment**, and **no validated restoration costs**.
- All scenarios are **simulations**. The LLM assistant has been tested only with a stubbed model.
- UNB7 (EfficientNet-B7) has **not** been trained here.
- The 95.56 % accuracy in the paper belongs to the foundation study (Ghorbanian et al., 2025), not to this work.

---

## 1. Potentially distinctive workflow (what the system does end to end)

The technical problem: a habitat map shows *where* habitat is. A conservation decision needs more:

- which fragments hold the network together,
- what connectivity is lost if one of them disappears,
- where restoration would reconnect the network, and
- how far those conclusions can be trusted.

Common practice splits these steps across separate tools: segmentation, GIS post-processing, connectivity
software, and spreadsheets. When the steps are split, the link between a decision and its evidence and assumptions
is lost.

EcoConnectAI runs one continuous, recorded chain:

`Sentinel-1/2 imagery → U-Net probability raster → calibrated threshold → habitat patches (with per-patch confidence) → k-NN/τ graph → IIC / PC / ECA → exact leave-one-out criticality (+ cut vertices) → τ × k assumption-sensitivity verdict → what-if simulation → restoration gain by node insertion (+ "uncertain habitat" guard) → rule-based explanation → staged human review with field verification → disagreement export for reviewed retraining → provenance lineage with on-demand reproduction → evidence-grounded assistant that can only propose, not execute.`

The chain as a whole is the candidate for review. Most of its individual links are known techniques (see §3).

## 2. Technical architecture

| Layer | Components | Code |
|---|---|---|
| Acquisition | STAC search (Planetary Computer, Earth Search): S1 RTC, S2 L2A (SCL-masked medians); GMW v3 weak labels | `ecoconnect/gee/` |
| Segmentation | U-Net + EfficientNet encoder (B0 dev / B7 full config); Swin alias; BCE + Dice; spatial-block split; threshold sweep; optional flip TTA | `ecoconnect/ml/`, `scripts/train.py`, `scripts/threshold_sweep.py` |
| Patch extraction | Threshold, 8-connectivity components, true pixel area, MMU 2 ha, mean-probability confidence, GeoJSON | `ecoconnect/geospatial/patch_extraction/` |
| Graph analytics (stdlib-only core) | k-NN within τ; w = √(q_i q_j)·exp(−d/τ); IIC, PC (max-product), ECA; leave-one-out criticality; cut vertices; what-if; restoration by insertion; explanations; τ × k sensitivity; cross-run patch tracking | `ecoconnect/graph/` |
| Pipeline and provenance | Run orchestration, manifests with git commit, config hash and file hashes | `ecoconnect/pipeline/` |
| Platform API | FastAPI, SQLAlchemy (SQLite or Postgres), Alembic, DB-backed job queue, artifact registry (sha256), 6-role RBAC, JWT with refresh-token rotation, audit log | `backend/` |
| Decision workflow | Scenario Lab A–G; restoration review stage machine (GIS → field → feasibility → decision); field checklist and evidence; HITL disagreement register and GeoJSON export; model status ladder | `backend/scenarios.py`, `backend/workflow_api.py`, `backend/registry_api.py` |
| Grounded assistant | Evidence pack E1…En → LLM with a JSON-schema output; citations filtered to the pack; proposed scenario validated against real IDs and run only on user click; template fallback | `backend/assistant_llm.py`, `backend/insight.py` |
| Frontend | Next.js / React, Leaflet, React Flow, Recharts | `frontend/` |

## 3. Algorithms and classification

Classification key:

- **Known technique**: published and standard. We apply it.
- **Our implementation**: a standard idea written by us, with specific engineering choices.
- **Potentially novel combination**: a coupling that the prior-art search should test. **No novelty is claimed.**

| # | Algorithm / mechanism | Classification | Notes |
|---|---|---|---|
| A1 | U-Net encoder–decoder with EfficientNet encoder (UNB7 in the foundation study) | Known technique | Ronneberger et al. 2015; Tan & Le 2019; Ghorbanian et al. 2025. We use the `segmentation-models-pytorch` library. |
| A2 | Weak supervision from GMW labels | Known technique | GMW (Bunting et al.) is widely used as a reference or label. |
| A3 | Threshold calibration by F1 sweep | Known technique | Standard practice. Our run has a methodological flaw: it was selected on the test split. |
| A4 | Connected-component patch extraction with MMU and mean-probability confidence | Known technique / Our implementation | Standard GIS. Keeping the probability-derived confidence per patch and carrying it into edge weights is our choice. |
| A5 | Distance-threshold / k-NN patch graph | Known technique | Urban & Keitt 2001, and the landscape-graph literature |
| A6 | Edge weight √(q_i q_j)·exp(−d/τ) | Our implementation | A design choice. The exponential decay kernel is standard (as in PC). The quality coupling is ours but simple. |
| A7 | IIC, PC, ECA | Known technique | Pascual-Hortal & Saura 2006; Saura & Pascual-Hortal 2007; Saura et al. 2011 (ECA). Implemented from the definitions, using only the stdlib. |
| A8 | Leave-one-out patch importance S_i = ΔC/C | Known technique | This is essentially the dIIC / dPC node-removal importance computed by Conefor (Saura & Rubio 2010 partitions it into fractions). Our S_i is the same idea. |
| A9 | Cut-vertex (articulation point) detection | Known technique | Classic graph theory (Hopcroft & Tarjan 1973) |
| A10 | Composite interface score (Eq. 7) | Our implementation | Unvalidated weights. Non-monotone under removal, so it has been demoted. **Not a candidate differentiator.** |
| A11 | What-if removal by exact recomputation | Known technique / Our implementation | The same computation as A8, applied to user-chosen sets and polygons |
| A12 | Restoration gain by node insertion, R_i = C(G+v) − C(G), with optional gain/cost | Known technique | Evaluating candidate patches by connectivity gained, and cost-effectiveness ranking, both appear in the connectivity and restoration-prioritisation literature. Verify the specific precedents in the search. |
| A13 | Candidate generation from the marginal-probability band [0.30, threshold), plus the rule "> 5 ha and > 10 % of habitat → uncertain habitat, field check" | Our implementation | A heuristic guard against headlining model uncertainty as restoration gain. Simple, and possibly obvious. |
| A14 | τ × k assumption-sensitivity grid (Spearman, Kendall, top-k Jaccard, per-patch rank range, stability verdict) attached to each priority | Our implementation; the **coupling with A8 at the point of decision** is a potentially novel combination | Parameter sensitivity analysis is standard. Reporting a per-patch robustness verdict alongside each priority is the element to test. |
| A15 | Rule-based natural-language explanation generated only from computed graph evidence | Our implementation | Template text. Straightforward. |
| A16 | Cross-run patch tracking by polygon overlap (disappeared / new / split / merged / reorganised), with a comparability flag when models or thresholds differ | Our implementation | Overlap-based object tracking is known. The comparability guard is our choice. (Uncommitted as of 2026-10-01.) |
| A17 | Provenance lineage (12 steps, content hashes, commit, config hash) plus on-demand reproduction that diffs every stored result | Known technique (provenance, reproducibility tooling); applying it **to each conservation recommendation** is a potentially novel combination | W3C PROV and ML experiment trackers are prior art for the general idea. |
| A18 | Staged model-vs-human workflow: approval technically blocked until field verification exists; accepted field evidence that contradicts the model is registered as a disagreement and exported for **reviewed, not automatic** retraining | Known technique (HITL, active learning, approval workflows); the coupling to connectivity recommendations is a potentially novel combination | — |
| A19 | LLM assistant that cannot act: schema-constrained output, citations filtered to the retrieved evidence set, an explicit "not enough evidence" reply, and scenario commands validated against real object IDs and executed only on user confirmation | Known technique (RAG with citation checking, structured output, tool-call confirmation); applying it to conservation decision records is a potentially novel combination | Lewis et al. 2020 (RAG) and much later work. Tested only with a stubbed model. |
| A20 | The full chain in §1 as one recorded pipeline | Potentially novel combination | The main candidate for review. Integration claims are often judged obvious, so professional assessment is essential. |

## 4. Original implementation (what is our own work)

The following is authored in this repository. Copyright in the code and documentation exists regardless of
patentability. Licensing is a separate question for the adviser.

- A stdlib-only graph-analytics core (`ecoconnect/graph/`). It reproduces the paper's synthetic Tables VI–VIII to
  within about 1e-14 relative error, and it re-derives every stored real run bit-for-bit (`tests/test_regression.py`).
- The patch extraction and pipeline with manifests and provenance hashes (`ecoconnect/geospatial/`, `ecoconnect/pipeline/`).
- The platform backend: scenario engine, review workflow, HITL register, model ladder, provenance and reproduction
  jobs, grounded assistant, RBAC, and audit (`backend/`).
- The frontend decision-support UI (`frontend/`).
- The test suite (about 93 tests per `docs/context/PROJECT_CONTEXT.md`).

**Not our work:** the UNB7 architecture and its 95.56 % result (Ghorbanian et al.), U-Net, EfficientNet, GMW
labels, IIC/PC/ECA definitions, the Sentinel data, and the open-source libraries.

## 5. Prior-art risks

The families below are **well-known and must be examined first**. This list is not exhaustive. Only
references I am confident exist are cited; exact details should be confirmed during the search.

| Prior-art family | What it already covers | Overlap with EcoConnectAI |
|---|---|---|
| **Conefor** (Conefor Sensinode; Saura & Torné 2009, *Environmental Modelling & Software*). **IIC** (Pascual-Hortal & Saura 2006, *Landscape Ecology*). **PC** (Saura & Pascual-Hortal 2007, *Landscape and Urban Planning*). dPC fractions (Saura & Rubio 2010, *Ecography*). **ECA** (Saura et al. 2011, *Ecological Indicators*). | Patch-importance by node removal (dIIC, dPC), PC with distance-decay probabilities, ECA | **High.** A7, A8 and A11 are essentially this. Our metrics are re-implementations of the definitions. |
| **Graphab** (Foltête, Clauzel & Vuidel 2012, *Environmental Modelling & Software*) | Landscape graph construction from land-cover maps, graph metrics, patch and link importance, and evaluation of adding patches or links | **High** for A5–A8 and A12 |
| **Circuit theory / Circuitscape** (McRae 2006, *Evolution*; McRae & Beier 2007, *PNAS*; McRae et al. 2008, *Ecology*), and the Linkage Mapper tools | Resistance-surface connectivity, pinch points, corridor and restoration targeting | Medium. A different connectivity model (resistance rather than centroid distance). It is also a strong alternative that reviewers will expect. |
| **Landscape-graph foundations** (Urban & Keitt 2001, *Ecology*) | Patch graphs, node removal, thresholds | High for A5 and A8 |
| **Global Mangrove Watch** (Bunting et al., *Remote Sensing*, 2018 baseline; v3.0 in 2022) and deep-learning mangrove mapping (e.g. Ghorbanian et al. 2025, *IEEE JSTARS*) | Mangrove extent maps from SAR and optical data, deep segmentation | High for A1–A2 |
| **Habitat-network restoration prioritisation** (connectivity-gain studies of candidate patch addition; spatial conservation prioritisation tools such as **Zonation** and **Marxan**) | Ranking sites by conservation value and connectivity gain, cost-effectiveness, budget-constrained selection | High for A12. Medium for the decision-support framing. |
| **Temporal / graph change detection** (e.g. Liu et al. 2022, *IEEE TGRS*, cited in the paper) | Patch-level change on graphs | Medium for A16 |
| **Provenance and reproducibility** (W3C PROV; experiment trackers such as MLflow and DVC) | Lineage, hashing, re-execution | Medium for A17 |
| **Human-in-the-loop, active learning, approval workflows**; **RAG with citations and tool-use confirmation** (Lewis et al. 2020, NeurIPS, and many successors) | Reviewer gating, disagreement-driven labelling, grounded LLM answers, confirm-before-act | Medium for A18–A19 |
| **Patent literature** (not yet searched) | Unknown | Search Espacenet, Google Patents, WIPO PATENTSCOPE and Indian Patent Office (InPASS) for "habitat connectivity", "ecological network", "patch importance", "restoration prioritization", "remote sensing" plus "graph", and "decision support" plus "provenance" |

## 6. What is standard (do not present as ours)

- The U-Net / EfficientNet segmentation, weak labels from GMW, threshold sweeps, and TTA.
- Patch graphs, IIC, PC, ECA, leave-one-out patch importance (dIIC/dPC), and cut vertices.
- Connectivity-gain evaluation of candidate patches and gain-per-cost ranking.
- Rank correlation (Spearman, Kendall) and Jaccard overlap for sensitivity.
- Generic provenance hashing, job queues, RBAC, audit logs, and RAG with citations.

## 7. What may be differentiated (hypotheses only — for the prior-art search to test)

1. **Robustness-annotated criticality.** Each patch priority is shown together with a τ × k stability verdict
   (A8 + A14), so a user sees whether a priority survives changes to the graph assumptions before acting on it.
2. **Provenance-bound decision record.** Each recommendation carries a machine-checkable lineage from imagery to
   result and can be re-derived on demand, with the reproduction outcome stored (A17).
3. **Model-vs-human gating tied to connectivity decisions.** Approval is blocked until field evidence exists, and
   contradictions flow into a reviewed retraining set (A18).
4. **An LLM layer that cannot act.** It can only propose schema-validated scenario commands against real IDs, and
   it refuses when evidence is lacking (A19).
5. **The uncertainty guard on restoration candidates** (A13). This is probably weak on its own and is listed for
   completeness.
6. **The integrated chain** (A20).

Honest counterweights:

- Each element on its own is close to known practice.
- Integration or "workflow" combinations are frequently judged obvious.
- The system has **no field validation, no deployment and no user study**, so there is no evidence yet of a
  technical effect beyond engineering convenience.
- Much of the system is already publicly disclosed.

## 8. What requires legal / prior-art review

- **Novelty and inventive step** of items 1–6 in §7, against §5 and against patent databases. This needs a
  professional search.
- **Patent-eligible subject matter.** Several elements are data-processing methods or software. Eligibility
  rules differ by jurisdiction (for example, India's Patents Act s.3(k) on computer programmes "per se").
  Legal advice is required.
- **Effect of public disclosure.** The public GitHub repository (since 2026-09-18), live deployment, paper draft,
  and any presentations. Ask about grace periods and whether filing is still possible anywhere.
- **Ownership and inventorship.** University or institute IP policy for a final-year project, contributions by
  supervisors or teammates, and AI-assisted authorship of code and documents.
- **Third-party licences.** Licences of the dependencies (PyTorch, segmentation-models-pytorch, FastAPI,
  Next.js, Leaflet, etc.), terms of use for the data (Copernicus Sentinel, GMW), and LLM provider terms for the
  assistant.
- **Claims language in the paper, README and pitch material.** Make sure none of it asserts novelty, validation,
  deployment or cost figures that do not exist (see `docs/PAPER_IMPLEMENTATION_MATRIX.md §C`).
- **Alternatives to patents.** Copyright, open-source licensing strategy, publication as defensive prior art,
  or trade secret for any non-public parts. The adviser should decide.

## 9. What would strengthen any future case (technical, not legal)

- A field campaign on selected patches (for example cut vertices such as P07 in `kerala-coast_multi_E1_s1_b0_dev_t0.70`)
  to test the model outputs and the criticality results.
- A user study with GIS or forest officers comparing decisions with and without the lineage and sensitivity views.
  This is the only route to showing a technical or practical effect.
- Independent validation labels (not GMW), so a model can pass the platform's own VALIDATED workflow.
- A trained UNB7, and threshold selection on the validation split.
- A documented prior-art search report and a dated invention disclosure, kept **outside** the public repository.
