"""Automatic near-real-time monitoring: new Sentinel-1 pass -> alert -> analysis -> result alert, without a click.

A check (job type ``satellite_monitor``) searches each study area's catalogue:
  - a pass not seen before raises a ``new_observation`` alert (one per product, never repeated);
  - when this server can run the model, the standard 8-pass same-track analysis is queued (``trigger: monitor``) for
    the areas in ``SATELLITE_MONITOR_AREAS`` (default: areas where the model is not rated unreliable);
  - when such an analysis completes, a ``satellite_update`` alert reports the result and its difference from the
    previous near-real-time analysis of the same area made with the same model and threshold. That difference is a
    model-output difference, never a verified habitat change.

Scheduling: ``SATELLITE_MONITOR_HOURS`` > 0 starts a small scheduler thread in the API process that enqueues a check
when the last one is older than that interval (the job queue makes this safe with several API instances). Cron
alternative: ``python scripts/satellite_monitor.py``.
"""
from __future__ import annotations

import os
import threading
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..db import Alert, Job, SatelliteAnalysis, SessionLocal, User, utcnow
from ..jobs import JobContext, enqueue, handler
from . import catalog, service
from .copernicus import SatelliteError, credentials_configured

ALERT_TYPES = ("new_observation", "satellite_update")      # kept when stored-run alerts are regenerated
ACTIVE = ("QUEUED", "RUNNING", "SCENE_READY", "COMPLETED")


def every_hours() -> float:
    try:
        return max(0.0, float(os.environ.get("SATELLITE_MONITOR_HOURS", "0") or 0))
    except ValueError:
        return 0.0


def auto_analyse() -> bool:
    return os.environ.get("SATELLITE_MONITOR_ANALYSE", "1") != "0"


def monitored_areas() -> list[str]:
    """SATELLITE_MONITOR_AREAS: ``all``, a comma list, or empty = every area whose model reliability is not 'unreliable'."""
    from ecoconnect.pipeline.config import load_study_areas
    areas = list(load_study_areas())
    v = os.environ.get("SATELLITE_MONITOR_AREAS", "").strip()
    if v == "all":
        return areas
    if v:
        return [a for a in (x.strip() for x in v.split(",")) if a in areas]
    return [a for a in areas if ((service.area_reliability(a) or {}).get("level") or "unreliable") != "unreliable"]


def _date(o) -> str:
    return (o.acquisition_start or "")[:16].replace("T", " ") + " UTC"


def check(db, *, analyse: Optional[bool] = None, user: Optional[User] = None) -> dict:
    """One monitoring pass over every study area. Returns a per-area report (also stored as the job result)."""
    from ecoconnect.pipeline.config import load_study_areas
    analyse = auto_analyse() if analyse is None else analyse
    targets = set(monitored_areas())
    report = {"checked_at": utcnow().isoformat(), "provider": catalog.PROVIDER, "analyse": analyse,
              "monitored_areas": sorted(targets), "areas": {}}
    for area in load_study_areas():
        try:
            obs = catalog.search(area)
            service.remember(db, obs)
            ref = catalog.pick_latest(obs)
        except SatelliteError as e:
            report["areas"][area] = {"status": "error", "message": e.user_message}
            continue
        row = {"status": "ok", "latest": ref.acquisition_start, "product": ref.name, "platform": ref.platform}
        known = db.query(Alert).filter(Alert.study_area_id == area, Alert.type == "new_observation",
                                       Alert.object_id == ref.product_id).first()
        analysed = any(a.product_ids and a.product_ids[0] == ref.product_id and a.status in ACTIVE
                       for a in db.query(SatelliteAnalysis).filter(SatelliteAnalysis.study_area_id == area).all())
        row["new_pass"] = not known and not analysed
        if row["new_pass"]:
            rel = service.area_reliability(area) or {}
            db.add(Alert(study_area_id=area, type="new_observation", severity="low",
                         title=f"New Sentinel-1 pass over {area}: {_date(ref)}",
                         reason=(f"{ref.platform or 'Sentinel-1'} {ref.orbit_direction or ''} orbit {ref.relative_orbit}, "
                                 f"{ref.aoi_coverage:.0%} of the study area, from {catalog.SOURCES.get(ref.provider, catalog.SOURCE)}. "
                                 + ("An analysis has been queued automatically." if analyse and area in targets else
                                    "Open the Satellite Monitor to analyse it.")
                                 + (f" Model reliability here: {rel['level']}." if rel.get("level") else "")),
                         object_type="observation", object_id=ref.product_id,
                         evidence={"observation": {"product": ref.name, "acquisition_start": ref.acquisition_start,
                                                   "platform": ref.platform, "relative_orbit": ref.relative_orbit,
                                                   "coverage": ref.aoi_coverage, "source": ref.provider}}))
        if analyse and area in targets and not analysed:
            ms = service.model_status(area)
            if not ms["available"]:
                row["analysis"] = {"skipped": ms["reason"]}
            elif ref.provider != "planetary" and not credentials_configured():
                row["analysis"] = {"skipped": "Copernicus retrieval credentials are not configured."}
            else:
                used = catalog.same_track(obs, ref, 8)
                try:
                    res = service.start_analysis(db, area, used, user, trigger="monitor")
                    row["analysis"] = {"id": res["analysis"].id, "job_id": res["job_id"], "reused": res["reused"],
                                       "composite_scenes": len(used)}
                except SatelliteError as e:
                    row["analysis"] = {"skipped": e.user_message}
        elif analyse and area not in targets:
            row["analysis"] = {"skipped": "not monitored (SATELLITE_MONITOR_AREAS / model unreliable here)"}
        report["areas"][area] = row
    db.commit()
    return report


