# Production Deployment Security Checklist

## Pre-Deployment Security Validation

### 1. Configuration Validation ✅
- [ ] Run `python -m apps.api.scripts.validate_secrets`
- [ ] Verify `PUBLIC_BASE_URL` is HTTPS in production
- [ ] Confirm `JWT_ALG` is RS256 or EdDSA (not HS256)
- [ ] Validate all secrets are 32+ characters
- [ ] Check `ENVIRONMENT=production` is set

### 2. Security Testing ✅
- [ ] Run `pytest -m security` - all tests must pass
- [ ] Execute 15-minute release gate validation script
- [ ] Verify CSRF protection is working
- [ ] Test rate limiting functionality
- [ ] Validate file upload restrictions
- [ ] Confirm SSRF protection blocks private IPs

### 3. Security Headers Validation ✅
- [ ] CSP header present with nonce
- [ ] HSTS header configured (production only)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] No X-Powered-By header
- [ ] Vary: Origin header present

### 4. Authentication & Authorization ✅
- [ ] JWT tokens expire in 15 minutes
- [ ] Refresh token rotation working
- [ ] 2FA rate limiting active
- [ ] Admin reauthentication required
- [ ] JWKS endpoint accessible at `/.well-known/jwks.json`

### 5. Input Validation & Sanitization ✅
- [ ] File upload validation with libmagic
- [ ] Image dimension limits enforced
- [ ] PDF page count limits enforced
- [ ] Zip bomb protection active
- [ ] SQL injection prevention tested
- [ ] XSS prevention verified

### 6. Monitoring & Logging ✅
- [ ] Security events logged with requestId
- [ ] PII redaction active in logs
- [ ] Log size capped at 2KB
- [ ] Error schema standardized
- [ ] Security event webhook configured

### 7. CI/CD Security Pipeline ✅
- [ ] Semgrep SAST scan passes
- [ ] Trivy vulnerability scan passes
- [ ] Gitleaks secret scan passes
- [ ] CycloneDX SBOM generated
- [ ] Security tests pass in CI

## Post-Deployment Verification

### 8. Live System Testing ✅
- [ ] CSRF protection working on live site
- [ ] Rate limiting active on production
- [ ] File upload restrictions enforced
- [ ] SSRF protection blocking private IPs
- [ ] Security headers present in responses
- [ ] JWKS endpoint serving public keys

### 9. Monitoring Setup ✅
- [ ] Security event alerts configured
- [ ] Rate limit breach alerts active
- [ ] CSRF mismatch monitoring
- [ ] JWT verification failure tracking
- [ ] Upload rejection monitoring
- [ ] Refresh token reuse detection

### 10. Incident Response Readiness ✅
- [ ] Refresh family revoke endpoint tested
- [ ] Security event runbooks available
- [ ] Emergency contact procedures defined
- [ ] Backup and recovery procedures tested
- [ ] Security team notification channels active

## Security Metrics to Monitor

### Authentication Metrics
- JWT verification failures per minute
- Refresh token reuse detections
- 2FA verification failures
- Admin reauthentication requests

### Authorization Metrics
- CSRF token mismatches
- Rate limit violations
- Unauthorized access attempts
- Privilege escalation attempts

### Input Validation Metrics
- File upload rejections by type
- SSRF protection triggers
- SQL injection attempts blocked
- XSS prevention activations

### System Security Metrics
- Security header compliance
- SSL/TLS certificate validity
- Database connection security
- Redis connection security

## Emergency Procedures

### Security Incident Response
1. **Immediate Actions**
   - Revoke all refresh token families: `POST /api/v1/auth/sessions/revoke-all`
   - Check security event logs for scope
   - Activate incident response team

2. **Investigation**
   - Pull last 24h auth logs for anomalies
   - Check for geo/device anomalies
   - Review failed authentication attempts
   - Analyze rate limit violations

3. **Containment**
   - Block offending IP ranges if attack
   - Enable additional WAF rules
   - Increase rate limits temporarily
   - Force password resets if needed

4. **Recovery**
   - Verify all security controls active
   - Test critical security functions
   - Update security configurations if needed
   - Document lessons learned

### Performance Impact Mitigation
- Monitor response times during security enforcement
- Adjust rate limits based on legitimate traffic patterns
- Optimize security header generation
- Balance security vs. performance requirements

## Compliance Requirements

### Data Protection
- [ ] PII redaction active in all logs
- [ ] Data retention policies enforced
- [ ] Encryption at rest and in transit
- [ ] Access logging and monitoring

### Security Standards
- [ ] OWASP Top 10 protections implemented
- [ ] Security headers compliance
- [ ] Input validation standards met
- [ ] Authentication best practices followed

### Audit Requirements
- [ ] Security event logging comprehensive
- [ ] Audit trail integrity maintained
- [ ] Compliance reporting capabilities
- [ ] Regular security assessments scheduled

---

**Deployment Approval**: ✅ Security Team Lead
**Date**: ___________
**Sign-off**: ___________
