"""Rule-based alert engine over stored run artefacts.  Every alert carries the numbers that triggered it.
Rules are configurable through ``ALERT_RULES`` (thresholds are presentation/operational choices, documented)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from .db import Alert, AnalysisVersion, Detection, utcnow

ALERT_RULES = {
    "critical_patch_S": 0.25,          # S_i >= -> critical patch alert (same band as the UI 'critical')
    "low_confidence": 0.60,            # patch mean probability below -> low-confidence alert
    "habitat_loss_pct": 5.0,           # habitat area change between consecutive runs (%) -> habitat change alert
    "connectivity_loss_pct": 10.0,     # IIC change between consecutive runs (%) -> connectivity alert
    "restoration_gain_pct": 1.0,       # candidate gain (% of C(G)) -> restoration opportunity
}


def _sev(x: float, levels: list[tuple[float, str]]) -> str:
    for thr, s in levels:
        if x >= thr:
            return s
    return "low"


def generate_alerts(db: Session, study_area_id: str, run: AnalysisVersion, replace_open: bool = True) -> int:
    """(Re)generate alerts for a run. Existing OPEN alerts of the same study area are replaced so the list
    always reflects the latest analysis; acknowledged/assigned/resolved ones are kept."""
    rd = Path(run.path)
    crit = json.loads((rd / "criticality.json").read_text())
    rest = json.loads((rd / "restoration.json").read_text())
    patches = {p["id"]: p for p in json.loads((rd / "patches_input.json").read_text())["patches"]}
    if replace_open:
        db.query(Alert).filter(Alert.study_area_id == study_area_id, Alert.status == "OPEN").delete()
    n = 0
    metric = run.metric.upper() if run.metric else "IIC"

    for r in crit:
        if r["criticality_score"] >= ALERT_RULES["critical_patch_S"]:
            p = patches[r["patch_id"]]
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="critical_patch",
                         severity=_sev(r["criticality_score"], [(0.4, "critical"), (0.25, "high")]),
                         title=f"Critical patch {r['patch_id']}",
                         reason=(f"Removing {r['patch_id']} ({r['area_ha']:.1f} ha, {r['area_pct']:.1f} % of habitat) lowers {metric} by "
                                 f"{r['delta_pct']:.1f} % (S = {r['criticality_score']:.3f}); degree {r['degree']}"
                                 + ("; cut vertex" if r["is_cut_vertex"] else "") + "."),
                         lat=p["centroid"][0], lon=p["centroid"][1], object_type="patch", object_id=r["patch_id"],
                         evidence={"criticality": r, "run_id": run.id, "result_label": run.result_label}))
            n += 1
        if r["confidence"] < ALERT_RULES["low_confidence"]:
            p = patches[r["patch_id"]]
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="low_confidence", severity="medium",
                         title=f"Low model confidence on {r['patch_id']}",
                         reason=f"Mean class probability {r['confidence']:.2f} < {ALERT_RULES['low_confidence']}; field verification recommended before relying on this patch.",
                         lat=p["centroid"][0], lon=p["centroid"][1], object_type="patch", object_id=r["patch_id"],
                         evidence={"confidence": r["confidence"], "run_id": run.id}))
            n += 1

    # change versus the previous run of the same study area (earlier scene year), SAME model and threshold only:
    # comparing different models would report model differences as habitat change
    prev = (db.query(AnalysisVersion)
            .filter(AnalysisVersion.study_area_id == study_area_id, AnalysisVersion.result_kind != "synthetic",
                    AnalysisVersion.model_id == run.model_id, AnalysisVersion.threshold == run.threshold,
                    AnalysisVersion.scene_year != None, AnalysisVersion.scene_year < (run.scene_year or 0))  # noqa: E711
            .order_by(AnalysisVersion.scene_year.desc()).first())
    if prev and prev.habitat_area_ha and prev.iic:
        d_area = 100.0 * (run.habitat_area_ha - prev.habitat_area_ha) / prev.habitat_area_ha
        d_iic = 100.0 * (run.iic - prev.iic) / prev.iic
        if abs(d_area) >= ALERT_RULES["habitat_loss_pct"]:
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="habitat_change",
                         severity=_sev(abs(d_area), [(25, "critical"), (10, "high"), (5, "medium")]),
                         title=f"Habitat area {'decreased' if d_area < 0 else 'increased'} {abs(d_area):.1f} % since {prev.scene_year}",
                         reason=(f"Predicted habitat {prev.habitat_area_ha:.0f} ha ({prev.scene_year}) → {run.habitat_area_ha:.0f} ha ({run.scene_year}). "
                                 f"Model output difference, not a verified observation; cause unknown."),
                         evidence={"previous_run": prev.id, "current_run": run.id, "delta_pct": d_area}))
            n += 1
        if abs(d_iic) >= ALERT_RULES["connectivity_loss_pct"]:
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="connectivity_degradation",
                         severity=_sev(abs(d_iic), [(40, "critical"), (20, "high"), (10, "medium")]),
                         title=f"Connectivity ({metric}) {'fell' if d_iic < 0 else 'rose'} {abs(d_iic):.1f} % since {prev.scene_year}",
                         reason=f"{metric} {prev.iic:.3e} → {run.iic:.3e}; ECA {prev.eca_pct:.1f} % → {run.eca_pct:.1f} % of habitat. Cause not established.",
                         evidence={"previous_run": prev.id, "current_run": run.id, "delta_pct": d_iic}))
            n += 1

    for c in rest.get("candidates", [])[:3]:
        if c["gain_pct"] >= ALERT_RULES["restoration_gain_pct"]:
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="restoration_opportunity", severity="low",
                         title=f"Restoration opportunity {c['candidate_id']} (+{c['gain_pct']:.2f} % {metric})",
                         reason=f"Inserting candidate {c['candidate_id']} ({c['area_ha']:.1f} ha) adds {c['new_links']} link(s) and raises {metric} by {c['gain_pct']:.2f} %. Feasibility not assessed; no cost data.",
                         lat=c["centroid"][0], lon=c["centroid"][1], object_type="candidate", object_id=c["candidate_id"],
                         evidence={"restoration": c, "run_id": run.id}))
            n += 1

    pending = db.query(Detection).filter(Detection.study_area_id == study_area_id, Detection.status.in_(["AI_DETECTED", "UNDER_REVIEW", "FIELD_ASSIGNED"])).count()
    if pending:
        db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="pending_verification", severity="medium",
                     title=f"{pending} detection(s) awaiting field verification",
                     reason="AI detections remain unverified; they must not be treated as confirmed observations.",
                     evidence={"pending": pending}))
        n += 1
    db.commit()
    return n
