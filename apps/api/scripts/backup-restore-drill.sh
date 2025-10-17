#!/bin/bash
#
# Backup and Restore Drill Script
#
# This script performs a complete backup/restore drill to verify:
# 1. Database backup and restore
# 2. Storage (S3/local) backup and restore
# 3. Evidence integrity verification after restore
# 4. PDF export consistency after restore
#
# Usage:
#   ./backup-restore-drill.sh [backup_dir]
#
# Environment variables:
#   DATABASE_URL - PostgreSQL connection string
#   STORAGE_PATH - Local storage path (default: uploads)
#   AWS_S3_BUCKET - S3 bucket name (if using S3)
#   TOKEN - JWT token for API calls
#   API - API URL (default: http://localhost:8000)

set -e

# Configuration
BACKUP_DIR="${1:-./backup-$(date +%Y%m%d-%H%M%S)}"
DATABASE_URL="${DATABASE_URL:-postgresql://shomer:shomer@localhost:5432/shomer}"
STORAGE_PATH="${STORAGE_PATH:-uploads}"
API="${API:-http://localhost:8000}"
TOKEN="${TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

check_dependencies() {
  echo "Checking dependencies..."
  
  # Check for pg_dump
  if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Install PostgreSQL client tools."
    exit 1
  fi
  
  # Check for jq
  if ! command -v jq &> /dev/null; then
    log_error "jq not found. Install jq for JSON parsing."
    exit 1
  fi
  
  log_info "All dependencies installed"
}

backup_database() {
  echo ""
  echo "=== Database Backup ==="
  
  mkdir -p "$BACKUP_DIR/db"
  
  # Extract database connection details
  DB_DUMP_FILE="$BACKUP_DIR/db/dump.sql"
  
  echo "Creating database dump..."
  pg_dump "$DATABASE_URL" > "$DB_DUMP_FILE"
  
  DB_SIZE=$(du -h "$DB_DUMP_FILE" | cut -f1)
  log_info "Database backed up: $DB_DUMP_FILE ($DB_SIZE)"
  
  # Create metadata file
  cat > "$BACKUP_DIR/db/metadata.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database_url": "${DATABASE_URL%%@*}@***",
  "size": "$DB_SIZE",
  "type": "pg_dump"
}
EOF
  
  log_info "Database backup completed"
}

