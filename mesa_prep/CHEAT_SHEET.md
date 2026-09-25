# EcoConnectAI — cheat sheet (memorise)

**PROJECT IN ONE SENTENCE**
EcoConnectAI maps coastal mangrove from Sentinel-1 radar and turns the map into a patch-connectivity graph. It finds
which patches hold the habitat network together, simulates interventions exactly, explains every ranking, and ranks
restoration sites by connectivity gain.

**PROBLEM**
* Habitat maps show *where* mangrove is, not *which patches matter* for connectivity.
* Area is a poor proxy: small stepping-stone patches can be critical.

**OBJECTIVE**
* Move from mapping habitat to ranking its functional importance.
* Support what-if analysis and restoration decisions.

**INPUT**
* Sentinel-1 RTC γ⁰ VV and VH in dB.
* 2020 per-pixel temporal median (4–6 scenes), 10 m, UTM.

**DATASET**
* Own dataset: 4 Indian landscapes.
* 1,373 tiles of 256² (899 with mangrove).
* Spatial-block split 954/195/224; dev run used 800/195/200.
* Weak labels: Global Mangrove Watch v3.0 2020.

**SATELLITE SOURCE**
* S1 RTC from Microsoft Planetary Computer: the model input.
* S2 L2A from Earth Search: ancillary (ablations, basemaps, NDWI rule).
* No Landsat, no Kaggle, no Google Earth Engine run.

**MODEL**
* U-Net decoder + EfficientNet-B0 encoder (6.25 M params), ImageNet-pretrained, fully fine-tuned.
* UNB7 = the B7 encoder: **configured, not trained.**

**MODEL INPUT / OUTPUT**
* Input: 2 × 256 × 256 z-scored tile.
* Output: per-pixel P(mangrove) via sigmoid, then threshold → binary mask.

**TRAINING**
* AdamW 3e-4, cosine, BCE (pos_weight 25) + Dice, batch 8.
* 40 epochs, best epoch 32. Apple M3 MPS, ~30 min.

**MAIN SEGMENTATION RESULT** (DEVELOPMENT — NOT FINAL, vs GMW)
* Test IoU **0.842**, F1 **0.914**, P 0.878, R 0.954, κ 0.894 (200 tiles).
* **Sundarbans-driven.** Kerala: 1 of 43 test tiles has correct mangrove.
* Kerala-only models: IoU 0.02–0.05.
* 95.56 % OA = foundation study (Ghorbanian et al. 2025), **not ours**.

**THRESHOLD**
* F1 sweep 0.30–0.70 → **0.70** (F1 0.933). This is at the edge of the swept range.
* Kerala LATEST run uses 0.5.

**PATCH EXTRACTION**
* Threshold → 8-connected components → drop < 2 ha.
* Each patch stores: id, area, centroid, confidence, class, polygon.

**GRAPH**
* Node = patch.
* Edge = among each other's k = 3 nearest (centroid, haversine) **and** d ≤ τ = 5 km.
* Weight w = √(qᵢqⱼ)·e^(−d/τ).
* Own pure-Python code; no NetworkX.

**CONNECTIVITY METRIC**
* **IIC** = ΣΣ aᵢaⱼ/(1+nlᵢⱼ) / A_L²: big patches reachable in few links.
* PC and ECA are reported alongside. Compare areas by ECA % of habitat.
* The Eq. 7 interface score is not a research metric.

**CRITICALITY**
* Exact leave-one-out: Sᵢ = (C(G) − C(G−vᵢ)) / C(G).
* Cut vertex = its removal increases the number of components.
* **Example:** Kerala P17
  * 3.13 ha, #17 of 24 by area.
  * S = 0.270, rank #3.
  * Cut vertex, 2 → 3 components.
  * Degree 4 (P14 0.59 km, P04 0.85 km, P15 1.24 km, P07 2.80 km), confidence 84 %.
* The largest patch, P01 (35.1 ha), has S = 0.307 but is **not** a cut vertex.

**WHAT-IF** (exact rebuild, labelled SIMULATED)

| Action | Result |
|---|---|
| Remove P17 | −27.0 % IIC, −1.4 % habitat |
| Remove P01 | −30.7 % IIC, −16 % habitat |
| Restore C1 | +1.29 % IIC |
| τ 3/5/8 km | links 41/43/47, ρ 0.96/1/0.97 |
| Threshold 0.4 → 0.7 | 26 → 21 patches |

**EXPLAINABILITY**
* Rule-based sentences built only from computed evidence.
* No SHAP, LIME or Grad-CAM.
* The assistant is template retrieval, not an LLM.

