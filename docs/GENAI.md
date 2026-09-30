# GenAI assistant — architecture and honest scope

> The assistant answers questions about **stored analysis runs** only. It retrieves structured run data from
> files and the database, sends it to Claude with an enforced JSON answer format, and keeps only citations that
> point at that evidence. It does **not** retrieve from project documentation or the paper (no RAG over documents
> — see §7). Answers are AI-generated and must be checked against the cited sources.

Code: `backend/assistant_llm.py` (grounded Claude path), `backend/insight.py` (template path, evidence chain),
`backend/routers.py::assistant_ask` (endpoint, rate limit, audit), `frontend/components/chat/assistant-launcher.tsx`
(UI). Tests: `tests/test_assistant.py`, `tests/test_workflow.py`, `tests/test_phase5.py`.

## 1. Request flow

```
POST /api/assistant/ask {question (2–1000 chars), study_area, run_id="latest"}
  ├─ resolve run directory (none → template answer "no analysis run yet")
  ├─ use_llm = signed-in user AND llm_available()      (ANTHROPIC_API_KEY/AUTH_TOKEN/PROFILE set,
  │                                                    anthropic SDK importable, ECO_ASSISTANT_LLM != "0")
  ├─ use_llm: per-user hourly limit → build_evidence → ask_llm → finalise   (any exception → template answer)
  ├─ else:    insight.answer (template)
  └─ audit row "assistant_question" for every question (anonymous users as "anonymous")
```

## 2. Evidence retrieval (`build_evidence`)

There is **no intent classifier and no embedding search** in the Claude path. Retrieval is a fixed set of
structured items plus the ids mentioned in the question (regex `\b[PC]\d{1,3}\b`, kept only if the id exists in
the run). Each item gets an id `E1, E2, …` and a `source` string:

| Kind | Content | Source |
|---|---|---|
| `run` | run id, result label, scene year, threshold, graph config, n_patches/edges/components, habitat area, IIC, PC, ECA | `manifest.json` + `metrics.json` |
| `criticality_top` | top 8 patches (rank, area, degree, S, Δ%, cut vertex, components, area rank) | `criticality.json` |
| `cut_vertices` | ids of all cut vertices | `criticality.json` |
| `patch` (per mentioned P-id) | full criticality row + rule-based explanation text | `criticality.json` + `explanations.json` |
| `restoration_candidate` (per mentioned C-id) | rank, area, gain %, links, cost | `restoration.json` |
| `restoration_top` | top 5 candidates **with category label** + note not to present uncertain-habitat gains as benefits | `restoration.json` + `restoration_rules.annotate` |
| `model` | registry id, status, encoder, input bands, split sizes, test IoU/F1/P/R vs reference labels, known limitations | `models` table |
| `field_verification` (per mentioned id) | field tasks and detection statuses | `detections`, `field_tasks` |
| `alerts` | open / total counts, up to 6 open titles | `alerts` |
| `hitl` | recorded / included model disagreements | `model_disagreements` |
| `limitations` | five fixed caveat sentences (GMW agreement, simulations, no field validation unless VERIFIED, structural connectivity, no cost/ownership/legal data) | hard-coded in `build_evidence` |

## 3. The Claude call (`ask_llm`)

- Model: `ECO_ASSISTANT_MODEL`, default **`claude-opus-5`**; Anthropic Python SDK (`anthropic>=1.0` in
  `requirements-api.txt`), client timeout 60 s, `max_retries=2`.
- `client.beta.messages.create(…, max_tokens=4000, thinking={"type": "adaptive"},
  output_config={"effort": "low", "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
  betas=["server-side-fallback-2026-07-01"], fallbacks="default")`.
- System prompt: answer only from the evidence items, cite ids, quote numbers exactly, state the GMW / simulation /
  no-field-validation caveats, set `insufficient_evidence` when the evidence does not answer, propose (never run)
  a scenario when asked to simulate, 2–6 sentences in plain language.
- The user message is the evidence items as JSON followed by the question.
- `ANSWER_SCHEMA` (strict, `additionalProperties: false`): `answer`, `cited_evidence_ids[]`,
  `insufficient_evidence`, `proposed_scenario {type ∈ none | remove_patches | restore | reduce_area | radius |
  sensitivity, patch_ids, candidate_ids, retain_fraction, tau_km, rationale}`.