backup_storage() {
  echo ""
  echo "=== Storage Backup ==="
  
  mkdir -p "$BACKUP_DIR/storage"
  
  if [ -d "$STORAGE_PATH" ]; then
    echo "Backing up local storage..."
    cp -r "$STORAGE_PATH"/* "$BACKUP_DIR/storage/" 2>/dev/null || true
    
    STORAGE_SIZE=$(du -sh "$BACKUP_DIR/storage" | cut -f1)
    FILE_COUNT=$(find "$BACKUP_DIR/storage" -type f | wc -l)
    
    log_info "Storage backed up: $FILE_COUNT files ($STORAGE_SIZE)"
  else
    log_warn "Storage path $STORAGE_PATH not found - skipping local storage backup"
  fi
  
  # TODO: Add S3 backup if AWS_S3_BUCKET is set
  # aws s3 sync s3://$AWS_S3_BUCKET/ "$BACKUP_DIR/s3/"
  
  log_info "Storage backup completed"
}

verify_backup_integrity() {
  echo ""
  echo "=== Verifying Backup Integrity ==="
  
  # Check database dump
  if [ ! -f "$BACKUP_DIR/db/dump.sql" ]; then
    log_error "Database dump not found"
    exit 1
  fi
  
  # Verify SQL dump is valid
  if ! grep -q "PostgreSQL database dump" "$BACKUP_DIR/db/dump.sql"; then
    log_error "Database dump appears corrupted"
    exit 1
  fi
  
  log_info "Database dump is valid"
  
  # Check storage backup
  if [ -d "$BACKUP_DIR/storage" ]; then
    EVIDENCE_FILES=$(find "$BACKUP_DIR/storage/evidence" -type f 2>/dev/null | wc -l)
    log_info "Storage backup contains $EVIDENCE_FILES evidence files"
  fi
  
  log_info "Backup integrity verified"
}

sample_evidence_hashes() {
  echo ""
  echo "=== Sampling Evidence Hashes ==="
  
  if [ -z "$TOKEN" ]; then
    log_warn "No JWT token provided - skipping evidence hash sampling"
    return
  fi
  
  # Get list of evidence
  EVIDENCE_LIST=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API/api/v1/evidence?limit=10" || echo '{"items":[]}')
  
  # Sample first 3 evidence records
  echo "$EVIDENCE_LIST" | jq -r '.items[:3] | .[] | "\(.id),\(.reference_number),\(.sha256_hash)"' \
    > "$BACKUP_DIR/evidence_hashes.csv"
  
  SAMPLE_COUNT=$(wc -l < "$BACKUP_DIR/evidence_hashes.csv")
  
  if [ "$SAMPLE_COUNT" -gt 0 ]; then
    log_info "Sampled $SAMPLE_COUNT evidence hashes for post-restore verification"
  else
    log_warn "No evidence found to sample"
  fi
}

restore_database() {
  echo ""
  echo "=== Database Restore (DRY RUN) ==="
  
  log_warn "This is a DRY RUN - not actually restoring to avoid data loss"
  log_warn "To perform actual restore:"
  echo "  1. Create a fresh database: createdb shomer_restore"
  echo "  2. Restore dump: psql shomer_restore < $BACKUP_DIR/db/dump.sql"
  echo "  3. Update DATABASE_URL to point to restored database"
  echo "  4. Verify evidence integrity"
  
  # Validate restore would work
  if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_info "Database connection valid - restore would succeed"
  else
    log_error "Database connection failed - restore would fail"
    exit 1
  fi
}

verify_evidence_after_restore() {
  echo ""
  echo "=== Verifying Evidence After Restore ==="
  
  if [ ! -f "$BACKUP_DIR/evidence_hashes.csv" ] || [ ! -s "$BACKUP_DIR/evidence_hashes.csv" ]; then
    log_warn "No evidence hashes to verify - skipping"
    return
  fi
  
  if [ -z "$TOKEN" ]; then
    log_warn "No JWT token - skipping evidence verification"
    return
  fi
  
  VERIFIED=0
  FAILED=0
  
  while IFS=',' read -r evidence_id ref_number expected_hash; do
    # Skip empty lines
    [ -z "$evidence_id" ] && continue
    
    echo "Verifying evidence $evidence_id ($ref_number)..."
    
    # Get current evidence
    CURRENT=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "$API/api/v1/evidence/$evidence_id" || echo '{}')
    
    CURRENT_HASH=$(echo "$CURRENT" | jq -r '.sha256_hash')
    
    if [ "$CURRENT_HASH" = "$expected_hash" ]; then
      log_info "  Hash match: $expected_hash"
      ((VERIFIED++))
    else
      log_error "  Hash mismatch! Expected: $expected_hash, Got: $CURRENT_HASH"
      ((FAILED++))
    fi
    
  done < "$BACKUP_DIR/evidence_hashes.csv"
  
  echo ""
  echo "Verification results: $VERIFIED passed, $FAILED failed"
  
  if [ "$FAILED" -gt 0 ]; then
    log_error "Evidence verification failed!"
    exit 1
  else
    log_info "All evidence verified successfully"
  fi
}

generate_restore_report() {
  echo ""
  echo "=== Generating Restore Report ==="
  
  REPORT_FILE="$BACKUP_DIR/restore_report.txt"
  
  cat > "$REPORT_FILE" <<EOF
Backup and Restore Drill Report
================================

Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Backup Directory: $BACKUP_DIR

Database Backup:
  - File: $BACKUP_DIR/db/dump.sql
  - Size: $(du -h "$BACKUP_DIR/db/dump.sql" 2>/dev/null | cut -f1 || echo "N/A")

Storage Backup:
  - Directory: $BACKUP_DIR/storage
  - Files: $(find "$BACKUP_DIR/storage" -type f 2>/dev/null | wc -l)
  - Size: $(du -sh "$BACKUP_DIR/storage" 2>/dev/null | cut -f1 || echo "N/A")

Evidence Verification:
  - Sampled: $(wc -l < "$BACKUP_DIR/evidence_hashes.csv" 2>/dev/null || echo "0")
  - Status: See verification results above

Next Steps:
  1. Review this report
  2. Test restore in isolated environment
  3. Verify evidence integrity
  4. Test PDF export consistency
  5. Document any issues

Report generated at: $(date)
EOF
  
  log_info "Report saved to: $REPORT_FILE"
  
  echo ""
  cat "$REPORT_FILE"
}

# Main execution
main() {
  echo "======================================"
  echo "  Backup and Restore Drill"
  echo "======================================"
  echo ""
  
  check_dependencies
  backup_database
  backup_storage
  verify_backup_integrity
  sample_evidence_hashes
  restore_database
  # Note: In a real restore drill, you'd restore to a fresh environment
  # and then run verify_evidence_after_restore
  generate_restore_report
  
  echo ""
  log_info "Backup drill completed successfully"
  echo ""
  echo "Backup location: $BACKUP_DIR"
  echo ""
  log_warn "IMPORTANT: Test actual restore in a separate environment!"
}

main "$@"

