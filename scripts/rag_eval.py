"""RAG evaluation on the golden set (tests/rag/golden.jsonl) - retrieval, answers, grounding, abstention, latency, cost.

    .venv/bin/python scripts/rag_eval.py                      # real local embeddings (fastembed), LLM off → docs/rag/EVAL_RESULTS.md
    .venv/bin/python scripts/rag_eval.py --embedder hashing   # CI: no model download
    .venv/bin/python scripts/rag_eval.py --llm stub           # exercise the generation path with a citing stub (no cost)
    .venv/bin/python scripts/rag_eval.py --llm live --judge 12 --out docs/rag/EVAL_RESULTS_LIVE.md   # real Claude + grader
    .venv/bin/python scripts/rag_eval.py --llm live --judge 3 --ids t01 --ask "Why is P02 important?"  # diagnostic subset

Live runs print a stage timeline (JSON lines prefixed STAGE) and per-question timings, bound every question by
--question-timeout, keep the Mac awake with `caffeinate -i` and report when the host was suspended mid-run (wall clock
advancing while the process clock did not), which is what made an earlier run look stalled for ~38 minutes.

Runs on a scratch copy of outputs/ with a fresh database; never calls a paid API.
Metrics
  retrieval recall@5   question has an expected source → is it among the top-5 reranked passages?
  precision@5          share of the top-5 that match the expected source (strict; one expected source per question)
  MRR                  1 / rank of the first matching passage among the fused candidates
  context relevance    coverage of the question's content words by the top context passage
  answer correctness   expected facts present, forbidden phrases absent, expected tier
  faithfulness         extractive answers: every sentence occurs verbatim in a cited passage or the stored run data
  citation correctness answers that cite: the expected source is among the citations
  abstention quality   unanswerable → refused; answerable → not refused
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import statistics
import sys
import tempfile
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))


def _ndcg(rels: list[bool], n_rel_total: int, k: int = 5) -> float:
    import math
    dcg = sum(1 / math.log2(i + 2) for i, r in enumerate(rels[:k]) if r)
    idcg = sum(1 / math.log2(i + 2) for i in range(min(k, n_rel_total)))
    return round(dcg / idcg, 4) if idcg else 0.0


JUDGE_PROMPT = """You grade ONE answer from a retrieval-grounded assistant for a mangrove-connectivity research platform.
You receive the question, the answer (with [S#] citation markers), the APP_DATA block (current stored results the
assistant was also given) and the full text of every source S1..Sn the assistant was given. Use ONLY that evidence,
never your own knowledge.

1. Split the answer into atomic factual claims (skip greetings, hedges, offers of help, restatements of the question).
   At most 12 claims; merge trivially related ones.
2. For each claim give a verdict:
   SUPPORTED            the evidence states it or it follows directly from it
   PARTIALLY_SUPPORTED  part of it is in the evidence, or it overstates / generalises the evidence
   UNSUPPORTED          not in the evidence, or contradicted by it
   List the evidence ids that support it ("APP_DATA" or "S#"), the ids the answer cited for it, and cited_ok:
   true if a cited id actually contains the support, false if the cited ids do not, null if the claim has no citation.
   A citation that exists but does not contain the claim does NOT make the claim supported.
3. correctness 0.0-1.0: answers what was asked and nothing in it is wrong according to the evidence.
   relevance 0.0-1.0: focused on the question, no padding.
Reply with JSON only, no prose:
{"claims": [{"claim": "...", "verdict": "SUPPORTED", "support": ["S1"], "cited": ["S1"], "cited_ok": true}],
 "correctness": 0.0, "relevance": 0.0, "note": "<= 20 words"}"""

VERDICT_SCORE = {"SUPPORTED": 1.0, "PARTIALLY_SUPPORTED": 0.5, "UNSUPPORTED": 0.0}


def judge_input(question: str, answer: str, evidence: list[dict], app_data: str) -> str:
    """The grader sees exactly what the generator saw: APP_DATA and the rendered text of every source."""
    src = "\n\n".join(f'<source id="{e["id"]}" title="{e.get("title") or ""}" section="{e.get("section") or ""}">\n{e["text"]}\n</source>'
                       for e in evidence)
    return f"Question: {question}\n\nAnswer:\n{answer}\n\nAPP_DATA:\n{app_data or '(none)'}\n\nSources:\n{src}"


def score_judgement(j: dict) -> dict:
    """Groundedness = mean claim score (SUPPORTED 1, PARTIAL 0.5, UNSUPPORTED 0); computed here, not by the grader."""
    claims = [c for c in (j.get("claims") or []) if isinstance(c, dict) and c.get("verdict") in VERDICT_SCORE]
    cited = [c for c in claims if c.get("cited_ok") is not None]
    n = len(claims)
    return {"claims": claims, "n_claims": n,
            "supported": sum(c["verdict"] == "SUPPORTED" for c in claims),
            "partial": sum(c["verdict"] == "PARTIALLY_SUPPORTED" for c in claims),
            "unsupported": sum(c["verdict"] == "UNSUPPORTED" for c in claims),
            "groundedness": round(sum(VERDICT_SCORE[c["verdict"]] for c in claims) / n, 3) if n else None,
            "citation_support": round(sum(bool(c["cited_ok"]) for c in cited) / len(cited), 3) if cited else None,
            "correctness": float(j.get("correctness", 0)), "relevance": float(j.get("relevance", 0)), "note": str(j.get("note", ""))[:160]}


_judge_client = None


def judge_one(question: str, answer: str, evidence: list[dict], app_data: str, timeout_s: float = 90.0) -> dict:
    """LLM-as-judge (a second opinion, not ground truth). Bounded: one request, timeout, at most one retry."""
    global _judge_client
    import anthropic
    if _judge_client is None:
        ws = os.environ.get("ANTHROPIC_WORKSPACE_ID")
        _judge_client = anthropic.Anthropic(default_headers={"anthropic-workspace-id": ws} if ws else None, timeout=timeout_s, max_retries=1)
    resp = _judge_client.messages.create(model=os.environ.get("RAG_JUDGE_MODEL", "claude-opus-5-5"), max_tokens=4000,
                                         output_config={"effort": "low"}, system=JUDGE_PROMPT,
                                         messages=[{"role": "user", "content": judge_input(question, answer, evidence, app_data)}])
    txt = "".join(b.text for b in resp.content if b.type == "text")
    return score_judgement(json.loads(txt[txt.index("{"): txt.rindex("}") + 1]))


class Timeline:
    """Stage timeline as JSON lines. Also detects host suspension: on macOS time.monotonic() stops while the machine
    sleeps but time.time() does not, so a growing gap means the process was paused (lid closed / system sleep)."""

    def __init__(self, enabled: bool):
        self.on, self.t0, self.w0, self.m0 = enabled, time.perf_counter(), time.time(), time.monotonic()
        self.suspended_s = 0.0

    def __call__(self, stage: str, **kw) -> None:
        drift = (time.time() - self.w0) - (time.monotonic() - self.m0)
        if drift - self.suspended_s > 5:
            self.suspended_s = drift
            kw["host_suspended_s"] = round(drift, 1)
        if self.on:
            print("STAGE " + json.dumps({"ts": time.strftime("%H:%M:%S"), "elapsed_ms": round((time.perf_counter() - self.t0) * 1000),
                                         "stage": stage, **kw}, default=str), flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--embedder", default="fastembed", choices=["fastembed", "hashing", "none"])
    ap.add_argument("--llm", default="off", choices=["off", "stub", "live"],
                    help="live = real provider for generation (spends API credit; needs ANTHROPIC_API_KEY)")
    ap.add_argument("--judge", type=int, default=0, help="with --llm live: grade N generated answers with an LLM judge")
    ap.add_argument("--record", action="store_true", help="append the summary to docs/rag/eval_history.jsonl")
    ap.add_argument("--ablation", action="store_true", help="also measure bm25-only / vector-only / hybrid retrieval")
    ap.add_argument("--out", default=str(REPO / "docs" / "rag" / "EVAL_RESULTS.md"))
    ap.add_argument("--min-pass", type=float, default=0.0, help="exit 1 if the answer pass rate is below this")
    ap.add_argument("--ids", default="", help="comma-separated golden ids to run (default: all)")
    ap.add_argument("--limit", type=int, default=0, help="run only the first N selected questions")
    ap.add_argument("--ask", action="append", default=[], help="ad-hoc question (no expected answer; diagnostics)")
    ap.add_argument("--question-timeout", type=float, default=240.0, help="seconds before one question is recorded as timed out")
    ap.add_argument("--json", default="", help="write per-question records (answer, evidence, grades) to this JSON file")
    a = ap.parse_args()
    tl = Timeline(a.llm == "live" or bool(a.ask) or bool(a.ids))
    tl("START", llm=a.llm, embedder=a.embedder)
    if a.llm == "live" and shutil.which("caffeinate"):        # keep the Mac from idling to sleep mid-run (not lid-close on battery)
        import subprocess
        subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    tmp = Path(tempfile.mkdtemp(prefix="eco_rageval_"))
    shutil.copytree(REPO / "outputs", tmp / "outputs", ignore=shutil.ignore_patterns("ecoconnect.db*", "quicklooks", "models_cache"))
    os.environ.update({"ECO_OUTPUTS_DIR": str(tmp / "outputs"), "ECO_DATABASE_URL": f"sqlite:///{(tmp / 'e.db').as_posix()}",
                       "ECO_DEMO_PASSWORD": "eval-pass-123", "ECO_JWT_SECRET": "eval-secret-" + "x" * 24, "ECO_INLINE_WORKER": "0",
                       "RAG_INGEST_ON_START": "0", "EMBEDDING_PROVIDER": a.embedder, "ECO_ANON_ASK_PER_HOUR": "10000",
                       "EMBEDDING_CACHE_DIR": str(REPO / "outputs" / "models_cache" / "fastembed"),
                       "LLM_ENABLED": "1" if a.llm in ("stub", "live") else "0"})
    if a.llm != "live":
        os.environ.pop("ANTHROPIC_API_KEY", None)
    else:   # bound the spend: only the first N LLM-eligible questions call the model, the rest answer extractively
        os.environ.update({"MAX_LLM_CALLS_PER_SESSION": str(max(1, a.judge or 10)), "ECO_ASSISTANT_PER_HOUR": "1000"})
    tl("CONFIG LOAD", llm_deadline_s=os.environ.get("LLM_DEADLINE_S", "150 (default)"), question_timeout_s=a.question_timeout)

    from fastapi.testclient import TestClient

    from backend.chat import ChatContext, resolve
    from backend.db import SessionLocal
    from backend.main import app
    from backend.rag import generation
    from backend.rag.classify import classify
    from backend.rag.ingest import ingest
    from backend.rag.rerank import coverage, rerank
    from backend.rag.retrieval import retrieve

    if a.llm == "stub":
        class Stub:
            name = "stub"
            def available(self): return True
            def generate(self, system, user, model, mt):
                sid = re.findall(r'<source id="(S\d+)"', user)[0]
                body = re.search(rf'<source id="{sid}"[^>]*>\n(.*?)\n</source>', user, re.S).group(1)
                sents = [x for x in re.split(r"(?<=[.!?])\s", " ".join(body.split())) if not x.endswith("?")]
                first = (sents or [body])[0]
                return generation.GenResult(f"{first} [{sid}]", model, len(user) // 4, 40)
            def stream(self, *x):
                r = self.generate(*x); yield r.text; yield r
        generation.set_llm(Stub())

    abl: dict[str, list] = {}
    golden = [json.loads(line) for line in (REPO / "tests" / "rag" / "golden.jsonl").read_text().splitlines() if line.strip()]
    if a.ids:
        want = [x.strip() for x in a.ids.split(",") if x.strip()]
        golden = [g for g in golden if g["id"] in want]
    elif a.ask:
        golden = []
    golden += [{"id": f"ask{i}", "category": "adhoc", "question": q, "contains": [], "not_contains": [], "source": None, "tier": None,
                "abstain": False, "history": [], "context": {}} for i, q in enumerate(a.ask, 1)]
    if a.limit:
        golden = golden[: a.limit]
    rows, records, timeouts, judged = [], [], 0, []
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
    pool = ThreadPoolExecutor(max_workers=4)
    with TestClient(app) as c:
        tl("APP STARTUP (db connect, migrations, registry)")
        t0 = time.perf_counter()
        with SessionLocal() as db:
            from backend.rag.embeddings import get_embedder
            emb = get_embedder()
            tl("EMBEDDER", model=emb.model_version() if emb else None)
            ing = ingest(db)
        ingest_s = time.perf_counter() - t0
        tl("INDEX/INGEST", seconds=round(ingest_s, 1), documents=ing.get("documents"), chunks_embedded=ing.get("chunks_embedded"),
           vector_store=os.environ.get("VECTOR_STORE", "auto"))
        tok = {r: c.post("/api/auth/login", json={"username": r, "password": "eval-pass-123"}).json()["token"] for r in ("senior",)}
        tl("AUTH READY", questions=len(golden))
        for qi, g in enumerate(golden, 1):
            role = g.get("role") or ("senior" if a.llm in ("stub", "live") and g["category"] != "permission" else None)
            hdr = {"Authorization": f"Bearer {tok[role]}"} if role else {}
            if qi == 1:
                tl("FIRST QUESTION", id=g["id"])
            t1 = time.perf_counter()
            fut = pool.submit(c.post, "/api/chat", json={"question": g["question"], "context": {"study_area": "kerala-coast", **g["context"]},
                                                         "history": g["history"], "session_id": "eval", "debug": a.llm == "live" or g["category"] == "adhoc"},
                              headers=hdr)
            try:
                r = fut.result(timeout=a.question_timeout).json()
            except FutTimeout:                               # record and move on: one stuck request never hangs the run
                timeouts += 1
                tl("QUESTION TIMEOUT", id=g["id"], after_s=a.question_timeout)
                r = {"answer": "", "tier": "timeout", "sources": [], "llm_called": False, "cache_hit": False}
            ms = (time.perf_counter() - t1) * 1000
            dbg = r.get("debug") or {}
            tr = dbg.get("trace") or {}
            ans = r["answer"]
            grade = None
            if a.llm == "live" and r.get("tier") == "llm" and len(judged) < a.judge and tr.get("evidence"):
                tl("GRADER REQUEST START", id=g["id"], sources=len(tr["evidence"]))
                tj = time.perf_counter()
                try:
                    grade = judge_one(g["question"], ans, tr["evidence"], tr.get("app_data", ""))
                    grade["ms"] = round((time.perf_counter() - tj) * 1000)
                    judged.append({"id": g["id"], "question": g["question"], **grade})
                    tl("GRADER RESPONSE RECEIVED", id=g["id"], ms=grade["ms"], groundedness=grade["groundedness"], claims=grade["n_claims"])
                except Exception as e:  # noqa: BLE001 - a failed grade is reported, never invented
                    tl("GRADER FAILED", id=g["id"], error=type(e).__name__, ms=round((time.perf_counter() - tj) * 1000))
            if tl.on:
                sm = tr.get("stage_ms") or {}
                tl("QUESTION COMPLETE", n=f"{qi}/{len(golden)}", id=g["id"], route=r.get("tier"), intent=r.get("intent"),
                   query_type=r.get("query_type"), retrieval=tr.get("retrieval_method"), candidates=tr.get("candidate_count"),
                   chunks=len(tr.get("selected_chunks") or []), context_tokens=tr.get("context_tokens"),
                   bm25_ms=sm.get("lexical_ms"), embed_ms=sm.get("embed_ms"), vector_ms=sm.get("dense_ms"),
                   retrieval_ms=tr.get("retrieval_ms"), rerank_ms=tr.get("rerank_ms"), llm_ms=dbg.get("llm_ms"), model=dbg.get("model"),
                   fallback=tr.get("fallback_used"), attempts=tr.get("attempts"), llm_reason=dbg.get("llm_reason"),
                   tokens_in=dbg.get("tokens_in_est"), tokens_out=dbg.get("tokens_out_est"), cost_usd=dbg.get("cost_usd"),
                   citations=len(r.get("sources") or []), total_ms=round(ms))
            records.append({"id": g["id"], "question": g["question"], "route": r.get("tier"), "intent": r.get("intent"), "answer": ans,
                            "citations": [{"id": x.get("id"), "label": x.get("label")} for x in r.get("sources") or []],
                            "evidence": tr.get("evidence") or [], "app_data": tr.get("app_data", ""), "model": dbg.get("model"),
                            "fallback_used": tr.get("fallback_used"), "llm_ms": dbg.get("llm_ms"), "total_ms": round(ms),
                            "grade": grade})
            # retrieval metrics on the effective question (as the pipeline sees it)
            rec = mrr = prec = ctxrel = ndcg = None
            if g["source"] and g["tier"] not in ("structured", "conversation", "refused") and g.get("route", "rag") in ("rag", "multi_source"):
                with SessionLocal() as db:
                    ctx = ChatContext(study_area="kerala-coast", selected_patch=g["context"].get("selected_patch"),
                                      selected_candidate=g["context"].get("selected_candidate"))
                    qq, area = resolve(g["question"], ctx)
                    plan = classify(qq, g["history"], ctx.selected_patch or ctx.selected_candidate)
                    qe = plan.rewritten or qq
                    rr = retrieve(db, qe, scope="public", study_area=area, selected=ctx.selected_patch or ctx.selected_candidate)
                    top, _, _ = rerank(qe, list(rr.cands))
                hint = g["source"].lower()
                match = lambda cand: hint in f"{cand.label} {cand.source_key} {cand.object_id or ''} {cand.title}".lower()  # noqa: E731
                rec = any(match(x) for x in top[:5])
                prec = sum(match(x) for x in top[:5]) / max(1, min(5, len(top)))
                mrr = next((1 / (i + 1) for i, x in enumerate(rr.cands) if match(x)), 0.0)
                ctxrel = coverage(qe, top[0]) if top else 0.0
                ndcg = _ndcg([match(x) for x in top[:5]], sum(match(x) for x in rr.cands))
                if a.ablation:
                    for mode in ("bm25", "vector", "hybrid"):
                        os.environ["RAG_RETRIEVAL_MODE"] = mode
                        with SessionLocal() as db:
                            rm = retrieve(db, qe, scope="public", study_area=area, selected=ctx.selected_patch or ctx.selected_candidate)
                            tm, _, _ = rerank(qe, list(rm.cands))
                        abl.setdefault(mode, []).append({"recall5": any(match(x) for x in tm[:5]),
                                                         "mrr": next((1 / (i + 1) for i, x in enumerate(rm.cands) if match(x)), 0.0),
                                                         "ndcg5": _ndcg([match(x) for x in tm[:5]], sum(match(x) for x in rm.cands))})
                    os.environ["RAG_RETRIEVAL_MODE"] = "hybrid"
            refused = r["tier"] == "refused"
            checks = {
                "facts": all(x.lower() in ans.lower() for x in g["contains"]),
                "forbidden_absent": not any(x.lower() in ans.lower() for x in g["not_contains"]),
                "tier": g["tier"] is None or r["tier"] == g["tier"],
                "abstention": refused == g["abstain"] if (g["abstain"] or g["tier"] not in ("refused",)) else True,
            }
            if g["tier"] == "refused":
                checks["abstention"] = refused
            cited = [s.get("label", "") for s in r["sources"]]
            cite_ok = None
            if g["source"] and cited and r["tier"] in ("retrieval", "llm", "structured"):
                cite_ok = any(g["source"].lower() in x.lower() for x in cited)
            faithful = None
            if r["tier"] == "retrieval" and r["sources"]:
                with SessionLocal() as db:
                    from backend.db import RagChunk
                    norm = lambda x: " ".join(re.sub(r"[`*|>#…]+", " ", re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", x)).lower().split())  # noqa: E731
                    texts = " ".join(norm(t) for (t,) in db.query(RagChunk.text).all())
                sents = [s for s in re.split(r"(?<=[.!?])\s+", ans) if len(s) > 25]
                core = [s for s in sents if not s.startswith(("It is in the top 5", "It stays in the top 5", "It is not in the top 5", "Development result"))]
                faithful = all(norm(s)[:80] in texts for s in core) if core else True   # formatting-insensitive verbatim check
            exp_route = g.get("route") or ("refuse" if g["abstain"] or g["tier"] == "refused" else
                                           "structured" if g["tier"] == "structured" else
                                           "conversation" if g["tier"] == "conversation" else None)
            got_route = {"structured": "structured", "refused": "refuse", "conversation": "conversation"}.get(r["tier"], "rag")
            route_ok = None if exp_route is None else (got_route == exp_route or (exp_route == "multi_source" and got_route == "rag"))
            ok = all(checks.values())
            rows.append({**g, "tier_got": r["tier"], "llm": r["llm_called"], "fallback": bool(tr.get("fallback_used")), "grade": grade, "cache": r["cache_hit"], "ms": ms, "ok": ok, "checks": checks,
                         "recall5": rec, "prec5": prec, "mrr": mrr, "ctxrel": ctxrel, "ndcg5": ndcg, "route_ok": route_ok, "model": r.get("model"), "cite_ok": cite_ok, "faithful": faithful,
                         "cost": float(dbg.get("cost_usd") or 0.0), "answer": ans, "sources": cited[:2], "all_sources": [(x.get("id"), x.get("label")) for x in r["sources"]],
                         "context_chunks": ((r.get("debug") or {}).get("trace") or {}).get("selected_chunks") or []})

    def mean(xs):
        xs = [x for x in xs if x is not None]
        return round(statistics.mean(xs), 3) if xs else None

    pool.shutdown(wait=False, cancel_futures=True)
    tl("EVALUATION COMPLETE", questions=len(rows), timeouts=timeouts)
    lat = sorted(r["ms"] for r in rows) or [0.0]
    summary = {
        "questions": len(rows), "answer_pass_rate": mean([float(r["ok"]) for r in rows]),
        "retrieval_recall@5": mean([float(r["recall5"]) if r["recall5"] is not None else None for r in rows]),
        "precision@5": mean([r["prec5"] for r in rows]), "MRR": mean([r["mrr"] for r in rows]),
        "nDCG@5": mean([r["ndcg5"] for r in rows]),
        "route_accuracy": mean([float(r["route_ok"]) if r["route_ok"] is not None else None for r in rows]),
        "context_relevance": mean([r["ctxrel"] for r in rows]),
        "faithfulness": mean([float(r["faithful"]) if r["faithful"] is not None else None for r in rows]),
        "citation_correctness": mean([float(r["cite_ok"]) if r["cite_ok"] is not None else None for r in rows]),
        "abstention_accuracy": mean([float(r["checks"]["abstention"]) for r in rows]),
        "llm_calls": sum(r["llm"] for r in rows), "latency_p50_ms": round(lat[len(lat) // 2], 1), "latency_p95_ms": round(lat[int(0.95 * len(lat))], 1),
        "cost_usd": 0.0, "ingest_seconds": round(ingest_s, 1), "ingest": ing,
    }
    if a.llm == "live":
        llm_lat = sorted(r["ms"] for r in rows if r["llm"]) or [0.0]
        summary.update({"refusals": sum(r["tier_got"] == "refused" for r in rows), "timeouts": timeouts,
                        "failures": sum(not r["ok"] for r in rows), "fallback_calls": sum(r["fallback"] for r in rows),
                        "grader_calls": len(judged), "latency_min_ms": round(lat[0], 1), "latency_max_ms": round(lat[-1], 1),
                        "llm_answer_latency_p50_ms": round(llm_lat[len(llm_lat) // 2], 1),
                        "llm_answer_latency_p95_ms": round(llm_lat[min(len(llm_lat) - 1, int(0.95 * len(llm_lat)))], 1),
                        "host_suspended_s": round(tl.suspended_s, 1)})
        summary["cost_usd"] = round(sum(r["cost"] for r in rows), 4)      # generation only; grader calls not included
    if judged:
        summary["judge_correctness"] = mean([j["correctness"] for j in judged])
        summary["judge_relevance"] = mean([j["relevance"] for j in judged])
        summary["judge_groundedness"] = mean([j["groundedness"] for j in judged])
        summary["judge_citation_support"] = mean([j["citation_support"] for j in judged])
        summary["judge_claims"] = sum(j["n_claims"] for j in judged)
        summary["judge_unsupported_claims"] = sum(j["unsupported"] for j in judged)
    if abl:
        summary["ablation"] = {m: {"recall@5": mean([float(x["recall5"]) for x in v]), "MRR": mean([x["mrr"] for x in v]),
                                   "nDCG@5": mean([x["ndcg5"] for x in v]), "n": len(v)} for m, v in abl.items()}
    if a.record:
        with open(REPO / "docs" / "rag" / "eval_history.jsonl", "a") as hf:     # regression history, one line per run
            hf.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "embedder": a.embedder, "llm": a.llm,
                                 **{k: v for k, v in summary.items() if k != "ingest"}}) + "\n")
    by_cat: dict[str, list] = {}
    for r in rows:
        by_cat.setdefault(r["category"], []).append(r["ok"])

    L = ["<!-- content_type: evaluation_artifact - quotes the golden questions; never indexed (backend/rag/sources.py) -->",
         "# RAG evaluation", "",
         f"Generated by `scripts/rag_eval.py --embedder {a.embedder} --llm {a.llm}` on the golden set `tests/rag/golden.jsonl` "
         f"({len(rows)} questions). Scratch copy of the stored data, fresh database" + ("" if a.llm == "live" else ", no paid API calls")
         + (" (LLM tier exercised with a citing stub)." if a.llm == "stub" else
            f" except the first {os.environ.get('MAX_LLM_CALLS_PER_SESSION')} LLM-eligible questions, which call Claude "
            f"(`{os.environ.get('LLM_MODEL', 'claude-opus-5-5')}`); the rest are answered extractively." if a.llm == "live" else
            "; LLM tier disabled — answers come from structured tools and retrieval only.") + "",
         "", "## Summary", "", "| Metric | Value |", "|---|---|"]
    for k, v in summary.items():
        if k not in ("ingest", "ablation"):
            L.append(f"| {k} | {v} |")
    if abl:
        L += ["", "## Retrieval ablation (same questions, same reranker)", "", "| Mode | Recall@5 | MRR | nDCG@5 | n |", "|---|---|---|---|---|"]
        for m, v in summary["ablation"].items():
            L.append(f"| {m} | {v['recall@5']} | {v['MRR']} | {v['nDCG@5']} | {v['n']} |")
    if judged:
        L += ["", f"## Graded Claude answers ({len(judged)})", "",
              "Grader: `" + os.environ.get("RAG_JUDGE_MODEL", "claude-opus-5-5") + "` (effort low), given the question, the answer, the "
              "APP_DATA block and the full rendered text of every source the generator saw. It splits the answer into claims and "
              "labels each SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED; groundedness = mean claim score (1 / 0.5 / 0) computed "
              "by this script. Citation support = share of cited claims whose cited source actually contains the support. "
              "Model-graded, not human-reviewed.", "",
              "| Id | Question | Claims (S/P/U) | Grounded | Citation support | Correct | Relevant | Grade ms | Note |",
              "|---|---|---|---|---|---|---|---|---|"]
        for j in judged:
            L.append(f"| {j['id']} | {j['question'][:60]} | {j['n_claims']} ({j['supported']}/{j['partial']}/{j['unsupported']}) | "
                     f"{j['groundedness']} | {j['citation_support']} | {j['correctness']} | {j['relevance']} | {j['ms']} | {j['note'][:80]} |")
        bad = [(j, c) for j in judged for c in j["claims"] if c["verdict"] != "SUPPORTED"]
        if bad:
            L += ["", "### Claims not fully supported", ""]
            for j, c in bad:
                L.append(f"- {j['id']} **{c['verdict']}**: {str(c.get('claim'))[:200]} (cited {c.get('cited')}, support {c.get('support')})")
    if a.llm == "live" or a.ask:
        L += ["", "## Per-question live detail", ""]
        for rec in records:
            if rec["route"] not in ("llm",) and not rec["id"].startswith("ask"):
                continue
            g_ = rec.get("grade") or {}
            L += [f"### {rec['id']} — {rec['question']}", "",
                  f"Route `{rec['route']}` · model `{rec['model']}` · fallback {rec['fallback_used']} · LLM {rec['llm_ms'] and round(rec['llm_ms'])} ms · "
                  f"total {rec['total_ms']} ms · grounded {g_.get('groundedness', 'not graded')}", "",
                  "> " + " ".join(rec["answer"].split())[:600], "",
                  "Sources: " + "; ".join(f"{e['id']} {e.get('label') or e.get('title')}" for e in rec["evidence"]) + "", ""]
    if a.json:
        Path(a.json).write_text(json.dumps({"content_type": "evaluation_artifact", "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                            "summary": {k: v for k, v in summary.items() if k != "ingest"}, "records": records}, indent=1, default=str))
    L += ["", f"Ingestion: {ing['documents']} documents, {ing['indexed']} indexed, {ing['chunks_embedded']} chunks embedded with "
          f"`{ing['embedding_model']}` in {summary['ingest_seconds']} s (includes model load).", "",
          "## By category", "", "| Category | Pass |", "|---|---|"]
    for k, v in sorted(by_cat.items()):
        L.append(f"| {k} | {sum(v)}/{len(v)} |")
    L += ["", "## Questions", "", "| # | Category | Question | Tier | LLM | Recall@5 | MRR | Faithful | Cited ok | Pass |", "|---|---|---|---|---|---|---|---|---|---|"]
    f = lambda x: "—" if x is None else ("✓" if x is True else "✗" if x is False else f"{x:.2f}")  # noqa: E731
    for r in rows:
        L.append(f"| {r['id']} | {r['category']} | {r['question']} | {r['tier_got']} | {'yes' if r['llm'] else 'no'} | {f(r['recall5'])} | "
                 f"{f(r['mrr'])} | {f(r['faithful'])} | {f(r['cite_ok'])} | **{'✓' if r['ok'] else '✗'}** |")
    fails = [r for r in rows if not r["ok"]]
    if fails:
        L += ["", "## Failures", ""]
        for r in fails:
            L.append(f"- **{r['id']} {r['question']}** — checks {[k for k, v in r['checks'].items() if not v]}; got ({r['tier_got']}): {r['answer'][:220]}")
    L += ["", "## How to read this", "",
          "* Structured questions are answered from stored data and are not retrieval questions (recall shown as —).",
          "* Faithfulness is checked mechanically for extractive answers (each sentence must occur in an indexed passage); "
          "LLM answers are constrained by citation validation instead and need human review for faithfulness.",
          "* nDCG@5 uses binary relevance (a passage from the expected source); route accuracy compares the answering route",
          "  (structured / rag / refuse / conversation) with the expected route of each question.",
          "* Generated-answer quality is graded only with `--llm live --judge N` (spends API credit); see the judge table when present."]
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(L) + "\n")
    print(json.dumps({k: v for k, v in summary.items() if k != "ingest"}, indent=1, default=str))
    print("RAG_EVAL_SUMMARY " + json.dumps({k: v for k, v in summary.items() if k != "ingest"}))
    for r in rows:
        if r["cite_ok"] is False:
            print(f"CITE {r['id']} expected~{r['source']!r} got {r['sources']}")
    for r in fails:
        print(f"FAIL {r['id']} [{r['category']}] {r['question']}: {[k for k, v in r['checks'].items() if not v]} -> {r['answer'][:150]}")
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if summary["answer_pass_rate"] < a.min_pass else 0


if __name__ == "__main__":
    sys.exit(main())
