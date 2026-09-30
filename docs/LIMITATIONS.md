# Limitations

EcoConnectAI is a **development / research prototype**. These limitations are shown in the product wherever
they apply; they are listed here in one place.

## Data and labels
- Training and evaluation labels are **Global Mangrove Watch v3 (2020)** — a reference map, not field ground truth.
  All segmentation metrics are *agreement with GMW*.
- Kerala (Vembanad–Kol) mangroves are thin fringes (1–3 px at 10 m, ~0.2 % of the area); Kerala-only models are weak
  (test IoU ≈ 0.02–0.05). The strong 4-area score (IoU 0.842) is dominated by Sundarbans.
- The 4-area tile set was overwritten on 2026-09-20; rasters and checkpoints are not in git, so model training
  cannot be re-run from the repository alone (graph-stage results can — "Reproduce this analysis").
- Known methodological issues in the current development runs: 128 px tile overlap across spatial-block splits,
  threshold selected on the test split, a stale normaliser cache in one experiment, and one model trained on 2025
  imagery against 2020 labels (audit bugs 20–28). They need new experiments, not code patches.

## Models
- Only EfficientNet-B0 development models are trained. The EfficientNet-B7 (UNB7) configuration is **not trained**.
- No model is VALIDATED; the platform allows that status only with independent (non-GMW) evidence.
- Confidence values are mean class probabilities and are **not calibrated**.

## Connectivity analysis
- Connectivity is **structural** (patch geometry + distance), not observed animal or propagule movement.
- The graph depends on assumptions (k nearest neighbours, τ radius, threshold). Rankings can change with them —
  the sensitivity grid shows by how much (e.g. Kerala P17 ranks #2–#20 across τ × k).
- What-if and restoration results are **simulations**, not forecasts.
- Patch ids are assigned by area **per run**; "P17" in one run is not the same object in another.

## Restoration and decisions
- No validated restoration cost, ownership, legal-status, tidal/hydrology or land-use data are loaded; these show
  as "Not assessed".
- Restoration candidates are sub-threshold model areas, not surveyed sites.
- No field validation has been carried out; no government or agency deployment exists.

## Assistant
- The AI assistant answers only from retrieved stored evidence and cites it, but it is a language model: answers
  must be checked against the cited sources. Without Anthropic credentials it falls back to template answers.

## Platform
- The public demo backend runs on a free tier (sleeps when idle; SQLite state resets on redeploy).
- CI is defined but GitHub Actions is currently blocked by a billing lock on the owner account (the repository is public; the lock must be cleared in GitHub billing settings).
