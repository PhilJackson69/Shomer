"""Add MFA cohort table for staged rollout

Revision ID: 009
Revises: 008
Create Date: 2025-01-18 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    """Add MFA cohort table for staged rollout."""
    # Create mfa_cohort_members table
    op.create_table('mfa_cohort_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('added_by', sa.Integer(), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['added_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_mfa_cohort_members_id'), 'mfa_cohort_members', ['id'], unique=False)


def downgrade():
    """Remove MFA cohort table."""
    op.drop_index(op.f('ix_mfa_cohort_members_id'), table_name='mfa_cohort_members')
    op.drop_table('mfa_cohort_members')
