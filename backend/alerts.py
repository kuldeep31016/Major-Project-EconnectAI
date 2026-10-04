"""Rule-based alert engine over stored run artefacts.  Every alert carries the numbers that triggered it.
Rules are configurable through ``ALERT_RULES`` (thresholds are presentation/operational choices, documented)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Alert, AnalysisVersion, Detection, FieldTask
from .restoration_rules import UNCERTAIN_NOTE, classify

ALERT_RULES = {
    "critical_patch_S": 0.25,          # S_i >= -> critical patch alert (same band as the UI 'critical')
    "low_confidence": 0.60,            # patch mean probability below -> low-confidence alert
    "habitat_loss_pct": 5.0,           # habitat area change between consecutive runs (%) -> habitat change alert
    "connectivity_loss_pct": 10.0,     # IIC change between consecutive runs (%) -> connectivity alert
    "restoration_gain_pct": 1.0,       # candidate gain (% of C(G)) -> restoration opportunity
    "max_per_kind": 3,                 # at most this many restoration / uncertain-area alerts per run
}
RULES_VERSION = 2                      # bump when wording or rules change; ensure_alerts refreshes OPEN alerts of older versions


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
        # keep alerts that a field task points at (FK); they are superseded, not erased
        referenced = select(FieldTask.alert_id).where(FieldTask.alert_id.is_not(None))
        # near-real-time monitoring alerts (backend/satellite/monitor.py) are about other runs: keep them
        stale = db.query(Alert).filter(Alert.study_area_id == study_area_id, Alert.status == "OPEN",
                                       Alert.type.not_in(("new_observation", "satellite_update")))
        stale.filter(Alert.id.in_(referenced)).update({"status": "DISMISSED"}, synchronize_session=False)
        stale.filter(Alert.id.not_in(referenced)).delete(synchronize_session=False)
    n = 0
    metric = run.metric.upper() if run.metric else "IIC"

    for r in crit:
        if r["criticality_score"] >= ALERT_RULES["critical_patch_S"]:
            p = patches[r["patch_id"]]
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="critical_patch",
                         severity=_sev(r["criticality_score"], [(0.4, "critical"), (0.25, "high")]),
                         title=(f"{r['patch_id']} holds the network together: losing it splits the coast and cuts connectivity {r['delta_pct']:.0f} %"
                                if r["is_cut_vertex"] else f"{r['patch_id']} is a key patch: losing it would cut connectivity {r['delta_pct']:.0f} %"),
                         reason=(f"Removing {r['patch_id']} ({r['area_ha']:.1f} ha, {r['area_pct']:.1f} % of habitat) lowers {metric} by "
                                 f"{r['delta_pct']:.1f} % (S = {r['criticality_score']:.3f}); degree {r['degree']}"
                                 + (f"; cut vertex ({r['component_count_before']} → {r['component_count_after']} separate groups)" if r["is_cut_vertex"] else "")
                                 + ". Suggested next step: check the patch for clearing or encroachment and consider it for protection."),
                         lat=p["centroid"][0], lon=p["centroid"][1], object_type="patch", object_id=r["patch_id"],
                         evidence={"criticality": r, "run_id": run.id, "result_label": run.result_label}))
            n += 1
        if r["confidence"] < ALERT_RULES["low_confidence"]:
            p = patches[r["patch_id"]]
            db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="low_confidence", severity="medium",
                         title=f"Map is unsure about {r['patch_id']}: confirm it in the field",
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

    habitat = sum(p["area_ha"] for p in patches.values())
    cands = rest.get("candidates", [])
    k = ALERT_RULES["max_per_kind"]
    uncertain = [c for c in cands if classify(c["area_ha"], habitat) == "uncertain_habitat"][:k]
    sites = [c for c in cands if classify(c["area_ha"], habitat) == "restoration_site" and c["gain_pct"] >= ALERT_RULES["restoration_gain_pct"]][:k]
    for c in uncertain:
        db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="uncertain_habitat", severity="medium",
                     title=f"{c['candidate_id']} ({c['area_ha']:.0f} ha) may be mangrove the map missed: field check",
                     reason=UNCERTAIN_NOTE + " Suggested next step: send a field team before any planting or protection decision.",
                     lat=c["centroid"][0], lon=c["centroid"][1], object_type="candidate", object_id=c["candidate_id"],
                     evidence={"candidate": c, "run_id": run.id, "mapped_habitat_ha": habitat}))
        n += 1
    for c in sites:
        db.add(Alert(study_area_id=study_area_id, run_id=run.id, type="restoration_opportunity", severity="low",
                     title=f"Restoring {c['candidate_id']} ({c['area_ha']:.1f} ha) would raise connectivity {c['gain_pct']:.1f} %",
                     reason=(f"Inserting candidate {c['candidate_id']} ({c['area_ha']:.1f} ha) adds {c['new_links']} link(s) and raises {metric} by {c['gain_pct']:.2f} %"
                             + (" and joins groups that are separate today" if c.get("components_after", 0) < c.get("components_before", 0) else "")
                             + ". Feasibility not assessed; no cost data. Suggested next step: review it in the Restoration Planner."),
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
    for a in db.new:                   # stamp the rules version so later wording/rule changes can refresh OPEN alerts
        if isinstance(a, Alert):
            a.evidence = {**(a.evidence or {}), "rules_version": RULES_VERSION}
    db.commit()
    return n


def ensure_alerts(db: Session) -> int:
    """Startup: every study area's current (LATEST) run gets its rule-based alerts once, so the Alerts module reflects
    the stored analysis without anyone pressing "generate". Alerts already made by the current rules are left untouched;
    OPEN alerts from older rules are regenerated (acknowledged/assigned/resolved ones are always kept)."""
    from .paths import RUNS_DIR
    n = 0
    for ptr in sorted(RUNS_DIR.glob("*/LATEST")) if RUNS_DIR.exists() else []:
        run = db.get(AnalysisVersion, ptr.read_text().strip())
        if not run or run.result_kind == "synthetic":
            continue
        existing = db.query(Alert).filter(Alert.run_id == run.id).all()
        if existing and any((a.evidence or {}).get("rules_version") == RULES_VERSION for a in existing):
            continue
        if existing and not any(a.status == "OPEN" for a in existing):
            continue                   # people already acted on every alert of this run; do not add new ones behind them
        n += generate_alerts(db, ptr.parent.name, run, replace_open=True)
    return n
