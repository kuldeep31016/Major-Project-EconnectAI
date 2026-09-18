"""Graph-analysis stage of the pipeline: patches -> graph -> C(G) -> criticality -> what-if ->
explanations -> restoration -> exports, all written under one run directory with provenance.

    outputs/runs/<study_area>/<run_id>/
        manifest.json          run id, timestamp, mode, data-source label, config, provenance
        patches.geojson        patches with criticality merged in (WGS84)
        graph.json             nodes/edges/parameters
        metrics.json           IIC / PC / ECA (research) + interface score (labelled)
        criticality.csv/.json  exact leave-one-out ranking
        explanations.json      rule-based evidence + text per patch
        restoration.csv/.json  candidate ranking (raw gain unless costs supplied)
        what_if_top1.json      worked example: removal of the most critical patch
        tau_sensitivity.json   ranking stability across tau values
        frontend_bundle.json   the same results in the shape the existing UI consumes
"""
from __future__ import annotations

import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ecoconnect import __version__
from ecoconnect.graph import (
    Patch, build_graph, summarise, composite_interface_score, compute_criticality,
    area_vs_criticality_rho, tau_sensitivity, write_criticality_csv, simulate_removal,
    evaluate_candidates, load_costs_csv, write_restoration_csv, explain_all,
)
from ecoconnect.geospatial.patch_extraction import patches_to_geojson
from .config import OUTPUTS_DIR
from .frontend_adapter import build_frontend_bundle

RESULT_LABELS = {
    "synthetic": "PROTOTYPE / SYNTHETIC RESULT - computed exactly, but over synthetic patch geometry",
    "development": "DEVELOPMENT-SUBSET RESULT - NOT FINAL",
    "experiment": "OUR EXPERIMENTAL RESULT",
    "external": "EXTERNAL PATCH GEOMETRY - provenance in manifest",
}


