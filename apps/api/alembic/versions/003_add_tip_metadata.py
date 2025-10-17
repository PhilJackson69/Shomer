"""add tip metadata column

Revision ID: 003
Revises: 002
Create Date: 2025-01-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add metadata JSONB column to tips table for storing file hashes and EXIF info."""
    # Add metadata column if it doesn't exist
    op.execute("""
        ALTER TABLE tips 
        ADD COLUMN IF NOT EXISTS metadata JSONB
    """)
    
    # Add contact_info column if it doesn't exist (for consolidating email/phone)
    op.execute("""
        ALTER TABLE tips 
        ADD COLUMN IF NOT EXISTS contact_info TEXT
    """)
    
    # Create index on metadata for querying hashes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tips_metadata_hash 
        ON tips USING gin((metadata->'cleaned_hash'))
    """)


def downgrade() -> None:
    """Remove metadata column."""
    op.execute("DROP INDEX IF EXISTS idx_tips_metadata_hash")
    op.drop_column('tips', 'contact_info')
    op.drop_column('tips', 'metadata')

