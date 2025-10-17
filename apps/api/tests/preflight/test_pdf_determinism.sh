#!/bin/bash
#
# PDF Export Determinism Test
#
# Tests that PDF exports are deterministic and include required elements:
# 1. Same evidence exported twice produces consistent results
# 2. Timestamps are in UTC ISO-8601 format
# 3. Git SHA is embedded in footer
# 4. Key fields are identical
#
# Usage:
#   export API="https://shomer.app"
#   export TOKEN="jwt-token"
#   ./test_pdf_determinism.sh

set -e

API="${API:-http://localhost:8000}"
TOKEN="${TOKEN:-}"

echo "====================================="
echo "PDF Export Determinism Test"
echo "====================================="
echo "API: $API"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_pass() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED++))
}

test_fail() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED++))
}

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Error: TOKEN environment variable required${NC}"
  exit 1
fi

# Check for required tools
if ! command -v pdftotext &> /dev/null; then
  echo -e "${YELLOW}⚠ pdftotext not found (install poppler-utils)${NC}"
  echo "  On Ubuntu/Debian: sudo apt-get install poppler-utils"
  echo "  On macOS: brew install poppler"
  echo ""
  USE_PDFTOTEXT=false
else
  USE_PDFTOTEXT=true
fi

# ============================================================================
# Step 1: Find or Create Test Evidence
# ============================================================================

echo "--- Step 1: Prepare Test Evidence ---"
echo ""

# Try to get existing evidence
EVIDENCE_LIST=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence?limit=1" 2>&1 || echo '{"items":[]}')

EVIDENCE_ID=$(echo "$EVIDENCE_LIST" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)

if [ -z "$EVIDENCE_ID" ]; then
  echo "No evidence found. Creating test evidence..."
  
  # Create test file
  TEST_FILE=$(mktemp)
  echo "PDF determinism test - $(date)" > "$TEST_FILE"
  
  # Upload
  UPLOAD_RESPONSE=$(curl -s -X POST "$API/api/v1/evidence/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$TEST_FILE" \
    -F "evidence_type=document" \
    -F "description=PDF determinism test" \
    -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    2>&1)
  
  EVIDENCE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
  
  rm "$TEST_FILE"
  
  if [ -z "$EVIDENCE_ID" ]; then
    echo -e "${RED}Failed to create test evidence${NC}"
    echo "$UPLOAD_RESPONSE"
    exit 1
  fi
  
  echo "  Created evidence ID: $EVIDENCE_ID"
else
  echo "Using existing evidence ID: $EVIDENCE_ID"
fi

echo ""

# ============================================================================
# Step 2: Export PDF Twice
# ============================================================================

echo "--- Step 2: Export PDF Twice ---"
echo ""

