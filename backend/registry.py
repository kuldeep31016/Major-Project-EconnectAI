"""Provenance registry sync: mirrors on-disk artefacts (study-area config, scene/label sidecars, experiment
folders, run directories) into the database so every derived number can be traced to its sources.
Idempotent; called at startup and after new runs."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from ecoconnect.pipeline.config import OUTPUTS_DIR, REPO_ROOT, load_study_areas
from .db import AnalysisVersion, LabelSource, Model, Scene, StudyArea

import os


def _data_root() -> Path:
    return Path(os.environ.get("DATA_ROOT") or REPO_ROOT / "data")


def sync_study_areas(db: Session) -> int:
    n = 0
    for sid, m in load_study_areas().items():
        sa = db.get(StudyArea, sid) or StudyArea(id=sid)
        b = m["bbox"]
        sa.name, sa.short_name, sa.state, sa.protection = m["name"], m.get("short_name"), m.get("state"), m.get("protection")
        sa.center_lat, sa.center_lon = m["center"]
        sa.min_lat, sa.min_lon, sa.max_lat, sa.max_lon = b
        sa.footprint_km2, sa.primary_habitat = m.get("footprint_km2"), m.get("primary_habitat")
        sa.meta = {k: v for k, v in m.items() if k not in ("name", "short_name", "state", "protection", "center", "bbox")}
        db.merge(sa); n += 1
    return n


def sync_scenes_and_labels(db: Session) -> int:
    n = 0
    root = _data_root()
    for sj in sorted((root / "scenes").glob("*/*.json")) if (root / "scenes").exists() else []:
        tif = sj.with_suffix(".tif")
        if not tif.exists():
            continue
        j = json.loads(sj.read_text())
        sid = sj.parent.name
        dr = j.get("date_range") or []
        sc = db.get(Scene, sj.stem) or Scene(id=sj.stem)
        sc.study_area_id, sc.path = sid, str(tif.resolve())
        sc.year = int(str(dr[0])[:4]) if dr else None
        sc.date_range, sc.bands, sc.sensors = dr, j.get("bands"), j.get("sources")
        sc.crs, sc.width, sc.height, sc.manifest = j.get("crs"), j.get("width"), j.get("height"), j
        db.merge(sc); n += 1
    for lj in sorted((root / "labels").glob("*/*.json")) if (root / "labels").exists() else []:
        tif = lj.with_suffix(".tif")
        if not tif.exists():
            continue
        j = json.loads(lj.read_text())
        sid = lj.parent.name
        ls = db.query(LabelSource).filter_by(study_area_id=sid, path=str(tif.resolve())).first() or LabelSource(study_area_id=sid, path=str(tif.resolve()))
        ls.source, ls.year, ls.licence, ls.supervision, ls.manifest = j.get("source"), j.get("year"), j.get("license"), j.get("supervision"), j
        db.merge(ls); n += 1
    return n


def sync_models(db: Session) -> int:
    n = 0
    seg = OUTPUTS_DIR / "segmentation"
    for d in sorted(seg.glob("*")) if seg.exists() else []:
        mp = d / "metrics.json"
        if not mp.exists():
            continue
        met = json.loads(mp.read_text())
        exp = json.loads((d / "experiment.json").read_text()) if (d / "experiment.json").exists() else {}
        cal = json.loads((d / "threshold_calibration.json").read_text()) if (d / "threshold_calibration.json").exists() else None
        m = db.get(Model, d.name) or Model(id=d.name)
        ds = exp.get("dataset", {})
        m.path = str((d / "best_model.pth").resolve()) if (d / "best_model.pth").exists() else None
        m.architecture = (exp.get("model") or {}).get("architecture", "U-Net")
        m.encoder = met.get("encoder"); m.input_bands = ds.get("bands"); m.mode = met.get("mode")
        m.result_label = met.get("result_label"); m.dataset_name = ds.get("name")
        m.n_train, m.n_val, m.n_test = ds.get("n_train"), ds.get("n_val"), ds.get("n_test")
        m.metrics = {"val": met.get("val"), "test": met.get("test"), "best_epoch": met.get("best_epoch"),
                     "test_threshold": met.get("test_threshold")}
        m.calibration = {"selected_threshold": cal["selected_threshold"], "criterion": cal["criterion"], "scope": cal["scope"]} if cal else None
        m.trained_at = exp.get("timestamp_utc"); m.hardware = exp.get("hardware")
        m.card = {"label_source": "Global Mangrove Watch v3.0 2020 (weak label)",
                  "validation": "spatial-block held-out test tiles; metrics are agreement with the reference map, not field truth",
                  "known_limitations": ["weak labels", "small single/multi-area training set", "class imbalance (Kerala 0.2 % positives)",
                                        "no field validation", "development encoder unless mode = full"]}
        db.merge(m); n += 1
    return n


def sync_runs(db: Session) -> int:
    n = 0
    runs = OUTPUTS_DIR / "runs"
    for mp in sorted(runs.glob("*/*/manifest.json")) if runs.exists() else []:
        m = json.loads(mp.read_text())
        met = json.loads((mp.parent / "metrics.json").read_text())
        rm = met["research_metrics"]
        ds = m.get("data_source", {})
        av = db.get(AnalysisVersion, m["run_id"] if m["run_id"] != "prototype_synthetic" else f"{m['study_area_id']}/prototype_synthetic")
        rid = m["run_id"] if m["run_id"] != "prototype_synthetic" else f"{m['study_area_id']}/prototype_synthetic"
        av = av or AnalysisVersion(id=rid)
        av.study_area_id = m["study_area_id"]
        scene_path = ds.get("path")
        if scene_path and not Path(scene_path).is_absolute():
            scene_path = str(REPO_ROOT / scene_path)
        model_ckpt = (ds.get("model_info") or {}).get("checkpoint")
        av.model_id = Path(model_ckpt).parent.name if model_ckpt else None
        if av.model_id and not db.get(Model, av.model_id):
            av.model_id = None
        # scene id from the prediction sidecar when available
        av.scene_id = None
        if scene_path and Path(scene_path).with_suffix(".json").exists():
            try:
                scene_file = json.loads(Path(scene_path).with_suffix(".json").read_text()).get("scene")
                if scene_file:
                    cand = Path(scene_file).stem
                    av.scene_id = cand if db.get(Scene, cand) else None
            except (ValueError, OSError):
                pass
        g, c = m["config"]["graph"], m["config"]["connectivity"]
        av.result_kind, av.result_label, av.scene_year = m["result_kind"], m["result_label"], ds.get("scene_year")
        av.threshold, av.mmu_ha = ds.get("threshold"), ds.get("mmu_ha")
        av.tau_km, av.k, av.metric = g["tau_km"], g["k_neighbors"], c["research_metric"]
        av.n_patches, av.n_edges, av.n_components = rm["n_patches"], rm["n_edges"], rm["n_components"]
        av.habitat_area_ha, av.landscape_area_ha = rm["habitat_area_ha"], rm["landscape_area_ha"]
        av.iic, av.pc, av.eca_ha, av.eca_pct = rm["iic"], rm["pc"], rm["eca_ha"], rm["eca_pct_of_habitat"]
        av.interface_score = met["interface_score"]["score"]
        av.path = str(mp.parent.resolve())
        av.timestamp = datetime.fromisoformat(m["timestamp_utc"])
        av.manifest = {k: v for k, v in m.items() if k != "config"} | {"config": m["config"]}
        db.merge(av); n += 1
    return n


def sync_all(db: Session) -> dict:
    out = {"study_areas": sync_study_areas(db)}
    db.flush()
    out["scenes_labels"] = sync_scenes_and_labels(db)
    db.flush()
    out["models"] = sync_models(db)
    db.flush()
    out["runs"] = sync_runs(db)
    db.commit()
    return out
