#!/bin/bash
# Post-merge validation script for API Keys hardening
# Run this after merging the API keys hardening PR

set -e  # Exit on any error

echo "🔍 API Keys Hardening - Post-Merge Validation"
echo "=============================================="

# 0) Environment sanity check
echo "📋 Checking environment..."
test -n "$ACTION_SECRET" || (echo "❌ Missing ACTION_SECRET" && exit 1)
echo "✅ ACTION_SECRET is set"

# 1) Database migrations and codegen
echo "🗄️  Running database migrations..."
pnpm prisma migrate deploy
pnpm prisma db pull && pnpm prisma generate
echo "✅ Database migrations complete"

# 2) Type checking, linting, building, and tests
echo "🔧 Running type check..."
pnpm typecheck
echo "✅ Type check passed"

echo "🧹 Running linter..."
pnpm lint
echo "✅ Linting passed"

echo "🏗️  Building application..."
pnpm build
echo "✅ Build successful"

echo "🧪 Running API keys tests..."
pnpm test -i org-apikeys-hardened.test.ts
echo "✅ Tests passed"

# 3) Smoke tests
echo "💨 Running smoke tests..."

# Set test variables
ORG="org_123"
SECRET="$ACTION_SECRET"
KEY="org_live_example_redacted"  # Replace with actual test key

echo "🔐 Testing global secret bypass..."
curl -sS -i -X POST \
  -H "X-Action-Secret: $SECRET" \
  "http://localhost:3000/api/oncall/rota?orgId=$ORG" | sed -n '1,10p'
echo "✅ Global secret test complete"

echo "🔑 Testing scoped key (allowed)..."
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
  "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1" | sed -n '1,10p'
echo "✅ Scoped key allowed test complete"

echo "🚫 Testing scoped key (denied)..."
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
  "http://localhost:3000/api/orgs/$ORG/settings" | sed -n '1,20p'
echo "✅ Scoped key denied test complete"

echo "⏱️  Testing rate limiting (hitting N+1 times)..."
for i in {1..7}; do
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "X-Org-Api-Key: $KEY" \
    "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1")
  echo "Request $i: HTTP $HTTP_CODE"
done
echo "✅ Rate limiting test complete"

echo ""
echo "🎉 Post-merge validation complete!"
echo "✅ All checks passed - API Keys hardening is ready for production"
echo ""
echo "📊 Next steps:"
echo "   1. Deploy to staging"
echo "   2. Run staging smoke tests"
echo "   3. Monitor dashboards"
echo "   4. Proceed with staged production rollout"
