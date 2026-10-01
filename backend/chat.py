"""EcoConnectAI Assistant: entry point (``ask``) + structured tools + response cache + tracing.

    question + app context + recent turns
      → classify / rewrite (backend/rag/classify.py, no LLM)
      → structured tools (this module): counts, patch/candidate facts, model, run, alerts, field tasks, verification
        status, reports - read from run files and the database, permission-checked, zero LLM tokens
      → response cache (scope: area, run, objects, role, index/embedding/reranker/prompt/model versions)
      → knowledge path (backend/rag/service.py): hybrid retrieval → rerank → confidence → context → LLM or extractive
      → ChatEvent trace (tier, cache, retrieval, model, tokens, cost, latency) + audit
Design: docs/rag/ARCHITECTURE.md. Nothing here invents a number: every figure is read at answer time.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import Callable, Optional

from sqlalchemy.orm import Session

from ecoconnect.pipeline.config import load_study_areas
from ecoconnect.pipeline.restoration_rules import annotate

from .db import Alert, ChatCache, ChatEvent, FieldTask, Model, Report, User, utcnow
from .llm_provider import llm_enabled
from .observability import log
from .paths import resolve_run
from .rag import service
from .rag.classify import classify
from .rag.config import PROMPT_VERSION, RERANKER_VERSION
from .rag.embeddings import get_embedder
from .rag.generation import get_llm, route
from .rag.retrieval import index_version
from .rag.spell import correct
from .rag.text import tokens

MAX_QUESTION_CHARS = 500
DEFAULT_AREA = "kerala-coast"
DEGRADED = ("I can still answer questions using the application's stored project data, but generative explanation "
            "is temporarily unavailable.")
NOT_FOUND = ("I could not find this in the project data or documentation. I only answer from EcoConnectAI's stored "
             "runs, model records and project documents.")
CAVEAT = "Development result (model output vs Global Mangrove Watch reference labels) - not field-validated."


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name) or os.environ.get(f"ECO_{name}") or default)
    except ValueError:
        return default


@dataclass
class ChatContext:
    study_area: str = DEFAULT_AREA
    run_id: str = "latest"
    selected_patch: Optional[str] = None
    selected_candidate: Optional[str] = None
    module: Optional[str] = None
    session_id: Optional[str] = None
    user: Optional[User] = None

    @property
    def role(self) -> str:
        return self.user.role if self.user else "public"


@dataclass
class Answer:
    text: str
    tier: str                                  # structured | retrieval | llm | refused
    intent: str
    sources: list[dict] = field(default_factory=list)
    action: Optional[dict] = None              # e.g. {"label": "Simulate in Scenario Lab", "href": ...}
    proposed_scenario: Optional[dict] = None
    note: Optional[str] = None                 # degraded mode / caveat line
    retrieved: list[dict] = field(default_factory=list)
    llm_called: bool = False
    llm_reason: Optional[str] = None
    cache_hit: bool = False
    tokens_in: int = 0
    tokens_out: int = 0
    llm_ms: Optional[float] = None
    confidence: Optional[float] = None
    query_type: Optional[str] = None
    trace: dict = field(default_factory=dict)
    cost_usd: float = 0.0
    cache_read: int = 0
    model: Optional[str] = None


# --------------------------------------------------------------------------- run data
class RunData:
    def __init__(self, study_area: str, run_id: str):
        self.study_area = study_area
        try:
            self.dir: Optional[Path] = resolve_run(study_area, run_id or "latest")
        except Exception:                      # noqa: BLE001 - no run is a normal answer ("no analysis run available")
            self.dir = None
        self._cache: dict = {}

    def _j(self, name: str):
        if name not in self._cache:
            p = self.dir / name if self.dir else None
            self._cache[name] = json.loads(p.read_text()) if p and p.exists() else None
        return self._cache[name]

    @property
    def manifest(self) -> dict: return self._j("manifest.json") or {}
    @property
    def metrics(self) -> dict: return (self._j("metrics.json") or {}).get("research_metrics", {})
    @property
    def crit(self) -> list: return self._j("criticality.json") or []

    @property
    def cands(self) -> list:
        if "_cands" not in self._cache:
            self._cache["_cands"] = annotate((self._j("restoration.json") or {}).get("candidates", []), float(self.metrics.get("habitat_area_ha") or 0))
        return self._cache["_cands"]

    @property
    def run_id(self) -> Optional[str]: return self.manifest.get("run_id")
    @property
    def name(self) -> str: return (self.manifest.get("study_area") or {}).get("short_name") or self.study_area

    def src(self, what: str, obj: Optional[str] = None) -> dict:
        return {"label": f"{self.name} run · {what}", "type": "run", "id": self.run_id, "object": obj}


# --------------------------------------------------------------------------- question handling
_AREA_NAMES = [("sundarbans", "sundarbans"), ("gulf of mannar", "gulf-of-mannar"), ("mannar", "gulf-of-mannar"),
               ("bhitarkanika", "odisha-coast"), ("odisha", "odisha-coast"), ("kerala", "kerala-coast"),
               ("vembanad", "kerala-coast")]
_THIS = re.compile(r"\b(this|it|that|selected|current) (patch|candidate|one|site|area)\b|\b(this|it)\b(?=[ ?.!]|$)", re.I)
_WHY = re.compile(r"\b(why|explain|reason|how come|what makes|justify|interpret|mean|meaning|significan)", re.I)


def resolve(question: str, ctx: ChatContext) -> tuple[str, str]:
    """Returns (effective question, study area). 'this' -> the object on screen; a named area overrides the context."""
    q = question.strip()
    ql = q.lower()
    area = next((sid for name, sid in _AREA_NAMES if name in ql), None) or ctx.study_area or DEFAULT_AREA
    if not re.search(r"\b[PC]\d{1,3}\b", q, re.I) and _THIS.search(q):
        obj = ctx.selected_patch or ctx.selected_candidate
        if obj:
            q = f"{q} ({obj})"
    return q, area


_INTERROGATIVE = frozenset({"why", "when", "where", "whom", "whose", "much", "many", "any", "some", "there", "here"})
_SYN = {"important": "critical", "crucial": "critical", "matter": "critical", "matters": "critical", "key": "critical",
        "significant": "critical", "essential": "critical", "make": "why", "makes": "why", "reason": "why",
        "edge": "link", "connection": "link", "lose": "remove", "lost": "remove", "loss": "remove", "removed": "remove",
        "habitat": "", "patch": "", "mangrove": "", "current": "", "project": "", "ecoconnectai": ""}


def canonical(q: str) -> str:
    out = []
    for t in tokens(q):
        t = _SYN.get(t, t)
        if t:
            out.append(t)
    return " ".join(sorted(set(out)))


def _bands(b) -> str:
    """Stored as indices into the stacked tile (0 = S1 VV, 1 = S1 VH, then Sentinel-2 bands)."""
    if isinstance(b, (list, tuple)) and b and all(isinstance(x, int) for x in b):
        s1 = [n for i, n in ((0, "VV"), (1, "VH")) if i in b]
        s2 = [x for x in b if x > 1]
        parts = (["Sentinel-1 " + " + ".join(s1)] if s1 else []) + ([f"{len(s2)} Sentinel-2 band(s)"] if s2 else [])
        return ", ".join(parts) or str(b)
    return str(b)


def _num(x, d=1):
    return f"{x:,.{d}f}"


# --------------------------------------------------------------------------- tier 1: structured intents
def structured(q: str, run: RunData, ctx: ChatContext, db: Session) -> Optional[Answer]:
    ql = q.lower()
    why = bool(_WHY.search(ql))
    ids = [x.upper() for x in re.findall(r"\b([pc]\d{1,3})\b", ql)]

    no_object = not re.search(r"\b[pc]\d{1,3}\b", ql) and not re.search(r"\b(habitat|mangrove|patch|restoration|candidate|mapped)", ql)
    if no_object and (
            re.search(r"\b(how many|which|list|what are|what|number of|name)\b.*\b(study areas?|case stud(y|ies)|study sites?|landscapes)\b", ql)
            or re.search(r"\b(how many|which|list|what are the|name the)\b.*\b(areas|regions|sites|locations)\b", ql)
            or re.search(r"\bstudy areas?\b.*\b(are there|do (we|you) (have|use)|using|used)", ql)):
        areas = load_study_areas()
        lines = [f"{i}. {a.get('name', k)} ({a.get('state', '')})" for i, (k, a) in enumerate(areas.items(), 1)]
        return Answer(f"EcoConnectAI currently uses {len(areas)} study areas (case studies):\n" + "\n".join(lines)
                      + "\nSwitch between them with the study-area selector at the top of the app.",
                      "structured", "study_areas", [{"label": "Study-area configuration", "type": "config", "id": "study_areas"}],
                      action={"label": "Open Command Center", "href": "/command"})

    if re.search(r"\b(who am i|my role|current user|logged in as|signed in as)\b", ql):
        if not ctx.user:
            return Answer("You are not signed in; you are using the public demo (read-only analysis).", "structured", "user")
        return Answer(f"You are signed in as {ctx.user.full_name} ({ctx.user.username}), role {ctx.user.role.replace('_', ' ')}.",
                      "structured", "user", [{"label": "Session", "type": "session", "id": ctx.user.username}])

    if run.dir is None:
        if re.search(r"\b(patch|link|component|habitat|candidate|iic|run|critical)", ql):
            return Answer(f"No analysis run is available for {run.study_area}.", "structured", "no_run")
        return None

    m, rm, crit = run.manifest, run.metrics, run.crit
    rid, ds = run.run_id, m.get("data_source") or {}

    # --- named objects -----------------------------------------------------------------
    pid = next((i for i in ids if i.startswith("P")), None)
    cid = next((i for i in ids if i.startswith("C")), None)
    if pid:
        r = next((x for x in crit if x["patch_id"] == pid), None)
        if r is None:
            return Answer(f"{pid} does not exist in the current {run.name} run ({rid}), which has patches "
                          f"{crit[0]['patch_id']}–{crit[-1]['patch_id'] if crit else '—'}. Patch IDs are assigned by area in each run, "
                          "so the same ID in another run is a different patch.", "structured", "patch_missing", [run.src("criticality")])
        what_if = re.search(r"\b(what (happens|would happen|if)|if .* (remov|lost|lose|destroy|clear))", ql) and re.search(r"remov|lose|lost|destroy|clear|disappear", ql)
        src = [run.src(f"{pid} criticality", pid)]
        if what_if:
            return Answer(f"If **{pid}** were lost, connectivity would fall by **{_num(r['delta_pct'])} %**.\n"
                          f"- Habitat removed: {_num(r['area_ha'], 2)} ha ({_num(r['area_pct'])} % of the mapped forest)\n"
                          + (f"- Network: splits the network from {r['component_count_before']} into {r['component_count_after']} separate groups\n"
                             if r["is_cut_vertex"] else f"- Network: stays at {r['component_count_after']} group(s) - other links route around it\n")
                          + "This is a simulation under the current assumptions (3 nearest neighbours, 5 km), not a forecast.",
                          "structured", "what_if", src,
                          action={"label": "Run it in Scenario Lab", "href": "/scenario?type=remove_patches", "patch": pid})
        if re.search(r"\b(verified|confirmed|validated|ground[- ]?truth(ed)?|field (check|visit|verification|survey))\b", ql):
            from .db import Detection
            dets = db.query(Detection).filter(Detection.run_id == run.run_id, Detection.object_id == pid).all()
            st = sorted({d.status for d in dets})
            return Answer((f"Field verification status for {pid}: {', '.join(st)}. " if st else
                           f"No field verification has been recorded for {pid}. ")
                          + ("Only accepted field evidence makes a result FIELD_VERIFIED/CONFIRMED; " if st else "")
                          + f"its numbers are model output from run {run.run_id} (development result, not field-validated).",
                          "structured", "patch_verification", src, action={"label": "Open Field Work", "href": "/field"})
        if why:
            return None                                                    # explanation -> tier 2
        if re.search(r"\b(area|hectare|ha|size|big|large|small)\b", ql):
            return Answer(f"**{pid}** covers **{_num(r['area_ha'], 2)} ha** - {_num(r['area_pct'])} % of the mapped forest (#{r['rank_by_area']} of {len(crit)} by size).",
                          "structured", "patch_area", src)
        if re.search(r"\b(loss|drop|impact|lower|decrease|reduce|criticality|score)\b", ql):
            return Answer(f"Losing **{pid}** would cut connectivity by **{_num(r['delta_pct'])} %**, making it #{r['rank']} of {len(crit)} by criticality.\n"
                          "This is a simulation under the current assumptions, not a forecast.", "structured", "patch_loss", src)
        if re.search(r"\b(neighbou?rs?|connected to|links?|degree|edges?)\b", ql):
            return Answer(f"{pid} has {r['degree']} link(s): " + ", ".join(f"{n} ({d:.1f} km)" for n, d in zip(r.get("neighbour_ids") or [], r.get("neighbour_distances_km") or []))
                          + ".", "structured", "patch_links", src)
        if re.search(r"\b(cut vertex|bridge|split|separate)", ql):
            return Answer(f"{pid} is {'a cut vertex: removing it splits the network from ' + str(r['component_count_before']) + ' into ' + str(r['component_count_after']) + ' components' if r['is_cut_vertex'] else 'not a cut vertex: the network keeps ' + str(r['component_count_after']) + ' component(s) without it'}.",
                          "structured", "patch_cut", src)
        if re.search(r"\b(confiden|probab|certain|sure)", ql):
            c = r.get("confidence")
            return Answer((f"Mean model probability over {pid} is {c * 100:.0f} %. That is model confidence, not ecological certainty; "
                           "it still requires field verification.") if c is not None else f"No confidence value is stored for {pid}.",
                          "structured", "patch_confidence", src)
        if re.search(r"\b(rank|position)\b", ql):
            return Answer(f"{pid} ranks #{r['rank']} of {len(crit)} by criticality and #{r['rank_by_area']} by area.", "structured", "patch_rank", src)
        if re.search(r"^\s*(what|tell me|show|describe|give).{0,20}\b" + pid.lower() + r"\b\s*\??\s*$|^\s*" + pid.lower() + r"\s*\??$", ql):
            return Answer(f"**{pid}** at a glance:\n- Size: {_num(r['area_ha'], 2)} ha ({_num(r['area_pct'])} % of the forest, #{r['rank_by_area']} by size)\n"
                          f"- Criticality: #{r['rank']} of {len(crit)} - losing it cuts connectivity by {_num(r['delta_pct'])} %\n"
                          + (f"- Role: a bridge - removing it splits the network from {r['component_count_before']} into {r['component_count_after']} groups\n"
                             if r["is_cut_vertex"] else "- Role: other links route around it\n")
                          + "Model result - not yet field-validated.", "structured", "patch_summary", src)
        return None

    if cid:
        c = next((x for x in run.cands if x["candidate_id"] == cid), None)
        if c is None:
            return Answer(f"{cid} is not a restoration candidate in the current {run.name} run ({rid}).", "structured", "candidate_missing", [run.src("restoration")])
        if why:
            return None
        unc = c["category"] == "uncertain_habitat"
        return Answer(f"{cid}: {_num(c['area_ha'])} ha, rank #{c['rank']} by connectivity gain. "
                      + ("Classed as uncertain habitat (larger than 5 ha and 10 % of mapped habitat): likely existing mangrove the model was unsure "
                         "about, so it needs a field check and is not presented as a restoration gain." if unc else
                         f"Restoring it would add {c['new_links']} link(s) to {', '.join(c['linked_patch_ids'])} and raise IIC by {_num(c['gain_pct'], 2)} % (simulation). "
                         "Potential candidate only - requires field and legal assessment; ownership, legal status, water and cost are not assessed."),
                      "structured", "candidate", [run.src(f"{cid} restoration", cid)],
                      action={"label": "Open in Restoration Planner", "href": "/restoration"})

    if why:
        return None
    if re.search(r"\b(paper|methodology|documentation|docs?|document|says?|according to|literature|study says)\b", ql):
        return None                                   # "what does the paper say ..." is a document question, not run data

    # --- run-level counts ----------------------------------------------------------------
    rsrc = [run.src("summary")]
    if re.search(r"\b(how many|number of|count of|total)\b.*\bpatch", ql) or re.fullmatch(r"\s*patch(es)?\s*\??\s*", ql):
        return Answer(f"{run.name} has **{rm['n_patches']} habitat patches**, covering **{_num(rm['habitat_area_ha'])} ha** of mapped mangrove.\n"
                      f"Only patches of at least {ds.get('mmu_ha', '—')} ha are counted.", "structured", "n_patches", rsrc)
    if re.search(r"\b(how many|number of|count of)\b.*\b(links?|edges?|connections?)\b", ql):
        g = m["config"]["graph"]
        return Answer(f"The {run.name} network has **{rm['n_edges']} links**. Each patch is linked to its {g['k_neighbors']} nearest neighbours "
                      f"that are within {g['tau_km']:g} km.", "structured", "n_links", rsrc)
    if re.search(r"\b(how many|number of)\b.*\b(components?|groups?|clusters?)\b", ql):
        return Answer(f"The {run.name} network has **{rm['n_components']} connected components** - separate groups of patches with no link between them.",
                      "structured", "n_components", rsrc)
    if re.search(r"\b(how much|total|mapped)\b.*\b(habitat|mangrove|area|hectares?)\b", ql) and "study area" not in ql:
        return Answer(f"The {run.name} analysis maps **{_num(rm['habitat_area_ha'])} ha** of mangrove in {rm['n_patches']} patches.\n"
                      "This is a model estimate, checked against Global Mangrove Watch, not yet field-validated.",
                      "structured", "habitat_area", rsrc)
    if re.search(r"\b(iic|eca|connectivity)\b.*\b(value|score|level|current|now)\b|\b(value|score) of (iic|eca)", ql):
        return Answer(f"Run {rid}: IIC = {rm['iic']:.3e}; ECA = {_num(rm['eca_ha'], 0)} ha ({_num(rm['eca_pct_of_habitat'])} % of mapped habitat). "
                      "IIC is only comparable between results with the same settings.", "structured", "iic", rsrc)
    if re.search(r"\b(how many|number of)\b.*\b(restoration|candidates?|sites?)\b", ql):
        sites = [c for c in run.cands if c["category"] != "uncertain_habitat"]
        unc = [c for c in run.cands if c["category"] == "uncertain_habitat"]
        return Answer(f"There are **{len(run.cands)} computed candidates** in {run.name}:\n"
                      f"- {len(sites)} potential restoration site(s)\n- {len(unc)} large uncertain area(s) that need a field check first\n"
                      "All of them still need field and legal assessment.",
                      "structured", "n_candidates", [run.src("restoration")])
    if re.search(r"\bwhere\b.*\brestor|\brestor\w*\b.*\b(where|help|best|top|recommend|priorit)|\b(best|top) (restoration|candidates?|sites?)\b", ql):
        sites = [c for c in run.cands if c["category"] != "uncertain_habitat"][:3]
        unc = [c["candidate_id"] for c in run.cands if c["category"] == "uncertain_habitat"]
        if not sites:
            return Answer(f"Run {rid} has no restoration-sized candidate; {', '.join(unc) or 'no'} large uncertain area(s) need a field check first.",
                          "structured", "restoration_where", [run.src("restoration")], action={"label": "Open Restoration Planner", "href": "/restoration"})
        return Answer(f"Restoring **{sites[0]['candidate_id']}** would reconnect the most forest (+{_num(sites[0]['gain_pct'], 2)} % connectivity).\n"
                      "Best restoration candidates:\n"
                      + "\n".join(f"{i}. **{c['candidate_id']}** - {_num(c['area_ha'])} ha · +{_num(c['gain_pct'], 2)} % · links to {', '.join(c['linked_patch_ids'])}"
                                  for i, c in enumerate(sites, 1))
                      + (f"\n{', '.join(unc)} are large uncertain areas - they need a field check, not planting." if unc else "")
                      + "\nThese are suggestions from the model; ownership, legal status, water and cost still need field assessment.",
                      "structured", "restoration_where", [run.src("restoration")], action={"label": "Open Restoration Planner", "href": "/restoration"})
    if re.search(r"\b(most critical|most important|highest criticality|top (\d+|five|three) (critical )?patch|critical patches)\b", ql):
        top = crit[:5]
        small = next((r for r in top if r["rank_by_area"] - r["rank"] >= 3), None)
        return Answer(f"**{top[0]['patch_id']}** is the most critical patch: losing it would cut connectivity by **{_num(top[0]['delta_pct'])} %**.\n"
                      "Top 5 by criticality:\n"
                      + "\n".join(f"{r['rank']}. **{r['patch_id']}** - {_num(r['area_ha'])} ha · −{_num(r['delta_pct'])} % connectivity"
                                  + (" · splits the network" if r["is_cut_vertex"] else "") for r in top)
                      + (f"\n**{small['patch_id']}** is small (#{small['rank_by_area']} by size) but ranks #{small['rank']} because it bridges two groups."
                         if small else ""),
                      "structured", "top_critical", [run.src("criticality")], action={"label": "Open Patch importance", "href": "/analysis"})
    if re.search(r"\b(largest|biggest) patch\b", ql):
        r = min(crit, key=lambda x: x["rank_by_area"])
        return Answer(f"The largest patch is **{r['patch_id']}**: {_num(r['area_ha'])} ha ({_num(r['area_pct'])} % of the mapped forest). "
                      f"It ranks #{r['rank']} by criticality.",
                      "structured", "largest", [run.src("criticality")])
    if re.search(r"\b(cut vertices|which patches (split|hold)|bridges?)\b", ql):
        cuts = [r for r in crit if r["is_cut_vertex"]]
        return Answer((f"**{len(cuts)} patch(es)** hold the network together - removing any one of them splits it:\n"
                       + "\n".join(f"- **{r['patch_id']}** - {_num(r['area_ha'])} ha · −{_num(r['delta_pct'])} % connectivity" for r in cuts)) if cuts
                      else "No single patch splits the network in this run.", "structured", "cut_vertices", [run.src("criticality")])
    if re.search(r"\b(which|what) model\b|\bmodel (are we|is) (using|used)\b|\bmodel used\b|\bcurrent model\b", ql) and not re.search(r"limitation|accura|good|reliab", ql):
        mid = Path(str(ds.get("model", ""))).parent.name or None
        mdl = db.get(Model, mid) if mid else None
        t = ((mdl.metrics or {}).get("test") or {}) if mdl else {}
        return Answer(f"The {run.name} analysis uses **{mid or '—'}**"
                      + (f", a {mdl.architecture} with an {mdl.encoder} encoder" if mdl else "") + ".\n"
                      + (f"- Input: {_bands(mdl.input_bands)}\n" if mdl else "")
                      + f"- Habitat threshold: {ds.get('threshold')}\n"
                      + (f"- Test agreement with Global Mangrove Watch: IoU {t.get('iou', 0):.3f}, F1 {t.get('f1', t.get('dice', 0)):.3f}\n" if t else "")
                      + "It is a development model, not production-ready, and its scores measure agreement with a reference map, not field "
                        "accuracy. The 95.56 % often quoted is the foundation study's result, not ours.",
                      "structured", "model", [{"label": f"Model registry · {mid}", "type": "model", "id": mid}, run.src("manifest")])
    if re.search(r"\b(which|what|current|latest) run\b|\brun id\b", ql):
        return Answer(f"The current {run.name} run is {rid} ({m.get('result_label')}), scene year {ds.get('scene_year')}, threshold {ds.get('threshold')}, "
                      f"created {str(m.get('timestamp_utc', ''))[:10]}.", "structured", "run", rsrc)
    if re.search(r"\b(how many|number of|open)\b.*\balerts?\b", ql):
        al = db.query(Alert).filter(Alert.study_area_id == run.study_area, Alert.status == "OPEN").all()
        return Answer(f"{len(al)} open alert(s) for {run.name}" + (": " + "; ".join(a.title for a in al[:4]) if al else "") + ".",
                      "structured", "alerts", [{"label": "Alerts", "type": "db", "id": "alerts"}], action={"label": "Open Alerts", "href": "/alerts"})
    if re.search(r"\b(how many|number of|pending|open)\b.*\b(field tasks?|verification tasks?|tasks?)\b", ql):
        if not ctx.user:
            return Answer("Field tasks are only visible to signed-in officers.", "structured", "tasks_denied")
        qy = db.query(FieldTask).filter(FieldTask.study_area_id == run.study_area)
        if ctx.user.role == "field_officer":
            qy = qy.filter(FieldTask.assignee_id == ctx.user.id)
        ts = qy.all()
        by = {}
        for t in ts:
            by[t.status] = by.get(t.status, 0) + 1
        return Answer(f"{len(ts)} field task(s) {'assigned to you ' if ctx.user.role == 'field_officer' else ''}in {run.name}"
                      + (": " + ", ".join(f"{v} {k.lower()}" for k, v in by.items()) if by else "") + ".",
                      "structured", "tasks", [{"label": "Field tasks", "type": "db", "id": "field_tasks"}], action={"label": "Open Field Work", "href": "/field"})
    if re.search(r"\b(how many|number of)\b.*\breports?\b", ql):
        if not ctx.user:
            return Answer("Official reports are only visible to signed-in users.", "structured", "reports_denied")
        n = db.query(Report).count()
        return Answer(f"{n} official report(s) have been generated.", "structured", "reports", [{"label": "Reports", "type": "db", "id": "reports"}],
                      action={"label": "Open Reports", "href": "/reports"})
    return None


# --------------------------------------------------------------------------- cache
def _role_scope(ctx: ChatContext) -> str:
    if not ctx.user:
        return "public"
    return {"field_officer": "field", "state_admin": "admin"}.get(ctx.user.role, "staff")


def _scope(ctx: ChatContext, area: str, run: RunData, q_eff: str, version: str, model: str) -> str:
    """Response-cache scope: everything that can change the answer except the wording of the question."""
    objs = sorted(set(re.findall(r"\b[PC]\d{1,3}\b", q_eff.upper())))
    emb = get_embedder()
    parts = [area, run.run_id, objs, _role_scope(ctx), version, emb.model_version() if emb else "none", RERANKER_VERSION, PROMPT_VERSION, model]
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()[:32]


def cache_get(db: Session, scope: str, canon: str) -> Optional[dict]:
    ttl = _env_int("RAG_CACHE_TTL", _env_int("CACHE_TTL", 7 * 24 * 3600))
    since = utcnow() - timedelta(seconds=ttl)
    rows = db.query(ChatCache).filter(ChatCache.scope == scope, ChatCache.created_at >= since).all()
    want = set(canon.split())
    best, score = None, 0.0
    for r in rows:
        have = set(r.canonical.split())
        j = len(want & have) / max(1, len(want | have))
        if j > score:
            best, score = r, j
    if best is not None and score >= 0.75:          # exact (1.0) or near-duplicate wording
        best.hits = (best.hits or 0) + 1
        return {**best.answer, "_similarity": round(score, 2)}
    return None


def cache_put(db: Session, scope: str, canon: str, payload: dict) -> None:
    """Idempotent under concurrency: two identical questions answered at once both try to insert the same key."""
    from sqlalchemy.exc import IntegrityError
    key = hashlib.sha256(f"{scope}|{canon}".encode()).hexdigest()
    if db.query(ChatCache).filter_by(key=key).first() is not None:
        return
    sp = db.begin_nested()
    try:
        db.add(ChatCache(key=key, scope=scope, canonical=canon[:400], answer=payload))
        db.flush()
        sp.commit()
    except IntegrityError:
        sp.rollback()                                   # another request cached the same answer first: fine


def _robustness(run: RunData, pid: str) -> str:
    """How the patch's top-5 status holds across the stored τ sensitivity runs (never overstated)."""
    tau = (run._j("tau_sensitivity.json") or {}).get("results", {})
    if not tau:
        return ""
    ins = [f"{v['tau_km']:g} km" for v in tau.values() if pid in v.get("top5", [])]
    outs = [f"{v['tau_km']:g} km" for v in tau.values() if pid not in v.get("top5", [])]
    if not outs:
        return f"It stays in the top 5 at every tested connection distance ({', '.join(ins)})."
    if not ins:
        return f"It is not in the top 5 at any tested connection distance ({', '.join(outs)}), so its rank depends on the assumptions."
    return f"It is in the top 5 at {', '.join(ins)} but not at {', '.join(outs)}, so its importance depends on the distance assumption."


