"""Scenario Lab + Restoration Planner computations over a stored run.

Every scenario returns  baseline -> scenario -> difference  computed EXACTLY on the run's patches (graph rebuilt,
index recomputed) and is labelled SIMULATED.  Period comparison compares two stored runs (both model outputs)
and is labelled MODEL-ESTIMATED CHANGE (or NOT LIKE-FOR-LIKE when model/settings differ) - never a field observation.

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

from ecoconnect.graph import (build_graph, connectivity, compute_criticality, evaluate_candidates,
                              simulate_removal, summarise)
from ecoconnect.graph.construction import haversine_km
from ecoconnect.graph.sensitivity import hypothetical_patch, scale_areas, sensitivity
from ecoconnect.graph.temporal import comparability, track_patches
from ecoconnect.graph.temporal import summarise as summarise_tracking
from ecoconnect.pipeline.config import REPO_ROOT

from .paths import abs_path, patch_from_dict
from .restoration_rules import UNCERTAIN_NOTE, classify


def _abs(p) -> Path:
    return abs_path(str(p or "")) or REPO_ROOT


def _load(run_dir: Path):
    m = json.loads((run_dir / "manifest.json").read_text())
    inp = json.loads((run_dir / "patches_input.json").read_text())
    mk = patch_from_dict
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


def _bounded(values, lo: float, hi: float, max_n: int, name: str) -> list[float]:
    """Public endpoints must not accept unbounded work: every list parameter is capped in length and range."""
    vals = [float(v) for v in values]
    if len(vals) > max_n or any(not lo <= v <= hi for v in vals):
        raise ValueError(f"{name}: at most {max_n} values, each between {lo} and {hi}")
    return vals


def run_scenario(run_dir: Path, body: dict, other_run_dir: Optional[Path] = None) -> dict:
    m, patches, cands, a_l, g, metric = _load(run_dir)
    k, tau, dm = g["k_neighbors"], g["tau_km"], g["distance_mode"]
    t = body["type"]
    base_graph = build_graph(patches, k=k, tau_km=tau, distance_mode=dm)
    baseline = _summary(base_graph, a_l, metric)
    label = "SIMULATED"

    if t in ("remove_patches", "remove_polygon"):
        if t == "remove_polygon":
            raw_pts = body.get("polygon", [])
            if len(raw_pts) < 3:
                raise ValueError("drawn polygon requires at least 3 points")
            poly_lonlat = Polygon([(lon, lat) for lat, lon in raw_pts])
            poly_latlon = Polygon([(lat, lon) for lat, lon in raw_pts])
            ids = []
            from shapely.geometry import Point
            for p in patches:
                geom = shape(p.geometry) if p.geometry else None
                if geom and (geom.intersects(poly_lonlat) or poly_lonlat.contains(geom.centroid) or geom.intersects(poly_latlon) or poly_latlon.contains(geom.centroid)):
                    ids.append(p.id)
                elif p.centroid:
                    pt1 = Point(p.centroid[1], p.centroid[0])
                    pt2 = Point(p.centroid[0], p.centroid[1])
                    if poly_lonlat.contains(pt1) or poly_latlon.contains(pt2) or poly_latlon.contains(pt1):
                        ids.append(p.id)
            if not ids:
                raise ValueError("The drawn area does not overlap any habitat patch, so nothing would be removed.")
        else:
            ids = list(body.get("patch_ids", []))
        if not ids:
            raise ValueError("No patches selected for removal.")
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
        taus = _bounded(body.get("taus_km") or [3.0, 5.0, 8.0], 0.5, 50, 6, "taus_km")
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

    if t == "reduce_area":
        ids = [i for i in dict.fromkeys(body.get("patch_ids") or []) if i in base_graph.patches]
        f = float(body.get("retain_fraction", 0.5))
        if not ids or not 0.0 < f < 1.0:
            raise ValueError("reduce_area needs known patch_ids and 0 < retain_fraction < 1")
        sg = build_graph(scale_areas(patches, ids, f), k=k, tau_km=tau, distance_mode=dm)
        scen = _summary(sg, a_l, metric)
        d = _diff(baseline, scen)
        expl = (f"Shrinking {len(ids)} patch(es) to {100 * f:.0f} % of their area (−{baseline['habitat_area_ha'] - scen['habitat_area_ha']:.1f} ha) "
                f"changes {metric.upper()} by {d['c_pct']:+.1f} %. Links are unchanged because patch locations stay the same; "
                "this is a hypothetical degradation, not a forecast.")
        return {"type": t, "label": label, "parameters": {"patch_ids": ids, "retain_fraction": f, "tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "scenario": scen, "difference": d, "affected_patch_ids": ids,
                "edges_after": [e.to_dict() for e in sg.edges.values()], "explanation": expl}

    if t == "add_patch":
        lat, lon, area = float(body["lat"]), float(body["lon"]), float(body["area_ha"])
        bb = (m.get("study_area") or {}).get("bbox")
        if not 0.1 <= area <= 10000:
            raise ValueError("area_ha must be between 0.1 and 10000")
        if bb and not (bb[0] - 0.25 <= lat <= bb[2] + 0.25 and bb[1] - 0.25 <= lon <= bb[3] + 0.25):
            raise ValueError("hypothetical patch must lie within the study area")
        hp = hypothetical_patch(lat, lon, area)
        sg = build_graph(patches + [hp], k=k, tau_km=tau, distance_mode=dm)
        scen = _summary(sg, a_l, metric)
        d = _diff(baseline, scen)
        links = [e.to_dict() for e in sg.edges.values() if hp.id in (e.source, e.target)]
        expl = (f"A hypothetical {area:.1f} ha patch at ({lat:.4f}, {lon:.4f}) would link to {len(links)} patch(es) and change "
                f"{metric.upper()} by {d['c_pct']:+.2f} % ({baseline['n_components']} → {scen['n_components']} components). "
                "It is user-defined - not a detected habitat or a restoration recommendation.")
        return {"type": t, "label": label, "parameters": {"lat": lat, "lon": lon, "area_ha": area, "tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "scenario": scen, "difference": d, "added": [hp.to_dict()], "new_links": links,
                "affected_patch_ids": sorted({x for e in links for x in (e["source"], e["target"])} - {hp.id}),
                "edges_after": [e.to_dict() for e in sg.edges.values()], "explanation": expl}

    if t == "radius":
        tv = float(body["tau_km"])
        if not 0.5 <= tv <= 50:
            raise ValueError("tau_km must be between 0.5 and 50")
        sg = build_graph(patches, k=k, tau_km=tv, distance_mode=dm)
        scen = _summary(sg, a_l, metric)
        d = _diff(baseline, scen)
        base_e = {(e.source, e.target) for e in base_graph.edges.values()}
        new_e = {(e.source, e.target) for e in sg.edges.values()}
        expl = (f"Changing the connection radius τ from {tau} to {tv} km changes links {baseline['n_edges']} → {scen['n_edges']}, "
                f"components {baseline['n_components']} → {scen['n_components']} and {metric.upper()} by {d['c_pct']:+.1f} %. "
                "τ is a modelling assumption, not a measured dispersal distance.")
        return {"type": t, "label": label, "parameters": {"tau_km": tv, "reference_tau_km": tau, "k": k, "metric": metric},
                "baseline": baseline, "scenario": scen, "difference": d,
                "links_added": sorted(map(list, new_e - base_e)), "links_removed": sorted(map(list, base_e - new_e)),
                "edges_after": [e.to_dict() for e in sg.edges.values()], "explanation": expl}

    if t == "sensitivity":
        taus = [float(x) for x in (body.get("taus_km") or g.get("tau_sensitivity_km") or [3.0, 5.0, 8.0])][:6]
        ks = [int(x) for x in (body.get("ks") or [2, 3, 4])][:4]
        if any(not 0.5 <= x <= 50 for x in taus) or any(not 1 <= x <= 10 for x in ks):
            raise ValueError("taus_km must be in [0.5, 50] and ks in [1, 10]")
        kw = {"p_at_tau": m["config"]["connectivity"]["pc_probability_at_tau"]} if metric == "pc" else {}
        res = sensitivity(patches, a_l, taus_km=taus, ks=ks, reference=(tau, k), metric=metric, distance_mode=dm, **kw)
        return {"type": t, "label": label, "parameters": {"taus_km": taus, "ks": ks, "reference_tau_km": tau, "reference_k": k, "metric": metric},
                "baseline": baseline, **res,
                "explanation": res["verdict"] + " τ and k are modelling assumptions; stability here is structural, not ecological validation."}

    if t == "threshold":
        src = m["data_source"]
        if src.get("type") != "probability_raster":
            raise ValueError("Threshold scenarios need a probability raster; this run uses synthetic patch geometry.")
        if not _abs(src.get("path")).is_file():
            raise ValueError("This run's probability raster is not on this server, so patches cannot be re-drawn at other "
                             "thresholds. Run the Thresholds scenario on a new analysis or a satellite (near-real-time) run.")
        from ecoconnect.pipeline.sources import from_probability_raster
        out = []
        for thr in _bounded(body.get("thresholds") or [0.4, 0.5, 0.6, 0.7], 0.05, 0.95, 8, "thresholds"):
            p2, _, a2, _, _ = from_probability_raster(_abs(src["path"]), threshold=float(thr), mmu_ha=src.get("mmu_ha", 2.0), candidate_threshold=None)
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
        # patch ids are per run: identity comes from polygon overlap (ecoconnect.graph.temporal)
        tracking = track_patches(json.loads((run_dir / "patches.geojson").read_text()),
                                 json.loads((other_run_dir / "patches.geojson").read_text()))
        comp = comparability(m, m2)
        one_to_one = [e for e in tracking["events"] if e["type"] in ("stable", "grown", "shrunk")]
        lost = [i for e in tracking["events"] if e["type"] == "disappeared" for i in e["patches_a"]]
        gained = [i for e in tracking["events"] if e["type"] == "new" for i in e["patches_b"]]
        crit_a, _ = compute_criticality(base_graph, a_l, metric)
        crit_b, _ = compute_criticality(g_other, a2, metric2)
        ra, rb = {r.patch_id: r for r in crit_a}, {r.patch_id: r for r in crit_b}
        crit_change = [{"patch_a": e["patches_a"][0], "patch_b": e["patches_b"][0], "change": e["type"], "area_a": e["area_a_ha"], "area_b": e["area_b_ha"],
                        "S_a": ra[e["patches_a"][0]].criticality_score, "S_b": rb[e["patches_b"][0]].criticality_score,
                        "rank_a": ra[e["patches_a"][0]].rank, "rank_b": rb[e["patches_b"][0]].rank} for e in one_to_one]
        d = _diff(baseline, other)
        expl = (f"Between run {m['run_id']} ({m['data_source'].get('scene_year')}) and {m2['run_id']} ({m2['data_source'].get('scene_year')}): "
                f"habitat {baseline['habitat_area_ha']:.0f} → {other['habitat_area_ha']:.0f} ha, {metric.upper()} {baseline['iic']:.3e} → {other['iic']:.3e} ({d['iic_pct']:+.1f} %), "
                f"components {baseline['n_components']} → {other['n_components']}. {summarise_tracking(tracking)} "
                "'Disappeared' means no patch above the minimum size overlaps it in the later run (it may have shrunk below that size). "
                + comp["note"] + " No cause is attributed.")
        return {"type": t, "label": "MODEL-ESTIMATED CHANGE" if comp["comparable"] else "NOT LIKE-FOR-LIKE (DIFFERENT MODEL/SETTINGS)",
                "parameters": {"run_a": m["run_id"], "run_b": m2["run_id"]},
                "baseline": baseline, "scenario": other, "difference": d, "lost_patch_ids": lost, "gained_patch_ids": gained,
                "matched": crit_change, "tracking": tracking, "comparability": comp, "explanation": expl}

    raise ValueError(f"unknown scenario type {t}")


# --------------------------------------------------------------------------- restoration feasibility
def _ndwi_stats(scene_path: Optional[str], geometry: dict) -> Optional[float]:
    """Mean Sentinel-2 NDWI inside a candidate polygon, if the scene carries an 's2_ndwi' band."""
    if not scene_path or not _abs(scene_path).exists():
        return None
    scene_path = str(_abs(scene_path))
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
        category = classify(r.area_ha, sum(p.area_ha for p in patches))
        if category == "uncertain_habitat":
            reasons_against.insert(0, UNCERTAIN_NOTE)
            verdict = "field_check"
        else:
            verdict = "not_recommended" if (r.new_links == 0 or overlaps) else ("conditional" if reasons_against else "recommended")
        out.append({"candidate_id": r.candidate_id, "rank": r.rank, "area_ha": r.area_ha, "centroid": r.centroid, "gain_pct": r.gain_pct,
                    "new_links": r.new_links, "linked_patch_ids": r.linked_patch_ids, "nearest_habitat_km": d_near, "ndwi_mean": ndwi,
                    "overlaps_existing": overlaps, "overlap_fraction": overlap_frac, "verdict": verdict, "category": category, "why": reasons_for, "why_not": reasons_against, "not_assessed": unknown,
                    "geometry": c.geometry})
    return {"metric": metric, "baseline_c": c_base, "ranking_basis": "raw connectivity gain (no cost data)",
            "candidate_method": ("candidates = connected components of the probability raster with "
                                 f"{m['config']['restoration'].get('candidate_threshold')} <= p < {m['data_source'].get('threshold')} (marginal habitat), "
                                 f">= {m['config']['restoration'].get('candidate_min_area_ha')} ha, top {m['config']['restoration'].get('candidate_max_count')} by area"),
            "rules": {"near_km": near_km, "water_ndwi": water_ndwi,
                      "note": "verdicts are rule outputs over available layers; a mathematically good site is never assumed legally feasible"},
            "candidates": out}