def result_alert(db, analysis: SatelliteAnalysis, summary: dict) -> None:
    """Alert for a completed monitor-triggered analysis, with the change since the previous comparable analysis."""
    prev = (db.query(SatelliteAnalysis)
            .filter(SatelliteAnalysis.study_area_id == analysis.study_area_id, SatelliteAnalysis.status == "COMPLETED",
                    SatelliteAnalysis.id != analysis.id, SatelliteAnalysis.model_checkpoint == analysis.model_checkpoint,
                    SatelliteAnalysis.threshold == analysis.threshold,
                    SatelliteAnalysis.acquisition_time < analysis.acquisition_time)
            .order_by(SatelliteAnalysis.acquisition_time.desc()).first())
    ha, iic = summary.get("habitatAreaHa"), summary.get("iic")
    s = analysis.summary or {}
    plaus, rel = s.get("plausibility") or {}, s.get("reliability") or {}
    change, ev = "", {"run_id": analysis.run_id, "analysis_id": analysis.id, "habitat_ha": ha, "iic": iic}
    pr = ((prev.summary or {}).get("run") or {}) if prev else {}
    if pr.get("habitatAreaHa") and ha is not None:
        d_ha = 100.0 * (ha - pr["habitatAreaHa"]) / pr["habitatAreaHa"]
        d_iic = 100.0 * (iic - pr["iic"]) / pr["iic"] if pr.get("iic") and iic is not None else None
        ev.update(previous_analysis=prev.id, previous_run=prev.run_id, habitat_change_pct=round(d_ha, 1),
                  iic_change_pct=None if d_iic is None else round(d_iic, 1))
        change = (f" Versus the previous analysis ({prev.acquisition_time:%d %b %Y}): habitat {d_ha:+.1f} %"
                  + (f", connectivity (IIC) {d_iic:+.1f} %" if d_iic is not None else "")
                  + ". This is a model-output difference between two 3-month composites, not a verified habitat change.")
    review = bool(plaus.get("review_recommended")) or rel.get("level") == "unreliable"
    db.add(Alert(study_area_id=analysis.study_area_id, run_id=analysis.run_id, type="satellite_update",
                 severity="medium" if review else "low",
                 title=(f"Satellite analysis ready for {analysis.study_area_id} ({analysis.acquisition_time:%d %b %Y}): "
                        f"{summary.get('nPatches', '?')} patches, {ha or 0:,.0f} ha"),
                 reason=(f"Automatic analysis of the latest {analysis.composite_scenes} Sentinel-1 passes "
                         f"(model {analysis.model_version}, threshold {analysis.threshold})." + change
                         + (f" {plaus['note']}" if plaus.get("note") else "")
                         + (f" Model reliability here: {rel['level']}." if rel.get("level") else "")
                         + (" Review before use." if review else "")),
                 object_type="analysis", object_id=analysis.id, evidence=ev))


@handler("satellite_monitor")
def monitor_job(ctx: JobContext, p: dict) -> dict:
    ctx.progress(0.1, "checking catalogues")
    with SessionLocal() as db:
        user = db.get(User, ctx.user_id) if ctx.user_id else None
        return check(db, analyse=p.get("analyse"), user=user)


def _aware(t: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive UTC datetimes, PostgreSQL aware ones."""
    return t if t is None or t.tzinfo else t.replace(tzinfo=timezone.utc)


def last_check(db) -> Optional[Job]:
    return db.query(Job).filter(Job.type == "satellite_monitor").order_by(Job.created_at.desc()).first()


def status(db) -> dict:
    j = last_check(db)
    h = every_hours()
    return {"enabled": h > 0, "every_hours": h, "analyse": auto_analyse(), "areas": monitored_areas(),
            "last": None if j is None else {"job_id": j.id, "status": j.status, "created_at": j.created_at.isoformat() if j.created_at else None,
                                            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
                                            "result": j.result, "error": j.error},
            "next_due": (_aware(j.created_at) + timedelta(hours=h)).isoformat() if j is not None and j.created_at and h > 0 else None}


# --------------------------------------------------------------------------- scheduler (API process)
_thread: Optional[tuple[threading.Thread, threading.Event]] = None


def enqueue_if_due(db) -> Optional[Job]:
    h = every_hours()
    j = last_check(db)
    if h <= 0 or (j is not None and j.created_at and _aware(j.created_at) > utcnow() - timedelta(hours=h)):
        return None
    return enqueue(db, "satellite_monitor", {})


def _loop(stop: threading.Event, poll_s: float) -> None:
    while not stop.is_set():
        try:
            with SessionLocal() as db:
                enqueue_if_due(db)
        except Exception:                                    # DB hiccup: try again next round
            traceback.print_exc()
        stop.wait(poll_s)


def start_scheduler(poll_s: float = 300.0) -> None:
    global _thread
    if _thread is not None or every_hours() <= 0:
        return
    stop = threading.Event()
    t = threading.Thread(target=_loop, args=(stop, poll_s), name="satellite-monitor", daemon=True)
    t.start()
    _thread = (t, stop)


def stop_scheduler() -> None:
    global _thread
    if _thread is not None:
        _thread[1].set()
        _thread = None
