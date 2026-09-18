# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SSL: CERTIFICATE_VERIFY_FAILED` on STAC / Zenodo / pip | python.org macOS builds ship no CA roots | `pip install certifi`; the acquisition module sets `SSL_CERT_FILE`/`GDAL_HTTP_CAINFO` automatically. Manually: `export SSL_CERT_FILE=$(python -c "import certifi;print(certifi.where())")` |
| `DATA_ROOT is not set` | dataset location unknown | `cp .env.example .env` and set `DATA_ROOT`, or `export DATA_ROOT=…` |
| `dataset not found at …/tiles/images` | canonical layout missing | run `scripts/build_tiles.py` or an adapter; check with `scripts/inspect_dataset.py` |
| `scene has N bands but the model expects M` | `dataset.bands` at training ≠ scene | pass the same band subset; the checkpoint stores `dataset.bands` |
| Training very slow / OOM on Mac | B7 at 512² does not fit 16 GB | use `train_dev.yaml` (B0, 256²) locally; B7 on CUDA (Colab/Kaggle); reduce `loader.batch_size` |
| AMP has no effect on MPS | autocast enabled on CUDA only | expected; documented in TRAINING.md |
| `no Sentinel-2 scenes matched` | too strict cloud filter / short date range | raise `max_cloud_cover_s2`, widen `date_range` |
| GMW tiles `NONE` | AOI has no mangrove 1° tile | expected for non-mangrove areas; label raster is all 255 (unlabelled) |
| UI badge shows *Prototype · synthetic* with a Wi-Fi-off icon | backend not running / CORS | start `uvicorn backend.main:app --port 8000`; set `ECO_CORS_ORIGINS`; check `NEXT_PUBLIC_API_URL` |
| UI badge shows *Prototype · synthetic* but backend is up | no run for that study area | `scripts/run_graph_analysis.py --study-area <id> …` |
| Interface score rises after removing a patch | Eq. 7 composite is not monotone (documented) | read C(G) retained (IIC) — the headline in the what-if panel |
| `baseline connectivity is zero` | no patches above threshold | lower `--threshold`/MMU or check the probability raster |
| pytest `httpx` missing | TestClient dependency | `pip install httpx` (in requirements.txt) |
| Frontend lint errors in `starfield.tsx`, `analysis/page.tsx`, localStorage effect | pre-existing prototype code (React compiler rule) | unchanged from the original prototype; not introduced here |
