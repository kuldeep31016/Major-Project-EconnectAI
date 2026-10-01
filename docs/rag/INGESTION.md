# Ingestion, chunking and versioning

Code: `backend/rag/sources.py`, `chunking.py`, `embeddings.py`, `ingest.py`. Runs as the background job `rag_ingest`
(queued at API start, from `/system`, from `POST /api/rag/ingest`, or `make rag-ingest`) — never in the request path.

## Pipeline

```
source → parse → normalise → structure-aware chunk → metadata + ACL → embed (cache first) → rag_chunks (+ pgvector)
       → document version + status
```

**Sources** (`collect()`): README + `docs/*.md` + `docs/rag/*.md` (superseded docs and generated eval reports skipped),
the FAQ (one record per question), the paper (LaTeX → markdown), page help + glossary (parsed from the frontend so the UI
and the assistant use the same words), study areas, each area's LATEST run (summary, network + τ sensitivity, one
record per patch and per candidate, stored what-if), the model registry, and admin uploads (bytes in object storage).

**Parsers**: md/txt; HTML (scripts, styles, nav, header, footer, forms removed; headings → `#`, lists, tables as rows);
JSON (one record per item, `key: value` lines); CSV (blocks of 25 rows with the header repeated); PDF (pypdf, page breaks
kept as `\f` so chunks carry page numbers); LaTeX. Unsupported types are rejected at upload.

**Normalisation**: control and zero-width characters removed, whitespace collapsed, PDF running headers/footers (lines
repeated on ≥ 60 % of pages) dropped. Headings, tables, identifiers, dates and page breaks are preserved.

## Chunking (structure-aware)

Markdown is parsed into blocks (heading, paragraph, list, table, fenced code, page break) and packed **per section** up
to `CHUNK_SIZE` tokens. A chunk never crosses a heading; the heading path is the chunk's `section` and the nearest
heading is repeated at the top of each chunk. Tables and code stay whole unless larger than `MAX_CHUNK_SIZE` (tables are
then split by rows with the header repeated). Continuing sections carry ≤ `CHUNK_OVERLAP` tokens of trailing sentences.
Chunks below `MIN_CHUNK_SIZE` merge into their neighbour. Records (patch, candidate, FAQ answer, glossary term, CSV
block) are one chunk each. Current corpus: 41 documents → 523 chunks, median 125 tokens, max ≤ 700.

Chunk metadata (`rag_chunks`): document id, chunk index, section, page (PDF only), text, content sha256, token count,
visibility, study area, object id (P07, C05 …), meta (title, uri, run id, FAQ flag), embedding, embedding model.
Document metadata (`rag_documents`): source key, type, title, uri, visibility, study area, run id, content hash,
version, status, chunk count, embedding model, error, timestamps.

## Versioning, incremental indexing, deletion

| Situation | What happens |
|---|---|
| content hash and embedding model unchanged | **skipped** — no chunking, no embedding (second ingest of the whole corpus: 0.04 s) |
| content changed | status PROCESSING → chunks replaced → `version + 1` → INDEXED |
| identical text elsewhere (duplicate doc, unchanged chunk) | vector taken from `rag_embedding_cache` (content-addressed) — never re-embedded |
| embedding model changed | every document re-indexed under the new model version; retrieval only compares vectors of the current version, so spaces never mix (pgvector column is 384-dim: a different dimension needs a new column/index) |
| source file removed | document → DELETED, chunks removed (delete propagation) |
| upload deleted (admin) | chunks removed, stored file deleted, document → DELETED |
| source changed but not yet re-indexed | `detect_stale()` (run by `GET /api/rag/status` and `make rag-status`) marks it STALE; still served until re-indexed |
| one document fails | that document → FAILED with the error (savepoint), the rest continue |

Statuses: PENDING · PROCESSING · INDEXED · FAILED · STALE · DELETED.

## Admin API

`GET /api/rag/status`, `GET /api/rag/documents`, `POST /api/rag/ingest[?force=true]`,
`POST /api/rag/documents/{id}/reindex` (view_audit) · `POST /api/rag/upload` (multipart: file ≤ 5 MB, title, visibility
public|staff|admin) and `DELETE /api/rag/documents/{id}` (manage_users). UI: `/system` → Knowledge index.
