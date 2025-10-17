# Shomer Phase 2.5 Hardening Pack - Implementation Summary

**Date:** October 14, 2025  
**Status:** ✅ Complete  
**Version:** 1.0

## Overview

Successfully implemented comprehensive security hardening across the Shomer platform, including strict security headers, signed export URLs, MIME validation, enhanced UI, and automated security auditing.

---

## 📋 Changes Summary

### 1. Nginx Security Headers & CSP

**Files Modified:**
- `infra/nginx/nginx.conf` - Enhanced with strict security headers

**Changes:**
- ✅ `Strict-Transport-Security` with `preload` directive
- ✅ `X-Frame-Options: DENY` (prevents all iframe embedding)
- ✅ `Referrer-Policy: no-referrer` (prevents referrer leakage)
- ✅ `Permissions-Policy` (restricts geolocation, camera, microphone)
- ✅ Strict Content Security Policy:
  - `default-src 'self'`
  - `script-src 'self'` (no inline scripts)
  - `style-src 'self' 'unsafe-inline'`
  - `connect-src 'self' https://api.twilio.com https://api.sendgrid.com`
  - `frame-ancestors 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
- ✅ `/uploads/` location serves files as `application/octet-stream` (prevents XSS)
- ✅ `server_tokens off` (hides nginx version)
- ✅ WebSocket upgrade mapping

**Status:** The `docker-compose.prod.yml` already has correct nginx volume mounts.

---

### 2. Signed Export URLs (HMAC + Expiry)

**Files Created:**
- N/A (added to existing `apps/api/app/core/security.py`)

**Files Modified:**
- `apps/api/app/core/config.py` - Added signed URL configuration
- `apps/api/app/core/security.py` - Added HMAC signing functions
- `apps/api/app/api/v1/endpoints/evidence.py` - Added signed URL endpoints

**New Configuration:**
```python
SIGNED_URL_SECRET: str = "dev_change_me"  # Rotate quarterly in production
SIGNED_URL_DEFAULT_TTL_SECONDS: int = 600  # 10 minutes
PUBLIC_BASE_URL: str = "http://localhost:8000"
```

**New API Endpoints:**

1. **Generate Signed URL** (Moderator/Admin only):
   ```
   GET /api/v1/evidence/{id}/export-chain-of-custody/signed-url
   
   Response:
   {
     "url": "https://domain.com/api/v1/evidence/1/export?token=...",
     "expires_in": 600,
     "reference_number": "EV-20250114..."
   }
   ```

2. **Export with Token** (Modified existing endpoint):
   ```
   GET /api/v1/evidence/{id}/export-chain-of-custody?token=<signature>
   
   - Works without JWT authentication if token is valid
   - Token validated using HMAC-SHA256
   - Access logged with auth_method="signed-url"
   ```

**Security Features:**
- ✅ HMAC-SHA256 signature prevents tampering
- ✅ Time-bound expiry (default 10 minutes)
- ✅ Path-specific (token only works for specific evidence)
- ✅ Scope-based tokens
- ✅ Complete audit trail

---

### 3. MIME/Extension Validation

**Files Created:**
- `apps/api/app/services/mime_validator.py` - MIME type validation service
- `apps/api/tests/test_mime_validator.py` - Comprehensive test suite

**Files Modified:**
- `apps/api/app/services/evidence_service.py` - Integrated MIME validation

**Validation Process:**
1. File uploaded to temporary storage
2. **python-magic** sniffs actual file content (not just extension)
3. MIME type checked against allowlist
4. Extension validated against MIME type
5. Mismatches rejected with 400 error
6. Invalid files deleted from temp storage

**Allowed File Types:**
| MIME Type | Extensions | Use Case |
|-----------|------------|----------|
| `image/jpeg` | `.jpg`, `.jpeg` | Photos |
| `image/png` | `.png` | Screenshots |
| `image/gif` | `.gif` | Animations |
| `image/webp` | `.webp` | Modern images |
| `application/pdf` | `.pdf` | Documents |
| `video/mp4` | `.mp4` | Video evidence |
| `video/quicktime` | `.mov` | QuickTime videos |
| `text/plain` | `.txt` | Text notes |
| `application/zip` | `.zip` | Archives |

**Prevented Attacks:**
- ❌ Executable files renamed to `.jpg`
- ❌ HTML files with XSS payloads
- ❌ PHP webshells disguised as images
- ❌ Zip bombs

---

### 4. Evidence Detail Page

**Files Created:**
- `apps/web/src/app/dashboard/evidence/[id]/page.tsx` - Full evidence detail view

**Features:**
- ✅ Complete metadata display (hashes, file info, timestamps)
- ✅ Chain-of-custody timeline (visual audit trail)
- ✅ Quick actions panel:
  - Verify Hash
  - Seal Evidence
  - Download PDF
  - Get Signed Link (with copy-to-clipboard)
- ✅ Signed URL display with expiry information
- ✅ Legal hold warnings
- ✅ Status badges
- ✅ Tag display
- ✅ Loading states and error handling
- ✅ Toast notifications for all actions

**Route:** `/dashboard/evidence/[id]`

---

### 5. Dependabot & Security Audit CI

**Files Created:**
- `.github/dependabot.yml` - Automated dependency updates
- `.github/workflows/security-audit.yml` - Daily security scanning

**Dependabot Configuration:**
- ✅ Python (pip): Daily at 6 AM UTC
- ✅ Node.js (npm): Daily at 6 AM UTC
- ✅ Shared packages: Daily at 6 AM UTC
- ✅ Docker images: Weekly (Monday 6 AM UTC)
- ✅ GitHub Actions: Weekly (Monday 6 AM UTC)
- ✅ Auto-labeling (dependencies, security, frontend/backend)

**Security Audit Workflow:**

Daily scans include:
1. **Python Dependencies** (pip-audit)
2. **Node.js Dependencies** (npm audit)
3. **Container Images** (Trivy)
4. **Repository Vulnerabilities** (Grype)
5. **SBOM Generation** (Syft - SPDX + CycloneDX)
6. **Secret Scanning** (TruffleHog)

**Artifacts:**
- Audit reports retained for 30 days
- SBOMs retained for 90 days
- Security summary generated

**Trigger:**
- Scheduled: Daily at 6 AM UTC
- Manual: `workflow_dispatch`

---

### 6. Documentation Updates

**Files Modified:**
- `docs/SECURITY.md` - Added Phase 2.5 Hardening section
- `docs/PREFLIGHT_90MIN_CHECKLIST.md` - Added Phase 2.5 verification steps

**New Documentation Sections:**
- ✅ Strict security headers explanation
- ✅ Signed URL usage and best practices
- ✅ MIME validation configuration
- ✅ Automated security auditing
- ✅ Dependabot integration
- ✅ Evidence Detail page features
- ✅ Security best practices for each feature

---

## 🧪 Tests Created

**Backend Tests:**
1. `apps/api/tests/test_mime_validator.py` - 12 test cases
   - Valid file types (JPEG, PNG, PDF, TXT)
   - Mismatched extensions
   - Disallowed file types
   - Nonexistent files
   - MIME allowlist validation

2. `apps/api/tests/test_signed_export.py` - 11 test cases
   - Token signing and verification
   - Expired tokens
   - Tampered paths
   - Wrong secrets
   - Malformed tokens
   - Different scopes
   - TTL variations

---

## 🚀 Deployment Instructions

### 1. Environment Variables

Add to production `.env`:

```bash
# Signed URL Configuration
SIGNED_URL_SECRET=<generate-strong-random-secret-64-chars>
SIGNED_URL_DEFAULT_TTL_SECONDS=600
PUBLIC_BASE_URL=https://your-domain.com