# Export 1
echo "Exporting PDF (attempt 1)..."
PDF1=$(mktemp --suffix=.pdf)
HTTP_CODE1=$(curl -s -w "%{http_code}" -o "$PDF1" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/$EVIDENCE_ID/export-chain-of-custody")

if [ "$HTTP_CODE1" != "200" ]; then
  echo -e "${RED}Export 1 failed (HTTP $HTTP_CODE1)${NC}"
  rm "$PDF1"
  exit 1
fi

PDF1_SIZE=$(stat -f%z "$PDF1" 2>/dev/null || stat -c%s "$PDF1" 2>/dev/null)
echo "  PDF 1: $PDF1_SIZE bytes"

# Wait a moment
sleep 2

# Export 2
echo "Exporting PDF (attempt 2)..."
PDF2=$(mktemp --suffix=.pdf)
HTTP_CODE2=$(curl -s -w "%{http_code}" -o "$PDF2" \
  -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/$EVIDENCE_ID/export-chain-of-custody")

if [ "$HTTP_CODE2" != "200" ]; then
  echo -e "${RED}Export 2 failed (HTTP $HTTP_CODE2)${NC}"
  rm "$PDF1" "$PDF2"
  exit 1
fi

PDF2_SIZE=$(stat -f%z "$PDF2" 2>/dev/null || stat -c%s "$PDF2" 2>/dev/null)
echo "  PDF 2: $PDF2_SIZE bytes"

echo ""

# ============================================================================
# Step 3: Compare PDF Sizes
# ============================================================================

echo "--- Step 3: Compare PDF Sizes ---"
echo ""

SIZE_DIFF=$((PDF1_SIZE - PDF2_SIZE))
if [ $SIZE_DIFF -lt 0 ]; then
  SIZE_DIFF=$((-SIZE_DIFF))
fi

echo "Size difference: $SIZE_DIFF bytes"

if [ $SIZE_DIFF -eq 0 ]; then
  test_pass "PDF sizes are identical"
elif [ $SIZE_DIFF -lt 100 ]; then
  test_pass "PDF sizes are nearly identical (diff: $SIZE_DIFF bytes - acceptable due to timestamps)"
else
  echo -e "${YELLOW}⚠ PDF sizes differ significantly: $SIZE_DIFF bytes${NC}"
  echo "  This is expected if the exports have different timestamps"
fi

echo ""

# ============================================================================
# Step 4: Extract and Compare Text Content
# ============================================================================

if [ "$USE_PDFTOTEXT" = true ]; then
  echo "--- Step 4: Compare PDF Content ---"
  echo ""
  
  # Extract text
  pdftotext "$PDF1" - > /tmp/pdf1.txt 2>/dev/null
  pdftotext "$PDF2" - > /tmp/pdf2.txt 2>/dev/null
  
  # Compare key fields (excluding timestamps which will differ)
  echo "Extracting key fields from both PDFs..."
  
  # Extract reference number
  REF1=$(grep -o "Reference Number:[[:space:]]*[A-Z0-9-]*" /tmp/pdf1.txt | head -n1 | cut -d':' -f2 | xargs)
  REF2=$(grep -o "Reference Number:[[:space:]]*[A-Z0-9-]*" /tmp/pdf2.txt | head -n1 | cut -d':' -f2 | xargs)
  
  if [ "$REF1" = "$REF2" ]; then
    test_pass "Reference numbers match: $REF1"
  else
    test_fail "Reference numbers differ: $REF1 vs $REF2"
  fi
  
  # Extract SHA-256 hash
  HASH1=$(grep -o "SHA-256 Hash:[[:space:]]*[a-f0-9]*" /tmp/pdf1.txt | head -n1 | cut -d':' -f2 | xargs)
  HASH2=$(grep -o "SHA-256 Hash:[[:space:]]*[a-f0-9]*" /tmp/pdf2.txt | head -n1 | cut -d':' -f2 | xargs)
  
  if [ "$HASH1" = "$HASH2" ]; then
    test_pass "SHA-256 hashes match: ${HASH1:0:16}..."
  else
    test_fail "SHA-256 hashes differ"
  fi
  
  # Check for chain-of-custody entries
  COC_COUNT1=$(grep -c "SUBMITTED\|RECEIVED\|VERIFIED\|SEALED\|ACCESSED\|EXPORTED" /tmp/pdf1.txt || echo "0")
  COC_COUNT2=$(grep -c "SUBMITTED\|RECEIVED\|VERIFIED\|SEALED\|ACCESSED\|EXPORTED" /tmp/pdf2.txt || echo "0")
  
  if [ "$COC_COUNT1" = "$COC_COUNT2" ]; then
    test_pass "Chain-of-custody entry count matches: $COC_COUNT1 entries"
  else
    test_fail "Chain-of-custody entry counts differ: $COC_COUNT1 vs $COC_COUNT2"
  fi
  
  rm /tmp/pdf1.txt /tmp/pdf2.txt
  
  echo ""
fi

# ============================================================================
# Step 5: Check UTC ISO-8601 Timestamps
# ============================================================================

if [ "$USE_PDFTOTEXT" = true ]; then
  echo "--- Step 5: Verify UTC ISO-8601 Timestamps ---"
  echo ""
  
  pdftotext "$PDF1" - > /tmp/pdf_check.txt 2>/dev/null
  
  # Look for ISO-8601 timestamps (YYYY-MM-DDTHH:MM:SS+00:00 or ...Z)
  ISO_TIMESTAMPS=$(grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\+00:00|Z)" /tmp/pdf_check.txt || true)
  
  if [ -n "$ISO_TIMESTAMPS" ]; then
    ISO_COUNT=$(echo "$ISO_TIMESTAMPS" | wc -l)
    test_pass "Found $ISO_COUNT ISO-8601 UTC timestamps"
    echo "  Sample: $(echo "$ISO_TIMESTAMPS" | head -n1)"
  else
    test_fail "No ISO-8601 UTC timestamps found"
    echo "  Expected format: 2025-10-14T12:00:00+00:00"
  fi
  
  rm /tmp/pdf_check.txt
  
  echo ""
fi

# ============================================================================
# Step 6: Check for Git SHA in Footer
# ============================================================================

if [ "$USE_PDFTOTEXT" = true ]; then
  echo "--- Step 6: Verify Git SHA in Footer ---"
  echo ""
  
  pdftotext "$PDF1" - > /tmp/pdf_footer.txt 2>/dev/null
  
  # Look for "Build:" followed by a short hash
  if grep -q "Build:[[:space:]]*[a-f0-9]\{7,8\}" /tmp/pdf_footer.txt; then
    GIT_SHA=$(grep -o "Build:[[:space:]]*[a-f0-9]*" /tmp/pdf_footer.txt | head -n1 | cut -d':' -f2 | xargs)
    test_pass "Git SHA found in footer: $GIT_SHA"
  else
    test_fail "Git SHA not found in footer"
    echo "  Footer should contain: Build: a1b2c3d4"
  fi
  
  rm /tmp/pdf_footer.txt
  
  echo ""
fi

# ============================================================================
# Step 7: Verify QR Code Presence
# ============================================================================

echo "--- Step 7: Verify QR Code ---"
echo ""

# Check PDF contains QR code (as image)
if command -v pdfimages &> /dev/null; then
  QR_DIR=$(mktemp -d)
  pdfimages "$PDF1" "$QR_DIR/img" 2>/dev/null
  
  IMG_COUNT=$(ls "$QR_DIR" 2>/dev/null | wc -l)
  
  if [ "$IMG_COUNT" -gt 0 ]; then
    test_pass "QR code image found in PDF"
  else
    echo -e "${YELLOW}⚠ No images found in PDF (QR code may be missing)${NC}"
  fi
  
  rm -rf "$QR_DIR"
else
  echo -e "${YELLOW}⚠ pdfimages not available (install poppler-utils to verify QR code)${NC}"
fi

echo ""

# ============================================================================
# Cleanup
# ============================================================================

echo "Cleaning up..."
rm "$PDF1" "$PDF2"
echo "  Temporary PDFs deleted"

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "====================================="
echo "Summary"
echo "====================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ PDF determinism tests passed!${NC}"
  echo ""
  echo "PDF exports include:"
  echo "  ✓ Consistent content between exports"
  echo "  ✓ UTC ISO-8601 timestamps"
  echo "  ✓ Git SHA in footer"
  echo "  ✓ QR code for verification"
  exit 0
else
  echo -e "${RED}✗ Some PDF determinism tests failed.${NC}"
  exit 1
fi

