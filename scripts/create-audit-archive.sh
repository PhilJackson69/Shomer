#!/bin/bash
# Create immutable audit archive of v1.0.0 release evidence
# Idempotent script - safe to run multiple times

set -euo pipefail

# Configuration
RELEASE_DIR="releases/v1.0.0"
ARCHIVE_DIR="releases/audit-archive"
TIMESTAMP=$(date -u +"%Y%m%d")
ARCHIVE_NAME="audit-archive-${TIMESTAMP}"
TARBALL="${ARCHIVE_NAME}.tar.gz"
SHA256_FILE="${ARCHIVE_NAME}.sha256"
SIG_FILE="${ARCHIVE_NAME}.sig"

echo "🔒 Creating immutable audit archive for Shomer v1.0.0"
echo "📅 Timestamp: ${TIMESTAMP}"
echo "📁 Source: ${RELEASE_DIR}"
echo "📦 Archive: ${ARCHIVE_DIR}/${TARBALL}"

# Create archive directory if it doesn't exist
mkdir -p "${ARCHIVE_DIR}"

# Check if release directory exists
if [ ! -d "${RELEASE_DIR}" ]; then
    echo "❌ Error: Release directory ${RELEASE_DIR} not found"
    exit 1
fi

# Create tarball (deterministic, reproducible)
echo "📦 Creating tarball..."
tar -czf "${ARCHIVE_DIR}/${TARBALL}" \
    --sort=name \
    --numeric-owner \
    --owner=0 \
    --group=0 \
    --mtime="2025-01-20 00:00:00" \
    -C "$(dirname "${RELEASE_DIR}")" \
    "$(basename "${RELEASE_DIR}")"

# Generate SHA256 checksum
echo "🔐 Generating SHA256 checksum..."
cd "${ARCHIVE_DIR}"
sha256sum "${TARBALL}" > "${SHA256_FILE}"
cd - > /dev/null

# Create deterministic pseudo-signature
echo "✍️  Creating deterministic signature..."
ARCHIVE_HASH=$(sha256sum "${ARCHIVE_DIR}/${TARBALL}" | cut -d' ' -f1)
MANIFEST_HASH=$(sha256sum "${RELEASE_DIR}/AUDIT_MANIFEST.sha256" | cut -d' ' -f1)
SIGNATURE_INPUT="${ARCHIVE_HASH}\n${MANIFEST_HASH}"
SIGNATURE=$(echo -e "${SIGNATURE_INPUT}" | sha256sum | cut -d' ' -f1)
echo "${SIGNATURE}" > "${ARCHIVE_DIR}/${SIG_FILE}"

# Display results
echo ""
echo "✅ Audit archive created successfully!"
echo "📦 Archive: ${ARCHIVE_DIR}/${TARBALL}"
echo "🔐 SHA256:  ${ARCHIVE_DIR}/${SHA256_FILE}"
echo "✍️  Signature: ${ARCHIVE_DIR}/${SIG_FILE}"
echo ""
echo "📊 Archive details:"
echo "   Size: $(du -h "${ARCHIVE_DIR}/${TARBALL}" | cut -f1)"
echo "   Archive SHA256: ${ARCHIVE_HASH}"
echo "   Manifest SHA256: ${MANIFEST_HASH}"
echo "   Signature: ${SIGNATURE}"
echo ""
echo "🔍 First 12 chars of archive SHA256: ${ARCHIVE_HASH:0:12}"
