# EcoConnectAI developer commands.  `make help` lists them.
# The API only needs requirements-api.txt; training/inference (PyTorch) needs requirements.txt.

PY      ?= .venv/bin/python
PIP     ?= .venv/bin/pip
NPM     ?= npm --prefix frontend

.PHONY: help setup setup-ml test acceptance rag-ingest rag-status rag-eval lint typecheck build run api web docker docker-postgres deploy-check clean

help:            ## list commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-16s %s\n", $$1, $$2}'

setup:           ## create .venv with the API dependencies + install frontend packages
	test -x $(PY) || python3 -m venv .venv
	$(PIP) install -r requirements-api.txt pytest ruff
	$(NPM) ci

setup-ml:        ## add the ML stack (PyTorch etc.) for training / inference
	$(PIP) install -r requirements.txt

test:            ## backend + library tests
	$(PY) -m pytest -q

acceptance:      ## 20-step end-to-end acceptance test on a scratch copy of outputs/ (no paid API calls)
	$(PY) scripts/acceptance_test.py

rag-ingest:      ## incremental RAG ingestion (FORCE=1 re-indexes everything)
	$(PY) scripts/rag_ingest.py $(if $(FORCE),--force)

rag-status:      ## RAG index status (documents by status, chunks, embedder, stale sources)
	$(PY) scripts/rag_ingest.py --status

rag-eval:        ## RAG golden-set evaluation with the real local embedding model -> docs/rag/EVAL_RESULTS.md
	$(PY) scripts/rag_eval.py

lint:            ## ruff (CI rule set) + eslint
	$(PY) -m ruff check backend ecoconnect scripts tests --select F
	$(NPM) run lint

typecheck:       ## TypeScript
	cd frontend && npx tsc --noEmit

build:           ## production frontend build
	$(NPM) run build

run:             ## API :8000 and frontend :3000 together (Ctrl-C stops both)
	$(MAKE) -j2 api web

api:             ## API only (SQLite in outputs/ unless ECO_DATABASE_URL is set)
	$(PY) -m uvicorn backend.main:app --port 8000

web:             ## frontend dev server only
	$(NPM) run dev

docker:          ## API + frontend in containers
	docker compose up --build

docker-postgres: ## same, with PostGIS (set ECO_DATABASE_URL in .env, see .env.example)
	docker compose --profile postgres up --build

deploy-check:    ## smoke-test a deployment: make deploy-check API=https://... FRONTEND=https://...
	$(PY) scripts/check_deployment.py --api $(API) $(if $(FRONTEND),--frontend $(FRONTEND))

clean:           ## remove caches and the frontend build (keeps data, runs and the database)
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache frontend/.next
