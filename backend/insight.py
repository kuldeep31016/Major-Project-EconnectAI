"""Evidence chains, the retrieval-based decision assistant, and the official report.

The assistant answers only from stored artefacts and database records: each intent maps to a query and a
template that quotes the retrieved numbers.  There is no free-text generation, so it cannot fabricate.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from .db import Alert, AnalysisVersion, Detection, Evidence, FieldTask, Model, Project, Scene, User


# --------------------------------------------------------------------------- evidence chain
def evidence_chain(db: Session, run_dir: Path, object_type: str, object_id: str) -> dict:
    m = json.loads((run_dir / "manifest.json"). read_text())
    met = json.loads((run_dir / "metrics.json").read_text())
    ds = m["data_source"]
    run = db.get(AnalysisVersion, m["run_id"])
    scene = db.get(Scene, run.scene_id) if run and run.scene_id else None
    model = db.get(Model, run.model_id) if run and run.model_id else None
    chain: dict = {
        "decision": None,
        "data_source": {"type": ds.get("type"), "scene": scene.to_dict() | {"manifest": None} if scene else {"path": ds.get("path"), "note": "scene not registered"},
                        "scene_year": ds.get("scene_year")},
        "model": (model.to_dict() if model else {"id": run.model_id if run else None, "note": "no trained model (synthetic geometry)"}),
        "parameters": {"threshold": ds.get("threshold"), "mmu_ha": ds.get("mmu_ha"), **m["config"]["graph"], "metric": met["criticality_metric"]},
        "analysis": {"run_id": m["run_id"], "timestamp": m["timestamp_utc"], "result_label": m["result_label"],
                     "research_metrics": met["research_metrics"], "spearman_area_vs_criticality": met["spearman_area_vs_criticality"]},
        "field_verification": [],
    }
    if object_type == "patch":
        crit = {r["patch_id"]: r for r in json.loads((run_dir / "criticality.json").read_text())}
        expl = {e["patch_id"]: e for e in json.loads((run_dir / "explanations.json").read_text())}
        patches = {p["id"]: p for p in json.loads((run_dir / "patches_input.json").read_text())["patches"]}
        r, p = crit.get(object_id), patches.get(object_id)
        if not r:
            raise KeyError(object_id)
        graph = json.loads((run_dir / "graph.json").read_text())
        nbrs = [e for e in graph["edges"] if object_id in (e["source"], e["target"])]
        chain["decision"] = {"object": object_id, "priority": expl[object_id]["level"], "rank": r["rank"], "of": len(crit),
                             "explanation": expl[object_id]["text"]}
        chain["patch"] = {"area_ha": p["area_ha"], "centroid": p["centroid"], "confidence": p["confidence"], "quality": p["quality"],
                          "pixel_count": (p.get("extra") or {}).get("pixel_count"), "perimeter_km": p.get("perimeter_km"), "geometry": p.get("geometry")}
        chain["graph_neighbourhood"] = {"degree": r["degree"], "neighbours": [{"id": e["target"] if e["source"] == object_id else e["source"], "distance_km": e["distance_km"], "weight": e["weight"]} for e in nbrs],
                                        "is_cut_vertex": r["is_cut_vertex"], "components_before": r["component_count_before"], "components_after": r["component_count_after"]}
        chain["criticality_calculation"] = {"C_G": r["c_before"], "C_G_minus_v": r["c_after"], "delta_C": r["delta_connectivity"], "S_i": r["criticality_score"],
                                            "delta_pct": r["delta_pct"], "rank_by_area": r["rank_by_area"], "formula": "S_i = (C(G) - C(G - v_i)) / C(G), exact leave-one-out"}
    elif object_type == "candidate":
        rest = json.loads((run_dir / "restoration.json").read_text())
        c = next((x for x in rest["candidates"] if x["candidate_id"] == object_id), None)
        if not c:
            raise KeyError(object_id)
        chain["decision"] = {"object": object_id, "rank": c["rank"], "basis": rest["ranking_basis"], "explanation": rest["cost_note"]}
        chain["restoration_calculation"] = {"C_G": c["c_before"], "C_G_plus_v": c["c_after"], "R_i": c["connectivity_gain"], "gain_pct": c["gain_pct"],
                                            "new_links": c["new_links"], "linked": c["linked_patch_ids"], "formula": "R_i = C(G + v_i) - C(G)"}
    dets = db.query(Detection).filter_by(run_id=m["run_id"], object_type=object_type, object_id=object_id).all()
    for d in dets:
        tasks = db.query(FieldTask).filter_by(detection_id=d.id).all()
        chain["field_verification"].append({"detection": d.to_dict(), "tasks": [
            t.to_dict() | {"evidence": [e.to_dict() for e in db.query(Evidence).filter_by(task_id=t.id).all()]} for t in tasks]})
    chain["verification_status"] = dets[0].status if dets else "AI_DETECTED (not yet reviewed)"
    return chain


# --------------------------------------------------------------------------- assistant
INTENTS = [
    ("critical", r"(most )?critical|priority patch|which patch(es)? (matter|are important)|top patch"),
    ("why", r"why (is|does) (patch )?(?P<pid>[A-Za-z0-9_-]+)"),
    ("whatif", r"(what (happens|if)|remove|lose|los(s|e) of).*?(?P<pid>P\d+|[a-z-]+-p\d+)"),
    ("change", r"chang|since|previous|last observation|trend|timeline"),
    ("restore", r"restor|candidate|cluster|gain"),
    ("alerts", r"alert|verif|pending|field"),
    ("model", r"model|accura|confiden|iou|dice|how good"),
    ("summary", r"summar|overview|status|state of|how (is|connected)"),
]


def answer(db: Session, question: str, study_area: str, run_dir: Optional[Path]) -> dict:
    q = question.strip()
    ql = q.lower()
    intent, pid = "summary", None
    for name, pat in INTENTS:
        mm = re.search(pat, ql)
        if mm:
            intent = name
            pid = (mm.groupdict().get("pid") or "").upper() if mm.groupdict().get("pid") else None
            break
    if run_dir is None:
        return {"intent": intent, "answer": f"There is no analysis run for {study_area} yet, so I cannot report any numbers. Run the pipeline first.", "sources": [], "label": None}
    m = json.loads((run_dir / "manifest.json").read_text())
    met = json.loads((run_dir / "metrics.json").read_text())
    rm = met["research_metrics"]
    label = m["result_label"]
    crit = json.loads((run_dir / "criticality.json").read_text())
    src = [{"type": "run", "id": m["run_id"], "file": "criticality.json / metrics.json"}]
    metric = met["criticality_metric"].upper()
    link = f"/analysis?scene={study_area}"

    if intent == "critical":
        top = crit[:5]
        txt = f"Most critical patches in {study_area} (run {m['run_id']}, exact leave-one-out on {metric}): " + "; ".join(
            f"#{r['rank']} {r['patch_id']} ({r['area_ha']:.1f} ha, S = {r['criticality_score']:.3f}, −{r['delta_pct']:.1f} %{', cut vertex' if r['is_cut_vertex'] else ''})" for r in top) + "."
        return {"intent": intent, "answer": txt, "sources": src, "label": label, "links": [link], "objects": [r["patch_id"] for r in top]}
    if intent in ("why", "whatif"):
        pid_norm = pid or ""
        r = next((x for x in crit if x["patch_id"].upper() == pid_norm or x["patch_id"].upper().endswith(pid_norm)), None)
        if not r:
            return {"intent": intent, "answer": f"I could not find patch '{pid}' in run {m['run_id']}. Known patches: {', '.join(x['patch_id'] for x in crit[:12])}…", "sources": src, "label": label}
        expl = {e["patch_id"]: e for e in json.loads((run_dir / "explanations.json").read_text())}[r["patch_id"]]
        txt = expl["text"] if intent == "why" else (f"If {r['patch_id']} is removed (exact recomputation): {metric} falls from {r['c_before']:.3e} to {r['c_after']:.3e} (−{r['delta_pct']:.1f} %), "
                                                    f"{r['degree']} link(s) are severed and the network goes from {r['component_count_before']} to {r['component_count_after']} component(s).")
        return {"intent": intent, "answer": txt, "sources": src + [{"type": "run", "id": m["run_id"], "file": "explanations.json"}], "label": label, "links": [link, f"/scenario"], "objects": [r["patch_id"]]}
    if intent == "change":
        runs = db.query(AnalysisVersion).filter(AnalysisVersion.study_area_id == study_area, AnalysisVersion.result_kind != "synthetic", AnalysisVersion.scene_year != None).order_by(AnalysisVersion.scene_year).all()  # noqa: E711
        if len(runs) < 2:
            return {"intent": intent, "answer": "Only one observation date has been analysed for this landscape; no change can be reported yet.", "sources": src, "label": label}
        a, b = runs[-2], runs[-1]
        txt = (f"Between {a.scene_year} and {b.scene_year} (both model outputs, cause not attributed): predicted habitat {a.habitat_area_ha:.0f} → {b.habitat_area_ha:.0f} ha, "
               f"{metric} {a.iic:.3e} → {b.iic:.3e} ({100*(b.iic-a.iic)/a.iic:+.1f} %), patches {a.n_patches} → {b.n_patches}, components {a.n_components} → {b.n_components}. "
               "Use Scenario Lab → Compare periods for patch-level detail.")
        return {"intent": intent, "answer": txt, "sources": [{"type": "run", "id": a.id}, {"type": "run", "id": b.id}], "label": b.result_label, "links": ["/scenario"]}
    if intent == "restore":
        rest = json.loads((run_dir / "restoration.json").read_text())
        cs = rest["candidates"][:5]
        joins = [c for c in cs if c["components_after"] < c["components_before"]]
        txt = ("Restoration candidates ranked by connectivity gain (no cost data): " + "; ".join(f"{c['candidate_id']} (+{c['gain_pct']:.2f} % {metric}, {c['new_links']} links → {', '.join(c['linked_patch_ids'])})" for c in cs) + ". "
               + (f"Candidates that join separate components: {', '.join(c['candidate_id'] for c in joins)}." if joins else "None of the top candidates joins two separate components at the current τ.")
               + " Feasibility (water, legal status, cost) is assessed separately in the Restoration Planner.")
        return {"intent": intent, "answer": txt, "sources": src + [{"type": "run", "id": m["run_id"], "file": "restoration.json"}], "label": label, "links": ["/restoration"], "objects": [c["candidate_id"] for c in cs]}
    if intent == "alerts":
        al = db.query(Alert).filter(Alert.study_area_id == study_area, Alert.status.in_(["OPEN", "ACKNOWLEDGED", "ASSIGNED"])).all()
        pend = db.query(Detection).filter(Detection.study_area_id == study_area, Detection.status.in_(["AI_DETECTED", "UNDER_REVIEW", "FIELD_ASSIGNED"])).all()
        tasks = db.query(FieldTask).filter(FieldTask.study_area_id == study_area, FieldTask.status.in_(["PENDING", "IN_PROGRESS", "SUBMITTED"])).all()
        txt = (f"{len(al)} open alert(s): " + ("; ".join(f"[{a.severity}] {a.title}" for a in al[:6]) or "none") + f". {len(pend)} detection(s) await field verification; "
               f"{len(tasks)} field task(s) are pending/in progress/submitted. AI detections are not confirmed until field evidence is accepted.")
        return {"intent": intent, "answer": txt, "sources": [{"type": "db", "table": "alerts/detections/field_tasks"}], "label": None, "links": ["/alerts", "/field"]}
    if intent == "model":
        mid = (m["data_source"].get("model_info") or {}).get("checkpoint")
        mdl = db.get(Model, Path(mid).parent.name) if mid else None
        if not mdl:
            return {"intent": intent, "answer": "This run uses synthetic geometry — no model, so no accuracy exists. The foundation study's 95.56 % OA is their result, not ours.", "sources": src, "label": label}
        t = (mdl.metrics or {}).get("test") or {}
        txt = (f"Model {mdl.id}: {mdl.architecture} with {mdl.encoder} encoder, input bands {mdl.input_bands}, mode {mdl.mode} ({mdl.result_label}). "
               f"Held-out test agreement with the Global Mangrove Watch weak label: IoU {t.get('iou', float('nan')):.3f}, Dice {t.get('dice', float('nan')):.3f}, precision {t.get('precision', float('nan')):.3f}, recall {t.get('recall', float('nan')):.3f}. "
               "This is agreement with a reference map, not field-truth accuracy. Patch confidence values are mean class probabilities.")
        return {"intent": intent, "answer": txt, "sources": [{"type": "model", "id": mdl.id}], "label": mdl.result_label, "links": ["/experiments"]}
    txt = (f"{study_area}, run {m['run_id']} ({label}): {rm['n_patches']} patches over {rm['habitat_area_ha']:.0f} ha form {rm['n_components']} component(s) with {rm['n_edges']} links; "
           f"IIC {rm['iic']:.3e}, PC {rm['pc']:.3e}, ECA {rm['eca_ha']:.0f} ha ({rm['eca_pct_of_habitat']:.1f} % of habitat). Most critical patch: {crit[0]['patch_id']} (S = {crit[0]['criticality_score']:.3f}). "
           "Ask: which patches are most critical · why is P01 important · what changed · restoration candidates · what if P01 is removed · which alerts need verification · model accuracy.")
    return {"intent": "summary", "answer": txt, "sources": src, "label": label, "links": [link]}


# --------------------------------------------------------------------------- official report
def official_report(db: Session, run_dir: Path, study_area: dict, project: Optional[Project], user: Optional[User]) -> dict:
    from ecoconnect.pipeline.report import build_report
    rep = build_report(run_dir, study_area)
    m = json.loads((run_dir / "manifest.json").read_text())
    rid = m["run_id"]
    dets = db.query(Detection).filter_by(run_id=rid).all()
    tasks = db.query(FieldTask).filter(FieldTask.run_id == rid).all() if dets or True else []
    ev_rows = []
    for t in tasks:
        for e in db.query(Evidence).filter_by(task_id=t.id).all():
            u = db.get(User, e.user_id)
            ev_rows.append([t.title, e.observed_at, f"{e.lat:.5f}, {e.lon:.5f}", e.observation, e.verification, u.full_name if u else "—"])
    verification = {"id": "verification", "heading": "8. Field verification",
                    "body": [f"{len(dets)} AI detection(s) from this run entered the verification workflow; statuses: " + (", ".join(f"{d.object_id}: {d.status}" for d in dets) or "none") + ". "
                             "Only detections with accepted field evidence are FIELD_VERIFIED/CONFIRMED; all others remain model output."],
                    "table": {"columns": ["Task", "Observed", "GPS", "Observation", "Verification", "Officer"], "rows": ev_rows} if ev_rows else None}
    proj_sec = None
    if project:
        owner = db.get(User, project.owner_id)
        proj_sec = {"id": "project", "heading": "0. Project", "body": [
            f"{project.name} — status {project.status}; objectives: {project.objectives or '—'}; priority patches: {', '.join(project.priority_patches) or '—'}; "
            f"candidates: {', '.join(project.candidates) or '—'}; owner: {owner.full_name if owner else '—'}; created {project.created_at:%Y-%m-%d}."]}
    sections = ([proj_sec] if proj_sec else []) + rep["sections"] + [verification]
    rep.update({"sections": sections, "author": f"Generated by EcoConnectAI for {user.full_name} ({user.role})" if user else rep["author"],
                "title": (f"{project.name} — official report ({rid})" if project else rep["title"]),
                "status": "draft" if m["result_kind"] in ("development", "synthetic") else "final"})
    rep["provenance"]["note"] = "Development-model runs produce DRAFT reports only; a final report requires an experimental (full) model run."
    return rep
