#!/usr/bin/env python
"""Run the graph-analysis stage (patches -> ... -> restoration -> exports) for one study area.

Examples
    # REAL: from a model probability GeoTIFF produced by scripts/predict.py
    python scripts/run_graph_analysis.py --study-area kerala-coast \
        --probability outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif --result-kind development

    # PROTOTYPE geometry (labelled synthetic) - exercises the pipeline + UI before a model exists
    python scripts/run_graph_analysis.py --study-area kerala-coast --source prototype

    # External patch polygons
    python scripts/run_graph_analysis.py --study-area odisha-coast --geojson my_patches.geojson --landscape-area-ha 67200
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ecoconnect.pipeline.config import load_config, load_study_areas  # noqa: E402
from ecoconnect.pipeline.analysis import run_graph_analysis  # noqa: E402
from ecoconnect.pipeline import sources  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--study-area", required=True, help="id from configs/study_areas.yaml")
    ap.add_argument("--config", default="graph", help="graph config name or path (default configs/graph.yaml)")
    ap.add_argument("--source", choices=["raster", "prototype", "geojson"], default=None)
    ap.add_argument("--probability", help="probability GeoTIFF (band 1 = habitat probability)")
    ap.add_argument("--valid-mask", help="optional GeoTIFF, >0 where pixels are valid")
    ap.add_argument("--geojson", help="patch polygons (WGS84)")
    ap.add_argument("--landscape-area-ha", type=float, help="A_L for --geojson sources")
    ap.add_argument("--threshold", type=float, default=None, help="segmentation threshold (default from env SEGMENTATION_THRESHOLD or 0.5)")
    ap.add_argument("--mmu-ha", type=float, default=2.0)
    ap.add_argument("--result-kind", choices=["development", "experiment", "external", "synthetic"], default=None)
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--model-checkpoint", default=None, help="recorded in provenance")
    ap.add_argument("--no-latest", action="store_true", help="do not move the study area's LATEST pointer to this run")
    args = ap.parse_args()

    cfg = load_config(args.config)
    areas = load_study_areas()
    if args.study_area not in areas:
        ap.error(f"unknown study area {args.study_area!r}; choose from {list(areas)}")
    meta = areas[args.study_area]

    source = args.source or ("raster" if args.probability else "geojson" if args.geojson else "prototype")
    import os
    threshold = args.threshold if args.threshold is not None else float(os.environ.get("SEGMENTATION_THRESHOLD", 0.5))
    rcfg = cfg["restoration"]

    if source == "raster":
        if not args.probability:
            ap.error("--probability is required for raster source")
        patches, cands, a_l, src, kind = sources.from_probability_raster(
            args.probability, threshold=threshold, mmu_ha=args.mmu_ha,
            habitat_class=meta.get("primary_habitat", "mangrove"),
            candidate_threshold=rcfg["candidate_threshold"] if rcfg["candidate_source"] == "sub_threshold" else None,
            candidate_min_area_ha=rcfg["candidate_min_area_ha"], candidate_max_count=rcfg["candidate_max_count"],
            valid_mask_path=args.valid_mask, result_kind=args.result_kind or "development",
            model_info={"checkpoint": args.model_checkpoint} if args.model_checkpoint else None,
        )
    elif source == "geojson":
        if not (args.geojson and args.landscape_area_ha):
            ap.error("--geojson and --landscape-area-ha are required")
        patches, cands, a_l, src, kind = sources.from_geojson(
            args.geojson, landscape_area_ha=args.landscape_area_ha, result_kind=args.result_kind or "external")
    else:
        patches, cands, a_l, src, kind = sources.from_prototype_mock(args.study_area)

    run_dir = run_graph_analysis(
        study_area_id=args.study_area, study_area_meta=meta, patches=patches, landscape_area_ha=a_l,
        cfg=cfg, data_source=src, result_kind=kind, candidates=cands, run_id=args.run_id,
        write_latest_pointer=not args.no_latest,
    )
    import json
    m = json.loads((run_dir / "metrics.json").read_text())
    rm = m["research_metrics"]
    print(f"\n[{m['result_label']}]")
    print(f"run dir : {run_dir}")
    print(f"patches : {rm['n_patches']}  edges: {rm['n_edges']}  components: {rm['n_components']}  "
          f"habitat: {rm['habitat_area_ha']:.1f} ha of {rm['landscape_area_ha']:.0f} ha")
    print(f"IIC     : {rm['iic']:.6f}   PC: {rm['pc']:.6f}   ECA: {rm['eca_ha']:.0f} ha ({rm['eca_pct_of_habitat']:.1f}% of habitat)")
    print(f"interface score (Eq.7, not a research metric): {m['interface_score']['score']:.1f}/100")
    crit = json.loads((run_dir / "criticality.json").read_text())
    print("top criticality:")
    for r in crit[:5]:
        print(f"  #{r['rank']} {r['patch_id']:<20} A={r['area_ha']:8.1f} ha ({r['area_pct']:4.1f}%, area rank {r['rank_by_area']:>2}) "
              f"deg={r['degree']} S={r['criticality_score']:.4f} comp {r['component_count_before']}->{r['component_count_after']}"
              f"{'  CUT-VERTEX' if r['is_cut_vertex'] else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
