"""Evidence-grounded assistant (Phase 6).

question -> intent + object ids -> evidence pack (stored run artefacts, model record, provenance caveats, field
verification, alerts) -> Claude with a JSON-schema answer format -> validation -> cited answer.

Guarantees enforced in code, not by prompt alone:
  * the model only sees evidence retrieved here, each item with an id (E1, E2, ...);
  * citations that are not in the evidence pack are dropped; an answer with no valid citation is replaced by the
    "not enough evidence" reply;
  * a proposed scenario is a structured command, validated against the run's real patch / candidate ids and
    parameter bounds, and is only EXECUTED by the user's explicit confirmation (the LLM never writes anything).
Without Anthropic credentials (or when ECO_ASSISTANT_LLM=0) the template assistant in insight.py answers instead.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from .db import Alert, AnalysisVersion, Detection, FieldTask, Model, ModelDisagreement
from .insight import answer as template_answer

MODEL = os.environ.get("ECO_ASSISTANT_MODEL", "claude-opus-5")
NO_EVIDENCE = "I don't have enough evidence in the current dataset to answer that."
SCENARIO_TYPES = ("none", "remove_patches", "restore", "reduce_area", "radius", "sensitivity")

SYSTEM = """You are EcoConnectAI Assistant, for coastal mangrove habitat connectivity decision support.
You answer only from the evidence items supplied in the user message: stored application data (ids E1, E2, ...)
and retrieved project documentation or research-paper excerpts (ids D1, D2, ..., kind "doc"). Doc items may be used
to explain concepts and methods; run-data items are the only source for numbers about a run. Every factual
statement must be supported by at least one cited evidence id. Never invent numbers, patches, dates, costs,
field results or validation. Quote numbers exactly as they appear in the evidence.
Honesty rules: segmentation metrics are agreement with Global Mangrove Watch reference labels, not field truth;
what-if and restoration results are simulations, not predictions; nothing on this platform is field-validated
unless an evidence item says a field task was VERIFIED. State these caveats when relevant.
If the evidence does not answer the question, set insufficient_evidence to true and say so briefly.
If the user asks to simulate something (remove/lose a patch, restore a candidate, shrink a patch, change the
connection radius tau, test sensitivity), fill proposed_scenario with the matching command using ids that appear
in the evidence; otherwise set proposed_scenario.type to "none". You only propose - the user decides whether to run it.
Never call Global Mangrove Watch labels ground truth; never claim the development model is production-ready; never
present the foundation study's 95.56 % as EcoConnectAI's result; never present model-output change as confirmed
ecological change; never call restoration candidates approved sites; never make conservation decisions - provide
evidence that helps human decision-makers. The platform models structural habitat connectivity, not animal movement.
Keep answers short: 2-6 sentences, plain language for a conservation officer; add technical detail only when asked."""

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "cited_evidence_ids": {"type": "array", "items": {"type": "string"}},
        "insufficient_evidence": {"type": "boolean"},
        "proposed_scenario": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": list(SCENARIO_TYPES)},
                "patch_ids": {"type": "array", "items": {"type": "string"}},
                "candidate_ids": {"type": "array", "items": {"type": "string"}},
                "retain_fraction": {"type": "number"},
                "tau_km": {"type": "number"},
                "rationale": {"type": "string"},
            },
            "required": ["type", "patch_ids", "candidate_ids", "retain_fraction", "tau_km", "rationale"],
            "additionalProperties": False,
        },
    },
    "required": ["answer", "cited_evidence_ids", "insufficient_evidence", "proposed_scenario"],
    "additionalProperties": False,
}


# --------------------------------------------------------------------------- retrieval
def _j(p: Path):
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def build_evidence(db: Session, question: str, study_area: str, run_dir: Path) -> tuple[list[dict], dict]:
    """Collect the evidence items relevant to the question. Returns (items, index of valid ids for validation)."""
    items: list[dict] = []

    def add(kind: str, source: str, data: dict) -> str:
        eid = f"E{len(items) + 1}"
        items.append({"id": eid, "kind": kind, "source": source, "data": data})
        return eid

    m = _j(run_dir / "manifest.json") or {}
    met = (_j(run_dir / "metrics.json") or {}).get("research_metrics", {})
    crit = _j(run_dir / "criticality.json") or []
    rest = (_j(run_dir / "restoration.json") or {}).get("candidates", [])
    from .restoration_rules import annotate
    annotate(rest, float(met.get("habitat_area_ha") or 0))
    expl = {e["patch_id"]: e for e in (_j(run_dir / "explanations.json") or [])}
    run_id = m.get("run_id", run_dir.name)
    ds = m.get("data_source") or {}

    add("run", f"run {run_id} / manifest.json + metrics.json", {
        "study_area": study_area, "run_id": run_id, "result_label": m.get("result_label"), "scene_year": ds.get("scene_year"),
        "threshold": ds.get("threshold"), "graph": (m.get("config") or {}).get("graph"),
        **{k: met.get(k) for k in ("n_patches", "n_edges", "n_components", "habitat_area_ha", "iic", "pc", "eca_ha", "eca_pct_of_habitat")}})
    ranked = [{k: r[k] for k in ("patch_id", "rank", "area_ha", "degree", "criticality_score", "delta_pct", "is_cut_vertex",
                                  "component_count_before", "component_count_after", "rank_by_area")} for r in crit[:8]]
    add("criticality_top", f"run {run_id} / criticality.json (exact leave-one-out)", {"top_patches": ranked, "n_patches": len(crit)})
    add("cut_vertices", f"run {run_id} / criticality.json", {"cut_vertices": [r["patch_id"] for r in crit if r["is_cut_vertex"]]})

    ids = {r["patch_id"] for r in crit}
    cids = {c["candidate_id"] for c in rest}
    mentioned = [x for x in dict.fromkeys(re.findall(r"\b([PC]\d{1,3})\b", question.upper())) if x in ids | cids]
    for pid in mentioned:
        if pid in ids:
            r = next(x for x in crit if x["patch_id"] == pid)
            add("patch", f"run {run_id} / criticality.json + explanations.json ({pid})",
                {**{k: r[k] for k in ("patch_id", "rank", "area_ha", "area_pct", "degree", "criticality_score", "delta_pct",
                                      "is_cut_vertex", "component_count_before", "component_count_after", "rank_by_area",
                                      "neighbour_ids", "neighbour_distances_km")},
                 "explanation": (expl.get(pid) or {}).get("text")})
        else:
            c = next(x for x in rest if x["candidate_id"] == pid)
            add("restoration_candidate", f"run {run_id} / restoration.json ({pid})",
                {k: c.get(k) for k in ("candidate_id", "rank", "area_ha", "gain_pct", "new_links", "linked_patch_ids", "cost")})
    if rest:
        add("restoration_top", f"run {run_id} / restoration.json (simulated gain, no cost data unless stated)",
            {"candidates": [{k: c.get(k) for k in ("candidate_id", "rank", "area_ha", "gain_pct", "new_links", "category_label")} for c in rest[:5]],
             "note": "'Uncertain habitat - field check' candidates are large marginal-probability areas, likely existing mangrove; do not present their gain as a restoration benefit."})

    run = db.get(AnalysisVersion, run_id)
    model = db.get(Model, run.model_id) if run and run.model_id else None
    if model:
        t = (model.metrics or {}).get("test") or {}
        add("model", f"model registry / {model.id}", {
            "id": model.id, "name": model.display_name, "status": model.status, "encoder": model.encoder,
            "input_bands": model.input_bands, "split_tiles": [model.n_train, model.n_val, model.n_test],
            "test_vs_reference_labels": {k: t.get(k) for k in ("iou", "f1", "precision", "recall")},
            "limitations": (model.card or {}).get("known_limitations")})
    for pid in mentioned:
        dets = db.query(Detection).filter_by(run_id=run_id, object_id=pid).all()
        tasks = [t for d in dets for t in db.query(FieldTask).filter_by(detection_id=d.id).all()]
        tasks += db.query(FieldTask).filter_by(run_id=run_id, object_id=pid).all()
        add("field_verification", f"field tasks for {pid}", {"object": pid, "tasks": sorted({(t.id, t.status) for t in tasks}) or "none",
                                                             "detection_status": [d.status for d in dets] or "not reviewed"})
    alerts = db.query(Alert).filter_by(study_area_id=study_area).all()
    add("alerts", "alerts table (rule engine over this landscape's runs)",
        {"open": sum(a.status == "OPEN" for a in alerts), "total": len(alerts),
         "open_titles": [a.title for a in alerts if a.status == "OPEN"][:6]})
    dis = db.query(ModelDisagreement).filter_by(study_area_id=study_area).all()
    add("hitl", "model_disagreements table", {"recorded": len(dis), "included_for_future_training": sum(d.status == "INCLUDED" for d in dis)})
    add("limitations", "platform limitations (docs/context PROJECT_CONTEXT §2)", {"notes": [
        "Segmentation metrics are agreement with Global Mangrove Watch weak labels, not field ground truth.",
        "What-if and restoration outputs are simulations, not forecasts.",
        "No result has been field-validated unless a field task is VERIFIED.",
        "Structural connectivity from patch geometry is not observed animal movement.",
        "No restoration cost, ownership or legal data are loaded unless stated."]})
    return items, {"patch_ids": ids, "candidate_ids": cids, "run_id": run_id, "evidence_ids": {i["id"] for i in items}}


# --------------------------------------------------------------------------- validation
def validate_scenario(s: Optional[dict], index: dict) -> tuple[Optional[dict], Optional[str]]:
    """Turn the LLM's proposal into a safe Scenario Lab request, or explain why it was rejected."""
    if not s or s.get("type") in (None, "none"):
        return None, None
    t = s["type"]
    if t not in SCENARIO_TYPES:
        return None, f"unknown scenario type {t!r}"
    if t in ("remove_patches", "reduce_area"):
        ids = [p for p in dict.fromkeys(s.get("patch_ids") or []) if p in index["patch_ids"]]
        if not ids:
            return None, "no valid patch ids in the proposal"
        if t == "reduce_area":
            f = float(s.get("retain_fraction") or 0)
            if not 0.05 <= f <= 0.95:
                return None, "retain_fraction must be between 0.05 and 0.95"
            return {"type": t, "patch_ids": ids, "retain_fraction": round(f, 2)}, None
        return {"type": t, "patch_ids": ids}, None
    if t == "restore":
        ids = [c for c in dict.fromkeys(s.get("candidate_ids") or []) if c in index["candidate_ids"]]
        return ({"type": "restore_multi" if len(ids) > 1 else "restore", "candidate_ids": ids}, None) if ids else (None, "no valid candidate ids")
    if t == "radius":
        tau = float(s.get("tau_km") or 0)
        return ({"type": "radius", "tau_km": tau}, None) if 0.5 <= tau <= 50 else (None, "tau_km must be between 0.5 and 50")
    return {"type": "sensitivity"}, None


