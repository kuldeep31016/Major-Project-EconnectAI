"""Phase 6: evidence-grounded assistant. The Claude call is stubbed - these tests pin the grounding guarantees."""
import json
import shutil
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend import assistant_llm as A
from ecoconnect.pipeline.config import OUTPUTS_DIR

KERALA = Path(__file__).resolve().parents[1] / "outputs" / "runs" / "kerala-coast" / "kerala-coast_20260920T182222Z"


class StubClient:
    """Mimics client.beta.messages.create(...) returning one JSON text block (structured output)."""
    def __init__(self, payload=None, stop_reason="end_turn", exc=None):
        self.payload, self.stop_reason, self.exc, self.calls = payload, stop_reason, exc, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        if self.exc:
            raise self.exc
        return SimpleNamespace(stop_reason=self.stop_reason, content=[SimpleNamespace(type="text", text=json.dumps(self.payload))])


def _payload(answer="P17 is a cut vertex [E4].", cited=("E4",), scen=None, insufficient=False):
    return {"answer": answer, "cited_evidence_ids": list(cited), "insufficient_evidence": insufficient,
            "proposed_scenario": scen or {"type": "none", "patch_ids": [], "candidate_ids": [], "retain_fraction": 0, "tau_km": 0, "rationale": ""}}


@pytest.fixture(scope="module")
def kerala_dir():
    if not KERALA.exists():
        pytest.skip("stored Kerala run not present")
    dst = OUTPUTS_DIR / "runs" / "kerala-coast" / KERALA.name
    if not dst.exists():
        shutil.copytree(KERALA, dst)
    return dst


@pytest.fixture(scope="module")
def db():
    from backend.db import SessionLocal, init_db
    init_db()
    with SessionLocal() as s:
        yield s


def test_evidence_pack_contains_stored_p17_values(db, kerala_dir):
    items, index = A.build_evidence(db, "Why is P17 important?", "kerala-coast", kerala_dir)
    patch = next(i for i in items if i["kind"] == "patch")
    assert patch["data"]["patch_id"] == "P17" and patch["data"]["is_cut_vertex"] and patch["data"]["rank"] == 3
    assert "P17" in next(i for i in items if i["kind"] == "cut_vertices")["data"]["cut_vertices"]
    assert any(i["kind"] == "limitations" for i in items) and "P17" in index["patch_ids"]


def test_grounded_answer_keeps_only_real_citations(db, kerala_dir):
    items, _ = A.build_evidence(db, "Why is P17 important?", "kerala-coast", kerala_dir)
    pid = next(i["id"] for i in items if i["kind"] == "patch")
    stub = StubClient(_payload(cited=(pid, "E999")))
    out = A.grounded_answer(db, "Why is P17 important?", "kerala-coast", kerala_dir, use_llm=True, client=stub)
    assert out["mode"] == "llm" and [c["id"] for c in out["citations"]] == [pid]
    sent = stub.calls[0]
    assert sent["output_config"]["format"]["type"] == "json_schema" and "E1" in sent["messages"][0]["content"]


def test_uncited_answer_becomes_not_enough_evidence(db, kerala_dir):
    out = A.grounded_answer(db, "What is the soil pH?", "kerala-coast", kerala_dir, use_llm=True,
                            client=StubClient(_payload(answer="pH is 6.5", cited=())))
    assert out["insufficient_evidence"] and out["answer"] == A.NO_EVIDENCE


def test_scenario_proposal_is_validated_not_executed(db, kerala_dir):
    scen = {"type": "remove_patches", "patch_ids": ["P17", "P999"], "candidate_ids": [], "retain_fraction": 0, "tau_km": 0, "rationale": "asked"}
    out = A.grounded_answer(db, "What happens if P17 is removed?", "kerala-coast", kerala_dir, use_llm=True, client=StubClient(_payload(scen=scen)))
    assert out["proposed_scenario"] == {"type": "remove_patches", "patch_ids": ["P17"]}
    bad = {**scen, "patch_ids": ["P999"]}
    out = A.grounded_answer(db, "remove P999", "kerala-coast", kerala_dir, use_llm=True, client=StubClient(_payload(scen=bad)))
    assert out["proposed_scenario"] is None and out["scenario_rejected"]
    assert A.validate_scenario({"type": "radius", "tau_km": 500}, {"patch_ids": set(), "candidate_ids": set()})[0] is None


def test_refusal_and_api_errors_fall_back_honestly(db, kerala_dir):
    out = A.grounded_answer(db, "q", "kerala-coast", kerala_dir, use_llm=True, client=StubClient(_payload(), stop_reason="refusal"))
    assert out["insufficient_evidence"]
    out = A.grounded_answer(db, "Which patches are critical?", "kerala-coast", kerala_dir, use_llm=True, client=StubClient(exc=RuntimeError("down")))
    assert out["mode"] == "template" and out["llm_error"] == "RuntimeError"


def test_endpoint_template_for_anonymous_llm_for_users(db, kerala_dir, monkeypatch):
    import backend.main as m
    monkeypatch.setattr(A, "llm_available", lambda: True)
    monkeypatch.setattr(A, "_client", lambda: StubClient(_payload(cited=("E1",))))
    with TestClient(m.app) as c:
        body = {"question": "Summarise this landscape", "study_area": "kerala-coast", "run_id": KERALA.name}
        assert c.post("/api/assistant/ask", json=body).json()["mode"] == "template"
        tok = c.post("/api/auth/login", json={"username": "analyst", "password": "testpass"}).json()["token"]
        out = c.post("/api/assistant/ask", json=body, headers={"Authorization": f"Bearer {tok}"}).json()
        assert out["mode"] == "llm" and out["citations"][0]["id"] == "E1"
        assert c.post("/api/assistant/ask", json={**body, "study_area": "../x"}).status_code == 422


def test_template_whatif_intent_uses_exact_recomputation(db, kerala_dir):
    from backend.insight import answer
    out = answer(db, "What happens if P17 is removed?", "kerala-coast", kerala_dir)
    assert out["intent"] == "whatif" and "−27.0 %" in out["answer"] and "2 to 3" in out["answer"]