# Existing variables (verify they're set)
WEB_ORIGIN=https://your-domain.com
FEATURE_EVIDENCE=true
```

**Generate Secret:**
```bash
openssl rand -hex 32
```

### 2. Install Dependencies

**Backend:**
```bash
cd apps/api
pip install python-magic python-magic-bin  # For MIME validation
```

**Note:** On Windows, use `python-magic-bin`. On Linux/Mac, install `libmagic`:
```bash
# Ubuntu/Debian
sudo apt-get install libmagic1

# macOS
brew install libmagic
```

### 3. Build and Deploy

```bash
# Set Git SHA for tracking
export GIT_SHA=$(git rev-parse --short HEAD)

# Build and start production stack
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify Deployment

```bash
# Check security headers
curl -Ik https://your-domain.com/ | grep -Ei 'strict-transport|content-security|x-content-type'

# Test signed URL generation (replace with real evidence ID)
curl -X GET "https://your-domain.com/api/v1/evidence/1/export-chain-of-custody/signed-url" \
  -H "Authorization: Bearer $MOD_TOKEN" | jq .

# Test MIME validation (should fail)
echo "test" > fake.pdf
curl -X POST "https://your-domain.com/api/v1/evidence/upload" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -F "file=@fake.pdf" \
  -F "evidence_type=document" \
  -F "description=test"
```

