"""RAG index (documents, chunks, embedding cache) + request tracing/cost columns; pgvector when available

Revision ID: 0007_rag_index
Revises: 0006_chat_rag
Create Date: 2026-10-01 18:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0007_rag_index'
down_revision = '0006_chat_rag'
branch_labels = None
depends_on = None

EMBED_DIM = 384      # BAAI/bge-small-en-v1.5; a different model gets its own column/index (see docs/rag/INGESTION.md)

TRACE_COLS = [
    ('request_id', sa.String(32)), ('query_type', sa.String(24)), ('rewritten_query', sa.String(300)),
    ('retrieval_method', sa.String(40)), ('candidate_count', sa.Integer()), ('reranker', sa.String(40)),
    ('selected_chunks', sa.JSON()), ('retrieval_ms', sa.Float()), ('rerank_ms', sa.Float()), ('model', sa.String(80)),
    ('embedding_model', sa.String(120)), ('index_version', sa.String(32)), ('citation_count', sa.Integer()),
    ('confidence', sa.Float()), ('abstain_reason', sa.String(120)), ('cache_read_tokens', sa.Integer()),
    ('cost_usd', sa.Float()), ('feedback', sa.Integer()),
]


def upgrade() -> None:
    op.create_table('rag_documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source_key', sa.String(300), nullable=False, unique=True),
        sa.Column('source_type', sa.String(40), nullable=False),
        sa.Column('title', sa.String(300)), sa.Column('uri', sa.String(500)),
        sa.Column('visibility', sa.String(16)), sa.Column('study_area_id', sa.String(64)), sa.Column('run_id', sa.String(200)),
        sa.Column('content_hash', sa.String(64)), sa.Column('version', sa.Integer()), sa.Column('status', sa.String(16)),
        sa.Column('chunk_count', sa.Integer()), sa.Column('embedding_model', sa.String(120)), sa.Column('error', sa.String(500)),
        sa.Column('meta', sa.JSON()), sa.Column('created_at', sa.DateTime()), sa.Column('updated_at', sa.DateTime()),
        sa.Column('indexed_at', sa.DateTime()))
    for c in ('source_type', 'visibility', 'study_area_id', 'status'):
        op.create_index(f'ix_rag_documents_{c}', 'rag_documents', [c])
    op.create_table('rag_chunks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('rag_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False), sa.Column('section', sa.String(300)), sa.Column('page', sa.Integer()),
        sa.Column('text', sa.Text(), nullable=False), sa.Column('content_hash', sa.String(64), nullable=False),
        sa.Column('token_count', sa.Integer()), sa.Column('visibility', sa.String(16)), sa.Column('study_area_id', sa.String(64)),
        sa.Column('object_id', sa.String(16)), sa.Column('meta', sa.JSON()), sa.Column('embedding', sa.JSON()),
        sa.Column('embedding_model', sa.String(120)), sa.Column('created_at', sa.DateTime()))
    for c in ('document_id', 'content_hash', 'visibility', 'study_area_id'):
        op.create_index(f'ix_rag_chunks_{c}', 'rag_chunks', [c])
    op.create_table('rag_embedding_cache',
        sa.Column('content_hash', sa.String(64), primary_key=True), sa.Column('model', sa.String(120), primary_key=True),
        sa.Column('vector', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime()))
    with op.batch_alter_table('chat_events', schema=None) as b:
        for name, typ in TRACE_COLS:
            b.add_column(sa.Column(name, typ, nullable=True))
        b.create_index('ix_chat_events_request_id', ['request_id'])

    # pgvector (Neon supports it): a native vector column + HNSW index for server-side ANN search with ACL filters.
    # Where the extension is unavailable (local PostgreSQL without pgvector, SQLite) search runs in-process instead.
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        sp = bind.begin_nested()
        try:
            bind.exec_driver_sql('CREATE EXTENSION IF NOT EXISTS vector')
            bind.exec_driver_sql(f'ALTER TABLE rag_chunks ADD COLUMN embedding_vec vector({EMBED_DIM})')
            bind.exec_driver_sql('CREATE INDEX ix_rag_chunks_embedding_vec ON rag_chunks USING hnsw (embedding_vec vector_cosine_ops)')
            sp.commit()
        except Exception:      # noqa: BLE001 - extension not installable here: in-process vector search is used
            sp.rollback()


def downgrade() -> None:
    with op.batch_alter_table('chat_events', schema=None) as b:
        b.drop_index('ix_chat_events_request_id')
        for name, _ in TRACE_COLS:
            b.drop_column(name)
    op.drop_table('rag_embedding_cache')
    op.drop_table('rag_chunks')
    op.drop_table('rag_documents')
