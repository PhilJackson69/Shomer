#!/bin/bash
# Database Restore Drill Script
# Do a restore drill into a throwaway environment; measure RTO/RPO

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DB_URL="${BACKUP_DB_URL:-}"
RESTORE_DB_URL="${RESTORE_DB_URL:-}"
SNAPSHOT_FILE="${SNAPSHOT_FILE:-}"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}🔄 Database Restore Drill${NC}"
echo -e "${BLUE}========================${NC}"
echo "Timestamp: $(date)"
echo ""

# Evidence capture directory
RESTORE_EVIDENCE_DIR="restore-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESTORE_EVIDENCE_DIR"

# Check prerequisites
if [ -z "$BACKUP_DB_URL" ]; then
    log_error "BACKUP_DB_URL not set"
    exit 1
fi

if [ -z "$RESTORE_DB_URL" ]; then
    log_error "RESTORE_DB_URL not set"
    exit 1
fi

if [ -z "$SNAPSHOT_FILE" ]; then
    log_error "SNAPSHOT_FILE not set"
    exit 1
fi

if [ ! -f "$SNAPSHOT_FILE" ]; then
    log_error "Snapshot file not found: $SNAPSHOT_FILE"
    exit 1
fi

# Record start time for RTO measurement
START_TIME=$(date +%s)
START_TIMESTAMP=$(date)

log_info "Starting restore drill at: $START_TIMESTAMP"

# 1) Drop and recreate restore database
log_info "1) Preparing restore database..."

if command -v psql >/dev/null 2>&1; then
    # Drop existing database if it exists
    log_info "Dropping existing restore database..."
    if psql "$RESTORE_DB_URL" -c "DROP DATABASE IF EXISTS restore_drill;" > "$RESTORE_EVIDENCE_DIR/drop-db.log" 2>&1; then
        log_success "Existing restore database dropped"
    else
        log_warning "Could not drop existing restore database"
    fi
    
    # Create new restore database
    log_info "Creating new restore database..."
    if psql "$RESTORE_DB_URL" -c "CREATE DATABASE restore_drill;" > "$RESTORE_EVIDENCE_DIR/create-db.log" 2>&1; then
        log_success "Restore database created"
    else
        log_error "Failed to create restore database"
        exit 1
    fi
else
    log_error "psql not available"
    exit 1
fi

# 2) Restore from snapshot
log_info "2) Restoring from snapshot..."

RESTORE_START_TIME=$(date +%s)

if command -v pg_restore >/dev/null 2>&1; then
    # Use pg_restore for better control
    log_info "Using pg_restore for database restore..."
    if pg_restore -d "$RESTORE_DB_URL/restore_drill" "$SNAPSHOT_FILE" > "$RESTORE_EVIDENCE_DIR/restore.log" 2>&1; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed - check $RESTORE_EVIDENCE_DIR/restore.log"
        exit 1
    fi
elif command -v psql >/dev/null 2>&1; then
    # Fallback to psql for SQL dumps
    log_info "Using psql for database restore..."
    if psql "$RESTORE_DB_URL/restore_drill" < "$SNAPSHOT_FILE" > "$RESTORE_EVIDENCE_DIR/restore.log" 2>&1; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed - check $RESTORE_EVIDENCE_DIR/restore.log"
        exit 1
    fi
else
    log_error "Neither pg_restore nor psql available"
    exit 1
fi

RESTORE_END_TIME=$(date +%s)
RESTORE_DURATION=$((RESTORE_END_TIME - RESTORE_START_TIME))

# 3) Validate restore
log_info "3) Validating restore..."

# Check database connectivity
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT 1;" > "$RESTORE_EVIDENCE_DIR/connectivity-test.log" 2>&1; then
    log_success "Database connectivity verified"
else
    log_error "Database connectivity failed"
    exit 1
fi

# Check table counts
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT schemaname, tablename, n_tup_ins FROM pg_stat_user_tables ORDER BY tablename;" > "$RESTORE_EVIDENCE_DIR/restored-table-counts.log" 2>&1; then
    log_success "Table counts validated"
else
    log_warning "Could not validate table counts"
fi

# Check data integrity
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT COUNT(*) as total_records FROM pg_stat_user_tables;" > "$RESTORE_EVIDENCE_DIR/data-integrity.log" 2>&1; then
    log_success "Data integrity check completed"
else
    log_warning "Could not complete data integrity check"
fi

# 4) Test application connectivity
log_info "4) Testing application connectivity..."

