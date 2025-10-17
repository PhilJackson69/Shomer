# Pre-Flight Test Suite

Comprehensive go-live readiness tests for the Shomer evidence management system.

## Overview

This test suite validates all critical security, operational, and compliance requirements before production deployment. Tests are designed to run quickly (90 minutes total) and provide clear pass/fail results.

## Test Scripts

| Script | Purpose | Duration | Dependencies |
|--------|---------|----------|--------------|
| `test_security_headers.sh` | Security headers & CSP | 5 min | curl |
| `test_auth_csrf.sh` | JWT cookies & CSRF | 5 min | curl, jq |
| `test_rbac.sh` | Role-based access control | 5 min | curl, jq |
| `test_rate_limits.sh` | Rate limiting enforcement | 10 min | curl, jq |
| `test_immutability.sh` | Database triggers | 5 min | psql |
| `test_pdf_determinism.sh` | PDF export consistency | 10 min | curl, jq, pdftotext |
| `test_exif_stripping.sh` | Image privacy protection | 5 min | curl, jq, exiftool |
| `run_all_preflight.sh` | Master test runner | 60 min | all above |

**Total Test Coverage:** 7 test suites, 50+ individual checks

## Quick Start

### Prerequisites

```bash
# Install required tools
sudo apt-get install curl jq postgresql-client poppler-utils libimage-exiftool-perl

# Or on macOS
brew install curl jq postgresql poppler exiftool
```

### Set Environment Variables

```bash
export API="https://shomer.app"
export DATABASE_URL="postgresql://user:pass@localhost:5432/shomer"
export ADMIN_TOKEN="your-admin-jwt-token"
export MOD_TOKEN="your-moderator-jwt-token"
export VIEWER_TOKEN="your-viewer-jwt-token"
```

### Run All Tests

```bash
cd apps/api/tests/preflight
chmod +x *.sh
./run_all_preflight.sh
```

### Run Individual Tests

```bash
# Test security headers
./test_security_headers.sh https://shomer.app

# Test authentication
export TOKEN="$ADMIN_TOKEN"
./test_auth_csrf.sh

# Test RBAC
./test_rbac.sh

# Test rate limits
./test_rate_limits.sh

# Test database immutability
./test_immutability.sh

# Test PDF determinism
./test_pdf_determinism.sh

# Test EXIF stripping
./test_exif_stripping.sh
```

## Test Details

### 1. Security Headers (`test_security_headers.sh`)

**Tests:**
- HSTS header present and configured correctly
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN/DENY
- Content-Security-Policy configured
- No mixed content (HTTP on HTTPS)
- Cookie security flags
- TLS/SSL configuration

**Pass Criteria:**
- All required headers present
- CSP includes frame-ancestors protection
- No mixed content warnings
- TLS 1.2 or 1.3

### 2. Authentication & CSRF (`test_auth_csrf.sh`)

**Tests:**
- Login successful
- JWT token received
- JWT cookie has HttpOnly flag
- JWT cookie has Secure flag
- JWT cookie has SameSite
- CSRF token present
- POST without CSRF rejected (403)
- POST with CSRF accepted
- Unauthenticated access rejected (401)

**Pass Criteria:**
- All cookie flags present
- CSRF protection active
- Proper 401/403 responses

### 3. RBAC (`test_rbac.sh`)

**Tests:**
- Viewer cannot perform moderator actions (403)
- Moderator cannot perform admin actions (403)
- Evidence operations require JWT (401)
- Evidence operations require CSRF (403 in prod)

**Pass Criteria:**
- All unauthorized actions return 403
- All unauthenticated actions return 401
- Admin can perform all actions

### 4. Rate Limiting (`test_rate_limits.sh`)

**Tests:**
- General API: 60 requests/min → 429 after limit
- Upload: 10 requests/min → 429 after limit
- Export: 5 requests/min → 429 after limit
- Retry-After header present in 429 response

**Pass Criteria:**
- Rate limits enforced
- 429 responses include Retry-After
- Limits apply per IP/user as configured

### 5. Database Immutability (`test_immutability.sh`)

**Tests:**
- Chain-of-custody UPDATE blocked by trigger
- Chain-of-custody DELETE blocked by trigger
- Sealed evidence file_path update blocked
- Sealed evidence hash update blocked
- Sealed evidence deletion blocked
- Status updates still allowed (workflow)

**Pass Criteria:**
- All modification attempts fail with trigger error
- Trigger functions exist in database
- Allowed operations still work

