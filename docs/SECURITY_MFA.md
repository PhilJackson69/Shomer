# Multi-Factor Authentication (MFA) Security Guide

## Overview

Shomer v1.1.0 introduces comprehensive Multi-Factor Authentication (MFA) capabilities to enhance account security. This guide covers the implementation, security considerations, and operational procedures for MFA.

## Supported MFA Methods

### 1. TOTP (Time-based One-Time Password)

**Technology:** RFC 6238 compliant TOTP implementation
**Compatible Apps:** Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.
**Security Level:** High

#### Implementation Details
- **Algorithm:** HMAC-SHA1
- **Time Window:** 30 seconds (configurable)
- **Code Length:** 6 digits
- **Tolerance:** ±1 time window (configurable)

#### Setup Process
1. User initiates TOTP setup via `/api/v1/mfa/totp/setup`
2. System generates a random base32 secret
3. QR code is generated with provisioning URI
4. User scans QR code with authenticator app
5. User verifies setup with a test code
6. Recovery codes are generated and displayed

#### Security Features
- Secrets are hashed using bcrypt before storage
- Replay attack protection via time window validation
- Rate limiting on verification attempts
- Audit logging of all MFA attempts

### 2. WebAuthn (Hardware Security Keys)

**Technology:** Web Authentication API (FIDO2/CTAP2)
**Compatible Devices:** YubiKey, Google Titan, Windows Hello, Touch ID, etc.
**Security Level:** Very High

#### Implementation Details
- **Protocol:** FIDO2 with CTAP2 support
- **Attestation:** Basic attestation support
- **User Verification:** Preferred but not required
- **Resident Keys:** Supported for enhanced UX

#### Setup Process
1. User initiates WebAuthn registration
2. System generates challenge and credential creation options
3. Browser prompts for authenticator interaction
4. Authenticator generates credential pair
5. Public key is stored, private key remains on device
6. Credential is associated with user account

#### Security Features
- Cryptographic proof of possession
- Phishing-resistant authentication
- Hardware-based key storage
- Counter-based replay protection

### 3. Recovery Codes

**Purpose:** Account recovery when primary MFA methods are unavailable
**Security Level:** Medium (single-use, time-limited)

#### Implementation Details
- **Quantity:** 10 codes per user (configurable)
- **Format:** URL-safe random strings (12 characters)
- **Storage:** Hashed using bcrypt
- **Usage:** Single-use only

#### Security Features
- Codes are hashed before storage
- Usage tracking prevents replay attacks
- Automatic regeneration when supply runs low
- Audit logging of all recovery code usage

## Security Architecture

### Data Storage

#### TOTP Secrets
```
Storage: bcrypt(password_hash(secret))
Access: Never stored in plaintext
Rotation: Manual regeneration required
```

#### Recovery Codes
```
Storage: bcrypt(password_hash(code))
Access: Never stored in plaintext
Rotation: Automatic when supply < 3 codes
```

#### WebAuthn Credentials
```
Storage: Public key only (base64 encoded)
Access: Read-only for verification
Rotation: User-initiated credential management
```

### Encryption and Hashing

#### Secret Hashing
- **Algorithm:** bcrypt with cost factor 12
- **Salt:** Automatic salt generation per hash
- **Verification:** Constant-time comparison

#### Data Transmission
- **Protocol:** HTTPS only in production
- **Headers:** Security headers enforced
- **CSRF:** Token-based protection

### Rate Limiting

#### MFA Endpoints
- **Setup:** 5 attempts per hour per user
- **Verification:** 10 attempts per hour per user
- **Recovery:** 5 attempts per hour per user
- **Disable:** 3 attempts per hour per user

#### Progressive Backoff
- **Violation 1:** 1-minute delay
- **Violation 2:** 5-minute delay
- **Violation 3:** 15-minute delay
- **Violation 4+:** 1-hour delay

## Operational Procedures

### Admin MFA Enforcement

#### Configuration
```python
MFA_ENFORCE_ADMINS = True  # Environment variable
```

#### Enforcement Logic
1. Admin users are prompted to enable MFA on first login
2. Admin users cannot access sensitive endpoints without MFA
3. Admin users cannot disable MFA without recovery codes
4. System administrators can override enforcement if needed

#### Bypass Procedures
1. Emergency access via recovery codes
2. System administrator override (audit logged)
3. Account recovery procedures (multi-step verification)

### Recovery Procedures

#### Lost Authenticator Device
1. User attempts login with recovery code
2. System validates recovery code
3. User is prompted to setup new MFA method
4. Old MFA settings are cleared
5. New recovery codes are generated

#### Lost Recovery Codes
1. User contacts system administrator
2. Identity verification via alternate means
3. Temporary MFA bypass (time-limited)
4. User must setup new MFA method
5. New recovery codes are generated

#### Account Lockout
1. Multiple failed MFA attempts trigger lockout
2. Lockout duration increases with violations
3. System administrator can unlock account
4. User must verify identity before unlock

