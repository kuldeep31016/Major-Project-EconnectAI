"""Map pipeline results onto the shapes the existing Next.js UI already consumes
(``frontend/types/index.ts``: HabitatMask, HabitatGraph, ConnectivityMetrics,
HeatmapData, RestorationData).

Rules:
* every number in the bundle is either computed here from the run, or ``null``;
* fields the prototype invented (carbon stock, species counts, degradation risk,
  species flow, time-series trends) are emitted as ``null`` / empty and the UI
  hides them when absent;
* ``provenance`` on the bundle tells the UI which label to display.
"""
from __future__ import annotations

import math
from typing import Optional

import networkx as nx
from shapely.geometry import shape, box

from ecoconnect.graph import Patch, HabitatGraph
from ecoconnect.graph.connectivity import ConnectivitySummary
from ecoconnect.graph.criticality import CriticalityRow
from ecoconnect.graph.explain import Explanation, criticality_level
from ecoconnect.graph.restoration import RestorationRow
from ecoconnect.graph.what_if import WhatIfResult

HABITAT_COLOR = {"mangrove": "#00c896", "seagrass": "#38bdf8", "coral": "#f472b6", "saltmarsh": "#a3e635",
                 "mudflat": "#f59e0b", "estuary": "#818cf8", "dune": "#fbbf24", "water": "#0ea5e9", "urban": "#94a3b8"}
LEVEL_COLOR = {"low": "#22c55e", "medium": "#f59e0b", "high": "#f97316", "critical": "#ef4444"}


def _ring(geometry: Optional[dict], centroid: tuple[float, float], simplify_deg: float) -> list[list[float]]:
    """Exterior ring of the largest polygon as [lat, lon] pairs (Leaflet order)."""
    if not geometry:
        lat, lon = centroid
        d = 0.002
        return [[lat + d, lon - d], [lat + d, lon + d], [lat - d, lon + d], [lat - d, lon - d]]
    geom = shape(geometry)
    if geom.geom_type == "MultiPolygon":
        geom = max(geom.geoms, key=lambda g: g.area)
    if simplify_deg > 0:
        geom = geom.simplify(simplify_deg, preserve_topology=True)
    return [[round(y, 6), round(x, 6)] for x, y in geom.exterior.coords]


def _betweenness(graph: HabitatGraph) -> dict[str, float]:
    if graph.n_nodes < 3:
        return {i: 0.0 for i in graph.node_ids}
    G = nx.Graph()
    G.add_nodes_from(graph.node_ids)
    G.add_weighted_edges_from((e.source, e.target, e.distance_km) for e in graph.edges.values())
    return nx.betweenness_centrality(G, weight="weight", normalized=True)


def _positions(graph: HabitatGraph, w: int = 1100, h: int = 640, pad: int = 60) -> dict[str, dict]:
    lats = [p.centroid[0] for p in graph.patches.values()]
    lons = [p.centroid[1] for p in graph.patches.values()]
    lat0, lat1, lon0, lon1 = min(lats), max(lats), min(lons), max(lons)
    sx = (w - 2 * pad) / max(lon1 - lon0, 1e-9)
    sy = (h - 2 * pad) / max(lat1 - lat0, 1e-9)
    s = min(sx, sy)
    return {pid: {"x": round(pad + (p.centroid[1] - lon0) * s), "y": round(pad + (lat1 - p.centroid[0]) * s)}
            for pid, p in graph.patches.items()}


def _diameter_km(graph: HabitatGraph) -> float:
    G = nx.Graph()
    G.add_nodes_from(graph.node_ids)
    G.add_weighted_edges_from((e.source, e.target, e.distance_km) for e in graph.edges.values())
    best = 0.0
    for comp in nx.connected_components(G):
        if len(comp) < 2:
            continue
        sub = G.subgraph(comp)
        for _, d in nx.all_pairs_dijkstra_path_length(sub, weight="weight"):
            best = max(best, max(d.values()))
    return best


