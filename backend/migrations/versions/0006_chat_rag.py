"""chat cache + chat events (RAG assistant)

Revision ID: 0006_chat_rag
Revises: 0005_refresh_tokens
Create Date: 2026-10-01 12:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0006_chat_rag'
down_revision = '0005_refresh_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('chat_cache',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('scope', sa.String(length=64), nullable=False),
    sa.Column('canonical', sa.String(length=400), nullable=False),
    sa.Column('answer', sa.JSON(), nullable=False),
    sa.Column('hits', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('key')
    )
    with op.batch_alter_table('chat_cache', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_chat_cache_scope'), ['scope'], unique=False)
    op.create_table('chat_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ts', sa.DateTime(), nullable=True),
    sa.Column('session_id', sa.String(length=64), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('role', sa.String(length=32), nullable=True),
    sa.Column('study_area_id', sa.String(length=64), nullable=True),
    sa.Column('run_id', sa.String(length=200), nullable=True),
    sa.Column('question', sa.String(length=200), nullable=True),
    sa.Column('tier', sa.String(length=16), nullable=True),
    sa.Column('intent', sa.String(length=48), nullable=True),
    sa.Column('cache_hit', sa.Boolean(), nullable=True),
    sa.Column('llm_called', sa.Boolean(), nullable=True),
    sa.Column('llm_reason', sa.String(length=120), nullable=True),
    sa.Column('retrieval_count', sa.Integer(), nullable=True),
    sa.Column('tokens_in_est', sa.Integer(), nullable=True),
    sa.Column('tokens_out_est', sa.Integer(), nullable=True),
    sa.Column('latency_ms', sa.Float(), nullable=True),
    sa.Column('llm_latency_ms', sa.Float(), nullable=True),
    sa.Column('error', sa.String(length=200), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('chat_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_chat_events_session_id'), ['session_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_chat_events_ts'), ['ts'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('chat_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_chat_events_ts'))
        batch_op.drop_index(batch_op.f('ix_chat_events_session_id'))
    op.drop_table('chat_events')
    with op.batch_alter_table('chat_cache', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_chat_cache_scope'))
    op.drop_table('chat_cache')
