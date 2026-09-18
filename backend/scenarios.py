"""Scenario Lab + Restoration Planner computations over a stored run.

Every scenario returns  baseline -> scenario -> difference  computed EXACTLY on the run's patches (graph rebuilt,
index recomputed) and is labelled SIMULATED.  Period comparison compares two stored runs (both model outputs)
and is labelled OBSERVED (MODEL OUTPUT) - it is still not a field observation.

Restoration feasibility uses only layers that really exist for the run: the run's own patches (existing
habitat), the scene's Sentinel-2 NDWI (open-water indicator) when the scene carries S2 bands, and distance
to existing habitat.  Legal status, land ownership, settlements and infrastructure are NOT assessed because
no such layer is loaded - the output says so explicitly instead of guessing.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
from shapely.geometry import Polygon, shape

from ecoconnect.graph import (Patch, build_graph, connectivity, compute_criticality, evaluate_candidates,
                              simulate_removal, summarise)
from ecoconnect.graph.construction import haversine_km


def _load(run_dir: Path):
    m = json.loads((run_dir / "manifest.json").read_text())
    inp = json.loads((run_dir / "patches_input.json").read_text())
    mk = lambda p: Patch(**{**p, "centroid": tuple(p["centroid"]), "bbox": tuple(p["bbox"]) if p.get("bbox") else None})  # noqa: E731
    patches = [mk(p) for p in inp["patches"]]
    cands = [mk(c) for c in inp["candidates"]]
    g = m["config"]["graph"]
    metric = m["config"]["connectivity"]["research_metric"]
    return m, patches, cands, inp["landscape_area_ha"], g, metric


def _summary(graph, a_l, metric):
    s = summarise(graph, a_l)
    return {"n_patches": s.n_patches, "n_edges": s.n_edges, "n_components": s.n_components, "habitat_area_ha": s.habitat_area_ha,
            "iic": s.iic, "pc": s.pc, "eca_ha": s.eca_ha, "eca_pct_of_habitat": s.eca_pct_of_habitat, "metric": metric,
            "c": connectivity(graph, a_l, metric)}


def _diff(b: dict, s: dict) -> dict:
    out = {}
    for k in ("n_patches", "n_edges", "n_components", "habitat_area_ha", "iic", "pc", "eca_ha", "eca_pct_of_habitat", "c"):
        out[k] = s[k] - b[k]
        if isinstance(b[k], float) and b[k]:
            out[f"{k}_pct"] = 100.0 * (s[k] - b[k]) / b[k]
    return out


def run_scenario(run_dir: Path, body: dict, other_run_dir: Optional[Path] = None) -> dict:
    m, patches, cands, a_l, g, metric = _load(run_dir)
    k, tau, dm = g["k_neighbors"], g["tau_km"], g["distance_mode"]
    t = body["type"]
    base_graph = build_graph(patches, k=k, tau_km=tau, distance_mode=dm)
    baseline = _summary(base_graph, a_l, metric)
    label = "SIMULATED"

    if t in ("remove_patches", "remove_polygon"):
        if t == "remove_polygon":
            poly = Polygon([(lon, lat) for lat, lon in body["polygon"]])
            ids = [p.id for p in patches if p.geometry and (shape(p.geometry).intersects(poly) or poly.contains(shape(p.geometry).centroid))]
        else:
            ids = list(body["patch_ids"])
        if not ids:
            raise ValueError("no patches selected")
        res = simulate_removal(base_graph, ids, a_l, metric)
        sg = base_graph.without(*ids)
        scen = _summary(sg, a_l, metric)
        expl = (f"Removing {len(ids)} patch(es) ({res.habitat_area_removed_ha:.1f} ha, {res.habitat_area_removed_pct:.1f} % of habitat) lowers "
                f"{metric.upper()} by {res.loss_pct:.1f} %, severs {len(res.severed_edges)} links, leaves {len(res.newly_isolated_patch_ids)} patch(es) isolated "
                f"and changes the component count {res.components_before} → {res.components_after}.")
        return {"type": t, "label": label, "parameters": {"patch_ids": ids, "tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "scenario": scen, "difference": _diff(baseline, scen),
                "affected_patch_ids": res.affected_patch_ids, "removed_patch_ids": ids, "severed_edges": res.severed_edges,
                "newly_isolated_patch_ids": res.newly_isolated_patch_ids, "edges_after": [e.to_dict() for e in sg.edges.values()],
                "explanation": expl}

    if t in ("restore", "restore_multi"):
        ids = set(body["candidate_ids"])
        chosen = [c for c in cands if c.id in ids]
        if not chosen:
            raise ValueError("no known candidates selected")
        sg = base_graph
        for c in chosen:
            sg = sg.with_patch(c, rebuild=m["config"]["restoration"].get("rebuild_edges_on_insert", False))
        scen = _summary(sg, a_l, metric)
        rows, _ = evaluate_candidates(base_graph, chosen, a_l, metric)
        d = _diff(baseline, scen)
        expl = (f"Adding {len(chosen)} candidate(s) ({sum(c.area_ha for c in chosen):.1f} ha) raises {metric.upper()} by {d['c_pct']:.2f} % "
                f"({baseline['n_edges']} → {scen['n_edges']} links, {baseline['n_components']} → {scen['n_components']} components). "
                "Individual gains are computed one at a time; the joint gain is not their sum when candidates share neighbours. Feasibility is not implied.")
        return {"type": t, "label": label, "parameters": {"candidate_ids": sorted(ids), "tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "scenario": scen, "difference": d,
                "individual": [r.to_dict() for r in rows], "added": [c.to_dict() for c in chosen],
                "edges_after": [e.to_dict() for e in sg.edges.values()], "explanation": expl}

    if t == "tau":
        taus = body.get("taus_km") or [3.0, 5.0, 8.0]
        out = []
        base_rows, _ = compute_criticality(base_graph, a_l, metric)
        base_rank = {r.patch_id: r.rank for r in base_rows}
        from ecoconnect.graph.criticality import spearman
        for tv in taus:
            gg = build_graph(patches, k=k, tau_km=tv, distance_mode=dm)
            rows, _ = compute_criticality(gg, a_l, metric)
            rk = {r.patch_id: r.rank for r in rows}
            out.append({"tau_km": tv, **_summary(gg, a_l, metric), "top5": [r.patch_id for r in rows[:5]],
                        "spearman_vs_reference": spearman([base_rank[i] for i in base_rank], [rk[i] for i in base_rank]),
                        "edges": [e.to_dict() for e in gg.edges.values()]})
        return {"type": t, "label": label, "parameters": {"taus_km": taus, "reference_tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "variants": out,
                "explanation": ("τ is a configurable analysis parameter, not a biological constant. "
                                + "; ".join(f"τ = {v['tau_km']} km: {v['n_edges']} links, {v['n_components']} components, rank correlation with reference {v['spearman_vs_reference']:.2f}" for v in out) + ".")}

    if t == "threshold":
        src = m["data_source"]
        if src.get("type") != "probability_raster" or not Path(str(src.get("path", ""))).is_file():
            raise ValueError("threshold scenarios need the run's probability raster on disk (not available for synthetic runs)")
        from ecoconnect.pipeline.sources import from_probability_raster
        out = []
        for thr in body.get("thresholds") or [0.4, 0.5, 0.6, 0.7]:
            p2, _, a2, _, _ = from_probability_raster(src["path"], threshold=float(thr), mmu_ha=src.get("mmu_ha", 2.0), candidate_threshold=None)
            if not p2:
                out.append({"threshold": thr, "n_patches": 0}); continue
            gg = build_graph(p2, k=k, tau_km=tau, distance_mode=dm)
            out.append({"threshold": thr, **_summary(gg, a2, metric), "patch_geojson_count": len(p2)})
        return {"type": t, "label": label, "parameters": {"thresholds": [v["threshold"] for v in out], "reference_threshold": src.get("threshold")},
                "baseline": baseline, "variants": out,
                "explanation": "Re-extracting patches at other probability thresholds changes patch count, habitat area and every index; the calibrated threshold is the one selected by the sweep against the reference map."}

    if t == "compare_periods":
        if other_run_dir is None:
            raise ValueError("compare_periods needs other_run_id")
        m2, p2, _, a2, g2, metric2 = _load(other_run_dir)
        g_other = build_graph(p2, k=g2["k_neighbors"], tau_km=g2["tau_km"], distance_mode=g2["distance_mode"])
        other = _summary(g_other, a2, metric2)
        ids_a, ids_b = {p.id for p in patches}, {p.id for p in p2}
        # patch identity is positional (ids are per-run); match by centroid proximity (< 300 m)
        matched, lost, gained = [], [], []
        for p in patches:
            best = min(p2, key=lambda q: haversine_km(p.centroid, q.centroid), default=None)
            if best and haversine_km(p.centroid, best.centroid) < 0.3:
                matched.append((p.id, best.id, p.area_ha, best.area_ha))
            else:
                lost.append(p.id)
        matched_b = {b for _, b, _, _ in matched}
        gained = [q.id for q in p2 if q.id not in matched_b]
        crit_a, _ = compute_criticality(base_graph, a_l, metric)
        crit_b, _ = compute_criticality(g_other, a2, metric2)
        ra, rb = {r.patch_id: r for r in crit_a}, {r.patch_id: r for r in crit_b}
        crit_change = [{"patch_a": a, "patch_b": b, "area_a": aa, "area_b": ab, "S_a": ra[a].criticality_score, "S_b": rb[b].criticality_score,
                        "rank_a": ra[a].rank, "rank_b": rb[b].rank} for a, b, aa, ab in matched]
        d = _diff(baseline, other)
        expl = (f"Between run {m['run_id']} ({m['data_source'].get('scene_year')}) and {m2['run_id']} ({m2['data_source'].get('scene_year')}): "
                f"habitat {baseline['habitat_area_ha']:.0f} → {other['habitat_area_ha']:.0f} ha, {metric.upper()} {baseline['iic']:.3e} → {other['iic']:.3e} ({d['iic_pct']:+.1f} %), "
                f"components {baseline['n_components']} → {other['n_components']}; {len(lost)} patch(es) without a counterpart within 300 m, {len(gained)} new. "
                "Both are model outputs; differences include model uncertainty and no cause is attributed.")
        return {"type": t, "label": "OBSERVED (MODEL OUTPUT)", "parameters": {"run_a": m["run_id"], "run_b": m2["run_id"]},
                "baseline": baseline, "scenario": other, "difference": d, "lost_patch_ids": lost, "gained_patch_ids": gained,
                "matched": crit_change, "explanation": expl}

    raise ValueError(f"unknown scenario type {t}")


# --------------------------------------------------------------------------- restoration feasibility
def _ndwi_stats(scene_path: Optional[str], geometry: dict) -> Optional[float]:
    """Mean Sentinel-2 NDWI inside a candidate polygon, if the scene carries an 's2_ndwi' band."""
    if not scene_path or not Path(scene_path).exists():
        return None
    try:
        import rasterio
        from rasterio.mask import mask as rmask
        from rasterio.warp import transform_geom
        with rasterio.open(scene_path) as s:
            names = list(s.descriptions or [])
            if "s2_ndwi" not in names:
                return None
            bi = names.index("s2_ndwi") + 1
            geom = transform_geom("EPSG:4326", s.crs, geometry)
            arr, _ = rmask(s, [geom], crop=True, indexes=[bi], nodata=s.nodata)
            v = arr[0][(arr[0] != s.nodata) & np.isfinite(arr[0])]
            return float(v.mean()) if v.size else None
    except Exception:
        return None


def restoration_feasibility(run_dir: Path, scene_path: Optional[str], water_ndwi: float = 0.3, near_km: float = 2.0) -> dict:
    m, patches, cands, a_l, g, metric = _load(run_dir)
    base_graph = build_graph(patches, k=g["k_neighbors"], tau_km=g["tau_km"], distance_mode=g["distance_mode"])
    rows, c_base = evaluate_candidates(base_graph, cands, a_l, metric)
    out = []
    for r in rows:
        c = next(x for x in cands if x.id == r.candidate_id)
        d_near = min((haversine_km(c.centroid, p.centroid) for p in patches), default=None)
        ndwi = _ndwi_stats(scene_path, c.geometry) if c.geometry else None
        cg = shape(c.geometry) if c.geometry else None
        overlap_frac = 0.0
        if cg is not None and cg.area > 0:
            inter = sum(cg.intersection(shape(p.geometry)).area for p in patches if p.geometry and cg.intersects(shape(p.geometry)))
            overlap_frac = min(1.0, inter / cg.area)
        overlaps = overlap_frac > 0.5
        adjoins = 0.0 < overlap_frac <= 0.5
        reasons_for, reasons_against, unknown = [], [], []
        reasons_for.append(f"connectivity gain +{r.gain_pct:.2f} % {metric.upper()} ({r.new_links} new link(s) to {', '.join(r.linked_patch_ids) or 'no patch'})")
        if d_near is not None:
            (reasons_for if d_near <= near_km else reasons_against).append(f"nearest existing habitat {d_near:.2f} km {'(within ' + str(near_km) + ' km)' if d_near <= near_km else '(> ' + str(near_km) + ' km: isolated site)'}")
        if ndwi is not None:
            (reasons_against if ndwi > water_ndwi else reasons_for).append(f"mean NDWI {ndwi:.2f} {'suggests predominantly open water - needs hydrology/tidal assessment' if ndwi > water_ndwi else 'consistent with intertidal/land surface'}")
        else:
            unknown.append("water/land status not assessed (no Sentinel-2 NDWI available for this run)")
        if overlaps:
            reasons_against.append(f"{100 * overlap_frac:.0f} % of the site already lies inside an existing habitat patch")
        elif adjoins:
            reasons_for.append(f"adjoins existing habitat ({100 * overlap_frac:.0f} % boundary overlap) - an expansion site")
        if r.new_links == 0:
            reasons_against.append("forms no link within τ - no network benefit")
        if c.confidence:
            reasons_for.append(f"model probability {c.confidence:.2f} (marginal habitat signal)")
        unknown += ["legal status / protected-area boundary not assessed (no layer loaded)",
                    "land ownership, settlements, infrastructure and accessibility not assessed (no layer loaded)",
                    "cost not assessed (no cost data supplied)"]
        verdict = "not_recommended" if (r.new_links == 0 or overlaps) else ("conditional" if reasons_against else "recommended")
        out.append({"candidate_id": r.candidate_id, "rank": r.rank, "area_ha": r.area_ha, "centroid": r.centroid, "gain_pct": r.gain_pct,
                    "new_links": r.new_links, "linked_patch_ids": r.linked_patch_ids, "nearest_habitat_km": d_near, "ndwi_mean": ndwi,
                    "overlaps_existing": overlaps, "overlap_fraction": overlap_frac, "verdict": verdict, "why": reasons_for, "why_not": reasons_against, "not_assessed": unknown,
                    "geometry": c.geometry})
    return {"metric": metric, "baseline_c": c_base, "ranking_basis": "raw connectivity gain (no cost data)",
            "candidate_method": ("candidates = connected components of the probability raster with "
                                 f"{m['config']['restoration'].get('candidate_threshold')} <= p < {m['data_source'].get('threshold')} (marginal habitat), "
                                 f">= {m['config']['restoration'].get('candidate_min_area_ha')} ha, top {m['config']['restoration'].get('candidate_max_count')} by area"),
            "rules": {"near_km": near_km, "water_ndwi": water_ndwi,
                      "note": "verdicts are rule outputs over available layers; a mathematically good site is never assumed legally feasible"},
            "candidates": out}
