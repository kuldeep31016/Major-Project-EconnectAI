# Results provenance

Every numerical result in this repository falls into one of the classes below. Anything not listed here
does not exist yet.

## PUBLISHED BASELINE — NOT OUR RESULT

| Metric | Value | Source |
|---|---|---|
| UNB7 overall accuracy / κ / F1 / mean PA / mean UA | 95.56 % / 0.94 / 0.95 / 95.37 % / 95.90 % | Ghorbanian et al., IEEE JSTARS 18, 2025, doi 10.1109/JSTARS.2025.3586289 (their Sentinel-1 study, their data) |
| Random-forest baseline OA / κ | 77.35 % / 0.74 | same |

These are reproduced in the paper's Table V and nowhere in this codebase's outputs.

## PROTOTYPE / SYNTHETIC RESULT

| Result | Where | Provenance |
|---|---|---|
| IIC, PC, ECA, criticality ranking, restoration ranking, τ sensitivity for Kerala / Sundarbans / Gulf of Mannar / Odisha | `outputs/runs/<area>/prototype_synthetic/` | Computed exactly by `ecoconnect/graph` (k = 3, τ = 5 km, C(G) = IIC) over the prototype's **synthetic** patch geometry `frontend/mock-data/habitat-mask.json`. Regression-identical (max |Δ| 5e-16) to `docs/legacy_experiment/results_synthetic_prototype.json`, i.e. the paper's Tables VI–VIII. Measures no real ecosystem. |
| Everything in `frontend/mock-data/*.json` | prototype | Deterministic generator output; site metadata only is real. |

## DEVELOPMENT-SUBSET RESULT — NOT FINAL

None yet. (`NOT YET RUN`)

## OUR EXPERIMENTAL RESULT

None yet. (`NOT YET RUN`)

## Template for a real result

```
Metric:       Dice (habitat class)
Dataset:      ecoconnect_tiles  (S1 RTC + S2 L2A 2020, GMW 2020 weak labels)   [DATA_ROOT/…/metadata.json]
Split:        test (N tiles, spatial-block split seed 42)
Model:        UNB7 (efficientnet-b7)  /  dev: efficientnet-b0
Checkpoint:   outputs/segmentation/<exp>/best_model.pth
Experiment:   <exp>  (outputs/segmentation/<exp>/experiment.json)
Threshold:    0.5
Hardware:     …
Date:         …
Label:        DEVELOPMENT-SUBSET RESULT — NOT FINAL | OUR EXPERIMENTAL RESULT
Caveat:       agreement with a weak label (GMW), not field truth
```
`scripts/evaluate.py` writes all of these fields into `metrics.json` / `experiment.json` automatically.
