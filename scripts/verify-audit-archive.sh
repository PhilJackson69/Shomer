#!/bin/bash
# Verify audit archive integrity
# Usage: ./scripts/verify-audit-archive.sh [YYYYMMDD]
# If no date provided, uses most recent archive

set -euo pipefail

# Get date parameter or find most recent archive
if [ $# -eq 1 ]; then
    TIMESTAMP="$1"
else
    # Find most recent archive
    TIMESTAMP=$(ls releases/audit-archive/audit-archive-*.tar.gz 2>/dev/null | \
                sed 's/.*audit-archive-\([0-9]\{8\}\).*/\1/' | \
                sort -r | head -1)
    
    if [ -z "${TIMESTAMP}" ]; then
        echo "❌ Error: No audit archive found in releases/audit-archive/"
        echo "Usage: $0 [YYYYMMDD]"
        exit 1
    fi
fi

ARCHIVE_NAME="audit-archive-${TIMESTAMP}"
TARBALL="releases/audit-archive/${ARCHIVE_NAME}.tar.gz"
SHA256_FILE="releases/audit-archive/${ARCHIVE_NAME}.sha256"
SIG_FILE="releases/audit-archive/${ARCHIVE_NAME}.sig"

echo "🔍 Verifying audit archive: ${ARCHIVE_NAME}"
echo "📅 Date: ${TIMESTAMP}"

# Check if all required files exist
for file in "${TARBALL}" "${SHA256_FILE}" "${SIG_FILE}"; do
    if [ ! -f "${file}" ]; then
        echo "❌ Error: Required file not found: ${file}"
        exit 1
    fi
done

# Verify SHA256 checksum
echo "🔐 Verifying SHA256 checksum..."
EXPECTED_HASH=$(cat "${SHA256_FILE}" | cut -d' ' -f1)
ACTUAL_HASH=$(sha256sum "${TARBALL}" | cut -d' ' -f1)

if [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
    echo "❌ SHA256 verification FAILED!"
    echo "   Expected: ${EXPECTED_HASH}"
    echo "   Actual:   ${ACTUAL_HASH}"
    exit 1
fi

echo "✅ SHA256 verification passed"

# Verify signature
echo "✍️  Verifying signature..."
ARCHIVE_HASH=$(sha256sum "${TARBALL}" | cut -d' ' -f1)
MANIFEST_HASH=$(sha256sum "releases/v1.0.0/AUDIT_MANIFEST.sha256" | cut -d' ' -f1)
EXPECTED_SIG=$(echo -e "${ARCHIVE_HASH}\n${MANIFEST_HASH}" | sha256sum | cut -d' ' -f1)
ACTUAL_SIG=$(cat "${SIG_FILE}")

if [ "${EXPECTED_SIG}" != "${ACTUAL_SIG}" ]; then
    echo "❌ Signature verification FAILED!"
    echo "   Expected: ${EXPECTED_SIG}"
    echo "   Actual:   ${ACTUAL_SIG}"
    exit 1
fi

echo "✅ Signature verification passed"

# Display verification results
echo ""
echo "🎉 Audit archive verification SUCCESSFUL!"
echo "📦 Archive: ${TARBALL}"
echo "🔐 SHA256: ${ACTUAL_HASH}"
echo "✍️  Signature: ${ACTUAL_SIG}"
echo "📊 Size: $(du -h "${TARBALL}" | cut -f1)"
echo ""
echo "🔍 First 12 chars of archive SHA256: ${ACTUAL_HASH:0:12}"