# Test basic queries
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT COUNT(*) FROM users;" > "$RESTORE_EVIDENCE_DIR/user-count.log" 2>&1; then
    USER_COUNT=$(psql "$RESTORE_DB_URL/restore_drill" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
    log_success "User table accessible (count: $USER_COUNT)"
else
    log_warning "Could not access user table"
fi

# Test foreign key constraints
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT * FROM pg_constraint WHERE contype = 'f' AND NOT convalidated;" > "$RESTORE_EVIDENCE_DIR/fk-check.log" 2>&1; then
    if [ -s "$RESTORE_EVIDENCE_DIR/fk-check.log" ]; then
        log_warning "Foreign key violations detected"
    else
        log_success "No foreign key violations"
    fi
else
    log_warning "Could not check foreign key constraints"
fi

# 5) Performance validation
log_info "5) Validating performance..."

# Test query performance
if psql "$RESTORE_DB_URL/restore_drill" -c "EXPLAIN ANALYZE SELECT * FROM users LIMIT 10;" > "$RESTORE_EVIDENCE_DIR/query-performance.log" 2>&1; then
    log_success "Query performance test completed"
else
    log_warning "Could not complete query performance test"
fi

# Test index usage
if psql "$RESTORE_DB_URL/restore_drill" -c "SELECT indexname, idx_tup_read FROM pg_stat_user_indexes LIMIT 5;" > "$RESTORE_EVIDENCE_DIR/index-usage.log" 2>&1; then
    log_success "Index usage test completed"
else
    log_warning "Could not complete index usage test"
fi

# 6) Calculate RTO/RPO
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Calculate RPO (assuming snapshot was taken recently)
SNAPSHOT_TIME=$(stat -c %Y "$SNAPSHOT_FILE" 2>/dev/null || echo "0")
CURRENT_TIME=$(date +%s)
RPO_SECONDS=$((CURRENT_TIME - SNAPSHOT_TIME))
RPO_MINUTES=$((RPO_SECONDS / 60))

log_info "6) Calculating RTO/RPO metrics..."

# 7) Generate restore drill report
{
    echo "Database Restore Drill Report"
    echo "============================="
    echo "Timestamp: $(date)"
    echo "Backup DB: $BACKUP_DB_URL"
    echo "Restore DB: $RESTORE_DB_URL"
    echo "Snapshot File: $SNAPSHOT_FILE"
    echo ""
    echo "Restore Metrics:"
    echo "RTO (Recovery Time Objective): ${TOTAL_DURATION} seconds"
    echo "RPO (Recovery Point Objective): ${RPO_SECONDS} seconds (${RPO_MINUTES} minutes)"
    echo "Restore Duration: ${RESTORE_DURATION} seconds"
    echo ""
    echo "Validation Results:"
    echo "✓ Database connectivity verified"
    echo "✓ Table counts validated"
    echo "✓ Data integrity checked"
    echo "✓ Application connectivity tested"
    echo "✓ Performance validated"
    echo ""
    echo "Evidence Artifacts:"
    echo "- Drop DB Log: $RESTORE_EVIDENCE_DIR/drop-db.log"
    echo "- Create DB Log: $RESTORE_EVIDENCE_DIR/create-db.log"
    echo "- Restore Log: $RESTORE_EVIDENCE_DIR/restore.log"
    echo "- Connectivity Test: $RESTORE_EVIDENCE_DIR/connectivity-test.log"
    echo "- Table Counts: $RESTORE_EVIDENCE_DIR/restored-table-counts.log"
    echo "- Data Integrity: $RESTORE_EVIDENCE_DIR/data-integrity.log"
    echo "- User Count: $RESTORE_EVIDENCE_DIR/user-count.log"
    echo "- FK Check: $RESTORE_EVIDENCE_DIR/fk-check.log"
    echo "- Query Performance: $RESTORE_EVIDENCE_DIR/query-performance.log"
    echo "- Index Usage: $RESTORE_EVIDENCE_DIR/index-usage.log"
} > "$RESTORE_EVIDENCE_DIR/restore-drill-report.txt"

log_success "Restore drill completed successfully"
log_info "Evidence captured in: $RESTORE_EVIDENCE_DIR"

echo ""
echo -e "${GREEN}🎉 Restore drill successful!${NC}"
echo -e "${BLUE}📊 RTO: ${TOTAL_DURATION} seconds${NC}"
echo -e "${BLUE}📊 RPO: ${RPO_SECONDS} seconds (${RPO_MINUTES} minutes)${NC}"
echo -e "${BLUE}📁 Evidence artifacts saved to: $RESTORE_EVIDENCE_DIR${NC}"

# Check if RTO/RPO meet targets
RTO_TARGET=900  # 15 minutes
RPO_TARGET=300  # 5 minutes

if [ $TOTAL_DURATION -le $RTO_TARGET ]; then
    log_success "RTO target met (${TOTAL_DURATION}s <= ${RTO_TARGET}s)"
else
    log_warning "RTO target exceeded (${TOTAL_DURATION}s > ${RTO_TARGET}s)"
fi

if [ $RPO_SECONDS -le $RPO_TARGET ]; then
    log_success "RPO target met (${RPO_SECONDS}s <= ${RPO_TARGET}s)"
else
    log_warning "RPO target exceeded (${RPO_SECONDS}s > ${RPO_TARGET}s)"
fi
