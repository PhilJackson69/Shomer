"""add custody immutability triggers

Revision ID: 006
Revises: 005
Create Date: 2025-10-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add database-level immutability guards for chain of custody and sealed evidence."""
    
    # Function to prevent updates/deletes on chain_of_custody (immutable audit log)
    op.execute("""
    CREATE OR REPLACE FUNCTION forbid_update_delete_coc()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'ChainOfCustody rows are immutable';
    END;
    $$ LANGUAGE plpgsql;
    """)
    
    # Trigger to protect chain_of_custody
    op.execute("""
    DROP TRIGGER IF EXISTS trig_coc_protect ON chain_of_custody;
    """)
    
    op.execute("""
    CREATE TRIGGER trig_coc_protect
    BEFORE UPDATE OR DELETE ON chain_of_custody
    FOR EACH ROW EXECUTE FUNCTION forbid_update_delete_coc();
    """)
    
    # Add 'sealed' column to evidence if not exists (tracks if evidence is in legal hold)
    # This is a convenience column - legal_hold is already present but sealed is clearer for status
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='evidence' AND column_name='sealed') 
        THEN
            ALTER TABLE evidence ADD COLUMN sealed BOOLEAN DEFAULT FALSE NOT NULL;
        END IF;
    END $$;
    """)
    
    # Update existing records: sealed = true if status is SEALED or legal_hold is true
    op.execute("""
    UPDATE evidence SET sealed = TRUE WHERE status = 'sealed' OR legal_hold = TRUE;
    """)
    
    # Function to protect sealed evidence from modifications
    op.execute("""
    CREATE OR REPLACE FUNCTION protect_sealed_evidence()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.sealed = TRUE THEN
          RAISE EXCEPTION 'Evidence is sealed (legal hold) - cannot delete';
        END IF;
        RETURN OLD;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.sealed = TRUE THEN
          -- Allow only status and notes updates, forbid file/hash/metadata changes
          IF (OLD.file_path IS DISTINCT FROM NEW.file_path OR
              OLD.sha256_hash IS DISTINCT FROM NEW.sha256_hash OR
              OLD.md5_hash IS DISTINCT FROM NEW.md5_hash OR
              OLD.filename IS DISTINCT FROM NEW.filename OR
              OLD.file_size IS DISTINCT FROM NEW.file_size OR
              OLD.sealed IS DISTINCT FROM NEW.sealed OR
              OLD.legal_hold IS DISTINCT FROM NEW.legal_hold) THEN
            RAISE EXCEPTION 'Evidence is sealed (legal hold) - cannot modify file or core metadata';
          END IF;
        END IF;
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
    """)
    
    # Trigger to protect sealed evidence
    op.execute("""
    DROP TRIGGER IF EXISTS trig_evidence_protect ON evidence;
    """)
    
    op.execute("""
    CREATE TRIGGER trig_evidence_protect
    BEFORE UPDATE OR DELETE ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION protect_sealed_evidence();
    """)


def downgrade() -> None:
    """Remove immutability guards."""
    op.execute("DROP TRIGGER IF EXISTS trig_evidence_protect ON evidence;")
    op.execute("DROP FUNCTION IF EXISTS protect_sealed_evidence();")
    op.execute("DROP TRIGGER IF EXISTS trig_coc_protect ON chain_of_custody;")
    op.execute("DROP FUNCTION IF EXISTS forbid_update_delete_coc();")
    
    # Remove sealed column if it was added
    op.execute("""
    DO $$ 
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='evidence' AND column_name='sealed') 
        THEN
            ALTER TABLE evidence DROP COLUMN sealed;
        END IF;
    END $$;
    """)

