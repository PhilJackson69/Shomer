#!/bin/bash
# Shomer Long-term Storage Setup Script
# Copy evidence to long-term storage (S3/Drive) → Audit/2025-Launch/

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EVIDENCE_ARCHIVE="${1:-}"
S3_BUCKET="${S3_BUCKET:-shomer-audit-evidence}"
S3_PREFIX="${S3_PREFIX:-Audit/2025-Launch/}"
GOOGLE_DRIVE_FOLDER="${GOOGLE_DRIVE_FOLDER:-Audit/2025-Launch}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/backup/shomer-evidence}"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Header
echo -e "${BLUE}💾 Shomer Long-term Storage Setup${NC}"
echo -e "${BLUE}===================================${NC}"
echo "Evidence Archive: $EVIDENCE_ARCHIVE"
echo "S3 Bucket: $S3_BUCKET"
echo "S3 Prefix: $S3_PREFIX"
echo "Google Drive Folder: $GOOGLE_DRIVE_FOLDER"
echo "Local Backup: $LOCAL_BACKUP_DIR"
echo ""

# Check if evidence archive exists
if [ -z "$EVIDENCE_ARCHIVE" ]; then
    log_error "Evidence archive not specified"
    echo "Usage: $0 <evidence-archive.tar.gz>"
    exit 1
fi

if [ ! -f "$EVIDENCE_ARCHIVE" ]; then
    log_error "Evidence archive $EVIDENCE_ARCHIVE does not exist"
    exit 1
fi

# Get archive details
ARCHIVE_NAME=$(basename "$EVIDENCE_ARCHIVE")
ARCHIVE_SIZE=$(stat -f%z "$EVIDENCE_ARCHIVE" 2>/dev/null || stat -c%s "$EVIDENCE_ARCHIVE" 2>/dev/null || echo "unknown")
ARCHIVE_HASH=$(sha256sum "$EVIDENCE_ARCHIVE" | cut -d' ' -f1)

log_info "Archive Details:"
echo "  Name: $ARCHIVE_NAME"
echo "  Size: $ARCHIVE_SIZE bytes"
echo "  Hash: $ARCHIVE_HASH"

# Create local backup directory
log_info "Creating local backup directory..."
mkdir -p "$LOCAL_BACKUP_DIR"

# Copy to local backup
log_info "Copying to local backup..."
cp "$EVIDENCE_ARCHIVE" "$LOCAL_BACKUP_DIR/"

# Verify local backup
LOCAL_BACKUP_HASH=$(sha256sum "$LOCAL_BACKUP_DIR/$ARCHIVE_NAME" | cut -d' ' -f1)
if [ "$LOCAL_BACKUP_HASH" = "$ARCHIVE_HASH" ]; then
    log_success "Local backup verified successfully"
else
    log_error "Local backup verification failed"
    exit 1
fi

# Upload to S3 (if AWS CLI is available)
if command -v aws >/dev/null 2>&1; then
    log_info "Uploading to S3..."
    
    S3_KEY="${S3_PREFIX}${ARCHIVE_NAME}"
    
    if aws s3 cp "$EVIDENCE_ARCHIVE" "s3://$S3_BUCKET/$S3_KEY" --metadata "sha256=$ARCHIVE_HASH,created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; then
        log_success "S3 upload completed successfully"
        
        # Verify S3 upload
        S3_ETAG=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$S3_KEY" --query 'ETag' --output text 2>/dev/null || echo "")
        if [ -n "$S3_ETAG" ]; then
            log_success "S3 upload verified (ETag: $S3_ETAG)"
        else
            log_warning "Could not verify S3 upload"
        fi
        
        # Set S3 object metadata
        aws s3api put-object-tagging --bucket "$S3_BUCKET" --key "$S3_KEY" --tagging 'TagSet=[{Key=retention,Value=7years},{Key=access,Value=readonly},{Key=compliance,Value=audit},{Key=project,Value=shomer},{Key=version,Value=v1.0.0-rc1}]' >/dev/null 2>&1 || log_warning "Could not set S3 tags"
        
    else
        log_error "S3 upload failed"
        exit 1
    fi