def finalise(raw: dict, items: list[dict], index: dict) -> dict:
    by_id = {i["id"]: i for i in items}
    cited = [c for c in dict.fromkeys(raw.get("cited_evidence_ids") or []) if c in index["evidence_ids"]]
    insufficient = bool(raw.get("insufficient_evidence")) or not cited
    scenario, why_not = validate_scenario(raw.get("proposed_scenario"), index)
    return {"mode": "llm", "model": MODEL, "answer": NO_EVIDENCE if insufficient and not cited else raw.get("answer", "").strip(),
            "insufficient_evidence": insufficient,
            "citations": [{"id": c, "kind": by_id[c]["kind"], "source": by_id[c]["source"]} for c in cited],
            "proposed_scenario": scenario, "scenario_rejected": why_not,
            "label": "AI-GENERATED FROM STORED EVIDENCE - check the cited sources"}


# --------------------------------------------------------------------------- LLM call
def llm_available() -> bool:
    if os.environ.get("ECO_ASSISTANT_LLM", "1") == "0":
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_PROFILE"))


def _client():
    import anthropic
    return anthropic.Anthropic(timeout=60.0, max_retries=2)


def ask_llm(question: str, items: list[dict], client=None, max_tokens: int = 4000) -> dict:
    """One Claude call with a JSON-schema answer. Raises on API errors; caller falls back to templates."""
    client = client or _client()
    user = ("Evidence items (JSON):\n" + json.dumps(items, default=str, ensure_ascii=False)
            + f"\n\nQuestion: {question}")
    resp = client.beta.messages.create(
        model=MODEL, max_tokens=max_tokens,
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",   # re-run a declined request server-side
        thinking={"type": "adaptive"}, output_config={"effort": "low", "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
        system=SYSTEM, messages=[{"role": "user", "content": user}],
    )
    if resp.stop_reason == "refusal":
        return {"answer": NO_EVIDENCE, "cited_evidence_ids": [], "insufficient_evidence": True,
                "proposed_scenario": {"type": "none"}}
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    return json.loads(text)


def grounded_answer(db: Session, question: str, study_area: str, run_dir: Optional[Path], *, use_llm: bool, client=None) -> dict:
    if run_dir is None or not use_llm:
        out = template_answer(db, question, study_area, run_dir)
        return {**out, "mode": "template"}
    items, index = build_evidence(db, question, study_area, run_dir)
    try:
        raw = ask_llm(question, items, client)
    except Exception as e:                           # API/network/parse failure -> honest template answer
        out = template_answer(db, question, study_area, run_dir)
        return {**out, "mode": "template", "llm_error": type(e).__name__}
    return finalise(raw, items, index) | {"evidence": items}
