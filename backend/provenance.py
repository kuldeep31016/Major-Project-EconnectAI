"""Provenance lineage: the ordered chain of evidence behind a run (and optionally one patch / candidate).

study area → satellite data → reference labels → preprocessing → model → threshold → probability raster →
patch extraction → graph → connectivity metric → result → run record. Every value is read from stored
artefacts (manifest, experiment record, calibration file, criticality/restoration JSON, artifact registry);
nothing is inferred. A step whose evidence is absent says so (status "not_recorded" / "not_applicable").
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from ecoconnect.pipeline.provenance import code_version

from .db import AnalysisVersion, Artifact, Model, Scene
from .paths import SEG_DIR, abs_path


def _json(p: Path) -> Optional[dict]:
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def _step(key: str, title: str, detail: dict, status: str = "recorded", artifacts: list | None = None,
          caveat: str | None = None) -> dict:
    return {"step": key, "title": title, "status": status, "detail": detail,
            "artifacts": artifacts or [], "caveat": caveat}


def _arts(db: Session, **filters) -> list[dict]:
    q = db.query(Artifact).filter_by(**filters)
    return [{"kind": a.kind, "key": a.key, "sha256": a.sha256} for a in q.order_by(Artifact.kind).all()]


def lineage(db: Session, run_dir: Path, object_type: str | None = None, object_id: str | None = None) -> dict:
    m = json.loads((run_dir / "manifest.json").read_text())
    met = json.loads((run_dir / "metrics.json").read_text())
    ds, cfg = m.get("data_source") or {}, m["config"]
    run = db.get(AnalysisVersion, m["run_id"])
    synthetic = m["result_kind"] == "synthetic" or ds.get("type") == "prototype_mock"
    ckpt = ds.get("model") or ""
    model_id = Path(ckpt).parent.name if ckpt and ckpt not in ("unknown",) and not synthetic else None
    model = db.get(Model, model_id) if model_id else None
    exp = _json(SEG_DIR / model_id / "experiment.json") if model_id else None
    cal = _json(SEG_DIR / model_id / "threshold_calibration.json") if model_id else None
    scene = db.get(Scene, run.scene_id) if run and run.scene_id else None
    sa = m.get("study_area") or {}
    steps = [_step("study_area", "Study area", {"id": m["study_area_id"], "name": sa.get("name"), "state": sa.get("state"),
                                                 "bbox": sa.get("bbox"), "landscape_area_ha": m.get("landscape_area_ha")})]

    if synthetic:
        steps.append(_step("satellite_data", "Satellite data", {"type": ds.get("type")}, "not_applicable",
                           caveat="Synthetic prototype geometry - no satellite observation behind this run."))
    else:
        steps.append(_step("satellite_data", "Satellite data", {
            "scene": scene.id if scene else None, "sensors": scene.sensors if scene else None,
            "bands": scene.bands if scene else None, "date_range": scene.date_range if scene else None,
            "scene_year": ds.get("scene_year"), "crs": ds.get("crs"), "grid": [ds.get("width"), ds.get("height")],
            "pixel_size_m": ds.get("pixel_size")}, "recorded" if scene else "partial",
            caveat=None if scene else "Scene raster not registered on this server (data/ is not deployed); year and grid come from the run manifest."))

    if model:
        d = (exp or {}).get("dataset") or {}
        meta = d.get("metadata") or {}
        steps.append(_step("reference_labels", "Reference labels", {
            "source": (model.card or {}).get("label_source"), "supervision": "weak (reference map, not field survey)",
            "training_sources": [s.get("note") for s in meta.get("sources", [])]},
            caveat="Global Mangrove Watch is a reference map, not field ground truth."))
        steps.append(_step("preprocessing", "Preprocessing & dataset", {
            "dataset": d.get("name"), "bands": [meta.get("bands", [])[i] for i in d.get("bands") or []] or meta.get("bands"),
            "tile_size": meta.get("tile_size"), "stride": meta.get("stride"), "split": meta.get("split_strategy"),
            "n_train": d.get("n_train"), "n_val": d.get("n_val"), "n_test": d.get("n_test"),
            "normalizer": {k: (d.get("normalizer") or {}).get(k) for k in ("method", "clip_percentiles", "n_tiles")}},
            "recorded" if exp else "not_recorded",
            caveat="Tiles overlap by 128 px across spatial-block splits (known leakage, audit bug 21)." if exp else None))
        test = (model.metrics or {}).get("test") or {}
        steps.append(_step("model", "Segmentation model", {
            "id": model.id, "display_name": model.display_name, "status": model.status, "version": model.version,
            "architecture": model.architecture, "encoder": model.encoder, "input_bands": model.input_bands,
            "mode": model.mode, "trained_at": model.trained_at, "code_commit": model.code_commit,
            "test_vs_reference": {k: test.get(k) for k in ("iou", "f1", "precision", "recall", "threshold")},
            "checkpoint_sha256": (m.get("input_sha256") or {}).get("model")},
            artifacts=_arts(db, model_id=model.id),
            caveat=f"Model status {model.status}: metrics are agreement with the reference labels on held-out tiles, not field accuracy."))
    else:
        steps.append(_step("model", "Segmentation model", {"checkpoint": ckpt or None},
                           "not_applicable" if synthetic else "not_recorded"))

    thr = ds.get("threshold")
    if thr is None:
        thr_src = "not recorded"
    elif cal and abs(float(cal.get("selected_threshold", -1)) - float(thr)) < 1e-9:
        thr_src = f"calibrated: {cal.get('criterion')} over {cal.get('scope')}"
    else:
        thr_src = "fixed value (default 0.5 unless set by the operator)"
    steps.append(_step("threshold", "Habitat threshold", {"value": thr, "source": thr_src},
                       "not_applicable" if synthetic else "recorded",
                       caveat="Calibration selected the threshold on the test split (audit bug 22)." if cal and "calibrated" in thr_src else None))
    prob = abs_path(ds.get("path")) if ds.get("type") == "probability_raster" else None
    steps.append(_step("probability_raster", "Probability raster", {
        "path": ds.get("path"), "sha256": (m.get("input_sha256") or {}).get("path"),
        "available_on_server": bool(prob and prob.is_file())},
        "not_applicable" if synthetic else "recorded"))
    rep = ds.get("extraction_report") or {}
    steps.append(_step("patch_extraction", "Patch extraction", {
        "threshold": rep.get("threshold", thr), "mmu_ha": rep.get("mmu_ha", ds.get("mmu_ha")),
        "connectivity": rep.get("connectivity", ds.get("connectivity")), "n_patches": m.get("n_patches"),
        "dropped_below_mmu": rep.get("n_dropped_below_mmu"), "habitat_area_ha": m.get("habitat_area_ha")},
        artifacts=[a for a in _arts(db, run_id=m["run_id"]) if a["kind"] in ("patches_geojson", "patches_input")]))
    g, rm = cfg["graph"], met["research_metrics"]
    steps.append(_step("graph", "Connectivity graph", {
        "rule": f"k = {g['k_neighbors']} nearest patches within tau = {g['tau_km']} km ({g['distance_mode']} centroid distance)",
        "n_edges": rm["n_edges"], "n_components": rm["n_components"], "sensitivity_taus_km": g.get("tau_sensitivity_km")},
        artifacts=[a for a in _arts(db, run_id=m["run_id"]) if a["kind"] in ("graph", "sensitivity")],
        caveat="Structural connectivity from patch geometry; not observed animal movement."))
    steps.append(_step("metric", "Connectivity metric", {
        "research_metric": cfg["connectivity"]["research_metric"].upper(), "iic": rm["iic"], "pc": rm["pc"],
        "eca_ha": rm["eca_ha"], "eca_pct_of_habitat": rm["eca_pct_of_habitat"]}))

    if object_type == "patch" and object_id:
        r = next((x for x in json.loads((run_dir / "criticality.json").read_text()) if x["patch_id"] == object_id), None)
        if r:
            steps.append(_step("result", f"Criticality of {object_id}", {
                "rank": r["rank"], "S": r["criticality_score"], "delta_pct": r["delta_pct"], "is_cut_vertex": r["is_cut_vertex"],
                "components": [r["component_count_before"], r["component_count_after"]], "area_ha": r["area_ha"],
                "degree": r["degree"], "method": "exact leave-one-out: S = (C(G) - C(G - v)) / C(G)"},
                artifacts=[a for a in _arts(db, run_id=m["run_id"]) if a["kind"] == "criticality"],
                caveat="A simulation over the modelled network - not field-confirmed."))
    elif object_type == "candidate" and object_id:
        c = next((x for x in json.loads((run_dir / "restoration.json").read_text())["candidates"] if x["candidate_id"] == object_id), None)
        if c:
            steps.append(_step("result", f"Restoration candidate {object_id}", {
                "rank": c["rank"], "gain_pct": c["gain_pct"], "area_ha": c["area_ha"], "new_links": c["new_links"],
                "linked_patches": c["linked_patch_ids"], "method": "R = C(G + v) - C(G)"},
                artifacts=[a for a in _arts(db, run_id=m["run_id"]) if a["kind"] == "restoration"],
                caveat="Model recommendation only; feasibility, ownership and cost are not assessed."))

    code = m.get("code") or {}
    now = code_version()
    steps.append(_step("run", "Analysis run", {
        "run_id": m["run_id"], "timestamp": m["timestamp_utc"], "result_label": m["result_label"],
        "ecoconnect_version": m.get("ecoconnect_version"), "config_sha256": m.get("config_sha256"),
        "git_commit": code.get("git_commit"), "git_dirty": code.get("git_dirty"),
        "code_changed_since": (code.get("git_commit") != now.get("git_commit")) if code.get("git_commit") and now.get("git_commit") else None},
        "recorded" if code else "partial", artifacts=[a for a in _arts(db, run_id=m["run_id"]) if a["kind"] == "run_manifest"],
        caveat=None if code else "Run predates code/config fingerprinting (2026-09-28); reproduce it to verify."))
    return {"run_id": m["run_id"], "study_area_id": m["study_area_id"], "result_label": m["result_label"],
            "object": {"type": object_type, "id": object_id} if object_id else None, "steps": steps,
            "limitations": ["Segmentation metrics are agreement with Global Mangrove Watch weak labels, not field truth.",
                            "No result on this platform has been field-validated.",
                            "What-if and restoration outputs are simulations, not predictions."]}