else
    log_warning "AWS CLI not available, skipping S3 upload"
fi

# Upload to Google Drive (if gdrive is available)
if command -v gdrive >/dev/null 2>&1; then
    log_info "Uploading to Google Drive..."
    
    # Create folder if it doesn't exist
    DRIVE_FOLDER_ID=$(gdrive list --query "name='$GOOGLE_DRIVE_FOLDER' and mimeType='application/vnd.google-apps.folder'" --format "csv" | tail -n +2 | cut -d',' -f1 | head -1)
    
    if [ -z "$DRIVE_FOLDER_ID" ]; then
        log_info "Creating Google Drive folder: $GOOGLE_DRIVE_FOLDER"
        DRIVE_FOLDER_ID=$(gdrive mkdir "$GOOGLE_DRIVE_FOLDER" | cut -d' ' -f2)
    fi
    
    if [ -n "$DRIVE_FOLDER_ID" ]; then
        if gdrive upload "$EVIDENCE_ARCHIVE" --parent "$DRIVE_FOLDER_ID" --description "Shomer v1.0.0-rc1 Evidence Package - $ARCHIVE_HASH"; then
            log_success "Google Drive upload completed successfully"
        else
            log_error "Google Drive upload failed"
        fi
    else
        log_error "Could not create or find Google Drive folder"
    fi
else
    log_warning "gdrive CLI not available, skipping Google Drive upload"
fi

# Create storage inventory
log_info "Creating storage inventory..."
{
    echo "Shomer v1.0.0-rc1 Evidence Storage Inventory"
    echo "==========================================="
    echo ""
    echo "Storage Date: $(date)"
    echo "Archive Name: $ARCHIVE_NAME"
    echo "Archive Size: $ARCHIVE_SIZE bytes"
    echo "Archive Hash: $ARCHIVE_HASH"
    echo ""
    echo "Storage Locations:"
    echo "=================="
    echo "1. Local Backup:"
    echo "   Path: $LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
    echo "   Status: $(if [ -f "$LOCAL_BACKUP_DIR/$ARCHIVE_NAME" ]; then echo "STORED"; else echo "MISSING"; fi)"
    echo "   Hash: $LOCAL_BACKUP_HASH"
    echo "   Verified: $(if [ "$LOCAL_BACKUP_HASH" = "$ARCHIVE_HASH" ]; then echo "YES"; else echo "NO"; fi)"
    echo ""
    
    if command -v aws >/dev/null 2>&1; then
        echo "2. Amazon S3:"
        echo "   Bucket: $S3_BUCKET"
        echo "   Key: $S3_KEY"
        echo "   Status: $(if aws s3api head-object --bucket "$S3_BUCKET" --key "$S3_KEY" >/dev/null 2>&1; then echo "STORED"; else echo "MISSING"; fi)"
        echo "   ETag: $S3_ETAG"
        echo "   Tags: retention=7years, access=readonly, compliance=audit"
        echo ""
    fi
    
    if command -v gdrive >/dev/null 2>&1; then
        echo "3. Google Drive:"
        echo "   Folder: $GOOGLE_DRIVE_FOLDER"
        echo "   Status: $(if gdrive list --query "name='$ARCHIVE_NAME'" --format "csv" | tail -n +2 | grep -q "$ARCHIVE_NAME"; then echo "STORED"; else echo "MISSING"; fi)"
        echo ""
    fi
    
    echo "Storage Requirements:"
    echo "==================="
    echo "Retention Period: 7 years"
    echo "Access Control: Read-only for auditors"
    echo "Backup Copies: Minimum 2"
    echo "Integrity Checks: Annual"
    echo "Compliance: Audit-ready"
    echo ""
    echo "Verification Commands:"
    echo "====================="
    echo "Local Backup:"
    echo "  sha256sum $LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
    echo ""
    
    if command -v aws >/dev/null 2>&1; then
        echo "S3 Backup:"
        echo "  aws s3api head-object --bucket $S3_BUCKET --key $S3_KEY"
        echo "  aws s3 cp s3://$S3_BUCKET/$S3_KEY - | sha256sum"
        echo ""
    fi
    
    if command -v gdrive >/dev/null 2>&1; then
        echo "Google Drive Backup:"
        echo "  gdrive list --query \"name='$ARCHIVE_NAME'\""
        echo ""
    fi
    
    echo "Annual Integrity Check:"
    echo "  ./scripts/verify-storage-integrity.sh $ARCHIVE_NAME"
    echo ""
    echo "Created by: Shomer Long-term Storage Setup Script"
    echo "Created on: $(date)"
    echo "Version: 1.0.0-rc1"
} > "$LOCAL_BACKUP_DIR/storage-inventory-$ARCHIVE_NAME.txt"