def _heat_cells(patches: list[Patch], crit: dict[str, CriticalityRow], levels: dict[str, str],
                cell_m: float) -> list[dict]:
    """Coarse grid over each patch; a cell takes the S_i of the patch it lies in."""
    cells = []
    for p in patches:
        if not p.geometry:
            continue
        geom = shape(p.geometry)
        lat = p.centroid[0]
        dlat = cell_m / 110_574.0
        dlon = cell_m / (111_320.0 * math.cos(math.radians(lat)))
        minx, miny, maxx, maxy = geom.bounds
        r = crit[p.id]
        y = miny
        while y < maxy:
            x = minx
            while x < maxx:
                cell = box(x, y, x + dlon, y + dlat)
                if geom.intersects(cell) and geom.intersection(cell).area > 0.5 * cell.area:
                    cells.append({
                        "id": f"{p.id}-{len(cells)}",
                        "bounds": [[round(y, 6), round(x, 6)], [round(y + dlat, 6), round(x + dlon, 6)]],
                        "sensitivity": round(r.criticality_score, 4),
                        "band": levels[p.id],
                        "habitatProbability": round(p.confidence, 4),
                        "connectivityContribution": round(r.criticality_score, 4),
                        "confidence": round(p.confidence, 4),
                        "patchId": p.id,
                    })
                x += dlon
            y += dlat
    return cells


