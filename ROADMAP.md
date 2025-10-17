# Shomer Platform Roadmap

**Version:** 1.0  
**Generated:** January 14, 2025  
**Owner:** Platform Engineering

## 6-Week Development Plan

This roadmap addresses critical security vulnerabilities and production readiness gaps identified in the platform audit.

## Week 1: Critical Security Fixes (P0)

### 🚨 Priority 1: Secret Management Overhaul
**Files to modify:**
- `apps/api/app/core/config.py`
- `apps/api/app/core/security.py`
- `docker-compose.yml`
- `infra/scripts/secret-rotation.sh` (new)

**Changes:**
- Remove hardcoded secrets from docker-compose.yml
- Implement secret validation on startup
- Add secret strength requirements
- Create secure secret generation utilities

**Acceptance Criteria:**
- No hardcoded secrets in repository
- Application fails fast with invalid secrets
- Secrets meet minimum strength requirements
- Secret rotation script functional

**Test Plan:**
```bash
# Test secret validation
make test-secrets

# Test secret rotation
./infra/scripts/secret-rotation.sh test

# Test application startup with invalid secrets
docker compose up --env-file .env.invalid
```

### 🚨 Priority 2: Enhanced Rate Limiting
**Files to modify:**
- `apps/api/app/middleware/rate_limit.py`
- `apps/api/app/core/config.py`

**Changes:**
- Implement progressive backoff
- Add distributed rate limiting
- Add endpoint-specific limits
- Add rate limit bypass for health checks

**Acceptance Criteria:**
- Progressive backoff after violations
- Different limits for different endpoint types
- Rate limiting works across multiple instances
- Health checks never rate limited

**Test Plan:**
```bash
# Test rate limiting
curl -w "%{http_code}\n" -o /dev/null -s http://localhost:8000/api/v1/incidents/
# Repeat 65 times to trigger rate limit

# Test progressive backoff
# Make requests after rate limit to verify backoff
```

### 🚨 Priority 3: Security Headers Implementation
**Files to modify:**
- `apps/api/app/main.py`
- `apps/web/next.config.js`

**Changes:**
- Add Content Security Policy (CSP)
- Add HSTS headers
- Add X-Frame-Options
- Add X-Content-Type-Options

**Acceptance Criteria:**
- All security headers present in responses
- CSP prevents XSS attacks
- HSTS enforces HTTPS in production
- Headers configurable per environment

**Test Plan:**
```bash
# Test security headers
curl -I http://localhost:8000/api/v1/health | grep -E "(Content-Security-Policy|Strict-Transport-Security|X-Frame-Options)"

# Test CSP effectiveness
# Attempt XSS injection and verify blocking
```

## Week 2: Authentication & Authorization Hardening

### 🔐 Priority 4: 2FA Implementation
**Files to modify:**
- `apps/api/app/models/user.py`
- `apps/api/app/schemas/user.py`
- `apps/api/app/api/v1/endpoints/auth.py`
- `apps/api/app/core/security.py`
- `apps/web/src/components/` (new 2FA components)

**Changes:**
- Add TOTP support using pyotp
- Add backup recovery codes
- Implement 2FA enforcement for admin users
- Add 2FA setup/verification endpoints

**Acceptance Criteria:**
- TOTP codes generated and validated
- Backup codes provided during setup
- Admin users required to enable 2FA
- 2FA can be disabled with recovery codes

**Test Plan:**
```bash
# Test 2FA setup
curl -X POST http://localhost:8000/api/v1/auth/2fa/setup \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test 2FA login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"username": "admin", "password": "admin123", "totp_code": "123456"}'
```

### 🔐 Priority 5: Session Management Enhancement
**Files to modify:**
- `apps/api/app/core/security.py`
- `apps/api/app/api/v1/endpoints/auth.py`
- `apps/web/src/lib/auth.ts`

**Changes:**
- Implement session invalidation on logout
- Add concurrent session limits
- Move JWT storage from localStorage to httpOnly cookies
- Add session timeout warnings

**Acceptance Criteria:**
- Sessions properly invalidated on logout
- Users limited to 3 concurrent sessions
- JWT tokens in httpOnly cookies
- Frontend shows session timeout warnings

**Test Plan:**
```bash
# Test session invalidation
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token')
curl -X POST http://localhost:8000/api/v1/auth/logout -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/v1/users/me -H "Authorization: Bearer $TOKEN"  # Should fail
```

## Week 3: Input Validation & Sanitization

### 🛡️ Priority 6: Enhanced Input Sanitization
**Files to modify:**
- `apps/api/app/schemas/` (all schema files)
- `apps/api/app/core/validation.py` (new)
- `apps/web/src/lib/validation.ts` (new)

**Changes:**
- Add HTML sanitization for user content
- Implement file upload validation
- Add SQL injection prevention layers
- Add content filtering for malicious patterns

**Acceptance Criteria:**
- All user input sanitized before storage
- File uploads validated for type and content
- SQL injection attempts logged and blocked
- Malicious content patterns detected

**Test Plan:**
```bash
# Test HTML sanitization
curl -X POST http://localhost:8000/api/v1/tips/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "<script>alert(\"xss\")</script>Safe content"}'

# Test file upload validation
curl -X POST http://localhost:8000/api/v1/evidence/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@malicious.exe"
```