- `stop_reason == "refusal"` → the "not enough evidence" reply.

## 4. Enforcement after the call (`finalise`, `validate_scenario`)

- Citations not in the evidence pack are **dropped**. If no valid citation remains, the answer is replaced by
  *"I don't have enough evidence in the current dataset to answer that."* and `insufficient_evidence = true`.
  (If the model sets `insufficient_evidence` but still cites valid items, its text is kept with the flag set.)
- `proposed_scenario` is validated against the run's real patch/candidate ids and bounds (`retain_fraction`
  0.05–0.95, `tau_km` 0.5–50; `restore` with > 1 id becomes `restore_multi`); invalid proposals return
  `scenario_rejected` with the reason.
- **Proposals are never auto-executed.** The UI shows "Proposed simulation · needs your confirmation"; only the
  user's click on *Run simulation* calls `POST /api/runs/{area}/{run}/scenario` ([SCENARIOS.md](SCENARIOS.md)).
  The LLM has no write access to anything.
- Response: `mode: "llm"`, `model`, `answer`, `insufficient_evidence`, `citations[{id, kind, source}]`,
  `proposed_scenario`, `scenario_rejected`, `label: "AI-GENERATED FROM STORED EVIDENCE - check the cited sources"`,
  and the full `evidence` list. Numbers in the answer text are not re-checked programmatically against the
  evidence — only the citations are.

## 5. Template fallback (`backend/insight.py::answer`)

Used for anonymous users, when no API credentials are configured, and whenever the Claude call raises
(`llm_error` names the exception type). The first matching regex intent wins:

| Intent | Triggers (abridged) | Answer built from |
|---|---|---|
| `cut` | hold together, cut vertex, bridge, stepping stone, split, fragment | cut-vertex rows |
| `critical` | critical, priority patch, top patch | top 5 of `criticality.json` |
| `why` | "why is/does P…" | `explanations.json` text |
| `whatif` | what if / remove / lose … P… | the patch's leave-one-out row |
| `change` | change, since, previous, trend, timeline | two runs with the **same model and threshold** only; otherwise says no like-for-like change exists |
| `restore` | restor, candidate, cluster, gain | restoration sites and uncertain-habitat areas **listed separately** |
| `alerts` | alert, verif, pending, field | alerts / detections / field-task counts |
| `model` | model, accuracy, confidence, IoU, dice | registry model test metrics vs GMW (or "no model — synthetic"; 95.56 % attributed to the foundation study) |
| `summary` | default | run summary + suggested questions |

Every template answer returns `intent`, `answer`, `sources`, `label` (the run's result label), and links.

## 6. Limits, audit, cost

- **Per-user limit:** `ECO_ASSISTANT_PER_HOUR` (default **30**) Claude questions per user per rolling hour → HTTP
  429. The counter is an in-process dictionary: it resets on restart and is not shared between processes.
  Anonymous users never reach Claude.
- **Audit:** every question (template or Claude) writes an `assistant_question` audit row with mode, study area,
  the first 300 characters of the question, cited ids and the proposed scenario.
- **Cost:** [DEPLOYMENT.md](DEPLOYMENT.md) §5 gives an *estimate* — `claude-opus-5` at $5 / $25 per million
  input / output tokens, a ~3–6 k-token evidence pack and a few hundred output tokens, "roughly $0.02–0.04 per
  question" — and says to verify against current pricing. No measured spend is recorded;
  `scripts/check_deployment.py` deliberately never calls the paid assistant.

## 7. What is *not* implemented (future work)

- **RAG over documents:** no retrieval over `docs/`, the paper (`docs/EcoConnectAI_IEEE_paper.pdf`,
  `paper_source_main.tex`), model cards as text, or any external literature; no embeddings, vector store or
  chunking. Methodology questions ("how is IIC defined?") can only be answered from the fixed evidence items,
  i.e. usually with "not enough evidence". Retrieval-augmented answers over project documentation are **FUTURE**.
- No multi-turn memory: each question is answered independently.
- No retrieval across runs or areas beyond the selected run (plus DB-wide alert/HITL counts for the area).
- No automated evaluation of answer faithfulness; `tests/test_assistant.py` uses a `StubClient` (no real API call) and checks citation filtering, refusal/error
  fallback and proposal validation, not answer quality. The live Claude path has not been exercised in tests.