def _llm_budget(db: Session, ctx: ChatContext) -> Optional[str]:
    """None if an LLM call is allowed, else the reason it is not (also shown in diagnostics)."""
    if not llm_enabled():
        return "LLM disabled by configuration"
    if not get_llm().available():
        return "no LLM provider configured"
    if ctx.user is None:
        return "public demo: generative answers need sign-in"
    day = utcnow() - timedelta(hours=24)
    if ctx.session_id:
        used = db.query(ChatEvent).filter(ChatEvent.session_id == ctx.session_id, ChatEvent.llm_called.is_(True), ChatEvent.ts >= day).count()
        if used >= _env_int("MAX_LLM_CALLS_PER_SESSION", 20):
            return "session LLM limit reached"
    hour = utcnow() - timedelta(hours=1)
    used_h = db.query(ChatEvent).filter(ChatEvent.user_id == ctx.user.id, ChatEvent.llm_called.is_(True), ChatEvent.ts >= hour).count()
    if used_h >= _env_int("ECO_ASSISTANT_PER_HOUR", 30):
        return "hourly LLM limit reached"
    return None


def app_data(run: RunData, q: str) -> str:
    """Authoritative stored facts for the LLM (preferred over documents): run summary + any named patch/candidate."""
    if run.dir is None:
        return ""
    rm, ds = run.metrics, run.manifest.get("data_source") or {}
    lines = [f"current run {run.run_id} ({run.name}): {rm.get('n_patches')} patches, {rm.get('habitat_area_ha', 0):.1f} ha, "
             f"{rm.get('n_edges')} links, {rm.get('n_components')} components, model {Path(str(ds.get('model', ''))).parent.name}, "
             f"threshold {ds.get('threshold')}, scene year {ds.get('scene_year')}; development result, not field-validated"]
    ids = set(re.findall(r"\b([PC]\d{1,3})\b", q.upper()))
    for r in run.crit:
        if r["patch_id"] in ids:
            lines.append(f"{r['patch_id']}: {r['area_ha']:.2f} ha ({r['area_pct']:.1f} % of habitat), criticality rank #{r['rank']} of {len(run.crit)}, "
                         f"IIC loss if removed {r['delta_pct']:.1f} %, degree {r['degree']}, cut vertex {r['is_cut_vertex']}, "
                         f"components {r['component_count_before']}->{r['component_count_after']}")
    for c in run.cands:
        if c["candidate_id"] in ids:
            lines.append(f"{c['candidate_id']}: {c['area_ha']:.1f} ha, {c['category_label']}, simulated IIC gain {c['gain_pct']:.2f} %")
    return "\n".join(lines)


