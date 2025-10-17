#!/bin/bash
#
# Check for raw fetch() usage in the web app
# This script ensures all network calls use apiFetch or externalFetch
#

set -e

echo "🔍 Checking for raw fetch() usage..."

# Count raw fetch calls (excluding allowed files)
RAW_FETCH_COUNT=$(grep -r '\bfetch(' apps/web/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | \
  grep -v 'src/lib/api-client.ts' | \
  grep -v 'src/lib/external-fetch.ts' | \
  grep -v 'src/lib/apiFetch.ts' | \
  wc -l)

if [ "$RAW_FETCH_COUNT" -gt 0 ]; then
  echo "❌ Found $RAW_FETCH_COUNT raw fetch() calls:"
  echo ""
  grep -r '\bfetch(' apps/web/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | \
    grep -v 'src/lib/api-client.ts' | \
    grep -v 'src/lib/external-fetch.ts' | \
    grep -v 'src/lib/apiFetch.ts'
  echo ""
  echo "💡 Use apiFetch for internal API calls or externalFetch for external APIs"
  echo "   Raw fetch() is banned to enforce CSRF rotation, credentials, and idempotency"
  exit 1
else
  echo "✅ No raw fetch() calls found"
  echo "   All network calls are using apiFetch or externalFetch"
fi