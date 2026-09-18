# Inference

## Probability map (paper Eq. 1)

`ecoconnect/ml/inference/predict.py`

* `predict_proba(model, x, tta=False)` → soft probabilities `P_i(c)`; binary models return `(B, H, W)`
  sigmoid, multi-class `(B, C, H, W)` softmax. `tta` averages horizontal/vertical flips (as in the foundation study).
* `predict_scene(checkpoint, scene.tif, out_prob.tif, threshold=…)` — sliding window (default 256, overlap 64)
  with Hann-weighted blending; nodata stays NaN. Writes three GeoTIFFs in the scene's CRS:

| File | Content |
|---|---|
| `<name>_prob.tif` | float32 habitat probability ∈ [0,1] |
| `<name>_confidence.tif` | float32 `|p − 0.5|·2` (0 = uncertain, 1 = certain) |
| `<name>_binary_t<thr>.tif` | uint8 `p ≥ threshold`, 255 nodata |

plus `<name>_prob.json` with checkpoint, experiment id, mode, threshold, valid fraction, habitat fraction.

```bash
python scripts/predict.py --checkpoint outputs/segmentation/<exp>/best_model.pth \
    --input data/scenes/kerala-coast/<scene>.tif \
    --output outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif --threshold 0.5
```

## Threshold

`SEGMENTATION_THRESHOLD` (env) / `--threshold`. Default 0.5 as the paper proposes; the paper states it is
**uncalibrated** and the code never treats it as biologically optimal. Patch extraction re-thresholds the
probability raster, so the same prediction can be analysed at several thresholds without re-running the model.

## From probability map to decision support

```bash
python scripts/run_graph_analysis.py --study-area kerala-coast \
    --probability outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif \
    --threshold 0.5 --mmu-ha 2.0 --result-kind development --model-checkpoint outputs/segmentation/<exp>/best_model.pth
```
→ `outputs/runs/kerala-coast/<run_id>/` (see `docs/ARCHITECTURE.md`), served by the backend, displayed by the UI.
`POST /api/segment` performs the same two steps for the dashboard.