### Monitoring and Alerting

#### Security Events
- **Failed MFA attempts:** Real-time alerts
- **Recovery code usage:** Immediate notification
- **MFA disable events:** Admin notification
- **Suspicious patterns:** Behavioral analysis

#### Metrics Collection
- **MFA adoption rate:** Daily reporting
- **Success/failure rates:** Hourly monitoring
- **Recovery code usage:** Real-time tracking
- **Performance metrics:** Response time monitoring

## API Endpoints

### Authentication Required
All MFA endpoints require valid JWT authentication.

### Core Endpoints

#### GET /api/v1/mfa/status
**Purpose:** Get current MFA status for authenticated user
**Response:**
```json
{
  "enabled": true,
  "totp_enabled": true,
  "webauthn_enabled": false,
  "has_backup_codes": true
}
```

#### POST /api/v1/mfa/totp/setup
**Purpose:** Initialize TOTP setup for user
**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code_url": "otpauth://totp/Shomer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Shomer",
  "backup_codes": ["code1", "code2", ...]
}
```

#### POST /api/v1/mfa/totp/verify
**Purpose:** Verify TOTP code
**Request:**
```json
{
  "code": "123456"
}
```

#### POST /api/v1/mfa/totp/enable
**Purpose:** Enable TOTP after verification
**Request:**
```json
{
  "code": "123456"
}
```

#### POST /api/v1/mfa/recovery/verify
**Purpose:** Verify recovery code
**Request:**
```json
{
  "recovery_code": "abc123def456"
}
```

#### POST /api/v1/mfa/disable
**Purpose:** Disable MFA using recovery code
**Request:**
```json
{
  "recovery_code": "abc123def456"
}
```

### WebAuthn Endpoints

#### POST /api/v1/mfa/webauthn/register
**Purpose:** Start WebAuthn registration
**Request:**
```json
{
  "credential_name": "My YubiKey"
}
```

#### POST /api/v1/mfa/webauthn/verify
**Purpose:** Verify WebAuthn credential
**Request:**
```json
{
  "credential_id": "base64-encoded-id",
  "client_data_json": "base64-encoded-data",
  "authenticator_data": "base64-encoded-data",
  "signature": "base64-encoded-signature"
}
```

## Security Considerations

### Threat Model

#### Attack Vectors
1. **Phishing:** WebAuthn provides protection
2. **Man-in-the-Middle:** HTTPS + certificate pinning
3. **Brute Force:** Rate limiting + progressive backoff
4. **Social Engineering:** Recovery code protection
5. **Insider Threats:** Audit logging + access controls

#### Mitigation Strategies
1. **Multi-layered Defense:** Multiple MFA methods
2. **Zero Trust:** Continuous verification
3. **Behavioral Analysis:** Anomaly detection
4. **Incident Response:** Automated alerting

### Compliance

#### Regulatory Requirements
- **SOC 2:** MFA for privileged access
- **GDPR:** Strong authentication for data access
- **HIPAA:** Multi-factor authentication requirements
- **PCI DSS:** Strong authentication for cardholder data

#### Audit Requirements
- **Access Logging:** All MFA events logged
- **Retention:** 1 year minimum retention
- **Integrity:** Cryptographic signing of logs
- **Access Control:** Role-based log access

## Troubleshooting

### Common Issues

#### TOTP Code Not Working
1. Check device time synchronization
2. Verify secret was entered correctly
3. Check for time window tolerance
4. Verify authenticator app compatibility

#### WebAuthn Registration Fails
1. Check browser compatibility
2. Verify device supports FIDO2
3. Check for HTTPS requirement
4. Verify user gesture requirements

#### Recovery Codes Not Working
1. Check if codes have been used
2. Verify code format and length
3. Check for typos in entry
4. Verify codes haven't expired

### Support Procedures

#### User Support
1. **Level 1:** Basic troubleshooting guide
2. **Level 2:** Advanced device configuration
3. **Level 3:** System administrator intervention

#### Escalation Matrix
1. **Technical Issues:** IT Support
2. **Security Concerns:** Security Team
3. **Account Lockouts:** System Administrator
4. **Compliance Issues:** Legal/Compliance Team

## Future Enhancements

### Planned Features
1. **SMS Backup:** Secondary authentication method
2. **Push Notifications:** Mobile app authentication
3. **Biometric Integration:** Enhanced WebAuthn support
4. **Risk-Based Authentication:** Contextual MFA requirements

### Security Improvements
1. **Hardware Security Modules:** Enhanced key storage
2. **Quantum-Resistant Algorithms:** Future-proof cryptography
3. **Zero-Knowledge Proofs:** Privacy-preserving authentication
4. **Blockchain Integration:** Decentralized identity management

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-18  
**Next Review:** 2025-04-18  
**Contact:** security@shomer.local
