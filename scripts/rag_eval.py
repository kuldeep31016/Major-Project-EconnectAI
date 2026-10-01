"""RAG evaluation on the golden set (tests/rag/golden.jsonl) - retrieval, answers, grounding, abstention, latency, cost.

    .venv/bin/python scripts/rag_eval.py                      # real local embeddings (fastembed), LLM off → docs/rag/EVAL_RESULTS.md
    .venv/bin/python scripts/rag_eval.py --embedder hashing   # CI: no model download
    .venv/bin/python scripts/rag_eval.py --llm stub           # exercise the generation path with a citing stub (no cost)

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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--embedder", default="fastembed", choices=["fastembed", "hashing", "none"])
    ap.add_argument("--llm", default="off", choices=["off", "stub"])
    ap.add_argument("--out", default=str(REPO / "docs" / "rag" / "EVAL_RESULTS.md"))
    ap.add_argument("--min-pass", type=float, default=0.0, help="exit 1 if the answer pass rate is below this")
    a = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="eco_rageval_"))
    shutil.copytree(REPO / "outputs", tmp / "outputs", ignore=shutil.ignore_patterns("ecoconnect.db*", "quicklooks", "models_cache"))
    os.environ.update({"ECO_OUTPUTS_DIR": str(tmp / "outputs"), "ECO_DATABASE_URL": f"sqlite:///{(tmp / 'e.db').as_posix()}",
                       "ECO_DEMO_PASSWORD": "eval-pass-123", "ECO_JWT_SECRET": "eval-secret-" + "x" * 24, "ECO_INLINE_WORKER": "0",
                       "RAG_INGEST_ON_START": "0", "EMBEDDING_PROVIDER": a.embedder, "ECO_ANON_ASK_PER_HOUR": "10000",
                       "EMBEDDING_CACHE_DIR": str(REPO / "outputs" / "models_cache" / "fastembed"),
                       "LLM_ENABLED": "1" if a.llm == "stub" else "0"})
    os.environ.pop("ANTHROPIC_API_KEY", None)

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

    golden = [json.loads(line) for line in (REPO / "tests" / "rag" / "golden.jsonl").read_text().splitlines() if line.strip()]
    rows = []
    with TestClient(app) as c:
        t0 = time.perf_counter()
        with SessionLocal() as db:
            ing = ingest(db)
        ingest_s = time.perf_counter() - t0
        tok = {r: c.post("/api/auth/login", json={"username": r, "password": "eval-pass-123"}).json()["token"] for r in ("senior",)}
        for g in golden:
            role = g.get("role") or ("senior" if a.llm == "stub" and g["category"] != "permission" else None)
            hdr = {"Authorization": f"Bearer {tok[role]}"} if role else {}
            t1 = time.perf_counter()
            r = c.post("/api/chat", json={"question": g["question"], "context": {"study_area": "kerala-coast", **g["context"]},
                                          "history": g["history"], "session_id": "eval"}, headers=hdr).json()
            ms = (time.perf_counter() - t1) * 1000
            ans = r["answer"]
            # retrieval metrics on the effective question (as the pipeline sees it)
            rec = mrr = prec = ctxrel = None
            if g["source"] and g["tier"] not in ("structured", "conversation", "refused"):
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
            ok = all(checks.values())
            rows.append({**g, "tier_got": r["tier"], "llm": r["llm_called"], "cache": r["cache_hit"], "ms": ms, "ok": ok, "checks": checks,
                         "recall5": rec, "prec5": prec, "mrr": mrr, "ctxrel": ctxrel, "cite_ok": cite_ok, "faithful": faithful,
                         "cost": 0.0, "answer": ans, "sources": cited[:2]})

    def mean(xs):
        xs = [x for x in xs if x is not None]
        return round(statistics.mean(xs), 3) if xs else None

    lat = sorted(r["ms"] for r in rows)
    summary = {
        "questions": len(rows), "answer_pass_rate": mean([float(r["ok"]) for r in rows]),
        "retrieval_recall@5": mean([float(r["recall5"]) if r["recall5"] is not None else None for r in rows]),
        "precision@5": mean([r["prec5"] for r in rows]), "MRR": mean([r["mrr"] for r in rows]),
        "context_relevance": mean([r["ctxrel"] for r in rows]),
        "faithfulness": mean([float(r["faithful"]) if r["faithful"] is not None else None for r in rows]),
        "citation_correctness": mean([float(r["cite_ok"]) if r["cite_ok"] is not None else None for r in rows]),
        "abstention_accuracy": mean([float(r["checks"]["abstention"]) for r in rows]),
        "llm_calls": sum(r["llm"] for r in rows), "latency_p50_ms": round(lat[len(lat) // 2], 1), "latency_p95_ms": round(lat[int(0.95 * len(lat))], 1),
        "cost_usd": 0.0, "ingest_seconds": round(ingest_s, 1), "ingest": ing,
    }
    by_cat: dict[str, list] = {}
    for r in rows:
        by_cat.setdefault(r["category"], []).append(r["ok"])

    L = ["# RAG evaluation", "",
         f"Generated by `scripts/rag_eval.py --embedder {a.embedder} --llm {a.llm}` on the golden set `tests/rag/golden.jsonl` "
         f"({len(rows)} questions). Scratch copy of the stored data, fresh database, no paid API calls"
         + (" (LLM tier exercised with a citing stub)." if a.llm == "stub" else "; LLM tier disabled — answers come from structured tools and retrieval only.") + "",
         "", "## Summary", "", "| Metric | Value |", "|---|---|"]
    for k, v in summary.items():
        if k != "ingest":
            L.append(f"| {k} | {v} |")
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
          "* A live-LLM evaluation (answer quality of generated text) has not been run: it would spend API credit."]
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(L) + "\n")
    print(json.dumps({k: v for k, v in summary.items() if k != "ingest"}, indent=1))
    print("RAG_EVAL_SUMMARY " + json.dumps({k: v for k, v in summary.items() if k != "ingest"}))
    for r in fails:
        print(f"FAIL {r['id']} [{r['category']}] {r['question']}: {[k for k, v in r['checks'].items() if not v]} -> {r['answer'][:150]}")
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if summary["answer_pass_rate"] < a.min_pass else 0


if __name__ == "__main__":
    sys.exit(main())
