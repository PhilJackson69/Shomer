#!/bin/bash
#
# Quick hash verification test script
# 
# Tests that evidence integrity verification works correctly:
# 1. Upload a test file
# 2. Verify its hash
# 3. Check that verification passes
#
# Usage:
#   export TOKEN="your-jwt-token"
#   export API="http://localhost:8000"
#   ./verify-hash-test.sh

set -e

# Configuration
TOKEN="${TOKEN:-}"
API="${API:-http://localhost:8000}"

if [ -z "$TOKEN" ]; then
  echo "Error: TOKEN environment variable required"
  echo "Usage: export TOKEN=your-jwt-token && ./verify-hash-test.sh"
  exit 1
fi

echo "=== Evidence Hash Verification Test ==="
echo "API: $API"
echo ""

# Create a test file
TEST_FILE=$(mktemp)
echo "This is a test evidence file - $(date)" > "$TEST_FILE"
EXPECTED_HASH=$(sha256sum "$TEST_FILE" | awk '{print $1}')
echo "✓ Created test file: $TEST_FILE"
echo "  Expected SHA-256: $EXPECTED_HASH"
echo ""

# Upload evidence
echo "Uploading evidence..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" \
  -F "evidence_type=document" \
  -F "description=Hash verification test" \
  -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)")

EVIDENCE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')
STORED_HASH=$(echo "$UPLOAD_RESPONSE" | jq -r '.sha256_hash')

if [ "$EVIDENCE_ID" = "null" ] || [ -z "$EVIDENCE_ID" ]; then
  echo "✗ Upload failed"
  echo "$UPLOAD_RESPONSE" | jq .
  rm "$TEST_FILE"
  exit 1
fi

echo "✓ Evidence uploaded"
echo "  ID: $EVIDENCE_ID"
echo "  Stored SHA-256: $STORED_HASH"
echo ""

# Check hash matches
if [ "$EXPECTED_HASH" = "$STORED_HASH" ]; then
  echo "✓ Hash matches expected value"
else
  echo "✗ Hash mismatch!"
  echo "  Expected: $EXPECTED_HASH"
  echo "  Got:      $STORED_HASH"
  rm "$TEST_FILE"
  exit 1
fi
echo ""

# Verify evidence integrity
echo "Verifying evidence integrity..."
VERIFY_RESPONSE=$(curl -s -X POST "$API/api/v1/evidence/$EVIDENCE_ID/verify" \
  -H "Authorization: Bearer $TOKEN")

HASH_MATCH=$(echo "$VERIFY_RESPONSE" | jq -r '.hash_match')
CURRENT_HASH=$(echo "$VERIFY_RESPONSE" | jq -r '.current_hash')

if [ "$HASH_MATCH" = "true" ]; then
  echo "✓ Verification passed"
  echo "  Current hash: $CURRENT_HASH"
else
  echo "✗ Verification failed"
  echo "$VERIFY_RESPONSE" | jq .
  rm "$TEST_FILE"
  exit 1
fi
echo ""

# Export chain-of-custody
echo "Exporting chain-of-custody PDF..."
PDF_FILE=$(mktemp --suffix=.pdf)
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$PDF_FILE" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/$EVIDENCE_ID/export-chain-of-custody")

if [ "$HTTP_CODE" = "200" ]; then
  PDF_SIZE=$(stat -f%z "$PDF_FILE" 2>/dev/null || stat -c%s "$PDF_FILE" 2>/dev/null || echo "0")
  echo "✓ PDF exported successfully"
  echo "  Size: $PDF_SIZE bytes"
  echo "  File: $PDF_FILE"
else
  echo "✗ PDF export failed (HTTP $HTTP_CODE)"
  rm "$TEST_FILE" "$PDF_FILE"
  exit 1
fi
echo ""

# Cleanup
rm "$TEST_FILE"
# Keep PDF for manual inspection: rm "$PDF_FILE"

echo "=== All Tests Passed ==="
echo ""
echo "Evidence ID: $EVIDENCE_ID"
echo "PDF saved to: $PDF_FILE (review and delete manually)"

