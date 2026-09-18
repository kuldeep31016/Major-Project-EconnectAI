"""End-to-end plumbing test of the ML stage on a tiny synthetic GeoTIFF.

The raster is a TEST FIXTURE (blobs of 'habitat' with a different spectral signature). It
exists only to prove that tiling -> dataset -> training -> evaluation -> scene inference ->
patch extraction -> graph run without error and produce well-formed outputs.  Its numbers are
never results.  Runs on CPU with a randomly initialised EfficientNet-B0 encoder (no download).
"""
import json
import os
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

torch = pytest.importorskip("torch")
smp = pytest.importorskip("segmentation_models_pytorch")


@pytest.fixture(scope="module")
def synthetic_aoi(tmp_path_factory):
    root = tmp_path_factory.mktemp("aoi")
    rng = np.random.default_rng(0)
    H = W = 512
    transform = from_origin(650_000, 1_095_000, 10.0, 10.0)
    crs = CRS.from_epsg(32643)
    label = np.zeros((H, W), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    for cy, cx, r in ((120, 130, 70), (300, 380, 60), (400, 120, 45), (150, 400, 30)):
        label[(yy - cy) ** 2 + (xx - cx) ** 2 < r * r] = 1
    img = rng.normal(0.15, 0.03, (4, H, W)).astype(np.float32)          # 4 "bands"
    img[3][label == 1] += 0.35                                             # habitat brighter in band 4
    img[0][label == 1] -= 0.05
    img[:, :, :20] = -9999.0                                               # nodata strip
    with rasterio.open(root / "image.tif", "w", driver="GTiff", height=H, width=W, count=4, dtype="float32",
                       crs=crs, transform=transform, nodata=-9999.0) as d:
        d.write(img)
    with rasterio.open(root / "label.tif", "w", driver="GTiff", height=H, width=W, count=1, dtype="uint8",
                       crs=crs, transform=transform, nodata=255) as d:
        d.write(label, 1)
    return root


def test_ml_stage_end_to_end(synthetic_aoi, tmp_path, monkeypatch):
    from ecoconnect.geospatial.preprocessing import build_tiles
    from ecoconnect.ml.common import prepare_data, resolve_training_config
    from ecoconnect.ml.training import train
    from ecoconnect.ml.inference import predict_scene, load_checkpoint
    from ecoconnect.pipeline import sources
    from ecoconnect.graph import build_graph, compute_criticality

    data_root = tmp_path / "data"
    monkeypatch.setenv("DATA_ROOT", str(data_root))
    rep = build_tiles(synthetic_aoi / "image.tif", synthetic_aoi / "label.tif", data_root / "ecoconnect_tiles",
                      tile_size=64, stride=64, block_tiles=2, seed=1, band_names=["b1", "b2", "b3", "b4"])
    assert rep.n_tiles_written > 20 and all(rep.split_counts[s] > 0 for s in ("train", "val", "test"))
    assert rep.n_tiles_skipped_invalid >= 0
    ds_root = data_root / "ecoconnect_tiles"
    assert (ds_root / "metadata.json").exists() and (ds_root / "splits" / "train.txt").exists()

    tcfg, dcfg = resolve_training_config("configs/train_dev.yaml")
    dcfg["dataset"]["image_size"] = 64
    dcfg["dataset"]["bands"] = None                       # fixture has 4 synthetic bands
    dcfg["loader"].update(batch_size=4, num_workers=0)
    dcfg["development"].update(max_train_samples=12, max_val_samples=6, max_test_samples=6)
    tcfg["model"].update(encoder="efficientnet-b0", encoder_weights=None)
    tcfg["training"].update(epochs=2, max_train_batches_per_epoch=2, device="cpu", early_stopping_patience=None)

    datasets, loaders, info = prepare_data(dcfg, "development")
    x, y, tid = datasets["train"][0]
    assert x.shape == (4, 64, 64) and y.shape == (64, 64) and x.dtype == torch.float32
    assert info["n_train"] == 12 and info["in_channels"] == 4
    assert list(ds_root.glob("stats_bands-*.json"))               # normaliser fitted on train only, per band subset
    # nodata pixels are masked out of the label
    raw, mask, _ = datasets["train"].read_raw(0)
    assert set(np.unique(mask)).issubset({0, 1, 255})

    out = train(tcfg, loaders, info, mode="development", out_root=tmp_path / "seg", experiment_id="smoke")
    for f in ("best_model.pth", "last_model.pth", "history.csv", "metrics.json", "experiment.json", "config.yaml",
              "training_curve.png", "validation_curve.png"):
        assert (out / f).exists(), f
    m = json.loads((out / "metrics.json").read_text())
    assert m["result_label"].startswith("DEVELOPMENT-SUBSET") and 0 <= m["val"]["iou"] <= 1
    assert (tmp_path / "seg" / "experiments.csv").exists()

    model, norm, ck, dev = load_checkpoint(out / "best_model.pth")
    assert ck["eco_meta"]["encoder"] == "efficientnet-b0" and norm is not None

    prob_path = tmp_path / "pred" / "aoi_prob.tif"
    side = predict_scene(out / "best_model.pth", synthetic_aoi / "image.tif", prob_path, tile=64, overlap=16,
                         batch_size=4, threshold=0.5)
    with rasterio.open(prob_path) as s:
        p = s.read(1)
        assert s.crs.to_epsg() == 32643 and p.shape == (512, 512)
        assert np.isnan(p[:, :20]).all()                        # nodata preserved
        valid = p[:, 20:]
        assert np.nanmin(valid) >= 0 and np.nanmax(valid) <= 1
    assert Path(side["outputs"]["binary"]).exists() and Path(side["outputs"]["confidence"]).exists()

    # a random-init model gives arbitrary probabilities; force a threshold that yields patches so the
    # extraction -> graph plumbing is exercised regardless of model quality
    thr = float(np.nanpercentile(valid, 80))
    patches, cands, a_l, src, kind = sources.from_probability_raster(
        prob_path, threshold=thr, mmu_ha=1.0, candidate_threshold=max(thr - 0.1, 0.0), result_kind="development")
    assert kind == "development" and src["type"] == "probability_raster"
    assert a_l == pytest.approx(512 * 492 * 0.01)                   # valid pixels x 0.01 ha
    assert len(patches) >= 1
    g = build_graph(patches, k=3, tau_km=5.0)
    rows, c = compute_criticality(g, a_l)
    assert len(rows) == len(patches) and c > 0
