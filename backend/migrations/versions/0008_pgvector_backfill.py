"""pgvector, idempotently: add the native vector column + HNSW index if 0007 ran before the extension existed

0007 skips pgvector when the extension cannot be created (e.g. a local PostgreSQL installed before pgvector). Running
this migration after installing the extension enables server-side vector search without resetting the database.
Embeddings are filled by the next ingest (the startup ingest backfills chunks whose vector column is NULL).
"""
from alembic import op
import sqlalchemy as sa

revision = '0008_pgvector_backfill'
down_revision = '0007_rag_index'
branch_labels = None
depends_on = None

EMBED_DIM = 384      # BAAI/bge-small-en-v1.5 (same as 0007)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    cols = {c['name'] for c in sa.inspect(bind).get_columns('rag_chunks')}
    if 'embedding_vec' in cols:
        return
    sp = bind.begin_nested()
    try:
        bind.exec_driver_sql('CREATE EXTENSION IF NOT EXISTS vector')
        bind.exec_driver_sql(f'ALTER TABLE rag_chunks ADD COLUMN embedding_vec vector({EMBED_DIM})')
        # HNSW: approximate nearest-neighbour search with cosine distance; m/ef_construction = pgvector defaults
        bind.exec_driver_sql('CREATE INDEX IF NOT EXISTS ix_rag_chunks_embedding_vec ON rag_chunks '
                             'USING hnsw (embedding_vec vector_cosine_ops)')
        sp.commit()
    except Exception:      # noqa: BLE001 - extension still unavailable: in-process vector search stays in use
        sp.rollback()


def downgrade() -> None:
    pass    # the column belongs to 0007's design; dropping it here would break databases created with the extension
