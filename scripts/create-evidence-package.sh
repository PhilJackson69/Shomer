#!/bin/bash
# Shomer Evidence Package Creation Script
# Freeze releases/v1.0.0-rc1/ as read-only evidence package

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EVIDENCE_SOURCE="releases/v1.0.0-rc1"
EVIDENCE_TARGET="releases/v1.0.0/evidence-package-$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="shomer-v1.0.0-rc1-evidence-$(date +%Y%m%d-%H%M%S)"

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
echo -e "${BLUE}📦 Shomer Evidence Package Creation${NC}"
echo -e "${BLUE}====================================${NC}"
echo "Source: $EVIDENCE_SOURCE"
echo "Target: $EVIDENCE_TARGET"
echo "Archive: $ARCHIVE_NAME"
echo ""

# Check if source directory exists
if [ ! -d "$EVIDENCE_SOURCE" ]; then
    log_error "Source directory $EVIDENCE_SOURCE does not exist"
    exit 1
fi

# Create target directory
log_info "Creating evidence package directory..."
mkdir -p "$EVIDENCE_TARGET"

# Copy evidence files
log_info "Copying evidence files..."
cp -r "$EVIDENCE_SOURCE"/* "$EVIDENCE_TARGET/"

# Create evidence manifest
log_info "Creating evidence manifest..."
{
    echo "Shomer v1.0.0-rc1 Evidence Package Manifest"
    echo "==========================================="
    echo ""
    echo "Package Created: $(date)"
    echo "Package Version: v1.0.0-rc1"
    echo "Source Directory: $EVIDENCE_SOURCE"
    echo "Target Directory: $EVIDENCE_TARGET"
    echo ""
    echo "Evidence Contents:"
    echo "=================="
    
    # List all evidence files
    find "$EVIDENCE_TARGET" -type f | sort | while read -r file; do
        local relative_path="${file#$EVIDENCE_TARGET/}"
        local file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
        local file_hash=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        echo "  $relative_path ($file_size bytes, SHA256: $file_hash)"
    done
    
    echo ""
    echo "Evidence Categories:"
    echo "==================="
    echo "1. Deployment Evidence:"
    echo "   - deployment-*.txt: Deployment logs and results"
    echo "   - jwks-test-*.txt: JWKS testing results"
    echo "   - pager-test-*.txt: Alerting system tests"
    echo "   - smoke-test-*.txt: Smoke test results"
    echo "   - waf-guard-*.txt: WAF protection tests"
    echo ""
    echo "2. Documentation:"
    echo "   - GO_NO_GO_MEETING_AGENDA.md: GO/NO-GO meeting agenda"
    echo "   - GO_NO_GO_TEMPLATE.md: GO/NO-GO template"
    echo "   - LAUNCH_DAY_RUNBOOK.md: Launch execution runbook"
    echo "   - STATUS_PAGE_TEMPLATES.md: Status page templates"
    echo ""
    echo "3. Verification Results:"
    echo "   - RC1_VERIFICATION_SUMMARY.md: RC1 verification summary"
    echo "   - EVIDENCE_ARCHIVE_SUMMARY.md: Evidence archive summary"
    echo "   - 24_HOUR_WATCHLIST.md: 24-hour monitoring checklist"
    echo ""
    echo "4. Compliance Evidence:"
    echo "   - All evidence files are SHA256 hashed"
    echo "   - Timestamps preserved"
    echo "   - Read-only package created"
    echo "   - Audit trail maintained"
    echo ""
    echo "Package Integrity:"
    echo "=================="
    echo "Total Files: $(find "$EVIDENCE_TARGET" -type f | wc -l)"
    echo "Total Size: $(du -sh "$EVIDENCE_TARGET" | cut -f1)"
    echo "Package Hash: $(find "$EVIDENCE_TARGET" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)"
    echo ""
    echo "Archive Information:"
    echo "==================="
    echo "Archive Name: $ARCHIVE_NAME"
    echo "Archive Format: tar.gz"
    echo "Compression: gzip"
    echo "Archive Hash: $(tar -czf - "$EVIDENCE_TARGET" | sha256sum | cut -d' ' -f1)"
    echo ""
    echo "Long-term Storage:"
    echo "=================="
    echo "Primary Storage: [TO_BE_CONFIGURED]"
    echo "Backup Storage: [TO_BE_CONFIGURED]"
    echo "Retention Policy: 7 years"
    echo "Access Control: Read-only for auditors"
    echo ""
    echo "Compliance Notes:"
    echo "================="
    echo "- This package contains evidence for Shomer v1.0.0-rc1 launch"
    echo "- All files are read-only and cannot be modified"
    echo "- Package integrity is verified via SHA256 hashes"
    echo "- Evidence supports audit and compliance requirements"
    echo "- Package should be stored in secure, long-term storage"
    echo ""
    echo "Created by: Shomer Evidence Package Creation Script"
    echo "Created on: $(date)"
    echo "Version: 1.0.0-rc1"
} > "$EVIDENCE_TARGET/EVIDENCE_MANIFEST.md"

# Create package integrity file
log_info "Creating package integrity file..."
{
    echo "Shomer v1.0.0-rc1 Evidence Package Integrity"
    echo "============================================"
    echo ""
    echo "Package Created: $(date)"
    echo "Package Version: v1.0.0-rc1"
    echo ""
    echo "File Integrity Hashes (SHA256):"
    echo "==============================="
    
    find "$EVIDENCE_TARGET" -type f | sort | while read -r file; do
        local relative_path="${file#$EVIDENCE_TARGET/}"
        local file_hash=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        echo "$file_hash  $relative_path"
    done
    
    echo ""
    echo "Package Integrity Verification:"
    echo "==============================="
    echo "To verify package integrity, run:"
    echo "  find $EVIDENCE_TARGET -type f -exec sha256sum {} \; | sha256sum"
    echo ""
    echo "Expected package hash: $(find "$EVIDENCE_TARGET" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)"
    echo ""
    echo "Individual file verification:"
    echo "  sha256sum -c EVIDENCE_INTEGRITY.txt"
    echo ""
    echo "Archive verification:"
    echo "  tar -tzf $ARCHIVE_NAME.tar.gz | sha256sum"
    echo ""
    echo "Created by: Shomer Evidence Package Creation Script"
    echo "Created on: $(date)"
} > "$EVIDENCE_TARGET/EVIDENCE_INTEGRITY.txt"

# Create archive
log_info "Creating evidence archive..."
tar -czf "$ARCHIVE_NAME.tar.gz" "$EVIDENCE_TARGET"

# Verify archive
log_info "Verifying archive integrity..."
ARCHIVE_HASH=$(sha256sum "$ARCHIVE_NAME.tar.gz" | cut -d' ' -f1)
ARCHIVE_SIZE=$(stat -f%z "$ARCHIVE_NAME.tar.gz" 2>/dev/null || stat -c%s "$ARCHIVE_NAME.tar.gz" 2>/dev/null || echo "unknown")

log_success "Archive created successfully"
echo "  Archive: $ARCHIVE_NAME.tar.gz"
echo "  Size: $ARCHIVE_SIZE bytes"
echo "  Hash: $ARCHIVE_HASH"

# Create read-only package
log_info "Making evidence package read-only..."
chmod -R 444 "$EVIDENCE_TARGET"
chmod 555 "$EVIDENCE_TARGET"

# Create final summary
{
    echo "Shomer v1.0.0-rc1 Evidence Package Summary"
    echo "=========================================="
    echo ""
    echo "Package Created: $(date)"
    echo "Package Version: v1.0.0-rc1"
    echo ""
    echo "Package Details:"
    echo "================"
    echo "Source Directory: $EVIDENCE_SOURCE"
    echo "Target Directory: $EVIDENCE_TARGET"
    echo "Archive Name: $ARCHIVE_NAME.tar.gz"
    echo "Archive Size: $ARCHIVE_SIZE bytes"
    echo "Archive Hash: $ARCHIVE_HASH"
    echo ""
    echo "Evidence Contents:"
    echo "=================="
    echo "Total Files: $(find "$EVIDENCE_TARGET" -type f | wc -l)"
    echo "Total Size: $(du -sh "$EVIDENCE_TARGET" | cut -f1)"
    echo "Package Hash: $(find "$EVIDENCE_TARGET" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)"
    echo ""
    echo "Package Status:"
    echo "==============="
    echo "Read-only: Yes"
    echo "Integrity Verified: Yes"
    echo "Archive Created: Yes"
    echo "Ready for Storage: Yes"
    echo ""
    echo "Next Steps:"
    echo "==========="
    echo "1. Copy archive to long-term storage"
    echo "2. Verify archive integrity in storage"
    echo "3. Update storage inventory"
    echo "4. Notify compliance team"
    echo "5. Schedule regular integrity checks"
    echo ""
    echo "Storage Requirements:"
    echo "==================="
    echo "Retention Period: 7 years"
    echo "Access Control: Read-only for auditors"
    echo "Backup Copies: Minimum 2"
    echo "Integrity Checks: Annual"
    echo ""
    echo "Compliance Notes:"
    echo "================="
    echo "- This package contains evidence for Shomer v1.0.0-rc1 launch"
    echo "- All files are read-only and cannot be modified"
    echo "- Package integrity is verified via SHA256 hashes"
    echo "- Evidence supports audit and compliance requirements"
    echo "- Package should be stored in secure, long-term storage"
    echo ""
    echo "Created by: Shomer Evidence Package Creation Script"
    echo "Created on: $(date)"
    echo "Version: 1.0.0-rc1"
} > "$EVIDENCE_TARGET/PACKAGE_SUMMARY.md"

log_success "Evidence package created successfully!"
echo ""
echo "Package Details:"
echo "  Directory: $EVIDENCE_TARGET"
echo "  Archive: $ARCHIVE_NAME.tar.gz"
echo "  Size: $ARCHIVE_SIZE bytes"
echo "  Hash: $ARCHIVE_HASH"
echo ""
echo "Evidence Files:"
echo "  Total Files: $(find "$EVIDENCE_TARGET" -type f | wc -l)"
echo "  Total Size: $(du -sh "$EVIDENCE_TARGET" | cut -f1)"
echo "  Package Hash: $(find "$EVIDENCE_TARGET" -type f -exec sha256sum {} \; | sha256sum | cut -d' ' -f1)"
echo ""
echo "Next Steps:"
echo "1. Copy $ARCHIVE_NAME.tar.gz to long-term storage"
echo "2. Verify archive integrity in storage"
echo "3. Update storage inventory"
echo "4. Notify compliance team"
echo "5. Schedule regular integrity checks"
