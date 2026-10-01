"""Golden-set regression gate: runs scripts/rag_eval.py in a fresh process (hashing embeddings, LLM off and a citing
stub LLM) and fails if answer quality or abstention regresses. The real-model report is docs/rag/EVAL_RESULTS.md."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("llm", ["off", "stub"])
def test_golden_set(tmp_path, llm):
    if not (REPO / "outputs" / "runs" / "kerala-coast").exists():
        pytest.skip("stored runs not present")
    out = tmp_path / "eval.md"
    p = subprocess.run([sys.executable, str(REPO / "scripts" / "rag_eval.py"), "--embedder", "hashing", "--llm", llm, "--out", str(out)],
                       capture_output=True, text=True, timeout=600, cwd=REPO)
    line = next((ln for ln in p.stdout.splitlines() if ln.startswith("RAG_EVAL_SUMMARY ")), None)
    assert line, p.stdout[-1500:] + p.stderr[-1500:]
    summary = json.loads(line.split(" ", 1)[1])
    assert summary["abstention_accuracy"] == 1.0 and summary["retrieval_recall@5"] >= 0.95
    assert summary["citation_correctness"] >= 0.95
    if llm == "stub":            # generation path exercised: calls happen, citations validated, abstention unchanged
        assert summary["llm_calls"] > 10
    else:                        # answer quality gate (structured + retrieval tiers, no LLM)
        assert summary["llm_calls"] == 0 and summary["answer_pass_rate"] >= 0.95, p.stdout[-2000:]
