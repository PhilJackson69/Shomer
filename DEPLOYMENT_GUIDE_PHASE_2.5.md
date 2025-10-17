# Phase 2.5 Hardening - Quick Deployment Guide

## Pre-Deployment Checklist

- [ ] Git repository is clean (no uncommitted changes)
- [ ] All tests passing locally
- [ ] Environment variables prepared
- [ ] SSL/TLS certificates in place (`infra/nginx/certs/`)

## Step 1: Verify Implementation

```bash
# Make script executable
chmod +x verify-phase-2.5.sh

# Run verification
./verify-phase-2.5.sh
```

**Expected:** All checks pass (green ✓)

## Step 2: Set Environment Variables

Edit `.env.production` or your secrets manager:

```bash
# Phase 2.5 Hardening - Required Variables
SIGNED_URL_SECRET=$(openssl rand -hex 32)
SIGNED_URL_DEFAULT_TTL_SECONDS=600
PUBLIC_BASE_URL=https://your-domain.com

# Verify these existing variables
WEB_ORIGIN=https://your-domain.com
FEATURE_EVIDENCE=true
```

## Step 3: Install Backend Dependencies

```bash
cd apps/api

# For python-magic (MIME detection)
# Linux/Mac:
pip install python-magic

# Windows:
pip install python-magic-bin

# Verify installation
python -c "import magic; print('OK')"
```

## Step 4: Run Tests

```bash
# Run new tests
pytest tests/test_mime_validator.py -v
pytest tests/test_signed_export.py -v

# Run all evidence tests
pytest tests/test_evidence.py -v

# Expected: All tests pass
```

## Step 5: Build and Deploy

```bash
# Set Git SHA for tracking
export GIT_SHA=$(git rev-parse --short HEAD)

# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
```

## Step 6: Verify Deployment

### 6.1 Security Headers

```bash
curl -I https://your-domain.com/ | grep -E "Strict-Transport|X-Content-Type|X-Frame-Options"
```

**Expected output:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### 6.2 Signed URLs (requires moderator JWT)

```bash
# Generate signed URL
curl -X GET "https://your-domain.com/api/v1/evidence/1/export-chain-of-custody/signed-url" \
  -H "Authorization: Bearer $MOD_TOKEN"

# Expected: JSON with url, expires_in, reference_number
```

### 6.3 MIME Validation

```bash
# Create fake PDF (text file with .pdf extension)
echo "not a pdf" > fake.pdf

# Try to upload
curl -X POST "https://your-domain.com/api/v1/evidence/upload" \
  -H "Authorization: Bearer $MOD_TOKEN" \
  -F "file=@fake.pdf" \
  -F "evidence_type=document" \
  -F "description=test"

# Expected: 400 Bad Request with "Invalid file type" message
```

### 6.4 Evidence Detail Page

1. Open browser: `https://your-domain.com/dashboard/evidence/list`
2. Click any evidence item
3. Verify page loads with:
   - Metadata (hashes, timestamps)
   - Timeline
   - Action buttons
   - "Get Signed Link" button

## Step 7: Enable GitHub Workflows

### Enable Dependabot

```bash
# Check if Dependabot is enabled
gh api repos/OWNER/REPO/vulnerability-alerts
```

Or visit: `https://github.com/OWNER/REPO/settings/security_analysis`

### Test Security Audit Workflow

```bash
# Manually trigger
gh workflow run security-audit.yml

# Check status
gh run list --workflow=security-audit.yml
```

## Step 8: Post-Deployment Monitoring

### Monitor for 24 hours

```bash
# Watch API logs for errors
docker compose -f docker-compose.prod.yml logs -f api | grep -E "ERROR|WARN"

# Watch for MIME validation
docker compose -f docker-compose.prod.yml logs -f api | grep "Invalid file type"

# Watch for signed URL usage
docker compose -f docker-compose.prod.yml logs -f api | grep "signed-url"
```

### Check Metrics Dashboard

Monitor these metrics:
- API response times (should be unchanged)
- Error rates (should be < 1%)
- Security header compliance (SecurityHeaders.com)
- MIME validation rejections

## Rollback Plan (if needed)

```bash
# Stop current version
docker compose -f docker-compose.prod.yml down

# Revert to previous Git tag
git checkout <previous-tag>

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Verify rollback
curl -I https://your-domain.com/
```

## Troubleshooting

### Issue: python-magic not found

```bash
# Install system library
# Ubuntu/Debian:
sudo apt-get install libmagic1

# macOS:
brew install libmagic

# Rebuild container
docker compose -f docker-compose.prod.yml build api
```

### Issue: Signed URLs not working

Check:
1. `SIGNED_URL_SECRET` is set (not empty)
2. `PUBLIC_BASE_URL` matches your domain
3. Token not expired (default 10 minutes)
4. Token not tampered with

Debug:
```bash
# Check environment variables
docker compose -f docker-compose.prod.yml exec api env | grep SIGNED_URL
```

### Issue: MIME validation failing for valid files

Check:
1. python-magic installed correctly
2. File is actually the type you think it is
3. File extension matches MIME type

Debug:
```bash
# Check file type
file your-file.jpg

# Test MIME detection
python -c "import magic; print(magic.from_file('your-file.jpg', mime=True))"
```

### Issue: CSP blocking resources

Check browser console for CSP violations. Update `connect-src` in nginx.conf if needed:

```nginx
add_header Content-Security-Policy "... connect-src 'self' https://your-api.com ..."
```

## Success Criteria

✅ All security headers return correct values  
✅ Signed URLs generate and work correctly  
✅ MIME validation rejects mismatched files  
✅ Evidence detail page loads and functions  
✅ Dependabot PRs appear (within 24 hours)  
✅ Security audit workflow runs successfully  
✅ No increase in error rates  
✅ No user complaints about functionality

## Next Steps

1. **Week 1:**
   - Review Dependabot PRs
   - Address any security findings
   - Gather user feedback

2. **Month 1:**
   - Rotate `SIGNED_URL_SECRET`
   - Review security audit trends
   - Update documentation based on learnings

3. **Quarter 1:**
   - Schedule security audit (external)
   - Review and update allowlists
   - Plan next security enhancements

## Support

- **Documentation:** `PHASE_2.5_HARDENING_SUMMARY.md`
- **Security:** `docs/SECURITY.md`
- **Issues:** GitHub Issues
- **Emergency:** security@shomer.local

---

**Deployment Time Estimate:** 30-45 minutes  
**Rollback Time:** 5-10 minutes  
**Risk Level:** Low (no breaking changes)


