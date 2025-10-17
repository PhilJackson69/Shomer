"""add evidence tables

Revision ID: 005
Revises: 004
Create Date: 2025-01-14 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create evidence, chain_of_custody, and evidence_access_log tables."""
    
    # Create evidence table
    op.create_table(
        'evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reference_number', sa.String(length=50), nullable=False),
        sa.Column('evidence_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=False),
        sa.Column('md5_hash', sa.String(length=32), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('location', sa.String(length=500), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('sealed_at', sa.DateTime(), nullable=True),
        sa.Column('incident_id', sa.Integer(), nullable=True),
        sa.Column('tip_id', sa.Integer(), nullable=True),
        sa.Column('submitted_by_user_id', sa.Integer(), nullable=True),
        sa.Column('legal_hold', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('legal_hold_reason', sa.Text(), nullable=True),
        sa.Column('legal_hold_until', sa.DateTime(), nullable=True),
        sa.Column('retention_until', sa.DateTime(), nullable=True),
        sa.Column('auto_delete', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('original_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata_removed', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], ),
        sa.ForeignKeyConstraint(['tip_id'], ['tips.id'], ),
        sa.ForeignKeyConstraint(['submitted_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evidence_id'), 'evidence', ['id'], unique=False)
    op.create_index(op.f('ix_evidence_reference_number'), 'evidence', ['reference_number'], unique=True)
    op.create_index(op.f('ix_evidence_sha256_hash'), 'evidence', ['sha256_hash'], unique=False)
    op.create_index(op.f('ix_evidence_incident_id'), 'evidence', ['incident_id'], unique=False)
    op.create_index(op.f('ix_evidence_tip_id'), 'evidence', ['tip_id'], unique=False)
    op.create_index(op.f('ix_evidence_submitted_by_user_id'), 'evidence', ['submitted_by_user_id'], unique=False)

    # Create chain_of_custody table
    op.create_table(
        'chain_of_custody',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('evidence_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('action_by_user_id', sa.Integer(), nullable=True),
        sa.Column('action_by_name', sa.String(length=255), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('hash_verified', sa.Boolean(), nullable=True),
        sa.Column('hash_match', sa.Boolean(), nullable=True),
        sa.Column('transferred_to', sa.String(length=255), nullable=True),
        sa.Column('transfer_method', sa.String(length=100), nullable=True),
        sa.Column('transfer_receipt', sa.String(length=500), nullable=True),
        sa.Column('evidence_status_at_time', sa.String(length=20), nullable=True),
        sa.Column('metadata_snapshot', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidence.id'], ),
        sa.ForeignKeyConstraint(['action_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chain_of_custody_id'), 'chain_of_custody', ['id'], unique=False)
    op.create_index(op.f('ix_chain_of_custody_evidence_id'), 'chain_of_custody', ['evidence_id'], unique=False)
    op.create_index(op.f('ix_chain_of_custody_action_by_user_id'), 'chain_of_custody', ['action_by_user_id'], unique=False)
    op.create_index(op.f('ix_chain_of_custody_timestamp'), 'chain_of_custody', ['timestamp'], unique=False)

    # Create evidence_access_log table
    op.create_table(
        'evidence_access_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('evidence_id', sa.Integer(), nullable=False),
        sa.Column('accessed_by_user_id', sa.Integer(), nullable=False),
        sa.Column('access_type', sa.String(length=50), nullable=False),
        sa.Column('accessed_at', sa.DateTime(), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('authorized_by_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidence.id'], ),
        sa.ForeignKeyConstraint(['accessed_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['authorized_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evidence_access_log_id'), 'evidence_access_log', ['id'], unique=False)
    op.create_index(op.f('ix_evidence_access_log_evidence_id'), 'evidence_access_log', ['evidence_id'], unique=False)
    op.create_index(op.f('ix_evidence_access_log_accessed_by_user_id'), 'evidence_access_log', ['accessed_by_user_id'], unique=False)
    op.create_index(op.f('ix_evidence_access_log_accessed_at'), 'evidence_access_log', ['accessed_at'], unique=False)


def downgrade() -> None:
    """Drop evidence tables."""
    op.drop_index(op.f('ix_evidence_access_log_accessed_at'), table_name='evidence_access_log')
    op.drop_index(op.f('ix_evidence_access_log_accessed_by_user_id'), table_name='evidence_access_log')
    op.drop_index(op.f('ix_evidence_access_log_evidence_id'), table_name='evidence_access_log')
    op.drop_index(op.f('ix_evidence_access_log_id'), table_name='evidence_access_log')
    op.drop_table('evidence_access_log')
    
    op.drop_index(op.f('ix_chain_of_custody_timestamp'), table_name='chain_of_custody')
    op.drop_index(op.f('ix_chain_of_custody_action_by_user_id'), table_name='chain_of_custody')
    op.drop_index(op.f('ix_chain_of_custody_evidence_id'), table_name='chain_of_custody')
    op.drop_index(op.f('ix_chain_of_custody_id'), table_name='chain_of_custody')
    op.drop_table('chain_of_custody')
    
    op.drop_index(op.f('ix_evidence_submitted_by_user_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_tip_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_incident_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_sha256_hash'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_reference_number'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_id'), table_name='evidence')
    op.drop_table('evidence')

