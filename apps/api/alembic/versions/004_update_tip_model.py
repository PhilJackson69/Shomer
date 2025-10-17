"""update tip model with status field

Revision ID: 004
Revises: 003
Create Date: 2025-01-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add status column to tips table."""
    # Add status column if it doesn't exist
    op.execute("""
        ALTER TABLE tips 
        ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'new' NOT NULL
    """)
    
    # Create index on status
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tips_status 
        ON tips(status)
    """)


def downgrade() -> None:
    """Remove status column."""
    op.execute("DROP INDEX IF EXISTS idx_tips_status")
    op.execute("ALTER TABLE tips DROP COLUMN IF EXISTS status")