def _dump(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(obj, f, indent=1, default=str)


def run_graph_analysis(
    *,
    study_area_id: str,
    study_area_meta: dict,
    patches: list[Patch],
    landscape_area_ha: float,
    cfg: dict,
    data_source: dict,
    result_kind: str,
    candidates: Optional[list[Patch]] = None,
    run_id: Optional[str] = None,
    out_root: Path = OUTPUTS_DIR,
    write_latest_pointer: bool = True,
    extra_files: Optional[dict[str, Path]] = None,
) -> Path:
    """Execute the full graph-analysis chain and export.  Returns the run directory."""
    if result_kind not in RESULT_LABELS:
        raise ValueError(f"result_kind must be one of {list(RESULT_LABELS)}")
    if not patches:
        raise ValueError("no patches to analyse")

    t0 = time.time()
    gcfg, ccfg, rcfg, kcfg, ecfg = (cfg["graph"], cfg["connectivity"], cfg["restoration"],
                                    cfg["criticality"], cfg.get("export", {}))
    metric = ccfg["research_metric"]
    metric_kw = {"p_at_tau": ccfg["pc_probability_at_tau"]} if metric == "pc" else {}

    run_id = run_id or f"{study_area_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    run_dir = out_root / "runs" / study_area_id / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # 1. graph  (Eqs. 3-6)
    graph = build_graph(patches, k=gcfg["k_neighbors"], tau_km=gcfg["tau_km"], distance_mode=gcfg["distance_mode"])

    # 2. connectivity  (research metrics + labelled interface score)
    summary = summarise(graph, landscape_area_ha)
    ui_score = composite_interface_score(graph, landscape_area_ha, ccfg["interface_score_weights"],
                                         iic_value=summary.iic, pc_value=summary.pc)

    # 3. criticality  (Eqs. 8-9)
    rows, c_base = compute_criticality(graph, landscape_area_ha, metric, **metric_kw)
    rho = area_vs_criticality_rho(rows)

    # 4. explanations
    explanations = explain_all(rows, graph, metric.upper(), tuple(kcfg["level_thresholds"]))

    # 5. what-if worked example: most critical patch  (Eq. 10)
    what_if = simulate_removal(graph, [rows[0].patch_id], landscape_area_ha, metric, **metric_kw)

    # 6. restoration  (Eqs. 11-12) - costs only if the user supplied them
    costs = load_costs_csv(rcfg["cost_csv"]) if rcfg.get("cost_csv") else {}
    rest_rows, _ = evaluate_candidates(
        graph, candidates or [], landscape_area_ha, metric,
        costs=costs or None, cost_unit=rcfg.get("cost_unit"),
        rebuild_edges=rcfg.get("rebuild_edges_on_insert", False), **metric_kw,
    )

    # 7. tau robustness  (Section VI-F)
    tau_check = tau_sensitivity(
        patches, landscape_area_ha, gcfg["tau_sensitivity_km"], k=gcfg["k_neighbors"],
        reference_tau_km=gcfg["tau_km"], distance_mode=gcfg["distance_mode"], metric=metric,
    )

    # ---------------------------------------------------------------- exports
    crit_by_id = {r.patch_id: r for r in rows}
    level_by_id = {e.patch_id: e.level for e in explanations}
    extra = {
        pid: {
            "criticality_rank": r.rank, "criticality_score": r.criticality_score,
            "delta_connectivity": r.delta_connectivity, "delta_pct": r.delta_pct,
            "degree": r.degree, "is_cut_vertex": r.is_cut_vertex,
            "component_count_after": r.component_count_after, "rank_by_area": r.rank_by_area,
            "criticality_level": level_by_id[pid],
        }
        for pid, r in crit_by_id.items()
    }
    _dump(patches_to_geojson(patches, extra), run_dir / "patches.geojson")
    _dump(graph.to_dict(), run_dir / "graph.json")
    metrics = {
        "research_metrics": summary.to_dict(),
        "criticality_metric": metric,
        "baseline_connectivity": c_base,
        "spearman_area_vs_criticality": rho,
        "interface_score": ui_score,
        "result_label": RESULT_LABELS[result_kind],
    }
    _dump(metrics, run_dir / "metrics.json")
    write_criticality_csv(rows, run_dir / "criticality.csv")
    _dump([r.to_dict() for r in rows], run_dir / "criticality.json")
    _dump([e.to_dict() for e in explanations], run_dir / "explanations.json")
    write_restoration_csv(rest_rows, run_dir / "restoration.csv")
    _dump({
        "ranking_basis": rest_rows[0].ranking_basis if rest_rows else "raw_gain",
        "cost_unit": rcfg.get("cost_unit") if costs else None,
        "cost_note": ("costs supplied by user file " + str(rcfg.get("cost_csv"))) if costs else
                     "no cost data supplied - ranking is by raw connectivity gain R_i (paper: Priority_i reduces to R_i)",
        "candidate_source": rcfg.get("candidate_source"),
        "candidates": [r.to_dict() for r in rest_rows],
        "candidate_geometries": patches_to_geojson(candidates or []),
    }, run_dir / "restoration.json")
    _dump(what_if.to_dict(), run_dir / "what_if_top1.json")
    _dump(tau_check, run_dir / "tau_sensitivity.json")

    # patches + candidates as plain JSON for the API's what-if/restoration endpoints
    _dump({"patches": [p.to_dict() for p in patches],
           "candidates": [c.to_dict() for c in (candidates or [])],
           "landscape_area_ha": landscape_area_ha}, run_dir / "patches_input.json")

    manifest = {
        "run_id": run_id,
        "study_area_id": study_area_id,
        "study_area": study_area_meta,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "ecoconnect_version": __version__,
        "result_kind": result_kind,
        "result_label": RESULT_LABELS[result_kind],
        "data_source": data_source,
        "landscape_area_ha": landscape_area_ha,
        "aoi_area_km2": round(landscape_area_ha / 100.0, 2),
        "valid_area_km2": round(landscape_area_ha / 100.0, 2),
        "habitat_area_ha": round(sum(p.area_ha for p in patches), 2),
        "comparability_note": ("IIC and PC scale with the analysis extent A_L; do not compare raw values between "
                               "study areas of different AOI size - use ECA as % of habitat area instead."),
        "n_patches": len(patches),
        "n_candidates": len(candidates or []),
        "config": cfg,
        "hardware": {"platform": platform.platform(), "machine": platform.machine(), "python": platform.python_version()},
        "elapsed_s": round(time.time() - t0, 3),
        "files": sorted(p.name for p in run_dir.iterdir()),
    }
    if extra_files:
        manifest["extra_files"] = {k: str(v) for k, v in extra_files.items()}
    _dump(manifest, run_dir / "manifest.json")

    bundle = build_frontend_bundle(
        manifest=manifest, patches=patches, graph=graph, summary=summary, ui_score=ui_score,
        rows=rows, explanations=explanations, rest_rows=rest_rows, candidates=candidates or [],
        what_if=what_if, rho=rho, landscape_area_ha=landscape_area_ha, export_cfg=ecfg,
        level_thresholds=tuple(kcfg["level_thresholds"]),
    )
    _dump(bundle, run_dir / "frontend_bundle.json")

    if write_latest_pointer:
        (out_root / "runs" / study_area_id / "LATEST").write_text(run_id)
    return run_dir
