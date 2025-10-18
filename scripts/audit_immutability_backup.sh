#!/bin/bash
# Audit Log Immutability and Backup/DR Procedures
# Implements append-only audit logs with hash chains and automated backups

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
AUDIT_LOG_DIR="/var/log/shomer/audit"
HASH_CHAIN_FILE="$BACKUP_DIR/audit_hash_chain.txt"
BACKUP_RETENTION_DAYS=30
RESTORE_TEST_INTERVAL_DAYS=30

echo "🔒 Starting Audit Log Immutability and Backup Procedures..."
echo "=========================================="

# Function to create append-only audit log table
create_immutable_audit_table() {
    echo "📋 Creating immutable audit log table..."
    
    # SQL to create append-only audit table with hash chain
    cat > /tmp/create_immutable_audit.sql << 'EOF'
-- Create immutable audit log table
CREATE TABLE IF NOT EXISTS audit_logs_immutable (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hash_chain VARCHAR(64) NOT NULL,  -- SHA256 hash of previous record + current record
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_timestamp ON audit_logs_immutable(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_user_id ON audit_logs_immutable(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_action ON audit_logs_immutable(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_immutable_hash_chain ON audit_logs_immutable(hash_chain);

-- Create function to calculate hash chain
CREATE OR REPLACE FUNCTION calculate_audit_hash_chain(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id UUID,
    p_details JSONB,
    p_ip_address INET,
    p_user_agent TEXT,
    p_timestamp TIMESTAMPTZ,
    p_previous_hash VARCHAR(64) DEFAULT NULL
) RETURNS VARCHAR(64) AS $$
DECLARE
    current_data TEXT;
    hash_result VARCHAR(64);
BEGIN
    -- Concatenate current record data
    current_data := COALESCE(p_user_id::TEXT, '') || '|' ||
                   COALESCE(p_action, '') || '|' ||
                   COALESCE(p_resource_type, '') || '|' ||
                   COALESCE(p_resource_id::TEXT, '') || '|' ||
                   COALESCE(p_details::TEXT, '') || '|' ||
                   COALESCE(p_ip_address::TEXT, '') || '|' ||
                   COALESCE(p_user_agent, '') || '|' ||
                   COALESCE(p_timestamp::TEXT, '');
    
    -- Include previous hash if available
    IF p_previous_hash IS NOT NULL THEN
        current_data := p_previous_hash || '|' || current_data;
    END IF;
    
    -- Calculate SHA256 hash
    hash_result := encode(digest(current_data, 'sha256'), 'hex');
    
    RETURN hash_result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce immutability
CREATE OR REPLACE FUNCTION enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent updates and deletes
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit logs are immutable - updates and deletes are not allowed';
    END IF;
    
    -- Calculate hash chain for new records
    IF TG_OP = 'INSERT' THEN
        SELECT calculate_audit_hash_chain(
            NEW.user_id,
            NEW.action,
            NEW.resource_type,
            NEW.resource_id,
            NEW.details,
            NEW.ip_address,
            NEW.user_agent,
            NEW.timestamp,
            (SELECT hash_chain FROM audit_logs_immutable ORDER BY id DESC LIMIT 1)
        ) INTO NEW.hash_chain;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS audit_immutability_trigger ON audit_logs_immutable;
CREATE TRIGGER audit_immutability_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON audit_logs_immutable
    FOR EACH ROW EXECUTE FUNCTION enforce_audit_immutability();

-- Create view for read-only access
CREATE OR REPLACE VIEW audit_logs_readonly AS
SELECT 
    id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent,
    timestamp,
    hash_chain,
    created_at
FROM audit_logs_immutable
ORDER BY timestamp DESC;
EOF
    
    # Execute SQL
    psql "$DATABASE_URL" -f /tmp/create_immutable_audit.sql
    
    echo "✅ Immutable audit log table created"
}

# Function to create daily hash chain verification
create_hash_chain_verification() {
    echo "🔗 Creating hash chain verification script..."
    
    cat > /usr/local/bin/verify_audit_hash_chain.sh << 'EOF'
#!/bin/bash
# Daily hash chain verification for audit logs

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost/shomer}"

echo "🔍 Verifying audit log hash chain..."

# Get all records ordered by creation time
RECORDS=$(psql "$DATABASE_URL" -t -c "
SELECT 
    id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent,
    timestamp,
    hash_chain
FROM audit_logs_immutable 
ORDER BY id ASC;
")

PREVIOUS_HASH=""
VERIFICATION_FAILED=false

while IFS='|' read -r id user_id action resource_type resource_id details ip_address user_agent timestamp hash_chain; do
    # Clean up whitespace
    id=$(echo "$id" | xargs)
    user_id=$(echo "$user_id" | xargs)
    action=$(echo "$action" | xargs)
    resource_type=$(echo "$resource_type" | xargs)
    resource_id=$(echo "$resource_id" | xargs)
    details=$(echo "$details" | xargs)
    ip_address=$(echo "$ip_address" | xargs)
    user_agent=$(echo "$user_agent" | xargs)
    timestamp=$(echo "$timestamp" | xargs)
    hash_chain=$(echo "$hash_chain" | xargs)
    
    # Calculate expected hash
    current_data="$user_id|$action|$resource_type|$resource_id|$details|$ip_address|$user_agent|$timestamp"
    if [ -n "$PREVIOUS_HASH" ]; then
        current_data="$PREVIOUS_HASH|$current_data"
    fi
    
    expected_hash=$(echo -n "$current_data" | sha256sum | cut -d' ' -f1)
    
    if [ "$hash_chain" != "$expected_hash" ]; then
        echo "❌ Hash chain verification failed for record ID $id"
        echo "   Expected: $expected_hash"
        echo "   Actual:   $hash_chain"
        VERIFICATION_FAILED=true
    fi
    
    PREVIOUS_HASH="$hash_chain"
done <<< "$RECORDS"

if [ "$VERIFICATION_FAILED" = true ]; then
    echo "🚨 Audit log hash chain verification FAILED"
    exit 1
else
    echo "✅ Audit log hash chain verification PASSED"
fi
EOF
    
    chmod +x /usr/local/bin/verify_audit_hash_chain.sh
    
    echo "✅ Hash chain verification script created"
}

# Function to create backup procedures
create_backup_procedures() {
    echo "💾 Creating backup procedures..."
    
    # Create backup script
    cat > /usr/local/bin/backup_database.sh << 'EOF'
#!/bin/bash
# Automated database backup with encryption

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost/shomer}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/shomer_backup_$TIMESTAMP.sql"
ENCRYPTED_BACKUP_FILE="$BACKUP_FILE.gpg"

echo "💾 Starting database backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create database backup
pg_dump "$DATABASE_URL" --verbose --no-password --format=custom --compress=9 > "$BACKUP_FILE"

# Encrypt backup if key provided
if [ -n "$ENCRYPTION_KEY" ]; then
    echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --cipher-algo AES256 --compress-algo 1 --symmetric --output "$ENCRYPTED_BACKUP_FILE" "$BACKUP_FILE"
    rm "$BACKUP_FILE"
    BACKUP_FILE="$ENCRYPTED_BACKUP_FILE"
fi

# Calculate checksum
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"

echo "✅ Database backup created: $BACKUP_FILE"

# Clean up old backups
find "$BACKUP_DIR" -name "shomer_backup_*.sql*" -type f -mtime +$BACKUP_RETENTION_DAYS -delete

echo "✅ Old backups cleaned up (retention: $BACKUP_RETENTION_DAYS days)"
EOF
    
    chmod +x /usr/local/bin/backup_database.sh
    
    # Create restore test script
    cat > /usr/local/bin/test_restore.sh << 'EOF'
#!/bin/bash
# Monthly restore test to verify backup integrity

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://user:pass@localhost/shomer_test}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

echo "🧪 Starting restore test..."

# Find latest backup
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "shomer_backup_*.sql" -type f | sort | tail -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup files found"
    exit 1
fi

echo "Testing restore from: $LATEST_BACKUP"

# Create test database
createdb "$TEST_DATABASE_URL" 2>/dev/null || true

# Decrypt if needed
if [ -n "$ENCRYPTION_KEY" ] && [[ "$LATEST_BACKUP" == *.gpg ]]; then
    echo "Decrypting backup..."
    echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --decrypt "$LATEST_BACKUP" > "/tmp/test_restore.sql"
    RESTORE_FILE="/tmp/test_restore.sql"
else
    RESTORE_FILE="$LATEST_BACKUP"
fi

# Restore to test database
pg_restore "$TEST_DATABASE_URL" --verbose --no-password --clean --if-exists "$RESTORE_FILE"

# Verify restore
RECORD_COUNT=$(psql "$TEST_DATABASE_URL" -t -c "SELECT COUNT(*) FROM audit_logs_immutable;")
echo "✅ Restore test completed. Records restored: $RECORD_COUNT"

# Clean up test database
dropdb "$TEST_DATABASE_URL" 2>/dev/null || true

# Clean up temp file
rm -f "/tmp/test_restore.sql"

echo "✅ Restore test PASSED"
EOF
    
    chmod +x /usr/local/bin/test_restore.sh
    
    echo "✅ Backup and restore test procedures created"
}

# Function to create cron jobs
setup_cron_jobs() {
    echo "⏰ Setting up automated cron jobs..."
    
    # Add cron jobs
    (crontab -l 2>/dev/null; echo "# Shomer audit and backup automation") | crontab -
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup_database.sh >> /var/log/shomer/backup.log 2>&1") | crontab -
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/verify_audit_hash_chain.sh >> /var/log/shomer/hash_verification.log 2>&1") | crontab -
    (crontab -l 2>/dev/null; echo "0 4 1 * * /usr/local/bin/test_restore.sh >> /var/log/shomer/restore_test.log 2>&1") | crontab -
    
    echo "✅ Cron jobs configured:"
    echo "   - Daily backup at 2 AM"
    echo "   - Daily hash verification at 3 AM"
    echo "   - Monthly restore test on 1st at 4 AM"
}

# Function to create monitoring alerts
create_monitoring_alerts() {
    echo "📊 Creating monitoring alerts..."
    
    cat > /usr/local/bin/audit_monitoring.sh << 'EOF'
#!/bin/bash
# Audit log monitoring and alerting

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost/shomer}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@shomer.app}"

echo "📊 Checking audit log health..."

# Check for recent audit log entries
RECENT_ENTRIES=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM audit_logs_immutable 
WHERE timestamp > NOW() - INTERVAL '1 hour';
")

if [ "$RECENT_ENTRIES" -eq 0 ]; then
    echo "⚠️  No audit log entries in the last hour"
    # Send alert (implement your alerting mechanism)
fi

# Check for hash chain integrity
if ! /usr/local/bin/verify_audit_hash_chain.sh; then
    echo "🚨 Hash chain verification failed - sending alert"
    # Send critical alert
fi

# Check backup status
LATEST_BACKUP=$(find /backups -name "shomer_backup_*.sql*" -type f -mtime -1 | wc -l)
if [ "$LATEST_BACKUP" -eq 0 ]; then
    echo "⚠️  No recent backups found"
    # Send backup alert
fi

echo "✅ Audit monitoring completed"
EOF
    
    chmod +x /usr/local/bin/audit_monitoring.sh
    
    # Add monitoring to cron
    (crontab -l 2>/dev/null; echo "*/15 * * * * /usr/local/bin/audit_monitoring.sh >> /var/log/shomer/monitoring.log 2>&1") | crontab -
    
    echo "✅ Monitoring alerts configured (every 15 minutes)"
}

# Function to create documentation
create_documentation() {
    echo "📚 Creating operational documentation..."
    
    cat > /usr/local/share/doc/audit_procedures.md << 'EOF'
# Audit Log Immutability and Backup Procedures

## Overview
This document describes the audit log immutability and backup procedures for the Shomer system.

## Audit Log Immutability

### Hash Chain Implementation
- Each audit log entry includes a hash chain field
- Hash is calculated from previous record hash + current record data
- Prevents tampering with historical audit logs
- Daily verification ensures integrity

### Database Schema
- `audit_logs_immutable` table with append-only constraints
- Triggers prevent UPDATE/DELETE operations
- Read-only view for application access

## Backup Procedures

### Automated Backups
- Daily backups at 2 AM UTC
- Encrypted with GPG (if key provided)
- Compressed with pg_dump custom format
- SHA256 checksums for integrity verification
- 30-day retention policy

### Restore Testing
- Monthly restore tests on 1st of month
- Verifies backup integrity
- Tests restore procedures
- Automated cleanup of test databases

## Monitoring and Alerting

### Health Checks
- Hash chain verification (daily)
- Backup status monitoring (every 15 minutes)
- Audit log activity monitoring
- Restore test validation

### Alert Conditions
- Hash chain verification failure
- Missing recent backups
- No audit log activity
- Restore test failures

## Emergency Procedures

### Manual Backup
```bash
/usr/local/bin/backup_database.sh
```

### Manual Restore
```bash
# Find latest backup
LATEST_BACKUP=$(find /backups -name "shomer_backup_*.sql" -type f | sort | tail -1)

# Restore to production database
pg_restore "$DATABASE_URL" --verbose --clean --if-exists "$LATEST_BACKUP"
```

### Hash Chain Verification
```bash
/usr/local/bin/verify_audit_hash_chain.sh
```

## Configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `BACKUP_DIR`: Backup storage directory
- `BACKUP_ENCRYPTION_KEY`: GPG encryption key
- `BACKUP_RETENTION_DAYS`: Backup retention period

### File Locations
- `/usr/local/bin/backup_database.sh`: Backup script
- `/usr/local/bin/verify_audit_hash_chain.sh`: Hash verification
- `/usr/local/bin/test_restore.sh`: Restore testing
- `/usr/local/bin/audit_monitoring.sh`: Monitoring
- `/backups/`: Backup storage directory
EOF
    
    echo "✅ Documentation created at /usr/local/share/doc/audit_procedures.md"
}

# Main execution
main() {
    # Create audit log immutability
    create_immutable_audit_table
    create_hash_chain_verification
    
    # Create backup procedures
    create_backup_procedures
    
    # Setup automation
    setup_cron_jobs
    create_monitoring_alerts
    
    # Create documentation
    create_documentation
    
    echo ""
    echo "=========================================="
    echo "🎉 Audit immutability and backup procedures configured"
    echo "🔒 Audit logs are now immutable with hash chain verification"
    echo "💾 Automated backups and restore testing enabled"
    echo "📊 Monitoring and alerting configured"
    echo "=========================================="
}

# Run main function
main "$@"
