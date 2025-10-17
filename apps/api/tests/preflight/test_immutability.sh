#!/bin/bash
#
# Database Immutability Tests
#
# Tests that database-level protections are in place:
# 1. Chain-of-custody rows cannot be updated or deleted
# 2. Sealed evidence cannot be modified
#
# Usage:
#   export DATABASE_URL="postgresql://user:pass@localhost:5432/shomer"
#   ./test_immutability.sh

set -e

DATABASE_URL="${DATABASE_URL:-postgresql://shomer:shomer@localhost:5432/shomer}"

echo "====================================="
echo "Database Immutability Tests"
echo "====================================="
echo "Database: ${DATABASE_URL%%@*}@***"
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

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo -e "${RED}Error: psql not found. Install PostgreSQL client tools.${NC}"
  exit 1
fi

# Test database connection
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${RED}Error: Cannot connect to database${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# ============================================================================
# Test 1: Chain-of-Custody Immutability
# ============================================================================

echo "--- Test 1: Chain-of-Custody Immutability ---"
echo ""

# Test 1a: Try to UPDATE a chain-of-custody row
echo "Test 1a: Attempt to UPDATE chain-of-custody row..."

COC_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM chain_of_custody;" | xargs)

if [ "$COC_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠ No chain-of-custody records found - creating test record${NC}"
  
  # Create test evidence and chain-of-custody entry
  psql "$DATABASE_URL" > /dev/null 2>&1 << EOF
INSERT INTO evidence (
  reference_number, evidence_type, status, filename, file_path, 
  file_size, mime_type, sha256_hash, submitted_at, received_at
) VALUES (
  'TEST-IMMUTABILITY-001', 'document', 'pending', 'test.txt', '/tmp/test.txt',
  100, 'text/plain', 'a' || repeat('0', 63), NOW(), NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO chain_of_custody (
  evidence_id, action, timestamp, description
) 
SELECT id, 'SUBMITTED', NOW(), 'Test entry'
FROM evidence WHERE reference_number = 'TEST-IMMUTABILITY-001'
LIMIT 1
ON CONFLICT DO NOTHING;
EOF
  
  echo "  Test record created"
fi

# Try to update
UPDATE_RESULT=$(psql "$DATABASE_URL" -t -c "
  UPDATE chain_of_custody 
  SET action = 'MODIFIED' 
  WHERE id = (SELECT id FROM chain_of_custody ORDER BY id LIMIT 1);
" 2>&1 || true)

if echo "$UPDATE_RESULT" | grep -qi "ChainOfCustody rows are immutable\|permission denied\|trigger"; then
  test_pass "Chain-of-custody UPDATE blocked by trigger"
else
  test_fail "Chain-of-custody UPDATE was not blocked!"
  echo "  Result: $UPDATE_RESULT"
fi

# Test 1b: Try to DELETE a chain-of-custody row
echo "Test 1b: Attempt to DELETE chain-of-custody row..."

DELETE_RESULT=$(psql "$DATABASE_URL" -t -c "
  DELETE FROM chain_of_custody 
  WHERE id = (SELECT id FROM chain_of_custody ORDER BY id LIMIT 1);
" 2>&1 || true)

if echo "$DELETE_RESULT" | grep -qi "ChainOfCustody rows are immutable\|permission denied\|trigger"; then
  test_pass "Chain-of-custody DELETE blocked by trigger"
else
  test_fail "Chain-of-custody DELETE was not blocked!"
  echo "  Result: $DELETE_RESULT"
fi

echo ""

# ============================================================================
# Test 2: Sealed Evidence Protection
# ============================================================================

echo "--- Test 2: Sealed Evidence Protection ---"
echo ""

# Check if 'sealed' column exists
SEALED_COL_EXISTS=$(psql "$DATABASE_URL" -t -c "
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='evidence' AND column_name='sealed'
  );
" | xargs)

if [ "$SEALED_COL_EXISTS" = "f" ]; then
  echo -e "${YELLOW}⚠ 'sealed' column not found - migration 006 may not be applied${NC}"
  echo "  Run: alembic upgrade head"
  echo ""
else
  # Create or find a sealed evidence record
  SEALED_ID=$(psql "$DATABASE_URL" -t -c "
    SELECT id FROM evidence WHERE sealed = true LIMIT 1;
  " | xargs)
  
  if [ -z "$SEALED_ID" ]; then
    echo "Creating sealed evidence record for testing..."
    
    psql "$DATABASE_URL" > /dev/null 2>&1 << EOF
INSERT INTO evidence (
  reference_number, evidence_type, status, filename, file_path, 
  file_size, mime_type, sha256_hash, submitted_at, received_at, sealed
) VALUES (
  'TEST-SEALED-001', 'document', 'sealed', 'sealed.txt', '/tmp/sealed.txt',
  100, 'text/plain', 'b' || repeat('0', 63), NOW(), NOW(), true
) ON CONFLICT DO NOTHING
RETURNING id;
EOF
    
    SEALED_ID=$(psql "$DATABASE_URL" -t -c "
      SELECT id FROM evidence WHERE reference_number = 'TEST-SEALED-001';
    " | xargs)
    
    echo "  Sealed evidence created: ID $SEALED_ID"
  else
    echo "Found existing sealed evidence: ID $SEALED_ID"
  fi
  
  # Test 2a: Try to UPDATE sealed evidence (should fail)
  echo "Test 2a: Attempt to UPDATE sealed evidence file_path..."
  
  UPDATE_RESULT=$(psql "$DATABASE_URL" -t -c "
    UPDATE evidence 
    SET file_path = '/tmp/modified.txt' 
    WHERE id = $SEALED_ID;
  " 2>&1 || true)
  
  if echo "$UPDATE_RESULT" | grep -qi "sealed.*legal hold\|permission denied\|trigger"; then
    test_pass "Sealed evidence file_path modification blocked"
  else
    test_fail "Sealed evidence file_path was modified!"
    echo "  Result: $UPDATE_RESULT"
  fi
  
  # Test 2b: Try to UPDATE sealed evidence hash (should fail)
  echo "Test 2b: Attempt to UPDATE sealed evidence hash..."
  
  UPDATE_RESULT=$(psql "$DATABASE_URL" -t -c "
    UPDATE evidence 
    SET sha256_hash = 'modified_hash_12345' 
    WHERE id = $SEALED_ID;
  " 2>&1 || true)
  
  if echo "$UPDATE_RESULT" | grep -qi "sealed.*legal hold\|permission denied\|trigger"; then
    test_pass "Sealed evidence hash modification blocked"
  else
    test_fail "Sealed evidence hash was modified!"
    echo "  Result: $UPDATE_RESULT"
  fi
  
  # Test 2c: Try to DELETE sealed evidence (should fail)
  echo "Test 2c: Attempt to DELETE sealed evidence..."
  
  DELETE_RESULT=$(psql "$DATABASE_URL" -t -c "
    DELETE FROM evidence WHERE id = $SEALED_ID;
  " 2>&1 || true)
  
  if echo "$DELETE_RESULT" | grep -qi "sealed.*legal hold\|permission denied\|trigger"; then
    test_pass "Sealed evidence deletion blocked"
  else
    test_fail "Sealed evidence was deleted!"
    echo "  Result: $DELETE_RESULT"
  fi
  
  # Test 2d: Verify allowed updates (status, notes) still work
  echo "Test 2d: Verify allowed updates on sealed evidence..."
  
  # Status update should be allowed (for workflow)
  UPDATE_RESULT=$(psql "$DATABASE_URL" -t -c "
    UPDATE evidence 
    SET status = 'sealed' 
    WHERE id = $SEALED_ID;
    SELECT 'OK';
  " 2>&1 || echo "FAILED")
  
  if echo "$UPDATE_RESULT" | grep -q "OK"; then
    test_pass "Sealed evidence status update allowed (as expected)"
  else
    echo -e "${YELLOW}⚠ Status update may have failed: $UPDATE_RESULT${NC}"
  fi
fi

echo ""

# ============================================================================
# Test 3: Trigger Function Existence
# ============================================================================

echo "--- Test 3: Trigger Function Existence ---"
echo ""

# Check for chain-of-custody trigger
COC_TRIGGER=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.triggers 
  WHERE trigger_name = 'trig_coc_protect';
" | xargs)

if [ "$COC_TRIGGER" -gt 0 ]; then
  test_pass "Chain-of-custody protection trigger exists"
else
  test_fail "Chain-of-custody protection trigger missing!"
fi

# Check for evidence protection trigger  
EVIDENCE_TRIGGER=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.triggers 
  WHERE trigger_name = 'trig_evidence_protect';
" | xargs)

if [ "$EVIDENCE_TRIGGER" -gt 0 ]; then
  test_pass "Evidence protection trigger exists"
else
  test_fail "Evidence protection trigger missing!"
fi

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
  echo -e "${GREEN}✓ All immutability tests passed!${NC}"
  echo ""
  echo "Database triggers are protecting:"
  echo "  ✓ Chain-of-custody records (immutable)"
  echo "  ✓ Sealed evidence (legal hold)"
  exit 0
else
  echo -e "${RED}✗ Some immutability tests failed!${NC}"
  echo ""
  echo "Action required:"
  echo "  1. Run database migrations: alembic upgrade head"
  echo "  2. Re-run this test"
  exit 1
fi