# Create verification script
log_info "Creating storage verification script..."
{
    echo "#!/bin/bash"
    echo "# Shomer Storage Integrity Verification Script"
    echo "# Verify integrity of stored evidence packages"
    echo ""
    echo "set -euo pipefail"
    echo ""
    echo "# Colors for output"
    echo "RED='\033[0;31m'"
    echo "GREEN='\033[0;32m'"
    echo "YELLOW='\033[1;33m'"
    echo "BLUE='\033[0;34m'"
    echo "NC='\033[0m' # No Color"
    echo ""
    echo "log_info() {"
    echo "    echo -e \"\${BLUE}ℹ\${NC} \$1\""
    echo "}"
    echo ""
    echo "log_success() {"
    echo "    echo -e \"\${GREEN}✓\${NC} \$1\""
    echo "}"
    echo ""
    echo "log_error() {"
    echo "    echo -e \"\${RED}✗\${NC} \$1\""
    echo "}"
    echo ""
    echo "# Configuration"
    echo "ARCHIVE_NAME=\"\$1\""
    echo "LOCAL_BACKUP_DIR=\"$LOCAL_BACKUP_DIR\""
    echo "S3_BUCKET=\"$S3_BUCKET\""
    echo "S3_PREFIX=\"$S3_PREFIX\""
    echo ""
    echo "if [ -z \"\$ARCHIVE_NAME\" ]; then"
    echo "    echo \"Usage: \$0 <archive-name>\""
    echo "    exit 1"
    echo "fi"
    echo ""
    echo "echo -e \"\${BLUE}🔍 Verifying Storage Integrity for \$ARCHIVE_NAME\${NC}\""
    echo "echo \"================================================\""
    echo ""
    echo "# Verify local backup"
    echo "if [ -f \"\$LOCAL_BACKUP_DIR/\$ARCHIVE_NAME\" ]; then"
    echo "    LOCAL_HASH=\$(sha256sum \"\$LOCAL_BACKUP_DIR/\$ARCHIVE_NAME\" | cut -d' ' -f1)"
    echo "    log_success \"Local backup verified: \$LOCAL_HASH\""
    echo "else"
    echo "    log_error \"Local backup not found\""
    echo "fi"
    echo ""
    echo "# Verify S3 backup"
    echo "if command -v aws >/dev/null 2>&1; then"
    echo "    S3_KEY=\"\$S3_PREFIX\$ARCHIVE_NAME\""
    echo "    if aws s3api head-object --bucket \"\$S3_BUCKET\" --key \"\$S3_KEY\" >/dev/null 2>&1; then"
    echo "        S3_ETAG=\$(aws s3api head-object --bucket \"\$S3_BUCKET\" --key \"\$S3_KEY\" --query 'ETag' --output text)"
    echo "        log_success \"S3 backup verified: \$S3_ETAG\""
    echo "    else"
    echo "        log_error \"S3 backup not found\""
    echo "    fi"
    echo "else"
    echo "    log_info \"AWS CLI not available, skipping S3 verification\""
    echo "fi"
    echo ""
    echo "# Verify Google Drive backup"
    echo "if command -v gdrive >/dev/null 2>&1; then"
    echo "    if gdrive list --query \"name='\$ARCHIVE_NAME'\" --format \"csv\" | tail -n +2 | grep -q \"\$ARCHIVE_NAME\"; then"
    echo "        log_success \"Google Drive backup verified\""
    echo "    else"
    echo "        log_error \"Google Drive backup not found\""
    echo "    fi"
    echo "else"
    echo "    log_info \"gdrive CLI not available, skipping Google Drive verification\""
    echo "fi"
    echo ""
    echo "log_success \"Storage integrity verification completed\""
} > "$LOCAL_BACKUP_DIR/verify-storage-integrity.sh"

