# 90-Minute Pre-Flight Checklist

**Status:** Ready for Execution  
**Estimated Time:** 90 minutes  
**Last Updated:** October 14, 2025

This checklist covers all final go-live readiness checks. Execute in order for maximum efficiency.

---

## Prerequisites

### Environment Variables

```bash
export API="https://shomer.app"
export DATABASE_URL="postgresql://shomer_prod:***@localhost:5432/shomer_prod"
export ADMIN_TOKEN="your-admin-jwt-token"
export MOD_TOKEN="your-moderator-jwt-token"
export VIEWER_TOKEN="your-viewer-jwt-token"
export TOKEN="$ADMIN_TOKEN"  # For single-user tests
```

### Required Tools

- [ ] `curl` - HTTP client
- [ ] `jq` - JSON processor
- [ ] `psql` - PostgreSQL client
- [ ] `exiftool` - EXIF metadata tool
- [ ] `pdftotext` - PDF text extractor (poppler-utils)
- [ ] `k6` - Load testing tool (optional)

---

## Phase 1: Supply Chain & Security (20 min)

### 1.1 SBOM Generation & Image Signing

**Manual Steps:**
```bash
# Generate SBOMs
syft packages ghcr.io/yourorg/shomer-api:latest -o spdx-json > sbom-api.json
syft packages ghcr.io/yourorg/shomer-web:latest -o spdx-json > sbom-web.json

# Sign images with Cosign
cosign sign ghcr.io/yourorg/shomer-api:latest
cosign sign ghcr.io/yourorg/shomer-web:latest
```

- [ ] API SBOM generated
- [ ] Web SBOM generated
- [ ] API image signed
- [ ] Web image signed
- [ ] SBOMs archived in CI artifacts

**Automated CI/CD:**
- [ ] `.github/workflows/security-scan.yml` configured
- [ ] CI runs `pip-audit` with `--fail-on high`
- [ ] CI runs `npm audit --omit=dev` with high threshold
- [ ] Vulnerability reports generated

### 1.2 Dependency Scanning

```bash
cd apps/api
pip-audit --requirement requirements.txt --fail-on high

cd ../web
npm audit --omit=dev --audit-level=high
```

- [ ] Python dependencies scanned
- [ ] Node dependencies scanned
- [ ] No high/critical vulnerabilities
- [ ] SBOM/vulnerability reports reviewed

---

## Phase 2: Security Headers & CSP + Phase 2.5 Hardening (20 min)

### 2.1 Run Header Tests

```bash
cd apps/api/tests/preflight
./test_security_headers.sh https://shomer.app
```

### 2.2 Verify Required Headers

- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: SAMEORIGIN` or `DENY`
- [ ] `Content-Security-Policy: default-src 'self'...`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

### 2.3 CSP Details

Verify CSP includes:
- [ ] `default-src 'self'`
- [ ] `img-src 'self' data: blob:`
- [ ] `connect-src 'self' https://api.twilio.com https://api.sendgrid.com`
- [ ] `frame-ancestors 'none'`

### 2.4 Mixed Content Check

- [ ] No HTTP resources on HTTPS pages
- [ ] All fonts/images load correctly
- [ ] No console errors about mixed content

### 2.5 Phase 2.5 Hardening Checks

**Signed URL Verification:**
```bash
# Generate a signed URL
curl -X GET "$API/api/v1/evidence/1/export-chain-of-custody/signed-url" \
  -H "Authorization: Bearer $MOD_TOKEN" | jq .

# Test the signed URL (should work without auth)
# Save the URL from above response
SIGNED_URL="<url from response>"
curl -I "$SIGNED_URL"
```

- [ ] Signed URL generated successfully
- [ ] URL contains `token=` parameter
- [ ] Accessing signed URL returns 200 (PDF)
- [ ] Accessing without token returns 401
- [ ] Expired token returns 403

**MIME Validation Test:**
```bash
# Try to upload a file with mismatched extension
echo "test" > fake.pdf  # Text file with PDF extension
curl -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -F "file=@fake.pdf" \
  -F "evidence_type=document" \
  -F "description=test"
```

- [ ] Mismatched MIME/extension rejected (400)
- [ ] Valid files accepted (JPEG as .jpg, PNG as .png, etc.)
- [ ] Error message mentions "Invalid file type"

**Security Headers Enhanced:**
- [ ] `Strict-Transport-Security` includes `preload`
- [ ] `X-Frame-Options: DENY` (not SAMEORIGIN)
- [ ] `Referrer-Policy: no-referrer`
- [ ] `Permissions-Policy` header present
- [ ] CSP includes `frame-ancestors 'none'`

**Dependabot & Security Audit:**
- [ ] `.github/dependabot.yml` present
- [ ] `.github/workflows/security-audit.yml` present
- [ ] Security audit workflow runs manually
- [ ] Dependabot PRs visible (if enabled)