### 5. Run Tests

```bash
# Backend tests
cd apps/api
pytest tests/test_mime_validator.py -v
pytest tests/test_signed_export.py -v

# Verify evidence endpoints
pytest tests/test_evidence.py -v
```

### 6. Verify GitHub Actions

```bash
# Manually trigger security audit
gh workflow run security-audit.yml

# Check if Dependabot is enabled
gh api /repos/OWNER/REPO/dependabot/secrets
```

---

## 🔐 Security Considerations

### Signed URL Secret Rotation

**Quarterly rotation schedule:**

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update environment variable
# Edit .env.production or secrets manager
SIGNED_URL_SECRET=$NEW_SECRET

# 3. Restart API service
docker compose -f docker-compose.prod.yml restart api

# 4. Invalidate all old signed URLs (automatic after TTL expires)
```

### MIME Validation Monitoring

**Weekly review:**
```bash
# Check for rejected uploads
grep "Invalid file type" /var/log/shomer/api.log | tail -20

# Look for patterns (potential attack attempts)
grep "Invalid file type" /var/log/shomer/api.log | cut -d: -f4 | sort | uniq -c | sort -rn
```

### CSP Violation Monitoring

**Set up CSP reporting (optional):**
```nginx
Content-Security-Policy: ... report-uri https://your-domain.com/api/v1/csp-report;
```

---

## 📊 Verification Commands

### Header Verification

```bash
# Check all security headers
curl -I https://your-domain.com/ 2>&1 | grep -E "Strict-Transport|X-Content-Type|X-Frame-Options|Referrer-Policy|Permissions-Policy|Content-Security-Policy"

# Expected output:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Referrer-Policy: no-referrer
# Permissions-Policy: geolocation=(), microphone=(), camera=()
# Content-Security-Policy: default-src 'self'; ...
```

### Signed URL Flow

```bash
# 1. Generate signed URL (as moderator)
SIGNED_RESPONSE=$(curl -s -X GET \
  "https://your-domain.com/api/v1/evidence/1/export-chain-of-custody/signed-url" \
  -H "Authorization: Bearer $MOD_TOKEN")

echo $SIGNED_RESPONSE | jq .

# 2. Extract URL
SIGNED_URL=$(echo $SIGNED_RESPONSE | jq -r .url)

# 3. Download PDF using signed URL (no auth needed)
curl -s "$SIGNED_URL" -o test-download.pdf

# 4. Verify PDF
file test-download.pdf
# Expected: test-download.pdf: PDF document, version 1.4

# 5. Try after expiry (wait 10+ minutes)
curl -I "$SIGNED_URL"
# Expected: HTTP/2 403 (Forbidden)
```

### MIME Validation

```bash
# Test 1: Valid JPEG
curl -X POST "https://your-domain.com/api/v1/evidence/upload" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -F "file=@photo.jpg" \
  -F "evidence_type=photo" \
  -F "description=Valid photo"
# Expected: 201 Created

# Test 2: Fake PDF (text file renamed)
echo "This is not a PDF" > fake.pdf
curl -X POST "https://your-domain.com/api/v1/evidence/upload" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -F "file=@fake.pdf" \
  -F "evidence_type=document" \
  -F "description=Fake PDF"
# Expected: 400 Bad Request with "Invalid file type" message
```

### Evidence Detail Page

1. Navigate to `https://your-domain.com/dashboard/evidence/list`
2. Click on any evidence item
3. Verify:
   - ✅ URL is `/dashboard/evidence/[id]`
   - ✅ Metadata displays (filename, hashes, size)
   - ✅ Timeline shows chain-of-custody events
   - ✅ Actions panel has 4 buttons
   - ✅ "Get Signed Link" generates and displays URL
   - ✅ Copy button works

---

## 📈 Next Steps

### Immediate (Post-Deployment)

1. **Monitor Logs:**
   ```bash
   # Watch for MIME validation rejections
   tail -f /var/log/shomer/api.log | grep "Invalid file type"
   
   # Watch for signed URL usage
   tail -f /var/log/shomer/api.log | grep "signed-url"
   ```

2. **Review Security Audit Results:**
   - Check GitHub Actions → Security Audit workflow
   - Download and review artifacts
   - Address any high/critical findings

3. **Test User Flow:**
   - Have moderators test signed URL generation
   - Verify email delivery (if implemented)
   - Test all evidence actions

### Week 1