### 6. PDF Determinism (`test_pdf_determinism.sh`)

**Tests:**
- Export same evidence twice
- PDF sizes nearly identical (< 100 bytes)
- Reference number matches
- SHA-256 hash matches
- Chain-of-custody count matches
- Timestamps in UTC ISO-8601
- Git SHA present in footer
- QR code present

**Pass Criteria:**
- Key fields identical
- All timestamps in UTC
- ISO-8601 format: 2025-10-14T12:00:00+00:00
- Git SHA embedded

### 7. EXIF Stripping (`test_exif_stripping.sh`)

**Tests:**
- Upload image with GPS/EXIF data
- API reports metadata_removed=true
- GPS data removed from stored file
- Sensitive tags removed
- EXIF tag count reduced
- Original metadata preserved in DB

**Pass Criteria:**
- GPS data removed
- Sensitive metadata stripped
- metadata_removed flag set
- Original metadata in audit field

## Interpreting Results

### Success

```
==============================================
  Pre-Flight Test Summary
==============================================

✓ Security Headers & CSP: PASS
✓ Authentication & CSRF: PASS
✓ RBAC & Permissions: PASS
✓ Rate Limiting: PASS
✓ Database Immutability: PASS
✓ PDF Export Determinism: PASS
✓ EXIF Metadata Stripping: PASS

==============================================
Passed: 7
Failed: 0
==============================================

✓ All pre-flight tests passed!
System is ready for go-live.
```

### Failure

```
==============================================
  Pre-Flight Test Summary
==============================================

✓ Security Headers & CSP: PASS
✗ Authentication & CSRF: FAIL
✓ RBAC & Permissions: PASS
...
```

**Action:** Review failed test output, fix issues, re-run tests.

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Pre-Flight Tests
  env:
    API: https://staging.shomer.app
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
  run: |
    cd apps/api/tests/preflight
    ./run_all_preflight.sh
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Troubleshooting

### "No JWT token" errors

**Cause:** TOKEN environment variable not set

**Fix:**
```bash
export TOKEN="your-admin-jwt-token"
# Or for RBAC tests
export ADMIN_TOKEN="..."
export MOD_TOKEN="..."
export VIEWER_TOKEN="..."
```

### "psql: command not found"

**Cause:** PostgreSQL client not installed

**Fix:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### "pdftotext: command not found"

**Cause:** Poppler utils not installed

**Fix:**
```bash
# Ubuntu/Debian
sudo apt-get install poppler-utils

# macOS
brew install poppler
```

### "exiftool: command not found"

**Cause:** ExifTool not installed

**Fix:**
```bash
# Ubuntu/Debian
sudo apt-get install libimage-exiftool-perl

# macOS
brew install exiftool
```

### Rate limit tests don't trigger 429

**Cause:** Rate limiting disabled or very high limits in development

**Expected:** This is normal in dev. Verify in production/staging with appropriate rate limits configured.

### CSRF tests pass without token in dev

**Cause:** CSRF protection disabled in development mode

**Expected:** CSRF middleware only enabled when `ENVIRONMENT=production`

### EXIF test can't access file

**Cause:** File path not accessible (production environment)

**Expected:** Trust `metadata_removed=true` flag in API response. Direct file access only works in local/test environments.

## Development

### Adding New Tests

1. Create new test script: `test_new_feature.sh`
2. Follow existing script structure:
   - Set up test environment
   - Run tests with clear pass/fail
   - Use color coding (GREEN/RED/YELLOW)
   - Return exit code (0=pass, 1=fail)
3. Add to `run_all_preflight.sh`
4. Update this README

### Test Script Template

```bash
#!/bin/bash
set -e

API="${API:-http://localhost:8000}"

GREEN='\033[0;32m'
RED='\033[0;31m'
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

# Your tests here

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed.${NC}"
  exit 1
fi
```

## Related Documentation

- **90-Minute Checklist:** `docs/PREFLIGHT_90MIN_CHECKLIST.md`
- **Post-Launch Monitoring:** `docs/POST_LAUNCH_MONITORING.md`
- **Pilot Runbook:** `docs/PILOT_RUNBOOK.md`
- **Go-Live Summary:** `GO_LIVE_READINESS_SUMMARY.md`

## Support

For issues or questions:
- Check troubleshooting section above
- Review test output for specific error messages
- Consult related documentation
- Contact platform engineering team

---

**Last Updated:** October 14, 2025  
**Maintained By:** Platform Engineering

