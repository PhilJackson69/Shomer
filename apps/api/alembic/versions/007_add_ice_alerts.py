"""add ice alert system

Revision ID: 007
Revises: 006
Create Date: 2025-10-14 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add ICE alert system with moderation and verification."""
    
    # Add category column to existing alerts table
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='alerts' AND column_name='category') 
        THEN
            ALTER TABLE alerts ADD COLUMN category VARCHAR DEFAULT 'OTHER' NOT NULL;
            CREATE INDEX idx_alerts_category ON alerts(category);
        END IF;
    END $$;
    """)
    
    # Create ice_alerts table
    op.create_table(
        'ice_alerts',
        
        # Primary key
        sa.Column('id', sa.Integer(), nullable=False),
        
        # Location information
        sa.Column('location', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        
        # Alert content
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        
        # Verification and moderation
        sa.Column('verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('approved', sa.Boolean(), nullable=False, default=False),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        
        # Lifecycle management
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False, default=False),
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        
        # Broadcast tracking
        sa.Column('broadcast_sent', sa.Boolean(), nullable=False, default=False),
        sa.Column('broadcast_at', sa.DateTime(), nullable=True),
        sa.Column('broadcast_count', sa.Integer(), nullable=False, default=0),
        
        # Metadata
        sa.Column('metadata', JSONB, nullable=True),
        
        # Audit trail
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        
        # Primary key
        sa.PrimaryKeyConstraint('id'),
        
        # Foreign keys
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_ice_alerts_created_by'),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], name='fk_ice_alerts_verified_by'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name='fk_ice_alerts_reviewed_by'),
    )
    
    # Create indexes for common queries
    op.create_index('idx_ice_alerts_location', 'ice_alerts', ['location'])
    op.create_index('idx_ice_alerts_latitude', 'ice_alerts', ['latitude'])
    op.create_index('idx_ice_alerts_longitude', 'ice_alerts', ['longitude'])
    op.create_index('idx_ice_alerts_severity', 'ice_alerts', ['severity'])
    op.create_index('idx_ice_alerts_verified', 'ice_alerts', ['verified'])
    op.create_index('idx_ice_alerts_approved', 'ice_alerts', ['approved'])
    op.create_index('idx_ice_alerts_expires_at', 'ice_alerts', ['expires_at'])
    op.create_index('idx_ice_alerts_archived', 'ice_alerts', ['archived'])
    op.create_index('idx_ice_alerts_created_at', 'ice_alerts', ['created_at'])
    
    # Composite index for active alerts query (most common)
    op.create_index(
        'idx_ice_alerts_active',
        'ice_alerts',
        ['approved', 'archived', 'expires_at'],
        postgresql_where=sa.text('approved = true AND archived = false')
    )
    
    # Spatial index for geographic queries (if PostGIS available)
    # This would be added if PostGIS extension is installed
    # For now, we'll use the separate lat/lon indexes
    
    # Add comment to table
    op.execute("""
    COMMENT ON TABLE ice_alerts IS 
    'Community-submitted ICE activity alerts with human moderation and verification';
    """)
    
    op.execute("""
    COMMENT ON COLUMN ice_alerts.severity IS 
    'Severity level: rumor (unconfirmed), verified (confirmed), active (current)';
    """)
    
    op.execute("""
    COMMENT ON COLUMN ice_alerts.confidence_score IS 
    'AI/manual confidence score from 0.0 to 1.0 based on verification';
    """)
    
    op.execute("""
    COMMENT ON COLUMN ice_alerts.expires_at IS 
    'Alerts expire after 48 hours and move to archive';
    """)


def downgrade() -> None:
    """Remove ICE alert system."""
    
    # Drop indexes
    op.drop_index('idx_ice_alerts_active', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_created_at', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_archived', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_expires_at', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_approved', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_verified', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_severity', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_longitude', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_latitude', table_name='ice_alerts')
    op.drop_index('idx_ice_alerts_location', table_name='ice_alerts')
    
    # Drop table
    op.drop_table('ice_alerts')
    
    # Remove category column from alerts (optional - may want to keep for backward compatibility)
    # op.drop_column('alerts', 'category')

