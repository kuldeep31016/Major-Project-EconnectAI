"""Decision-support report composed ONLY from a run's computed artefacts (paper Section IV-F, 'decision output').

Every sentence below quotes a number that exists in the run directory; nothing is estimated or narrated
beyond the evidence.  The output matches the prototype's ``ScientificReport`` TypeScript shape so the
existing Reports page renders it unchanged.
"""
from __future__ import annotations

import json
from pathlib import Path


def _fmt(v, nd=3):
    return f"{v:.{nd}f}" if isinstance(v, (int, float)) else str(v)


def build_report(run_dir: Path, study_area: dict) -> dict:
    m = json.loads((run_dir / "manifest.json").read_text())
    met = json.loads((run_dir / "metrics.json").read_text())
    crit = json.loads((run_dir / "criticality.json").read_text())
    rest = json.loads((run_dir / "restoration.json").read_text())
    tau = json.loads((run_dir / "tau_sensitivity.json").read_text())
    expl = {e["patch_id"]: e for e in json.loads((run_dir / "explanations.json").read_text())}
    wi = json.loads((run_dir / "what_if_top1.json").read_text())
    rm = met["research_metrics"]
    ds = m["data_source"]
    g = m["config"]["graph"]
    metric = met["criticality_metric"].upper()
    label = m["result_label"]
    top = crit[0]
    n = len(crit)

    # -- data provenance sentence
    if ds.get("type") == "probability_raster":
        er = ds.get("extraction_report", {})
        data_txt = (f"The habitat map is the output of segmentation model '{Path(str(ds.get('model'))).parent.name or ds.get('model')}' "
                    f"applied to the scene '{Path(ds['path']).stem}' (CRS {ds.get('crs')}, {ds.get('width')}×{ds.get('height')} px). "
                    f"Pixels with class probability ≥ {ds.get('threshold')} were grouped into 8-connected components; "
                    f"components below the {ds.get('mmu_ha')} ha minimum mapping unit were dropped "
                    f"({er.get('n_patches_kept')} of {er.get('n_components_total')} components kept, "
                    f"habitat coverage {er.get('habitat_coverage_pct', 0):.2f} % of {er.get('landscape_area_ha', 0):.0f} ha of valid pixels).")
    else:
        data_txt = ("The patch geometry is the prototype's synthetic dataset (deterministic generator); only the site "
                    "metadata is real. The analysis below is exact over that geometry but measures no real ecosystem.")

    crit_rows = [[r["rank"], r["patch_id"], round(r["area_ha"], 1), round(r["area_pct"], 1), r["degree"],
                  f"{r['delta_connectivity']:.3e}", round(r["criticality_score"], 3), r["component_count_after"],
                  r["rank_by_area"], "yes" if r["is_cut_vertex"] else "no"] for r in crit[:10]]
    rest_rows = [[c["rank"], c["candidate_id"], round(c["area_ha"], 1), round(c["gain_pct"], 3), c["new_links"],
                  c["cost"] if c["cost"] is not None else "—", round(c["gain_per_cost"], 4) if c["gain_per_cost"] is not None else "—"]
                 for c in rest["candidates"][:10]]
    tau_rows = [[k.replace("tau_", "").replace("km", " km"), v["edges"], v["components"], round(v["spearman_vs_reference"], 3),
                 ", ".join(v["top5"][:3])] for k, v in tau["results"].items()]
    rho = met["spearman_area_vs_criticality"]
    most_crit_not_largest = top["rank_by_area"] != 1

    sections = [
        {"id": "data", "heading": "1. Data and habitat map",
         "body": [data_txt,
                  f"Result label: {label}. Run {m['run_id']} computed {m['timestamp_utc'][:19]} UTC on {m['hardware']['platform']}."]},
        {"id": "graph", "heading": "2. Connectivity graph and baseline connectivity",
         "body": [f"Patches were linked to their k = {g['k_neighbors']} nearest neighbours within τ = {g['tau_km']} km "
                  f"(edge weight w_ij = √(q_i q_j)·exp(−d_ij/τ)). The graph has {rm['n_patches']} nodes, {rm['n_edges']} links and "
                  f"{rm['n_components']} connected component{'s' if rm['n_components'] != 1 else ''}; mean degree {rm['mean_degree']:.2f}.",
                  f"Research metrics over a landscape extent A_L = {rm['landscape_area_ha']:.0f} ha with {rm['habitat_area_ha']:.1f} ha of habitat: "
                  f"IIC = {rm['iic']:.4e}, PC = {rm['pc']:.4e}, ECA = {rm['eca_ha']:.0f} ha ({rm['eca_pct_of_habitat']:.1f} % of habitat area). "
                  f"The interface score (Eq. 7, a design heuristic, not a research metric) is {met['interface_score']['score']:.1f}/100.",
                  "IIC and PC scale with A_L and must not be compared between study areas of different extent; ECA as a share of habitat is comparable."]},
        {"id": "criticality", "heading": f"3. Patch criticality (exact leave-one-out, C(G) = {metric})",
         "body": [f"For each of the {n} patches the graph was rebuilt without it and {metric} recomputed. "
                  f"The most critical patch is {top['patch_id']}: {top['area_ha']:.1f} ha ({top['area_pct']:.1f} % of habitat, rank {top['rank_by_area']} of {n} by area), "
                  f"degree {top['degree']}; its removal lowers {metric} by {top['delta_pct']:.1f} % (S = {top['criticality_score']:.3f}) and changes the component count from "
                  f"{top['component_count_before']} to {top['component_count_after']}{' — it is a cut vertex' if top['is_cut_vertex'] else ''}.",
                  (f"The most critical patch is not the largest (area rank {top['rank_by_area']}); " if most_crit_not_largest else "Here the most critical patch is also the largest; ")
                  + f"Spearman rank correlation between area and criticality is ρ = {rho:.3f}. "
                  + f"{sum(1 for r in crit if r['is_cut_vertex'])} of {n} patches are cut vertices."],
         "table": {"columns": ["Rank", "Patch", "Area (ha)", "Area %", "Degree", f"Δ{metric}", "S_i", "Comp. after", "Area rank", "Cut vertex"],
                   "rows": crit_rows}},
        {"id": "whatif", "heading": "4. What-if: loss of the most critical patch",
         "body": [f"Removing {', '.join(wi['removed_patch_ids'])} ({wi['habitat_area_removed_ha']:.1f} ha, {wi['habitat_area_removed_pct']:.1f} % of habitat) "
                  f"lowers {metric} from {wi['c_before']:.4e} to {wi['c_after']:.4e} (−{wi['loss_pct']:.1f} %), severs {len(wi['severed_edges'])} links, "
                  f"leaves {len(wi['newly_isolated_patch_ids'])} patch{'es' if len(wi['newly_isolated_patch_ids']) != 1 else ''} newly isolated and "
                  f"changes the component count from {wi['components_before']} to {wi['components_after']}.",
                  f"Explanation generated from the graph evidence: {expl[top['patch_id']]['text']}"]},
        {"id": "tau", "heading": "5. Sensitivity to the dispersal threshold τ",
         "body": [f"The ranking was recomputed at τ ∈ {{{', '.join(k.replace('tau_', '').replace('km', '') for k in tau['results'])}}} km. "
                  f"Spearman correlation of each ranking with the reference (τ = {tau['reference_tau_km']} km) is reported below; "
                  "τ is species-relevant and was not calibrated to a species — rankings should be read across these scenarios, not from τ = 5 km alone."],
         "table": {"columns": ["τ", "Links", "Components", "ρ vs reference", "Top-3 patches"], "rows": tau_rows}},
        {"id": "restoration", "heading": "6. Restoration prioritisation",
         "body": [f"{len(rest['candidates'])} candidate sites ({rest.get('candidate_source')}) were each inserted into the graph and {metric} recomputed (R_i = C(G+v_i) − C(G)). "
                  + (f"Ranking basis: {rest['ranking_basis']}. " ) + rest["cost_note"] + "."],
         "table": {"columns": ["Rank", "Candidate", "Area (ha)", "R_i (% of C(G))", "New links", "Cost", "Gain per cost"], "rows": rest_rows}},
        {"id": "limits", "heading": "7. Provenance and limitations",
         "bullets": [f"Result label: {label}.",
                     "Segmentation labels are Global Mangrove Watch (an existing map): metrics against them measure agreement with that map, not field-truth accuracy." if ds.get("type") == "probability_raster" else "Patch geometry is synthetic.",
                     "The class-probability threshold and 2 ha minimum mapping unit are design parameters; the threshold was selected by a sweep against GMW where a calibration file exists.",
                     "The interface score (Eq. 7) is a heuristic for the dashboard and is not monotone under patch removal; decisions should rest on IIC/PC/ECA.",
                     "No restoration costs are assumed; cost-aware ranking (Eq. 12) applies only when the user supplies a cost table."],
         "body": []},
    ]
    return {
        "id": f"report-{m['run_id']}",
        "title": f"Connectivity assessment — {study_area.get('name', m['study_area_id'])} ({m['run_id']})",
        "sceneId": m["study_area_id"],
        "region": study_area.get("name", ""),
        "author": "EcoConnectAI pipeline (automated)",
        "organisation": "Generated from outputs/runs — no manual edits",
        "generatedAt": m["timestamp_utc"],
        "status": "draft" if m["result_kind"] in ("development", "synthetic") else "final",
        "doi": "n/a",
        "version": m.get("ecoconnect_version", "0.1.0"),
        "pages": len(sections),
        "keywords": ["habitat connectivity", metric, "criticality", "what-if", "restoration", m["result_kind"]],
        "abstract": (f"{label}. {rm['n_patches']} habitat patches over {rm['habitat_area_ha']:.0f} ha form {rm['n_components']} component(s) with "
                     f"ECA = {rm['eca_pct_of_habitat']:.1f} % of habitat area. The most critical patch ({top['patch_id']}, {top['area_pct']:.1f} % of habitat, "
                     f"area rank {top['rank_by_area']}) accounts for {top['delta_pct']:.1f} % of {metric}. ρ(area, criticality) = {rho:.2f}."),
        "sections": sections,
        "provenance": {"runId": m["run_id"], "resultKind": m["result_kind"], "resultLabel": label},
    }