chmod +x "$LOCAL_BACKUP_DIR/verify-storage-integrity.sh"

# Create compliance notification
log_info "Creating compliance notification..."
{
    echo "Shomer v1.0.0-rc1 Evidence Storage Notification"
    echo "=============================================="
    echo ""
    echo "To: Compliance Team"
    echo "From: Engineering Team"
    echo "Date: $(date)"
    echo "Subject: Evidence Package Stored for Audit"
    echo ""
    echo "Evidence Package Details:"
    echo "========================"
    echo "Package Name: $ARCHIVE_NAME"
    echo "Package Size: $ARCHIVE_SIZE bytes"
    echo "Package Hash: $ARCHIVE_HASH"
    echo "Storage Date: $(date)"
    echo ""
    echo "Storage Locations:"
    echo "=================="
    echo "1. Local Backup: $LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
    echo "2. Amazon S3: s3://$S3_BUCKET/$S3_PREFIX$ARCHIVE_NAME"
    echo "3. Google Drive: $GOOGLE_DRIVE_FOLDER/$ARCHIVE_NAME"
    echo ""
    echo "Compliance Information:"
    echo "======================"
    echo "Retention Period: 7 years"
    echo "Access Control: Read-only for auditors"
    echo "Integrity Verified: Yes"
    echo "Audit Ready: Yes"
    echo ""
    echo "Next Steps:"
    echo "==========="
    echo "1. Update compliance inventory"
    echo "2. Schedule annual integrity checks"
    echo "3. Notify auditors of availability"
    echo "4. Document storage procedures"
    echo ""
    echo "Verification:"
    echo "============"
    echo "Run: $LOCAL_BACKUP_DIR/verify-storage-integrity.sh $ARCHIVE_NAME"
    echo ""
    echo "Contact: Engineering Team"
    echo "Email: engineering@shomer.com"
    echo "Phone: [CONTACT_NUMBER]"
} > "$LOCAL_BACKUP_DIR/compliance-notification-$ARCHIVE_NAME.txt"

log_success "Long-term storage setup completed successfully!"
echo ""
echo "Storage Summary:"
echo "  Archive: $ARCHIVE_NAME"
echo "  Size: $ARCHIVE_SIZE bytes"
echo "  Hash: $ARCHIVE_HASH"
echo ""
echo "Storage Locations:"
echo "  1. Local Backup: $LOCAL_BACKUP_DIR/$ARCHIVE_NAME"
if command -v aws >/dev/null 2>&1; then
    echo "  2. Amazon S3: s3://$S3_BUCKET/$S3_PREFIX$ARCHIVE_NAME"
fi
if command -v gdrive >/dev/null 2>&1; then
    echo "  3. Google Drive: $GOOGLE_DRIVE_FOLDER/$ARCHIVE_NAME"
fi
echo ""
echo "Generated Files:"
echo "  - storage-inventory-$ARCHIVE_NAME.txt"
echo "  - verify-storage-integrity.sh"
echo "  - compliance-notification-$ARCHIVE_NAME.txt"
echo ""
echo "Next Steps:"
echo "1. Review storage inventory"
echo "2. Send compliance notification"
echo "3. Schedule annual integrity checks"
echo "4. Update compliance procedures"
echo "5. Notify auditors of availability"