**Evidence Detail Page:**
- [ ] Navigate to `/dashboard/evidence/1`
- [ ] Metadata displays (hashes, timestamps)
- [ ] Chain of custody timeline renders
- [ ] "Get Signed Link" button works
- [ ] Signed URL displays with copy button
- [ ] Verify/Seal/Download actions present

---

## Phase 3: Authentication & CSRF (10 min)

### 3.1 JWT Cookie Security

```bash
./test_auth_csrf.sh
```

Verify JWT cookie has:
- [ ] `HttpOnly` flag
- [ ] `Secure` flag
- [ ] `SameSite=Strict` or `SameSite=Lax`

### 3.2 CSRF Protection

- [ ] CSRF token present on GET requests
- [ ] POST without CSRF token returns 403
- [ ] POST with valid CSRF token succeeds
- [ ] POST with invalid CSRF token returns 403

### 3.3 DevTools Check

Open browser DevTools → Network:
- [ ] CSRF token in cookies
- [ ] `X-CSRF-Token` header on mutating requests
- [ ] JWT not accessible via JavaScript

---

## Phase 4: RBAC Negative Tests (10 min)

### 4.1 Run RBAC Tests

```bash
export ADMIN_TOKEN="admin-jwt"
export MOD_TOKEN="moderator-jwt"
export VIEWER_TOKEN="viewer-jwt"
./test_rbac.sh
```

### 4.2 Verify Access Controls

Viewer role:
- [ ] Cannot create incidents (403)
- [ ] Cannot update alerts (403)

Moderator role:
- [ ] Cannot create users (403)
- [ ] Cannot delete users (403)
- [ ] Cannot access admin settings (403)

Evidence operations:
- [ ] Export without JWT returns 401
- [ ] Verify without JWT returns 401
- [ ] Upload without JWT returns 401

---

## Phase 5: Rate Limiting (10 min)

### 5.1 Run Rate Limit Tests

```bash
./test_rate_limits.sh
```

### 5.2 Verify Limits

General API (60/min/IP):
- [ ] Request 80/min → expect 429s after 60
- [ ] 429 includes `Retry-After` header

Evidence uploads (10/min):
- [ ] Request 15/min → expect 429s after 10
- [ ] 429 includes `Retry-After` header

Exports (5/min/user):
- [ ] Request 10/min → expect 429s after 5
- [ ] 429 includes `Retry-After` header

---

## Phase 6: Database Immutability (5 min)

### 6.1 Run Immutability Tests

```bash
./test_immutability.sh
```

### 6.2 Verify Triggers

Chain-of-custody:
- [ ] UPDATE attempt blocked
- [ ] DELETE attempt blocked
- [ ] Trigger error message contains "immutable"

Sealed evidence:
- [ ] file_path UPDATE blocked
- [ ] sha256_hash UPDATE blocked
- [ ] DELETE blocked
- [ ] Status update allowed (workflow)

---

## Phase 7: PDF Determinism (10 min)

### 7.1 Run PDF Tests

```bash
./test_pdf_determinism.sh
```

### 7.2 Verify PDF Output

Export same evidence twice:
- [ ] Byte size nearly identical (< 100 bytes diff)
- [ ] Reference number matches
- [ ] SHA-256 hash matches
- [ ] Chain-of-custody entry count matches

Timestamp format:
- [ ] All timestamps in UTC
- [ ] ISO-8601 format: `2025-10-14T12:00:00+00:00`
- [ ] No local timezone offsets

Footer:
- [ ] Git SHA present: `Build: a1b2c3d4`
- [ ] System version included
- [ ] Reference number included

QR Code:
- [ ] QR code image present in PDF
- [ ] QR links to public verification page

---

## Phase 8: Image Privacy (5 min)

### 8.1 Run EXIF Test

```bash
./test_exif_stripping.sh
```

### 8.2 Manual Verification

Upload test photo with GPS:
```bash
# Create test image with EXIF
exiftool -GPS:GPSLatitude="37.7749" \
         -GPS:GPSLongitude="122.4194" \
         test_photo.jpg

# Upload
curl -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_photo.jpg" \
  -F "evidence_type=photo"

# Download and check
# (In production, trust metadata_removed=true in API response)
```

Verify:
- [ ] GPS data removed
- [ ] Camera make/model removed
- [ ] User comments removed
- [ ] Original metadata preserved in DB for audit
- [ ] `metadata_removed=true` in API response

Check stored file:
```bash
exiftool stored.jpg | wc -l  # Should be minimal (< 10 lines)
```

---

## Phase 9: Disaster Drill (10 min)

### 9.1 Quick Backup & Restore

```bash
# Run backup
cd apps/api/scripts
./backup-restore-drill.sh ./test-backup-$(date +%Y%m%d)

# Restore to staging DB (if available)
psql staging_db < ./test-backup-*/db/dump.sql
```