**RESTORATION**
* Candidates: 0.3 ≤ p < threshold, ≥ 1 ha (model output, not surveyed).
* Gain R = C(G+v) − C(G), ranked by gain.
* **No costs** (validated cost data unavailable). An uploaded CSV switches ranking to gain/cost.

**TECH STACK**
* Python 3.14, PyTorch 2.13, segmentation_models_pytorch.
* rasterio, pyproj, shapely, scipy.
* FastAPI, SQLAlchemy.
* Next.js 16, React 19, TypeScript, Tailwind, Leaflet, React Flow, Recharts.
* 44 pytest tests.

**DATABASE**
* SQLite, 15 tables: users/orgs, registry, analysis_versions, detections, alerts, field_tasks, evidence, projects,
  scenarios, reports, audit_log.
* Rasters stay on disk.

**BACKEND**
* FastAPI, about 50 endpoints.
* JWT + bcrypt, 6 roles.
* `/api/segment` runs the full pipeline.

**FRONTEND**
* 17 routes: dashboard, interactive map + evidence drawer, graph, Scenario Lab A–G, restoration, Data & Models,
  alerts, field, reports, new analysis.

**STUDY AREAS** (4-area model, t 0.70, 2020)

| Area | Patches | Predicted habitat | GMW |
|---|---|---|---|
| Kerala Vembanad–Kol | 12 | 205 ha | 102 ha |
| Sundarbans | 54 | 63,830 ha | 58,903 ha |
| Gulf of Mannar | 16 | 118 ha | 44 ha |
| Odisha Bhitarkanika | 21 | 14,944 ha | 10,793 ha |

**MAIN RESULT**
* Criticality ≠ size on real predictions: Kerala P17, Odisha P09 (55.6 ha) outranks P04 (910 ha).
* Segmentation dev IoU 0.842 (Sundarbans-driven).

**LIMITATIONS**
* B0 dev model; weak labels; accuracy uneven across areas; over-prediction.
* Threshold at sweep edge; τ and k assumed.
* Change detection is model noise; no costs; no field validation or deployment.

**FUTURE WORK**
* UNB7 on GPU with balanced sampling; field validation; species-calibrated τ; real costs.
* S1+S2 fusion; multi-year time series; uncertainty; PostGIS deployment.

**NOVELTY**
* Integrated, exact, explained and provenance-labelled chain: SAR segmentation → patch graph → criticality →
  what-if → restoration.

---

## Top-20: if they ask X → say Y
1. **Accuracy?** IoU 0.84 / F1 0.91 against GMW on our pooled dev split. Sundarbans-driven. 95.56 % is the foundation study's.
2. **Model?** U-Net + EfficientNet-B0. UNB7 configured, not trained.
3. **Why not UNB7?** Compute: B7 needs a CUDA GPU. The Colab notebook is ready.
4. **Labels ground truth?** No. Weak GMW reference labels.
5. **Input?** Sentinel-1 VV/VH dB only. S2 is ablation and ancillary.
6. **Why SAR?** It works through cloud and is sensitive to canopy structure.
7. **Dataset?** 1,373 tiles, 4 areas, spatial-block split.
8. **Threshold?** F1 sweep → 0.70.
9. **Why 2 ha?** Paper's MMU; suppresses noise; configurable.
10. **Why 5 km?** Assumed dispersal distance; we test 3 and 8 km on every run.
11. **Criticality?** Remove, recompute IIC, S = ΔC / C.
12. **Small but critical?** P17: 3.1 ha, −27 % IIC, cut vertex.
13. **Bridge patch?** A cut vertex: removal increases components.
14. **What-if?** Exact recomputation, labelled simulated, not a forecast.
15. **XAI?** Rule-based from computed evidence. No SHAP or Grad-CAM.
16. **Restoration?** Rank by IIC gain. No invented costs.
17. **Database?** SQLite, 15 tables. Rasters on disk.
18. **Deployed?** No. Prototype with demo users.
19. **Change detection?** Run comparison; model output; not a measured loss.
20. **Biggest limitation?** Segmentation on thin fringes plus weak labels.

## Don't say
* "95.56 % is ours", "UNB7 trained", "ground truth", "validated model".
* "P16", "Landsat", "Kaggle", "INR costs".
* "Kerala mangrove fell 16 %", "real-time", "deployed", "field-verified".
* "LLM", "SHAP".
* "0.84 IoU on every area", or any landing-page numbers.