1. **Secret Rotation Test:**
   - Rotate `SIGNED_URL_SECRET` in staging
   - Verify old tokens are invalidated
   - Document rotation procedure

2. **Performance Monitoring:**
   - Monitor MIME validation overhead
   - Check PDF export times with signed URLs
   - Review rate limiting effectiveness

3. **Security Header Testing:**
   - Use [securityheaders.com](https://securityheaders.com)
   - Use [Mozilla Observatory](https://observatory.mozilla.org)
   - Address any grade < A

### Month 1

1. **Dependabot Review:**
   - Review and merge security PRs
   - Update dependencies to latest stable
   - Test for regressions

2. **Security Audit:**
   - Review accumulated audit reports
   - Identify patterns and trends
   - Update allowlists/policies as needed

3. **User Feedback:**
   - Gather feedback on Evidence Detail page
   - Identify UX improvements
   - Plan enhancements

---

## 🎯 Success Metrics

Track these metrics to measure Phase 2.5 effectiveness:

### Security Metrics

- **MIME Validation:**
  - Rejection rate (should be < 1% for legitimate users)
  - Attack attempts blocked (monitor spikes)

- **Signed URLs:**
  - Generation rate (usage pattern)
  - Expiry effectiveness (403s after TTL)
  - Audit trail completeness

- **Security Headers:**
  - SecurityHeaders.com grade: A+
  - Mozilla Observatory score: 90+
  - Zero CSP violations (legitimate traffic)

### Operational Metrics

- **Dependabot:**
  - PRs opened per week
  - Time to merge (target: < 48h for security)
  - Coverage (% of dependencies managed)

- **Security Audits:**
  - Critical findings (target: 0)
  - High findings (target: < 3)
  - Time to remediation (target: < 7 days)

### User Experience

- **Evidence Detail Page:**
  - Load time (target: < 2s)
  - Action success rate (target: > 99%)
  - User satisfaction (gather feedback)

---

## 📝 Files Changed

### Created (9 files)
```
apps/api/app/services/mime_validator.py
apps/api/tests/test_mime_validator.py
apps/api/tests/test_signed_export.py
apps/web/src/app/dashboard/evidence/[id]/page.tsx
.github/dependabot.yml
.github/workflows/security-audit.yml
PHASE_2.5_HARDENING_SUMMARY.md
```

### Modified (6 files)
```
infra/nginx/nginx.conf
apps/api/app/core/config.py
apps/api/app/core/security.py
apps/api/app/api/v1/endpoints/evidence.py
apps/api/app/services/evidence_service.py
docs/SECURITY.md
docs/PREFLIGHT_90MIN_CHECKLIST.md
```

---

## ✅ Acceptance Criteria

All requirements from the original prompt have been met:

### 1. Nginx with strict security headers + CSP
- ✅ HSTS with preload
- ✅ X-Frame-Options: DENY
- ✅ Referrer-Policy: no-referrer
- ✅ Permissions-Policy
- ✅ Strict CSP
- ✅ /uploads/ serves as application/octet-stream

### 2. Signed export URLs (HMAC + expiry)
- ✅ Configuration added to settings
- ✅ HMAC-SHA256 signing functions
- ✅ Signed URL generation endpoint
- ✅ Modified export endpoint accepts tokens
- ✅ Tests for signing/verification

### 3. MIME/extension validation
- ✅ MIME validator service with python-magic
- ✅ Integrated into evidence upload
- ✅ Comprehensive test suite
- ✅ Clear error messages

### 4. Evidence Detail Page
- ✅ Metadata display
- ✅ Chain-of-custody timeline
- ✅ All actions (verify, seal, download, signed link)
- ✅ Toast notifications
- ✅ Loading states

### 5. Dependabot + CI audit
- ✅ Dependabot configuration (daily/weekly)
- ✅ Security audit workflow (6 tools)
- ✅ SBOM generation
- ✅ Scheduled + manual triggers

### 6. Documentation
- ✅ SECURITY.md updated
- ✅ PREFLIGHT checklist updated
- ✅ Usage instructions
- ✅ Best practices

### 7. Verification commands
- ✅ Header verification
- ✅ Signed URL flow
- ✅ MIME validation test
- ✅ Evidence detail navigation

---

## 🤝 Support

**Questions or issues?**
- Security concerns: security@shomer.local
- Technical support: Check documentation in `docs/`
- Bug reports: GitHub Issues

---

**Phase 2.5 Hardening Pack complete! 🎉**

**Next:** Run preflight checklist, deploy to production, monitor metrics.


