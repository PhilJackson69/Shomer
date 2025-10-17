"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)

    # Create subscribers table
    op.create_table(
        'subscribers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('subscribed_at', sa.DateTime(), nullable=False),
        sa.Column('unsubscribed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subscribers_id'), 'subscribers', ['id'], unique=False)
    op.create_index(op.f('ix_subscribers_email'), 'subscribers', ['email'], unique=False)
    op.create_index(op.f('ix_subscribers_phone'), 'subscribers', ['phone'], unique=False)

    # Create incidents table
    op.create_table(
        'incidents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_incidents_id'), 'incidents', ['id'], unique=False)
    op.create_index(op.f('ix_incidents_title'), 'incidents', ['title'], unique=False)
    op.create_index(op.f('ix_incidents_severity'), 'incidents', ['severity'], unique=False)
    op.create_index(op.f('ix_incidents_status'), 'incidents', ['status'], unique=False)
    op.create_index(op.f('ix_incidents_created_at'), 'incidents', ['created_at'], unique=False)
    op.create_index(op.f('ix_incidents_expires_at'), 'incidents', ['expires_at'], unique=False)

    # Create tips table
    op.create_table(
        'tips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('submitter_email', sa.String(), nullable=True),
        sa.Column('submitter_phone', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tips_id'), 'tips', ['id'], unique=False)
    op.create_index(op.f('ix_tips_created_at'), 'tips', ['created_at'], unique=False)
    op.create_index(op.f('ix_tips_expires_at'), 'tips', ['expires_at'], unique=False)

    # Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('recipients_count', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_id'), 'alerts', ['id'], unique=False)
    op.create_index(op.f('ix_alerts_status'), 'alerts', ['status'], unique=False)
    op.create_index(op.f('ix_alerts_created_at'), 'alerts', ['created_at'], unique=False)

    # Create events table
    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('event_time', sa.DateTime(), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=True),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False)
    op.create_index(op.f('ix_events_title'), 'events', ['title'], unique=False)
    op.create_index(op.f('ix_events_event_time'), 'events', ['event_time'], unique=False)
    op.create_index(op.f('ix_events_risk_score'), 'events', ['risk_score'], unique=False)

    # Insert seed admin user
    # Password: admin123 (hashed with bcrypt)
    op.execute(
        """
        INSERT INTO users (email, username, hashed_password, full_name, role, is_active, created_at)
        VALUES (
            'admin@shomer.local',
            'admin',
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7d8e9h0gSK',
            'System Administrator',
            'admin',
            true,
            NOW()
        )
        """
    )


def downgrade() -> None:
    # Drop events table
    op.drop_index(op.f('ix_events_risk_score'), table_name='events')
    op.drop_index(op.f('ix_events_event_time'), table_name='events')
    op.drop_index(op.f('ix_events_title'), table_name='events')
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_table('events')

    # Drop alerts table
    op.drop_index(op.f('ix_alerts_created_at'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_status'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_id'), table_name='alerts')
    op.drop_table('alerts')

    # Drop tips table
    op.drop_index(op.f('ix_tips_expires_at'), table_name='tips')
    op.drop_index(op.f('ix_tips_created_at'), table_name='tips')
    op.drop_index(op.f('ix_tips_id'), table_name='tips')
    op.drop_table('tips')

    # Drop incidents table
    op.drop_index(op.f('ix_incidents_expires_at'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_created_at'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_status'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_severity'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_title'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_id'), table_name='incidents')
    op.drop_table('incidents')

    # Drop subscribers table
    op.drop_index(op.f('ix_subscribers_phone'), table_name='subscribers')
    op.drop_index(op.f('ix_subscribers_email'), table_name='subscribers')
    op.drop_index(op.f('ix_subscribers_id'), table_name='subscribers')
    op.drop_table('subscribers')

    # Drop audit_logs table
    op.drop_index(op.f('ix_audit_logs_timestamp'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_table('audit_logs')

    # Drop users table
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

