"""Near-real-time satellite layer: Copernicus catalogue observations + analysis provenance records

Revision ID: 0009_satellite_nrt
Revises: 0008_pgvector_backfill
Create Date: 2026-10-03 20:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0009_satellite_nrt'
down_revision = '0008_pgvector_backfill'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('satellite_observations',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('study_area_id', sa.String(64), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('platform', sa.String(32)), sa.Column('product_type', sa.String(32)), sa.Column('mode', sa.String(8)),
        sa.Column('polarisation', sa.String(16)), sa.Column('orbit_direction', sa.String(16)),
        sa.Column('relative_orbit', sa.Integer()), sa.Column('timeliness', sa.String(32)),
        sa.Column('acquisition_start', sa.DateTime()), sa.Column('acquisition_end', sa.DateTime()),
        sa.Column('published_at', sa.DateTime()), sa.Column('aoi_coverage', sa.Float()), sa.Column('footprint', sa.JSON()),
        sa.Column('first_seen_at', sa.DateTime()), sa.Column('last_seen_at', sa.DateTime()))
    op.create_index('ix_satellite_observations_study_area_id', 'satellite_observations', ['study_area_id'])
    op.create_index('ix_satellite_observations_acquisition_start', 'satellite_observations', ['acquisition_start'])

    op.create_table('satellite_analyses',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('study_area_id', sa.String(64), nullable=False),
        sa.Column('mode', sa.String(8), nullable=False),
        sa.Column('product_ids', sa.JSON()), sa.Column('product_names', sa.JSON()),
        sa.Column('satellite', sa.String(32)), sa.Column('product_type', sa.String(32)),
        sa.Column('acquisition_time', sa.DateTime()), sa.Column('composite_scenes', sa.Integer()),
        sa.Column('preprocessing_version', sa.String(64)), sa.Column('scene_path', sa.String(500)),
        sa.Column('model_version', sa.String(120)), sa.Column('model_checkpoint', sa.String(500)),
        sa.Column('threshold', sa.Float()), sa.Column('mmu_ha', sa.Float()), sa.Column('tau_km', sa.Float()),
        sa.Column('k_neighbors', sa.Integer()), sa.Column('software_version', sa.String(80)),
        sa.Column('status', sa.String(24)), sa.Column('stage', sa.String(40)), sa.Column('error', sa.Text()),
        sa.Column('job_id', sa.String()), sa.Column('run_id', sa.String(200)), sa.Column('summary', sa.JSON()),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime()), sa.Column('processed_at', sa.DateTime()), sa.Column('finished_at', sa.DateTime()))
    for c in ('study_area_id', 'status', 'job_id', 'created_at'):
        op.create_index(f'ix_satellite_analyses_{c}', 'satellite_analyses', [c])


def downgrade() -> None:
    op.drop_table('satellite_analyses')
    op.drop_table('satellite_observations')
