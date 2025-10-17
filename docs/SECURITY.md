# Security Policy

**Version:** 1.0  
**Last Updated:** January 14, 2025  
**Contact:** security@shomer.local

## Our Security Commitment

Shomer is built security-first. We protect community safety information with industry-leading security practices, transparency, and continuous improvement.

**Core Principles:**
- 🔐 **Defense in Depth**: Multiple layers of security
- 🔍 **Continuous Monitoring**: 24/7 threat detection
- 📊 **Transparency**: Open source and documented
- ⚡ **Rapid Response**: Incidents handled within hours
- 🛡️ **Privacy by Design**: Security that protects privacy

---

## Table of Contents

1. [Security Architecture](#1-security-architecture)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [Data Protection](#3-data-protection)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Infrastructure Security](#5-infrastructure-security)
6. [Application Security](#6-application-security)
7. [Incident Response](#7-incident-response)
8. [Vulnerability Disclosure](#8-vulnerability-disclosure)
9. [Compliance & Auditing](#9-compliance--auditing)
10. [Security Best Practices](#10-security-best-practices)

---

## 1. Security Architecture

### 1.1 Defense in Depth

We implement **multiple layers** of security:

```
┌─────────────────────────────────────────────┐
│  Layer 7: User Education & Awareness        │
├─────────────────────────────────────────────┤
│  Layer 6: Application Security (WAF, CSRF)  │
├─────────────────────────────────────────────┤
│  Layer 5: Access Control (RBAC, 2FA)        │
├─────────────────────────────────────────────┤
│  Layer 4: Data Encryption (TLS, AES-256)    │
├─────────────────────────────────────────────┤
│  Layer 3: Network Security (Firewall, VPC)  │
├─────────────────────────────────────────────┤
│  Layer 2: Infrastructure (Hardened servers) │
├─────────────────────────────────────────────┤
│  Layer 1: Physical Security (Cloud provider)│
└─────────────────────────────────────────────┘
```

### 1.2 Security Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Encryption in Transit** | TLS 1.3 | Protect data moving between systems |
| **Encryption at Rest** | AES-256 | Protect stored data |
| **Password Hashing** | Bcrypt (cost 12) | Secure password storage |
| **Authentication** | JWT + httpOnly cookies | Secure session management |
| **Authorization** | RBAC with permissions | Granular access control |
| **Audit Logging** | Immutable logs | Track all security events |
| **Monitoring** | Real-time alerts | Detect suspicious activity |
| **Backups** | Encrypted, versioned | Disaster recovery |

---

## 2. Role-Based Access Control (RBAC)

### 2.1 Role Hierarchy

Shomer uses **three primary roles** with escalating privileges:

#### 👤 **User** (Read-Only)
**Purpose:** View-only access for general community members

**Permissions:**
- ✅ View incident reports (not sensitive details)
- ✅ View public safety information
- ✅ Submit anonymous tips
- ❌ Cannot create incidents
- ❌ Cannot send alerts
- ❌ Cannot access personal information

**Use case:** Community members, observers

---

#### 👮 **Moderator** (Triage & Response)
**Purpose:** Front-line security team members who triage and respond

**Permissions:**
- ✅ All User permissions
- ✅ Create and update incidents
- ✅ Review all submitted tips
- ✅ Send alerts (SMS, Email)
- ✅ Manage event security planning
- ✅ View contact information from tips (when provided)
- ❌ Cannot modify user accounts
- ❌ Cannot access audit logs
- ❌ Cannot change system settings

**Requirements:**
- Background check completed
- Training certification
- Signed confidentiality agreement

**Use case:** Security coordinators, safety team members

---

#### 👑 **Administrator** (Full Access)
**Purpose:** System administrators and organizational leadership

**Permissions:**
- ✅ All Moderator permissions
- ✅ Manage user accounts and roles
- ✅ Access audit logs
- ✅ Configure system settings
- ✅ Manage data retention policies
- ✅ Export data for compliance
- ✅ Configure integrations

**Requirements:**
- Enhanced background check
- Advanced security training
- Multi-factor authentication (REQUIRED)
- Logged and reviewed access

**Use case:** IT administrators, executive leadership

---

### 2.2 Permission Matrix

Detailed permission breakdown:

| Resource | User | Moderator | Admin |
|----------|------|-----------|-------|
| **Tips** |
| Submit anonymously | ✅ | ✅ | ✅ |
| View all tips | ❌ | ✅ | ✅ |
| View contact info | ❌ | ✅ (if provided) | ✅ |
| Convert to incident | ❌ | ✅ | ✅ |
| Delete | ❌ | ❌ | ✅ |
| **Incidents** |
| View public incidents | ✅ | ✅ | ✅ |
| Create incidents | ❌ | ✅ | ✅ |
| Update status | ❌ | ✅ | ✅ |
| Delete | ❌ | ❌ | ✅ |
| **Alerts** |
| Receive alerts | ✅ | ✅ | ✅ |
| Send alerts | ❌ | ✅ | ✅ |
| View alert history | ❌ | ✅ | ✅ |
| **Events** |
| View events | ✅ | ✅ | ✅ |
| Create/plan events | ❌ | ✅ | ✅ |
| Export plans | ❌ | ✅ | ✅ |
| **Admin** |
| Manage users | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ✅ |
| Data retention | ❌ | ❌ | ✅ |

### 2.3 Access Control Enforcement

**Every API request is checked** against RBAC policies:

```python
@require_permission(Permission.INCIDENT_UPDATE)
async def update_incident(incident_id: int, current_user: User):
    # Permission checked BEFORE executing
    if not has_permission(current_user, Permission.INCIDENT_UPDATE):
        raise HTTP_403_FORBIDDEN
    # ... proceed with update
```

**Failed access attempts:**
- Logged to audit trail
- User notified of denial
- Repeated failures trigger security review

---

## 3. Data Protection

### 3.1 Encryption at Rest

**All stored data is encrypted** using AES-256:

| Data Type | Encryption Method | Key Management |
|-----------|-------------------|----------------|
| Database | AES-256-GCM | Cloud KMS, rotated quarterly |
| File uploads | AES-256-GCM | Per-file keys, managed by S3 |
| Backups | AES-256-GCM | Separate keys, offline storage |
| Logs | AES-256-GCM | Append-only, tamper-evident |
| Configuration | Encrypted secrets | Environment variables, Secrets Manager |

**Key management:**
- Keys stored in dedicated Key Management Service (AWS KMS, Google Cloud KMS)
- Automatic key rotation every 90 days
- Access to keys logged and audited
- Keys never stored in application code

### 3.2 Encryption in Transit

**All network traffic is encrypted:**

| Connection | Protocol | Configuration |
|------------|----------|---------------|
| Web browser → API | HTTPS/TLS 1.3 | Certificate pinning, HSTS enabled |
| API → Database | TLS 1.2+ | Certificate authentication |
| API → Redis | TLS 1.2+ | Password + certificate |
| API → External services | HTTPS/TLS 1.3 | Certificate validation |

**TLS Configuration:**
- Minimum TLS 1.2 (prefer TLS 1.3)
- Strong cipher suites only
- Perfect Forward Secrecy (PFS)
- HSTS header (max-age=31536000)
- Certificate from trusted CA

### 3.3 Data Minimization

**We collect only what's necessary:**

**For anonymous tips:**
- No account required
- Optional contact information
- IP addresses deleted after 7 days
- EXIF data stripped from photos

**For registered users:**
- Email (for authentication)
- Role (for permissions)
- Optional: Name, phone

**Not collected:**
- Social security numbers
- Financial information
- Unnecessary personal data

### 3.4 Secure Data Deletion

**Data is securely deleted** according to retention policies:

**Standard deletion:**
- Overwrite with random data (3 passes)
- Database records marked as deleted
- Backups purged after retention period

**Legal hold:**
- Data preserved if legally required
- Documented in audit log
- Automatically reviewed quarterly

---

## 4. Authentication & Authorization

### 4.1 Password Security

**Strong password requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Cannot be common passwords (checked against breach database)
- Cannot reuse last 5 passwords

**Password storage:**
- Bcrypt hashing (cost factor 12)
- Per-user random salt
- Never stored in plain text
- Never visible to administrators

**Password reset:**
- Secure token sent via email
- Expires after 1 hour
- One-time use only
- Requires email verification

### 4.2 Multi-Factor Authentication (MFA)

**Available for all users, REQUIRED for administrators:**

**Supported methods:**
- Time-based One-Time Passwords (TOTP) - Google Authenticator, Authy
- SMS codes (backup method)
- Recovery codes (printed backup)

**MFA enforcement:**
- Administrators: Required within 7 days of account creation
- Moderators: Strongly recommended
- Users: Optional

### 4.3 Session Management

**Secure session handling:**

| Setting | Value | Purpose |
|---------|-------|---------|
| Session duration | 1 hour (active), 24 hours (max) | Limit exposure |
| Cookie flags | httpOnly, Secure, SameSite=Strict | Prevent XSS/CSRF |
| Session storage | Redis with encryption | Fast, secure |
| Concurrent sessions | Max 3 per user | Detect account sharing |
| Idle timeout | 30 minutes | Auto-logout |

**Session invalidation:**
- Logout button (immediate)
- Password change (all sessions)
- Role change (all sessions)
- Suspicious activity (automatic)

### 4.4 Account Lockout

**Protection against brute force:**
- 5 failed login attempts → 15 minute lockout
- 10 failed attempts → 1 hour lockout
- 20 failed attempts → Account locked (admin unlock required)

**Lockout notification:**
- Email sent to account owner
- Admin notified for suspicious patterns
- IP address logged

---

## 5. Infrastructure Security

### 5.1 Network Security

**Network isolation:**
- Private Virtual Private Cloud (VPC)
- Database not publicly accessible
- Backend services in private subnets
- Web tier in public subnet (load balanced)

**Firewall rules:**
```
Incoming:
  - Port 443 (HTTPS) from anywhere
  - Port 22 (SSH) from VPN only
  - All other ports blocked

Outgoing:
  - Port 443 (HTTPS) for API calls
  - Port 25/587 (Email) for notifications
  - All other ports blocked by default
```

**DDoS Protection:**
- Cloud provider DDoS mitigation
- Rate limiting (100 requests/minute per IP)
- WAF rules for common attacks

### 5.2 Server Hardening

**All servers are hardened:**
- Minimal installed packages
- Automatic security updates
- SSH key-only authentication (no passwords)
- Fail2ban for intrusion prevention
- Host-based firewall (iptables/nftables)
- SELinux/AppArmor enabled

**Regular maintenance:**
- Weekly security patches
- Monthly full system updates
- Quarterly OS version upgrades
- Annual infrastructure refresh

### 5.3 Container Security

**Docker containers are secured:**
- Non-root user inside containers
- Read-only root filesystem where possible
- No privileged containers
- Minimal base images (Alpine Linux)
- Regular vulnerability scanning (Trivy)
- Image signing and verification

---

## 6. Application Security

### 6.1 Input Validation

**All user input is validated:**

**Server-side validation:**
- Type checking (string, number, email, etc.)
- Length limits
- Format validation (regex)
- Sanitization (remove dangerous characters)
- Parameterized queries (prevent SQL injection)

**Example protections:**
```python
# SQL Injection protection (using ORM)
user = db.query(User).filter(User.email == email).first()  # Safe

# XSS protection (automatic escaping)
<div>{tip.content}</div>  # React auto-escapes

# CSRF protection (token validation)
@csrf_protect
def submit_form(...):  # Token checked
```

### 6.2 Common Vulnerability Prevention

| Vulnerability | Protection | Implementation |
|---------------|------------|----------------|
| **SQL Injection** | Parameterized queries | SQLAlchemy ORM |
| **XSS (Cross-Site Scripting)** | Auto-escaping | React, Content Security Policy |
| **CSRF (Cross-Site Request Forgery)** | CSRF tokens | Django-style tokens |
| **Clickjacking** | X-Frame-Options | DENY header |
| **MIME Sniffing** | X-Content-Type-Options | nosniff header |
| **Path Traversal** | Input validation | Whitelist paths only |
| **File Upload Attacks** | Type validation, size limits | EXIF stripping |
| **Command Injection** | No shell execution | Use libraries, not exec() |

### 6.3 API Security

**RESTful API protections:**
- JWT authentication required (except public endpoints)
- Rate limiting (100 req/min per user)
- Input validation on all endpoints
- Output encoding
- CORS restrictions (whitelist only)
- API versioning (breaking changes handled gracefully)

**Public endpoints (no auth required):**
- `/health` - Health check
- `/api/v1/tips` (POST only) - Submit tips
- `/api/v1/auth/login` - Login

**All other endpoints require authentication.**

### 6.4 Dependency Management

**Third-party dependencies are monitored:**
- Automated vulnerability scanning (Dependabot)
- Weekly dependency updates
- No dependencies with known critical vulnerabilities
- Minimal dependency tree
- All dependencies pinned to specific versions

**Update process:**
- Security patches: Within 48 hours
- Minor updates: Weekly review
- Major updates: Tested thoroughly before deployment

---

## 7. Incident Response

### 7.1 Incident Response Team

**Security incidents are handled by:**
- **Security Lead**: Overall incident coordination
- **Technical Lead**: Investigation and remediation
- **Communications Lead**: User notification
- **Legal Counsel**: Legal/regulatory compliance (if needed)

**Contact:** security@shomer.local (monitored 24/7)

### 7.2 Incident Response Process

**We follow a structured 5-phase response:**

#### Phase 1: Detection & Analysis (0-1 hour)
```
1. Incident detected (automated monitoring or report)
2. Security team alerted immediately
3. Initial assessment:
   - What happened?
   - What data was affected?
   - Is it ongoing?
   - What's the severity?
4. Decision: Escalate or false alarm?
```

**Severity Levels:**
- **P0 (Critical)**: Active data breach, system compromise
- **P1 (High)**: Vulnerability with known exploit
- **P2 (Medium)**: Vulnerability without known exploit
- **P3 (Low)**: Minor issue, no immediate risk

#### Phase 2: Containment (1-4 hours)
```
1. Stop the bleeding:
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Disable vulnerable features
2. Preserve evidence (for investigation)
3. Implement temporary workarounds
4. Communicate with stakeholders
```

#### Phase 3: Eradication (4-24 hours)
```
1. Identify root cause
2. Remove threat completely:
   - Patch vulnerabilities
   - Remove malware
   - Close security gaps
3. Verify threat is eliminated
4. Conduct thorough security scan
```

#### Phase 4: Recovery (24-72 hours)
```
1. Restore normal operations:
   - Bring systems back online
   - Restore from clean backups (if needed)
   - Monitor for recurrence
2. Enhanced monitoring for 7 days
3. Verify data integrity
4. Resume normal services
```

#### Phase 5: Post-Incident Review (Within 7 days)
```
1. Document incident thoroughly
2. Conduct lessons learned meeting
3. Identify improvements:
   - What worked?
   - What didn't?
   - What should we change?
4. Update incident response plan
5. Implement preventive measures
6. Publish transparency report (if applicable)
```

### 7.3 User Notification

**We notify affected users within 72 hours if:**
- Personal information was accessed
- Accounts were compromised
- Data integrity was affected

**Notification includes:**
- What happened (in plain English)
- What data was affected
- What we're doing about it
- What you should do
- Who to contact with questions

**Communication channels:**
- Email to affected users
- Website notice
- Social media (for widespread incidents)
- Press release (for major incidents)

### 7.4 Incident Escalation

**Escalation criteria:**

| Condition | Action |
|-----------|--------|
| Personal data breach | Notify affected users within 72 hours |
| Regulatory reporting required | Notify authorities per legal requirements |
| Law enforcement needed | Contact local/federal authorities |
| Media coverage | Activate PR response plan |
| System compromise | Engage external security firm |

---

## 8. Vulnerability Disclosure

### 8.1 Responsible Disclosure Policy

**We welcome security researchers** to help us stay secure.

**How to report a vulnerability:**

1. **Email:** security@shomer.local
2. **Include:**
   - Description of vulnerability
   - Steps to reproduce
   - Proof of concept (if available)
   - Suggested fix (optional)
3. **Encrypt sensitive reports** with our PGP key (available on request)

**Please DO:**
- ✅ Report vulnerabilities privately first
- ✅ Give us reasonable time to fix (90 days)
- ✅ Work with us on coordinated disclosure
- ✅ Act in good faith

**Please DON'T:**
- ❌ Access or modify user data
- ❌ Disrupt service availability
- ❌ Publicly disclose before we've fixed
- ❌ Demand payment or ransom

### 8.2 Our Response Timeline

**What you can expect:**

| Timeframe | Our Action |
|-----------|------------|
| **24 hours** | Initial response acknowledging your report |
| **7 days** | Assessment of severity and impact |
| **30 days** | Fix deployed (for critical vulnerabilities) |
| **90 days** | Fix deployed (for non-critical) or coordinated disclosure |

**Recognition:**
- Public acknowledgment (if you wish)
- Hall of Fame listing
- Swag/thank you gift (for significant findings)

**Note:** We do not currently offer a bug bounty program, but we deeply appreciate your efforts.

### 8.3 Security Hall of Fame

**Researchers who've helped us:**
- [Your researchers will be listed here]

*Want to be listed? Report a vulnerability responsibly.*

---

## 9. Compliance & Auditing

### 9.1 Audit Logging

**All security-relevant events are logged:**

**What we log:**
- User authentication (success/failure)
- Permission checks (granted/denied)
- Data modifications (before/after states)
- Admin actions
- System changes
- Security events

**Log format:**
```json
{
  "timestamp": "2025-01-14T12:00:00Z",
  "action": "incident_updated",
  "user_id": 42,
  "user_email": "moderator@example.com",
  "resource_type": "incident",
  "resource_id": "123",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "before": {"status": "new"},
  "after": {"status": "investigating"},
  "result": "success"
}
```

**Log retention:**
- Stored for 365 days
- Encrypted at rest
- Immutable (cannot be modified)
- Regular integrity checks

**Log access:**
- Administrators only
- All access logged (logs of logs)
- Exported for compliance on request

### 9.2 Security Audits

**Regular security reviews:**

| Audit Type | Frequency | Conducted By |
|------------|-----------|--------------|
| **Internal code review** | Continuous | Development team |
| **Automated scanning** | Daily | CI/CD pipeline |
| **Penetration testing** | Annually | External security firm |
| **Compliance audit** | Annually | Third-party auditor |
| **Infrastructure review** | Quarterly | DevOps team |

**Audit findings:**
- Tracked in secure system
- Prioritized by severity
- Remediated per SLA
- Verified as fixed

### 9.3 Compliance Standards

**We align with industry standards:**

| Standard | Status | Notes |
|----------|--------|-------|
| **OWASP Top 10** | ✅ Implemented | Annual review |
| **CIS Benchmarks** | ✅ Implemented | Server hardening |
| **NIST Cybersecurity Framework** | 🔄 In progress | Risk management |
| **SOC 2 Type II** | 📋 Planned | Annual audit |
| **GDPR** | ✅ Compliant | For EU users |

---

## 10. Security Best Practices for Users

### 10.1 For All Users

**Protect your account:**
- ✅ Use a strong, unique password
- ✅ Don't share your password with anyone
- ✅ Log out when using shared computers
- ✅ Report suspicious emails/messages
- ✅ Keep your email account secure
- ✅ Review your account activity regularly

**Recognize phishing:**
- ❌ We'll never ask for your password via email
- ❌ We'll never ask you to "verify" your account via link
- ❌ We'll never threaten to delete your account
- ✅ We'll always sign emails with [email signature]
- ✅ Our emails come from @shomer.local domain only

### 10.2 For Moderators

**Additional responsibilities:**
- ✅ Enable two-factor authentication
- ✅ Use a dedicated work device if possible
- ✅ Don't access from public WiFi (use VPN)
- ✅ Lock your device when away
- ✅ Report suspicious activity immediately
- ✅ Complete annual security training

**Handling sensitive information:**
- Keep tip submitter contact info confidential
- Don't share incident details outside secure channels
- Use encrypted email for sensitive communications
- Don't screenshot or photograph sensitive data

### 10.3 For Administrators

**Highest security standards:**
- ✅ Two-factor authentication REQUIRED
- ✅ Use a dedicated, secure workstation
- ✅ All administrative actions logged
- ✅ Regular security training
- ✅ Background check maintained
- ✅ Know and follow incident response plan

**Access management:**
- Grant minimum necessary permissions
- Review user access quarterly
- Revoke access within 1 hour of termination
- Use separate admin account (don't use for daily work)

---

## 11. Security Roadmap

**Continuous improvement:**

### Q1 2025
- ✅ Implement RBAC system
- ✅ Add audit logging
- ✅ Deploy EXIF scrubbing
- 🔄 Complete penetration test

### Q2 2025
- 📋 Implement Web Application Firewall (WAF)
- 📋 Add Security Information and Event Management (SIEM)
- 📋 Deploy Intrusion Detection System (IDS)
- 📋 Conduct SOC 2 Type I audit

### Q3 2025
- 📋 Implement advanced threat detection
- 📋 Add behavioral analytics
- 📋 Deploy honeypots
- 📋 Achieve SOC 2 Type II

### Q4 2025
- 📋 Launch bug bounty program
- 📋 Implement security automation
- 📋 Advanced AI threat detection
- 📋 Annual security review

---

## 12. Contact & Resources

### Security Team

**Report security issues:**
- **Email:** security@shomer.local
- **Response time:** Within 24 hours
- **Emergency:** Include "URGENT" in subject line

**General security questions:**
- **Email:** security@shomer.local
- **Documentation:** https://github.com/shomer/docs/security

### Resources

**For Developers:**
- [Security Guidelines](./CONTRIBUTING.md#security)
- [Code Review Checklist](./CODE_REVIEW.md)
- [Dependency Policy](./DEPENDENCIES.md)

**For Users:**
- [Privacy Policy](./PRIVACY.md)
- [Account Security Tips](#101-for-all-users)
- [Phishing Protection](#101-for-all-users)

**For Administrators:**
- [Admin Security Guide](./ADMIN_SECURITY.md)
- [Incident Response Plan](#7-incident-response)
- [Audit Log Review](./AUDIT_GUIDE.md)

---

## 11. Phase 2.5 Hardening (New Features)

### 11.1 Strict Security Headers

**Enhanced nginx configuration with:**
- `Strict-Transport-Security` with `preload` directive
- `X-Frame-Options: DENY` (prevents clickjacking)
- `Referrer-Policy: no-referrer` (prevents referrer leakage)
- `Permissions-Policy` (restricts browser features)
- **Content Security Policy (CSP):**
  ```
  default-src 'self'; 
  img-src 'self' data: blob:; 
  script-src 'self'; 
  style-src 'self' 'unsafe-inline'; 
  font-src 'self' data:; 
  connect-src 'self' https://api.twilio.com https://api.sendgrid.com; 
  frame-ancestors 'none'; 
  base-uri 'self'; 
  form-action 'self'
  ```

**Benefits:**
- Prevents XSS attacks through strict CSP
- Forces HTTPS with HSTS preload
- Protects against clickjacking and iframe embedding
- Limits browser API access

### 11.2 Signed Export URLs (HMAC + Expiry)

**Secure, time-limited URLs for chain-of-custody exports:**

**How it works:**
1. Moderator/Admin requests signed URL via API
2. System generates HMAC-SHA256 signature with expiry timestamp
3. URL valid for 10 minutes (configurable)
4. No JWT/session required to use the signed URL
5. Access logged in chain-of-custody

**Security properties:**
- **HMAC signature**: Prevents URL tampering
- **Time-bound**: Auto-expires after TTL
- **Path-specific**: Token only valid for specific evidence
- **Scope-based**: Different scopes for different operations
- **Audit trail**: All access logged regardless of auth method

**Configuration:**
```bash
SIGNED_URL_SECRET=<strong-random-secret>  # Rotate quarterly
SIGNED_URL_DEFAULT_TTL_SECONDS=600        # 10 minutes
PUBLIC_BASE_URL=https://your-domain.com
```

**Endpoint:**
```
GET /api/v1/evidence/{id}/export-chain-of-custody/signed-url
```

**Returns:**
```json
{
  "url": "https://domain.com/api/v1/evidence/123/export?token=...",
  "expires_in": 600,
  "reference_number": "EV-20250114..."
}
```

**Use cases:**
- Sharing reports with external parties
- Email delivery of chain-of-custody PDFs
- Automated report generation
- One-time access for legal proceedings

### 11.3 MIME/Extension Validation

**File upload protection using python-magic:**

**Validation process:**
1. File uploaded to temporary location
2. **MIME sniffing** reads file headers (not just extension)
3. MIME type matched against allowlist
4. Extension validated against MIME type
5. Mismatches rejected with 400 error

**Allowed file types:**
| MIME Type | Extensions | Use Case |
|-----------|------------|----------|
| `image/jpeg` | `.jpg`, `.jpeg` | Photos |
| `image/png` | `.png` | Screenshots |
| `image/gif` | `.gif` | Animations |
| `application/pdf` | `.pdf` | Documents |
| `video/mp4` | `.mp4` | Video evidence |
| `text/plain` | `.txt` | Text notes |

**Prevented attacks:**
- ❌ Malicious executables renamed to `.jpg`
- ❌ HTML files with XSS renamed to `.txt`
- ❌ PHP webshells disguised as images
- ❌ ZIP bombs renamed to `.pdf`

**Integration:**
```python
from app.services.mime_validator import validate_mime_and_extension

is_valid, message = validate_mime_and_extension(file_path, original_name)
if not is_valid:
    raise HTTPException(status_code=400, detail=f"Invalid file: {message}")
```

### 11.4 Automated Security Auditing

**Daily security scans via GitHub Actions:**

**Audit components:**
1. **Python dependencies** (pip-audit)
2. **Node.js dependencies** (npm audit)
3. **Container images** (Trivy)
4. **Repository vulnerabilities** (Grype)
5. **SBOM generation** (Syft)
6. **Secret scanning** (TruffleHog)

**Schedule:**
- **Daily at 6 AM UTC**
- **Manual trigger available**
- **Results saved as artifacts (30 days)**

**Response SLA:**
| Severity | Response Time | Fix Time |
|----------|---------------|----------|
| **Critical** | 1 hour | 24 hours |
| **High** | 4 hours | 7 days |
| **Medium** | 24 hours | 30 days |
| **Low** | 7 days | Next release |

### 11.5 Dependabot Integration

**Automated dependency updates:**
- **Python (pip)**: Daily at 6 AM UTC
- **Node.js (npm)**: Daily at 6 AM UTC
- **Docker images**: Weekly (Monday 6 AM UTC)
- **GitHub Actions**: Weekly (Monday 6 AM UTC)

**Auto-merge policy:**
- ✅ Security patches (after tests pass)
- ✅ Minor version updates (after review)
- ⚠️ Major updates (manual review required)

**Configuration:** `.github/dependabot.yml`

### 11.6 Evidence Detail Page

**New frontend features:**
- **Full metadata display** (hashes, timestamps, file info)
- **Chain-of-custody timeline** (visual audit trail)
- **Quick actions** (verify, seal, download PDF, get signed link)
- **Legal hold warnings**
- **Signed URL generation with copy-to-clipboard**

**Route:** `/dashboard/evidence/[id]`

### 11.7 Security Header Decisions

**Header Implementation Rationale:**

**X-XSS-Protection Removed:**
- ❌ **Deprecated**: Chromium ignores this header, Safari never supported it
- ❌ **Obsolete**: Modern browsers use CSP for XSS protection instead
- ✅ **Modern Alternative**: Content Security Policy provides better protection

**Cross-Origin-Embedder-Policy (COEP) Deferred:**
- ⚠️ **Powerful but Brittle**: Can break Next.js fonts, analytics, and third-party images
- ⚠️ **Third-party Dependencies**: Requires auditing all external assets before enabling
- 📋 **Future Enhancement**: Enable after comprehensive third-party asset audit
- 🔧 **Current Status**: Commented out in both API and Next.js configs

**HSTS Conditional Implementation:**
- ✅ **Production Only**: Only enabled when `ENVIRONMENT=production`
- ✅ **HTTPS Required**: HSTS only effective over HTTPS connections
- ✅ **Reverse Proxy Ready**: Assumes TLS termination at CDN/edge layer
- 🔧 **Configuration**: `enable_hsts=(settings.ENVIRONMENT == "production")`

**Content Security Policy (CSP) Softened:**
- 🔧 **MVP Approach**: Minimal CSP that won't break Next.js functionality
- 🔧 **Development Friendly**: Allows `unsafe-inline` for styles during development
- 📋 **Future Tightening**: Will implement nonces/hashes for production hardening
- ✅ **Current Scope**: Prevents basic XSS while maintaining functionality

**Data Redaction Scope:**
- ✅ **Logs Only**: Redaction applied to log messages, never API responses
- ✅ **Targeted Patterns**: Specific regex for common token formats (sk-, pk-, Bearer JWT)
- ✅ **Reduced False Positives**: Avoids over-redacting random 20+ character strings
- 🔧 **Clear Documentation**: Comments specify redaction is for logging, not payloads

**X-Frame-Options Trade-off:**
- ⚠️ **DENY Policy**: Prevents all iframe embedding, including legitimate use cases
- ⚠️ **Admin Interface Impact**: May break embedding in admin dashboards or Grafana
- ✅ **Security Benefit**: Prevents clickjacking attacks
- 📝 **Decision**: Kept for security, documented trade-off for future review

### 11.8 Security Best Practices

**For signed URLs:**
- ✅ Rotate `SIGNED_URL_SECRET` quarterly
- ✅ Keep TTL short (5-15 minutes max)
- ✅ Use HTTPS only (never HTTP)
- ✅ Log all signed URL usage
- ✅ Monitor for suspicious patterns

**For MIME validation:**
- ✅ Install python-magic (`pip install python-magic-bin`)
- ✅ Keep allowlist minimal (only needed types)
- ✅ Regularly review rejected uploads
- ✅ Update allowlist conservatively

**For security auditing:**
- ✅ Review audit reports weekly
- ✅ Address critical findings within 24h
- ✅ Track remediation in issue tracker
- ✅ Maintain SBOM for compliance

**For CSP:**
- ✅ Test thoroughly after enabling
- ✅ Monitor CSP violation reports
- ✅ Update connect-src for new APIs
- ✅ Keep style-src minimal (avoid 'unsafe-inline' if possible)

**For Security Headers:**
- ✅ Monitor header effectiveness with browser dev tools
- ✅ Test embedding functionality before deploying X-Frame-Options changes
- ✅ Plan COEP enablement after third-party asset audit
- ✅ Use single source of truth for headers (avoid duplication at gateway and app level)

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 14, 2025 | Initial security policy |
| 1.1 | January 14, 2025 | Added Phase 2.5 Hardening features |
| 1.2 | January 14, 2025 | Added security header implementation rationale and decisions |

---

**Security is everyone's responsibility. If you see something, say something: security@shomer.local**

*This policy is publicly available because we believe transparency improves security.*