### 9.2 Verify Restore

Pick one evidence ID:
- [ ] Hash matches in restored DB
- [ ] File exists in restored storage
- [ ] Export works from restored env
- [ ] Timestamps preserved correctly

---

## Phase 10: Legal & Communications (5 min)

### 10.1 Legal Compliance

- [ ] Vendor DPAs signed (Twilio, SendGrid)
- [ ] Privacy notice linked from all public forms
- [ ] Terms of service updated with evidence handling
- [ ] Data retention policy documented
- [ ] Evidence acknowledgment template ready

### 10.2 Evidence Received Template

```
Subject: Evidence Received - Ref #[REF_NUMBER]

Your evidence submission has been securely received.

Reference: [REF_NUMBER]
Received: [TIMESTAMP_UTC]
SHA-256: [HASH]

No personally identifying information is included in this message.
For questions, contact support@shomer.app
```

Verify template:
- [ ] No PII echoed in acknowledgment
- [ ] Reference number included
- [ ] Timestamp in UTC
- [ ] Hash included for verification

### 10.3 Transparency Reports

- [ ] Weekly report template ready
- [ ] Oversight board briefing scheduled
- [ ] False positive tracking configured

---

## Phase 11: Post-Launch Watchlist (Planning)

### 11.1 SLO Configuration

Performance targets:
- [ ] p95 API response time < 300ms
- [ ] p95 export time < 2s
- [ ] Error rate < 0.5%

Monitoring configured for:
- [ ] Request latency (p50, p95, p99)
- [ ] Error rates (4xx, 5xx)
- [ ] Upload success rate
- [ ] Verification pass rate

### 11.2 Security Monitoring

Alerts for:
- [ ] Spike in 401/403/429 responses
- [ ] MIME type mismatches
- [ ] Evidence verification failures
- [ ] Unusual export volume

### 11.3 Operational Monitoring

Track:
- [ ] Queue lag (ingestion/alerts)
- [ ] Database bloat (large objects)
- [ ] Storage usage trends
- [ ] Backup success rate

### 11.4 Governance Reports

Weekly transparency mini-report:
- [ ] Tips submitted
- [ ] Incidents created
- [ ] Alerts triggered
- [ ] False positive rate
- [ ] Evidence exports
- [ ] Escalations

---

## Phase 12: Quick Wins (Optional, 10 min)

### 12.1 MIME Enforcement

Already implemented:
- [x] Server-side MIME sniffing
- [x] Extension validation
- [x] Content-Type checking

### 12.2 Signed Export URLs (Future)

Document for Phase 2:
- [ ] Generate short-lived URLs (1 hour TTL)
- [ ] User-scoped tokens
- [ ] Audit all URL access

### 12.3 Evidence Detail Page (Future)

Enhance UI with:
- [ ] Inline re-hash button
- [ ] Timeline visualization
- [ ] Access log display

### 12.4 Auto-Rotation (Future)

Schedule:
- [ ] Weekly JWT signing key rotation
- [ ] Monthly API key rotation
- [ ] Quarterly secret rotation

---

## Master Test Suite

### Run All Tests

```bash
cd apps/api/tests/preflight

# Set all required environment variables
export API="https://shomer.app"
export DATABASE_URL="postgresql://..."
export ADMIN_TOKEN="..."
export MOD_TOKEN="..."
export VIEWER_TOKEN="..."

# Run master suite
./run_all_preflight.sh
```

This will:
1. Run all 7 test suites
2. Generate pass/fail report
3. Create HTML report
4. Exit with appropriate code

### Expected Output

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

---

## Sign-Off Checklist

Before go-live, all stakeholders must sign off:

- [ ] **Engineering Lead** - All technical tests passed
- [ ] **Security Team** - Vulnerability scans clear
- [ ] **Legal Counsel** - Compliance requirements met
- [ ] **Product Manager** - Feature requirements satisfied
- [ ] **Operations** - Monitoring and runbooks in place

---

## Emergency Contacts

- **On-Call Engineer:** [Phone]
- **Security Team:** [Phone/Email]
- **Legal Counsel:** [Phone/Email]
- **Escalation:** See `docs/PILOT_RUNBOOK.md`

---

## Final Go/No-Go Decision

**Criteria for GO:**
- [ ] All pre-flight tests passed (0 failures)
- [ ] All stakeholders signed off
- [ ] Emergency contacts confirmed
- [ ] Monitoring dashboards operational
- [ ] Backup system verified
- [ ] On-call schedule confirmed

**If NO-GO:**
- Document all issues
- Create remediation plan
- Schedule re-test
- Update this checklist

---

**Document Owner:** Engineering Lead  
**Last Review:** October 14, 2025  
**Next Review:** Before production deployment

