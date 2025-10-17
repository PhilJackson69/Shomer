# Security Policy & Threat Model

**Version:** 2.0  
**Last Updated:** January 14, 2025  
**Contact:** security@shomer.local

## Executive Summary

Shomer implements defense-in-depth security with comprehensive RBAC, audit logging, and observability. However, several **P0 critical vulnerabilities** require immediate attention before production deployment.

## Threat Model v0

### Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|------------|------------|------------|
| **Script Kiddies** | Defacement, disruption | Low | High |
| **Hacktivists** | Political messaging | Medium | Medium |
| **Criminal Groups** | Data theft, ransomware | High | Medium |
| **State Actors** | Intelligence gathering | Very High | Low |
| **Insiders** | Data exfiltration, sabotage | High | Low |

### Attack Vectors

1. **Web Application Attacks**
   - SQL injection (mitigated by ORM)
   - XSS (mitigated by React escaping)
   - CSRF (partially mitigated)
   - Authentication bypass

2. **Infrastructure Attacks**
   - Container escape
   - Database compromise
   - Redis cache poisoning
   - Network interception

3. **Social Engineering**
   - Credential phishing
   - Privilege escalation
   - Insider threats

## Critical Security Gaps (P0)

### 🚨 P0.1: Default Credentials in Production
**Risk:** Complete system compromise
**Impact:** Confidentiality, Integrity, Availability
**CVSS:** 9.8 (Critical)

**Current State:**
```bash
# Hardcoded in docker-compose.yml
POSTGRES_PASSWORD=shomer
API_SECRET_KEY=devsecret_change_me
JWT_SECRET=devjwt_change_me
```

**Immediate Actions:**
- [ ] Implement secret rotation service integration
- [ ] Add production secret validation
- [ ] Create secure secret generation scripts

### 🚨 P0.2: Missing 2FA Implementation
**Risk:** Account takeover via credential compromise
**Impact:** Confidentiality, Integrity
**CVSS:** 8.1 (High)

**Current State:**
- JWT-only authentication
- No second factor verification
- No TOTP/SMS backup codes

**Immediate Actions:**
- [ ] Implement TOTP 2FA for admin accounts
- [ ] Add backup recovery codes
- [ ] Enforce 2FA for production admin users

### 🚨 P0.3: Insufficient Rate Limiting
**Risk:** DoS attacks, brute force
**Impact:** Availability
**CVSS:** 7.5 (High)

**Current State:**
```python
# Basic rate limiting implemented but insufficient
limits[ip_key] = {'max_requests': 60, 'window_seconds': 60}
limits[user_key] = {'max_requests': 10, 'window_seconds': 60}
```

**Issues:**
- No progressive backoff
- No distributed rate limiting
- No protection against slow loris attacks

### 🚨 P0.4: Insecure Secret Management
**Risk:** Secret exposure in logs, environment
**Impact:** Confidentiality
**CVSS:** 8.2 (High)

**Current State:**
- Secrets in plain text environment variables
- No secret rotation automation
- Potential secret leakage in error messages

## High Priority Security Gaps (P1)

### 🔴 P1.1: Missing Input Sanitization
**Risk:** XSS, injection attacks
**Impact:** Confidentiality, Integrity
**CVSS:** 6.8 (Medium)

**Issues:**
- User-generated content not sanitized
- File upload validation insufficient
- No CSP headers implemented

### 🔴 P1.2: Inadequate Audit Logging
**Risk:** Security event visibility
**Impact:** Confidentiality, Integrity
**CVSS:** 5.3 (Medium)

**Current State:**
- Basic audit logging implemented
- No log integrity verification
- No centralized log analysis

### 🔴 P1.3: Weak Session Management
**Risk:** Session hijacking, fixation
**Impact:** Confidentiality, Integrity
**CVSS:** 6.1 (Medium)

**Issues:**
- No session invalidation on logout
- No concurrent session limits
- JWT tokens stored in localStorage

### 🔴 P1.4: Missing Security Headers
**Risk:** Various client-side attacks
**Impact:** Confidentiality, Integrity
**CVSS:** 5.9 (Medium)

**Missing Headers:**
- Content Security Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options

## Medium Priority Security Gaps (P2)

### 🟡 P2.1: Insufficient Error Handling
**Risk:** Information disclosure
**Impact:** Confidentiality
**CVSS:** 4.7 (Medium)

**Issues:**
- Stack traces in error responses
- Database errors exposed to clients
- No error rate limiting

### 🟡 P2.2: Missing Backup Encryption
**Risk:** Data exposure in backups
**Impact:** Confidentiality
**CVSS:** 4.3 (Medium)

### 🟡 P2.3: No Intrusion Detection
**Risk:** Delayed threat detection
**Impact:** Confidentiality, Integrity
**CVSS:** 4.1 (Low)

### 🟡 P2.4: Inadequate Monitoring
**Risk:** Delayed incident response
**Impact:** Availability
**CVSS:** 3.9 (Low)

## Security Controls Matrix

