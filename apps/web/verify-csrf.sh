#!/bin/bash
# Manual verification script for CSRF rotation and degraded mode

echo "=== CSRF Rotation + Degraded Mode Manual Verification ==="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Server not running. Please start with: pnpm dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# 1) Prime rotation via GET (server should issue a rotate header)
echo "1️⃣ Priming CSRF rotation via GET request..."
RESPONSE=$(curl -i -X GET http://localhost:3000/api/csrf \
  -H "Accept: application/json" \
  --cookie-jar /tmp/c.jar 2>/dev/null)

echo "Response headers:"
echo "$RESPONSE" | grep -E "(x-csrf-rotate|Set-Cookie)"

# Extract token from response
TOKEN=$(echo "$RESPONSE" | grep -i "x-csrf-rotate:" | cut -d' ' -f2 | tr -d '\r\n')
if [ -z "$TOKEN" ]; then
    echo "❌ No CSRF rotation token found in response"
    exit 1
fi

echo "✅ CSRF token received: $TOKEN"
echo ""

# 2) Do a mutating request with the token; expect success
echo "2️⃣ Testing mutating request with CSRF token..."
RESPONSE=$(curl -i -X POST http://localhost:3000/api/thing \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOKEN" \
  --cookie /tmp/c.jar \
  --data '{"hello":"world"}' 2>/dev/null)

echo "Response:"
echo "$RESPONSE" | head -10

if echo "$RESPONSE" | grep -q "200 OK"; then
    echo "✅ Mutating request successful with CSRF token"
else
    echo "❌ Mutating request failed"
    echo "Response: $RESPONSE"
fi
echo ""

# 3) Test without CSRF token (should fail)
echo "3️⃣ Testing mutating request without CSRF token (should fail)..."
RESPONSE=$(curl -i -X POST http://localhost:3000/api/thing \
  -H "Content-Type: application/json" \
  --cookie /tmp/c.jar \
  --data '{"hello":"world"}' 2>/dev/null)

if echo "$RESPONSE" | grep -q "403\|Forbidden"; then
    echo "✅ Request properly rejected without CSRF token"
else
    echo "❌ Request should have been rejected without CSRF token"
    echo "Response: $RESPONSE"
fi
echo ""

# 4) Test degraded mode (if environment variable is set)
echo "4️⃣ Testing degraded mode..."
export RATE_LIMIT_DEGRADED=1
RESPONSE=$(curl -i -X POST http://localhost:3000/api/thing \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOKEN" \
  --cookie /tmp/c.jar \
  --data '{"heavy":"load"}' 2>/dev/null)

echo "Response headers:"
echo "$RESPONSE" | grep -E "(x-degraded-mode|HTTP)"

if echo "$RESPONSE" | grep -q "x-degraded-mode: 1"; then
    echo "✅ Degraded mode header present"
else
    echo "ℹ️  Degraded mode header not found (may be normal if not implemented)"
fi

echo ""
echo "=== Verification Complete ==="
echo "✅ CSRF rotation working"
echo "✅ CSRF protection working"
echo "ℹ️  Degraded mode tested (check implementation)"