def build_frontend_bundle(*, manifest: dict, patches: list[Patch], graph: HabitatGraph,
                          summary: ConnectivitySummary, ui_score: dict, rows: list[CriticalityRow],
                          explanations: list[Explanation], rest_rows: list[RestorationRow],
                          candidates: list[Patch], what_if: WhatIfResult, rho: float,
                          landscape_area_ha: float, export_cfg: dict,
                          level_thresholds=(0.25, 0.10, 0.03)) -> dict:
    sid = manifest["study_area_id"]
    crit = {r.patch_id: r for r in rows}
    expl = {e.patch_id: e for e in explanations}
    levels = {e.patch_id: e.level for e in explanations}
    btw = _betweenness(graph)
    pos = _positions(graph)
    simplify_deg = export_cfg.get("polygon_simplify_m", 15) / 111_000.0
    a_h = graph.habitat_area_ha()
    max_s = max((r.criticality_score for r in rows), default=1.0) or 1.0

    # ---------------------------------------------------------------- HabitatMask
    by_class: dict[str, list[Patch]] = {}
    for p in patches:
        by_class.setdefault(p.habitat_class, []).append(p)
    classes = [{
        "habitatClass": hc, "label": hc.capitalize(), "color": HABITAT_COLOR.get(hc, "#00c896"),
        "areaHa": round(sum(p.area_ha for p in ps), 2),
        "coveragePct": round(100 * sum(p.area_ha for p in ps) / landscape_area_ha, 2),
        "meanConfidence": round(sum(p.confidence * p.area_ha for p in ps) / sum(p.area_ha for p in ps), 4),
    } for hc, ps in by_class.items()]
    ui_patches = []
    for p in patches:
        r = crit[p.id]
        ui_patches.append({
            "id": p.id, "name": p.name or p.id, "habitatClass": p.habitat_class,
            "areaHa": round(p.area_ha, 2), "center": [round(p.centroid[0], 6), round(p.centroid[1], 6)],
            "polygon": _ring(p.geometry, p.centroid, simplify_deg),
            "confidence": round(p.confidence, 4), "quality": round(p.quality, 4),
            "connectivityContribution": round(r.criticality_score, 4),
            "bridgeScore": round(btw.get(p.id, 0.0), 4),
            "sensitivity": levels[p.id],
            "protected": p.protected, "protectedAreaName": None,
            "carbonStockTonnes": None, "speciesSupported": None, "degradationRisk": None,
            "notes": expl[p.id].text,
            # research fields (new, consumed by the updated UI)
            "criticalityRank": r.rank, "criticalityScore": round(r.criticality_score, 6),
            "deltaConnectivity": r.delta_connectivity, "deltaPct": round(r.delta_pct, 3),
            "degree": r.degree, "isCutVertex": r.is_cut_vertex,
            "componentCountAfter": r.component_count_after, "rankByArea": r.rank_by_area,
            "perimeterKm": p.perimeter_km, "neighbourIds": r.neighbour_ids,
            "neighbourDistancesKm": r.neighbour_distances_km,
        })
    largest = max(patches, key=lambda p: p.area_ha)
    mask = {
        "sceneId": sid, "generatedAt": manifest["timestamp_utc"],
        "modelVersion": manifest["data_source"].get("model", "n/a"),
        "classes": classes, "patches": ui_patches,
        "totals": {
            "habitatAreaHa": round(a_h, 2), "patchCount": len(patches),
            "meanPatchSizeHa": round(a_h / len(patches), 2),
            "largestPatchIndex": round(100 * largest.area_ha / a_h, 2),
            "edgeDensity": round(sum(p.perimeter_km or 0 for p in patches) / (a_h / 100.0), 3) if a_h else 0,
            "meanConfidence": round(sum(p.confidence * p.area_ha for p in patches) / a_h, 4),
        },
    }

    # ---------------------------------------------------------------- HabitatGraph
    comps = graph.components()
    comp_of = {pid: ci for ci, c in enumerate(comps) for pid in c}
    hubs = sorted(graph.node_ids, key=lambda i: -graph.degree(i))[: max(1, len(patches) // 6)]
    nodes = [{
        "id": p.id, "patchId": p.id, "label": p.name or p.id, "habitatClass": p.habitat_class,
        "position": pos[p.id], "areaHa": round(p.area_ha, 2), "quality": round(p.quality, 4),
        "connectivity": round(crit[p.id].criticality_score / max_s, 4),
        "sensitivity": levels[p.id], "bridgeScore": round(btw.get(p.id, 0.0), 4),
        "importance": round(crit[p.id].criticality_score, 4), "degree": graph.degree(p.id),
        "isHub": p.id in hubs and graph.degree(p.id) > 0, "explanation": expl[p.id].text,
        "criticalityRank": crit[p.id].rank, "isCutVertex": crit[p.id].is_cut_vertex,
    } for p in patches]
    edges = [{
        "id": f"{sid}-e{n}", "source": e.source, "target": e.target,
        "strength": round(e.weight, 4), "distanceKm": round(e.distance_km, 3),
        "resistance": round(1 - e.weight, 4), "critical": graph.is_bridge_edge(e.source, e.target),
        "speciesFlow": [],
    } for n, e in enumerate(graph.edges.values(), 1)]
    palette = ["#00c896", "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6", "#a3e635", "#fb7185", "#22d3ee"]
    clusters = [{"id": f"c{ci + 1}", "label": f"Component {ci + 1}", "nodeIds": sorted(c),
                 "color": palette[ci % len(palette)]} for ci, c in enumerate(comps)]
    ui_graph = {"sceneId": sid, "nodes": nodes, "edges": edges, "clusters": clusters}

    # ---------------------------------------------------------------- ConnectivityMetrics
    nn = [graph.neighbours(i)[0][1] for i in graph.node_ids if graph.degree(i) > 0]
    n = graph.n_nodes
    comps_ui = ui_score["components"]
    connectivity = {
        "sceneId": sid,
        "score": round(ui_score["score"], 1), "previousScore": None,
        "pcIndex": summary.pc, "iicIndex": summary.iic,
        "equivalentConnectedArea": round(summary.eca_ha, 1),
        "ecaPctOfHabitat": round(summary.eca_pct_of_habitat, 1),
        "meanPatchIsolationM": round(1000 * sum(nn) / len(nn), 0) if nn else None,
        "linkDensity": round(2 * graph.n_edges / (n * (n - 1)), 4) if n > 1 else 0.0,
        "networkDiameterKm": round(_diameter_km(graph), 2),
        "fragmentationIndex": round(graph.n_components() / n, 4),
        "resilienceIndex": round(comps_ui["redundancy"], 4),
        "confidence": round(mask["totals"]["meanConfidence"], 4),
        "grade": None, "interpretation": None,
        "components": [
            {"label": k.capitalize(), "value": round(100 * v, 1), "weight": ui_score["weights"][k], "delta": None}
            for k, v in comps_ui.items()
        ],
        "composition": [{"name": c["label"], "value": c["areaHa"], "color": c["color"]} for c in classes],
        "health": [], "trend": [],
        "research": {
            "iic": summary.iic, "pc": summary.pc, "ecaHa": summary.eca_ha,
            "nPatches": n, "nEdges": graph.n_edges, "nComponents": graph.n_components(),
            "meanDegree": summary.mean_degree, "tauKm": graph.tau_km, "k": graph.k,
            "spearmanAreaVsCriticality": rho, "labels": summary.metric_labels,
            "interfaceScoreLabel": ui_score["label"],
        },
    }

    # ---------------------------------------------------------------- HeatmapData
    heat = {
        "sceneId": sid, "resolutionM": export_cfg.get("heatmap_cell_m", 300),
        "generatedAt": manifest["timestamp_utc"],
        "cells": _heat_cells(patches, crit, levels, export_cfg.get("heatmap_cell_m", 300)),
        "legend": [
            {"band": b, "label": b.capitalize(), "color": LEVEL_COLOR[b], "range": rng,
             "description": f"S_i {'>=' if b != 'low' else '<'} {thr}"}
            for b, rng, thr in (
                ("critical", [level_thresholds[0], 1.0], level_thresholds[0]),
                ("high", [level_thresholds[1], level_thresholds[0]], level_thresholds[1]),
                ("medium", [level_thresholds[2], level_thresholds[1]], level_thresholds[2]),
                ("low", [0.0, level_thresholds[2]], level_thresholds[2]),
            )
        ],
    }

    # ---------------------------------------------------------------- RestorationData
    cand_by_id = {c.id: c for c in candidates}
    actions = []
    for r in rest_rows:
        c = cand_by_id.get(r.candidate_id)
        actions.append({
            "id": r.candidate_id, "rank": r.rank, "name": r.name or r.candidate_id,
            "patchId": r.linked_patch_ids[0] if r.linked_patch_ids else None,
            "location": r.name or r.candidate_id, "center": r.centroid,
            "polygon": _ring(c.geometry, tuple(r.centroid), simplify_deg) if c else None,
            "interventionType": "habitat restoration (candidate site)",
            "areaHa": round(r.area_ha, 2), "costLakh": r.cost,
            "connectivityGain": round(r.gain_pct, 4),        # % of baseline C(G)
            "connectivityGainAbs": r.connectivity_gain,
            "scoreAfter": None, "confidence": round(c.confidence, 4) if c else None,
            "timeToImpactMonths": None, "carbonSequestrationTonnes": None, "speciesBenefited": None,
            "costEffectiveness": r.gain_per_cost,
            "newLinks": r.new_links, "linkedPatchIds": r.linked_patch_ids,
            "componentsBefore": r.components_before, "componentsAfter": r.components_after,
            "rationale": (f"Adds {r.new_links} link(s) to {', '.join(r.linked_patch_ids) or 'no patch'}; "
                          f"recomputed {manifest['config']['connectivity']['research_metric'].upper()} rises by {r.gain_pct:.2f}%"
                          + (f", components {r.components_before} -> {r.components_after}" if r.components_after != r.components_before else "") + "."),
            "risks": None, "rankingBasis": r.ranking_basis,
        })
    restoration = {
        "sceneId": sid, "currency": rest_rows[0].cost_unit if rest_rows and rest_rows[0].cost_unit else None,
        "baselineScore": round(ui_score["score"], 1), "budgetBands": [], "actions": actions,
        "rankingBasis": rest_rows[0].ranking_basis if rest_rows else "raw_gain",
    }

    return {
        "provenance": {
            "runId": manifest["run_id"], "studyAreaId": sid, "resultKind": manifest["result_kind"],
            "resultLabel": manifest["result_label"], "dataSource": manifest["data_source"],
            "timestamp": manifest["timestamp_utc"], "landscapeAreaHa": landscape_area_ha,
            "parameters": {"k": graph.k, "tauKm": graph.tau_km, "metric": manifest["config"]["connectivity"]["research_metric"],
                           "threshold": manifest["data_source"].get("threshold"), "mmuHa": manifest["data_source"].get("mmu_ha")},
        },
        "habitatMask": mask,
        "graph": ui_graph,
        "connectivity": connectivity,
        "heatmap": heat,
        "restoration": restoration,
        "criticality": [r.to_dict() for r in rows],
        "explanations": {e.patch_id: e.to_dict() for e in explanations},
        "whatIfExample": what_if.to_dict(),
    }
