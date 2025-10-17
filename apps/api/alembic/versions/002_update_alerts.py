"""Update alerts table for new alert service.

Revision ID: 002_update_alerts
Revises: 001_initial
Create Date: 2025-01-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_update_alerts'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade():
    """Add new columns for alert service."""
    # Add new columns
    op.add_column('alerts', sa.Column('channel', sa.String(), nullable=True))
    op.add_column('alerts', sa.Column('recipient', sa.String(), nullable=True))
    op.add_column('alerts', sa.Column('subject', sa.String(), nullable=True))
    op.add_column('alerts', sa.Column('metadata', postgresql.JSONB(), nullable=True))
    
    # Create indexes
    op.create_index(op.f('ix_alerts_channel'), 'alerts', ['channel'], unique=False)
    
    # Make existing columns nullable for backward compatibility
    op.alter_column('alerts', 'title', nullable=True)
    op.alter_column('alerts', 'alert_type', nullable=True)
    op.alter_column('alerts', 'created_by', nullable=True)
    
    # Update existing records to have channel and recipient
    op.execute("""
        UPDATE alerts 
        SET channel = COALESCE(alert_type, 'email'),
            recipient = 'legacy@example.com'
        WHERE channel IS NULL
    """)
    
    # Now make channel and recipient non-nullable
    op.alter_column('alerts', 'channel', nullable=False)
    op.alter_column('alerts', 'recipient', nullable=False)


def downgrade():
    """Remove new columns."""
    op.drop_index(op.f('ix_alerts_channel'), table_name='alerts')
    op.drop_column('alerts', 'metadata')
    op.drop_column('alerts', 'subject')
    op.drop_column('alerts', 'recipient')
    op.drop_column('alerts', 'channel')
    
    # Restore non-nullable constraints
    op.alter_column('alerts', 'title', nullable=False)
    op.alter_column('alerts', 'alert_type', nullable=False)
    op.alter_column('alerts', 'created_by', nullable=False)

