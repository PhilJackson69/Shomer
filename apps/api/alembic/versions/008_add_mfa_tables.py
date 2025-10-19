"""Add MFA tables

Revision ID: 008
Revises: 007
Create Date: 2025-01-18 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    """Add MFA tables."""
    # Create user_mfa table
    op.create_table('user_mfa',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('totp_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('totp_secret_hash', sa.String(length=255), nullable=True),
        sa.Column('webauthn_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('recovery_codes_hash', sa.Text(), nullable=True),
        sa.Column('backup_codes_used', sa.Text(), nullable=True),
        sa.Column('last_totp_used', sa.String(length=10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_mfa_id'), 'user_mfa', ['id'], unique=False)
    
    # Create webauthn_credentials table
    op.create_table('webauthn_credentials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_mfa_id', sa.Integer(), nullable=False),
        sa.Column('credential_id', sa.String(length=255), nullable=False),
        sa.Column('public_key', sa.Text(), nullable=False),
        sa.Column('counter', sa.Integer(), nullable=False, default=0),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_mfa_id'], ['user_mfa.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('credential_id')
    )
    op.create_index(op.f('ix_webauthn_credentials_id'), 'webauthn_credentials', ['id'], unique=False)
    op.create_index('ix_webauthn_credentials_credential_id', 'webauthn_credentials', ['credential_id'], unique=False)
    
    # Create mfa_attempts table
    op.create_table('mfa_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('attempt_type', sa.String(length=20), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('failure_reason', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mfa_attempts_id'), 'mfa_attempts', ['id'], unique=False)


def downgrade():
    """Remove MFA tables."""
    op.drop_index(op.f('ix_mfa_attempts_id'), table_name='mfa_attempts')
    op.drop_table('mfa_attempts')
    
    op.drop_index('ix_webauthn_credentials_credential_id', table_name='webauthn_credentials')
    op.drop_index(op.f('ix_webauthn_credentials_id'), table_name='webauthn_credentials')
    op.drop_table('webauthn_credentials')
    
    op.drop_index(op.f('ix_user_mfa_id'), table_name='user_mfa')
    op.drop_table('user_mfa')