### 🛡️ Priority 7: Error Handling Security
**Files to modify:**
- `apps/api/app/core/exceptions.py` (new)
- `apps/api/app/main.py`
- `apps/api/app/middleware/error_handler.py` (new)

**Changes:**
- Implement secure error responses
- Add error rate limiting
- Sanitize error messages for clients
- Add error monitoring and alerting

**Acceptance Criteria:**
- No sensitive information in error responses
- Error rate limiting prevents information disclosure
- Client errors are sanitized but helpful
- Server errors trigger monitoring alerts

**Test Plan:**
```bash
# Test error sanitization
curl http://localhost:8000/api/v1/nonexistent  # Should not expose stack trace

# Test error rate limiting
# Generate multiple errors and verify rate limiting
```

## Week 4: Monitoring & Observability Enhancement

### 📊 Priority 8: Advanced Security Monitoring
**Files to modify:**
- `apps/api/app/core/observability.py`
- `infra/grafana/dashboards/security.json` (new)
- `infra/prometheus/security-rules.yml` (new)

**Changes:**
- Add security-specific metrics
- Implement intrusion detection rules
- Add real-time security dashboards
- Create security alerting rules

**Acceptance Criteria:**
- Security metrics collected and exposed
- Intrusion detection alerts configured
- Security dashboard shows real-time threats
- Alerts trigger on security events

**Test Plan:**
```bash
# Test security metrics
curl http://localhost:8000/metrics | grep security

# Test security alerts
# Trigger security event and verify alert
```

### 📊 Priority 9: Backup & Recovery Security
**Files to modify:**
- `apps/api/scripts/backup-restore-drill.sh`
- `infra/scripts/encrypted-backup.sh` (new)
- `apps/api/app/services/backup_service.py` (new)

**Changes:**
- Implement encrypted backups
- Add backup integrity verification
- Create automated backup rotation
- Add backup restoration testing

**Acceptance Criteria:**
- All backups encrypted at rest
- Backup integrity verified automatically
- Automated backup rotation schedule
- Monthly backup restoration drills

**Test Plan:**
```bash
# Test backup encryption
./infra/scripts/encrypted-backup.sh test

# Test backup integrity
./infra/scripts/encrypted-backup.sh verify

# Test backup restoration
./apps/api/scripts/backup-restore-drill.sh
```

## Week 5: Production Hardening

### 🏭 Priority 10: Production Security Hardening
**Files to modify:**
- `apps/api/Dockerfile`
- `infra/nginx/nginx.conf`
- `infra/terraform/security.tf` (new)
- `apps/api/app/core/config.py`

**Changes:**
- Implement container security hardening
- Add WAF configuration
- Implement network segmentation
- Add production security validation

**Acceptance Criteria:**
- Containers run as non-root user
- WAF blocks common attacks
- Network traffic properly segmented
- Production security checklist automated

**Test Plan:**
```bash
# Test container security
docker run --rm -it shomer-api:latest whoami  # Should not be root

# Test WAF functionality
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '<script>alert("xss")</script>'

# Test network segmentation
# Verify services can only communicate as needed
```

## Week 6: Testing & Validation

### 🧪 Security Testing & Validation
**Files to create:**
- `tests/security/` (new directory)
- `tests/security/test_authentication.py`
- `tests/security/test_authorization.py`
- `tests/security/test_input_validation.py`
- `tests/security/test_rate_limiting.py`

**Changes:**
- Implement comprehensive security test suite
- Add penetration testing scenarios
- Create security validation scripts
- Add security regression tests

**Acceptance Criteria:**
- All security features covered by tests
- Penetration testing scenarios pass
- Security validation scripts automated
- No security regressions in CI/CD

**Test Plan:**
```bash
# Run security test suite
make test-security

# Run penetration tests
make test-pentest

# Run security validation
make validate-security
```

## Implementation Guidelines

### PR Size Limits
Each PR should be ≤200 LOC and focused on a single security concern.

### Testing Requirements
- Unit tests for all new security features
- Integration tests for security workflows
- Manual testing for complex security scenarios
- Performance testing for rate limiting

### Documentation Updates
- Update SECURITY.md with new controls
- Update API documentation with new endpoints
- Update deployment guides with security requirements
- Create security runbooks for operations

### Deployment Strategy
1. Deploy to staging environment
2. Run security validation suite
3. Conduct security review
4. Deploy to production with monitoring
5. Verify security controls active

## Success Metrics

### Security Metrics
- Zero P0 vulnerabilities
- <5 P1 vulnerabilities
- 100% test coverage for security features
- <1 minute mean time to detection for security events

### Operational Metrics
- <5 minute deployment time
- 99.9% uptime during deployments
- Zero security-related incidents
- 100% compliance with security checklist

## Risk Mitigation

### High-Risk Changes
- Secret management changes
- Authentication system modifications
- Database schema changes

### Rollback Procedures
- Automated rollback triggers
- Database migration rollbacks
- Secret rotation rollbacks
- Feature flag toggles

### Monitoring During Deployment
- Real-time security metrics
- Error rate monitoring
- Performance impact assessment
- User experience monitoring

---

**Next Steps:**
1. Begin with P0 secret management fixes
2. Set up security testing framework
3. Create staging environment for testing
4. Establish security review process

**Contact:** platform-engineering@shomer.local for questions or issues.