| Control | Implementation | Status | Gap |
|---------|---------------|--------|-----|
| **Authentication** | JWT + Bcrypt | ✅ Implemented | Missing 2FA |
| **Authorization** | RBAC (3 roles) | ✅ Implemented | No fine-grained permissions |
| **Input Validation** | Pydantic schemas | ✅ Implemented | Missing sanitization |
| **SQL Injection** | SQLAlchemy ORM | ✅ Implemented | - |
| **XSS Protection** | React escaping | ✅ Implemented | Missing CSP |
| **CSRF Protection** | Middleware | ✅ Implemented | - |
| **Rate Limiting** | Redis token bucket | ⚠️ Partial | Needs improvement |
| **Audit Logging** | Comprehensive | ✅ Implemented | No integrity checks |
| **Secret Management** | Env variables | ❌ Inadequate | Need rotation |
| **Session Security** | JWT tokens | ⚠️ Partial | No invalidation |
| **Error Handling** | Basic | ❌ Inadequate | Info disclosure |
| **Security Headers** | CORS only | ❌ Missing | Need CSP, HSTS |
| **Backup Security** | Basic scripts | ❌ Missing | No encryption |
| **Monitoring** | Prometheus | ⚠️ Partial | No IDS |

## Secrets Policy

### Secret Classification

| Level | Examples | Rotation | Storage |
|-------|----------|----------|---------|
| **Critical** | JWT secrets, DB passwords | 90 days | Vault/AWS Secrets |
| **High** | API keys, certificates | 180 days | Environment + Vault |
| **Medium** | Service tokens | 365 days | Environment |
| **Low** | Public keys, non-sensitive | As needed | Environment |

### Secret Rotation Requirements

1. **Automated Rotation:**
   - Database passwords: Every 90 days
   - JWT secrets: Every 180 days
   - API keys: Every 365 days

2. **Manual Rotation:**
   - On security incident
   - On personnel changes
   - On system compromise

3. **Validation:**
   - Pre-rotation testing
   - Rollback procedures
   - Monitoring during rotation

## PII Logging Policy

### Data Classification

| Type | Examples | Logging | Retention |
|------|----------|---------|-----------|
| **PII** | Names, emails, phone | ❌ Never | N/A |
| **Sensitive** | User IDs, evidence IDs | ✅ Hashed | 30 days |
| **Business** | Incident counts, metrics | ✅ Clear text | 90 days |
| **System** | Request IDs, timestamps | ✅ Clear text | 7 days |

### Logging Standards

1. **Never Log:**
   - Passwords or password hashes
   - Personal names or contact info
   - File contents (evidence)
   - JWT token payloads

2. **Always Hash:**
   - User IDs (use hash prefix)
   - Evidence IDs (use hash prefix)
   - IP addresses (last octet only)

3. **Log Format:**
```
2025-01-14T10:30:45Z | INFO | req-abc123 | user-h456 | evidence-h789 | service | Operation completed
```

## Incident Response Checklist

### Detection (0-15 minutes)
- [ ] Alert received via monitoring system
- [ ] Initial severity assessment
- [ ] Security team notification
- [ ] Incident ticket creation

### Containment (15-60 minutes)
- [ ] Isolate affected systems
- [ ] Preserve evidence (logs, memory dumps)
- [ ] Block malicious IPs/accounts
- [ ] Notify stakeholders

### Investigation (1-4 hours)
- [ ] Forensic analysis of logs
- [ ] Identify attack vector
- [ ] Assess data exposure
- [ ] Document findings

### Recovery (4-24 hours)
- [ ] Patch vulnerabilities
- [ ] Rotate compromised secrets
- [ ] Restore from clean backups
- [ ] Validate system integrity

### Post-Incident (24-48 hours)
- [ ] Root cause analysis
- [ ] Update security controls
- [ ] Conduct lessons learned
- [ ] Update incident response plan

## Security Monitoring

### Real-time Alerts

| Alert | Threshold | Response Time |
|-------|-----------|---------------|
| **Failed Auth** | >10/minute per IP | 15 minutes |
| **Rate Limit** | >5 violations/hour | 30 minutes |
| **SQL Injection** | Any attempt | Immediate |
| **Admin Login** | Any successful | 5 minutes |
| **Data Export** | >10 records/minute | 15 minutes |

### Weekly Security Reviews

- [ ] Review failed authentication attempts
- [ ] Analyze rate limiting violations
- [ ] Check for unusual access patterns
- [ ] Validate backup integrity
- [ ] Review audit logs for anomalies

### Monthly Security Assessments

- [ ] Vulnerability scanning
- [ ] Penetration testing
- [ ] Security control review
- [ ] Incident response drill
- [ ] Security training update

## Compliance Requirements

### Data Protection
- **GDPR:** EU data protection (if applicable)
- **CCPA:** California privacy rights
- **SOX:** Financial reporting controls
- **HIPAA:** Health information (if applicable)

### Security Standards
- **ISO 27001:** Information security management
- **NIST Cybersecurity Framework**
- **OWASP Top 10:** Web application security
- **SOC 2:** Service organization controls

## Security Tools & Technologies

### Current Stack
- **Authentication:** JWT + Bcrypt
- **Authorization:** Custom RBAC
- **Monitoring:** Prometheus + Grafana
- **Logging:** Structured JSON logs
- **Rate Limiting:** Redis token bucket

### Recommended Additions
- **Secret Management:** HashiCorp Vault
- **WAF:** Cloudflare or AWS WAF
- **SIEM:** Splunk or ELK Stack
- **Vulnerability Scanning:** OWASP ZAP
- **Container Security:** Trivy or Snyk

## Security Training Requirements

### Developer Training
- Secure coding practices
- OWASP Top 10 awareness
- Threat modeling basics
- Incident response procedures

### Operations Training
- Security monitoring
- Incident response
- Backup and recovery
- Access management

### Annual Requirements
- Security awareness training
- Incident response drill
- Penetration testing
- Security control review

---

**Next Steps:**
1. Address P0 vulnerabilities immediately
2. Implement secret rotation service
3. Add 2FA for admin accounts
4. Enhance rate limiting
5. Implement security headers

**Contact:** security@shomer.local for security incidents or questions.