def _suggest(ans: Answer, ctx: ChatContext) -> list[str]:
    """Concrete next questions when the assistant cannot answer (or is greeting) - always answerable ones."""
    obj = ctx.selected_patch or "P07"
    return ["Which patch is most critical?", f"Why is {obj} important?", "Where could restoration help?", "How many study areas are there?"]


REFUSE_UNSAFE = ("I can't help with that. I answer questions about EcoConnectAI's data and documentation, and I never "
                 "reveal configuration, credentials or internal instructions.")
CASUAL = ("Hi! I'm the EcoConnectAI Assistant. I can tell you which mangrove patches matter most, what would happen if one were lost, "
          "where restoration could help, and how the analysis works. What would you like to know?")
CLARIFY = ("Which one do you mean? Select a patch or restoration candidate on the map, or name it - for example "
           "\"Why is P07 important?\".")


# --------------------------------------------------------------------------- entry point
def ask(db: Session, question: str, ctx: ChatContext, *, debug: bool = False, audit: Optional[Callable[..., None]] = None,
        history: Optional[list[dict]] = None, on_delta: Optional[Callable[[str], None]] = None) -> dict:
    t0 = time.perf_counter()
    request_id = os.urandom(8).hex()
    q_raw = (question or "").strip()[:MAX_QUESTION_CHARS]
    q_fixed, _typos = correct(q_raw)                    # "case stuey" -> "case study"; identifiers untouched
    q, area = resolve(q_fixed, ctx)
    plan = classify(q, history, ctx.selected_patch or ctx.selected_candidate)
    if plan.rewritten:                                  # follow-up: the rewritten question decides area and objects
        q, area = resolve(plan.rewritten, ChatContext(**{**ctx.__dict__, "study_area": area}))
    run = RunData(area, ctx.run_id if area == ctx.study_area else "latest")
    sim, err = None, None
    try:
        if not q:
            ans = Answer("Please type a question.", "refused", "empty")
        elif plan.qtype == "unsafe":
            ans = Answer(REFUSE_UNSAFE, "refused", "unsafe")
        elif plan.qtype == "casual":
            ans = Answer(CASUAL, "conversation", "casual")
        elif plan.qtype == "ambiguous":
            ans = Answer(CLARIFY, "conversation", "clarify")
        else:
            ans = structured(q, run, ctx, db)
            if ans is None:
                model = route(plan.qtype)
                scope, canon = _scope(ctx, area, run, q, index_version(db), model), canonical(q)
                cached = cache_get(db, scope, canon)
                if cached:
                    sim = cached.pop("_similarity", None)
                    ans = Answer(**{k: v for k, v in cached.items() if k in Answer.__dataclass_fields__})
                    ans.cache_hit, ans.llm_called, ans.tokens_in, ans.tokens_out, ans.llm_ms, ans.cost_usd = True, False, 0, 0, None, 0.0
                else:
                    plan.rewritten = q if q != plan.original else plan.rewritten
                    k = service.answer(db, plan, scope=_role_scope(ctx), study_area=area,
                                       selected=ctx.selected_patch or ctx.selected_candidate, app_data=app_data(run, q),
                                       llm_block=_llm_budget(db, ctx), robustness=lambda pid: _robustness(run, pid), caveat=CAVEAT,
                                       on_delta=on_delta)
                    g = k.gen
                    ans = Answer(k.text, k.tier, plan.qtype, k.citations, note=k.note, retrieved=k.trace.get("retrieved", []),
                                 llm_called=g is not None, llm_reason=k.trace.get("llm_block") or k.trace.get("llm_error"),
                                 tokens_in=g.input_tokens if g else 0, tokens_out=g.output_tokens if g else 0,
                                 llm_ms=g.latency_ms if g else None, confidence=k.confidence, query_type=plan.qtype, trace=k.trace,
                                 cost_usd=g.cost_usd if g else 0.0, cache_read=g.cache_read if g else 0, model=g.model if g else None)
                    if ans.tier in ("llm", "retrieval") and not ans.note:
                        cache_put(db, scope, canon, {"text": ans.text, "tier": ans.tier, "intent": ans.intent, "sources": ans.sources,
                                                     "note": ans.note, "action": ans.action, "confidence": ans.confidence})
            elif ans.confidence is None:
                ans.confidence = 1.0                    # read directly from stored data
    except Exception as e:  # noqa: BLE001 - never 500 the chat; the reason goes to logs/diagnostics, not the user
        err = f"{type(e).__name__}: {e}"[:200]
        ans = Answer("Something went wrong while answering. The analysis data is unchanged; please try again.", "refused", "error")
    ans.query_type = ans.query_type or plan.qtype
    ms = (time.perf_counter() - t0) * 1000
    tr = ans.trace
    ev = ChatEvent(session_id=(ctx.session_id or "")[:64] or None, user_id=ctx.user.id if ctx.user else None, role=ctx.role,
                   study_area_id=area, run_id=run.run_id, question=q_raw[:200], tier=ans.tier, intent=ans.intent,
                   cache_hit=ans.cache_hit, llm_called=ans.llm_called, llm_reason=(ans.llm_reason or "")[:120] or None,
                   retrieval_count=len(ans.retrieved), tokens_in_est=ans.tokens_in, tokens_out_est=ans.tokens_out,
                   latency_ms=round(ms, 1), llm_latency_ms=round(ans.llm_ms, 1) if ans.llm_ms else None, error=err,
                   request_id=request_id, query_type=ans.query_type, rewritten_query=(plan.rewritten or "")[:300] or None,
                   retrieval_method=tr.get("retrieval_method"), candidate_count=tr.get("candidate_count"), reranker=tr.get("reranker"),
                   selected_chunks=tr.get("selected_chunks"), retrieval_ms=tr.get("retrieval_ms"), rerank_ms=tr.get("rerank_ms"),
                   model=ans.model, embedding_model=(get_embedder().model_version() if get_embedder() else None),
                   index_version=tr.get("index_version"), citation_count=len(ans.sources), confidence=ans.confidence,
                   abstain_reason=tr.get("abstain_reason"), cache_read_tokens=ans.cache_read, cost_usd=ans.cost_usd)
    db.add(ev)
    if audit:
        audit(q_raw, ans)
    db.commit()
    log.info("assistant", extra={"route": "chat", "ms": round(ms, 1), "job_id": request_id})
    out = {"answer": ans.text, "tier": ans.tier, "intent": ans.intent, "sources": ans.sources, "action": ans.action,
           "proposed_scenario": ans.proposed_scenario, "note": ans.note, "cache_hit": ans.cache_hit, "llm_called": ans.llm_called,
           "study_area": area, "run_id": run.run_id, "resolved_question": q if q != q_raw else None, "confidence": ans.confidence,
           "query_type": ans.query_type, "request_id": request_id, "event_id": ev.id,
           "suggestions": _suggest(ans, ctx) if ans.tier in ("refused", "conversation") else []}
    if debug:
        out["debug"] = {"latency_ms": round(ms, 1), "llm_reason": ans.llm_reason, "llm_ms": ans.llm_ms, "retrieved": ans.retrieved,
                        "cache_similarity": sim, "tokens_in_est": ans.tokens_in, "tokens_out_est": ans.tokens_out, "cost_usd": ans.cost_usd,
                        "model": ans.model, "query": {"original": plan.original, "normalized": plan.normalized, "rewritten": plan.rewritten,
                                                     "type": plan.qtype, "memory": plan.memory},
                        "trace": {k: v for k, v in tr.items() if k != "retrieved"}, "provider": get_llm().name, "error": err}
    return out
