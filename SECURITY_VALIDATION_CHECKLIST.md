# Security Validation Checklist (10 min)

## Pre-Deployment Security Validation

### 1. Environment Configuration (2 min)
- [ ] **Strong Secrets**: All secrets are 32+ characters, not placeholder values
  ```bash
  # Generate strong secrets
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- [ ] **HTTPS Enforcement**: `PUBLIC_BASE_URL` uses HTTPS in production
- [ ] **Environment Variables**: All required vars set, no defaults in production
- [ ] **Feature Flags**: `FEATURE_2FA=true` if 2FA enabled

### 2. Security Headers (1 min)
- [ ] **API Headers**: Test `/health` endpoint returns security headers
  ```bash
  curl -I http://localhost:8000/health | grep -E "(X-Content-Type-Options|X-Frame-Options|CSP)"
  ```
- [ ] **HSTS**: Only enabled in production with HTTPS
- [ ] **CSP**: Content Security Policy present and not breaking UI

### 3. Rate Limiting (1 min)
- [ ] **Rate Limit Headers**: `X-RateLimit-*` headers present
- [ ] **429 Responses**: Rate limiting returns proper 429 with `Retry-After`
- [ ] **Redis Health**: Rate limiting degrades gracefully without Redis

### 4. CSRF Protection (1 min)
- [ ] **CSRF Endpoint**: `/api/v1/csrf` returns token
- [ ] **Token Rotation**: Client rotates CSRF tokens properly
- [ ] **Write Protection**: POST/PUT/DELETE blocked without valid token

### 5. Input Validation (2 min)
- [ ] **File Uploads**: Dangerous extensions (.exe, .bat) blocked
- [ ] **HTML Sanitization**: `<script>` tags stripped from rich text
- [ ] **Text Sanitization**: Control characters removed from inputs
- [ ] **MIME Validation**: File content matches declared MIME type

### 6. Error Handling (1 min)
- [ ] **PII Redaction**: Email/phone numbers redacted from error logs
- [ ] **Stack Traces**: No sensitive paths in production error responses
- [ ] **Request IDs**: Error responses include request IDs for tracing

### 7. 2FA Implementation (1 min)
- [ ] **Feature Flag**: `FEATURE_2FA=true` enables 2FA endpoints
- [ ] **TOTP Setup**: `/api/v1/2fa/setup` generates QR codes
- [ ] **Backup Codes**: 10 backup codes generated per user
- [ ] **Admin Only**: 2FA restricted to admin users

### 8. Admin Dashboard (1 min)
- [ ] **System Metrics**: `/api/v1/system/metrics` returns health data
- [ ] **Rate Limit Violations**: Admin can view violation history
- [ ] **Security Events**: Recent security events visible in dashboard

## Quick Commands

```bash
# Run security tests
make security-test

# Validate secret strength
make validate-secrets

# Check security headers
make security-check

# Start secure development
make dev-secure
```

## Security Endpoints

- **CSRF**: `GET /api/v1/csrf` - Get CSRF token
- **2FA Setup**: `POST /api/v1/2fa/setup` - Setup 2FA (admin only)
- **File Validation**: `POST /api/v1/validation/validate` - Validate uploads
- **System Metrics**: `GET /api/v1/system/metrics` - System health (admin only)
- **Security Events**: `GET /api/v1/system/security-events` - Security monitoring

## Critical Security Files

- `apps/api/app/core/security.py` - Secret validation
- `apps/api/app/core/validation.py` - Input sanitization
- `apps/api/app/core/two_factor.py` - 2FA implementation
- `apps/api/app/core/error_handling.py` - Error hardening
- `apps/api/app/middleware/security_headers.py` - Security headers
- `apps/api/app/middleware/rate_limit.py` - Rate limiting
- `apps/api/app/middleware/csrf.py` - CSRF protection
- `apps/web/src/lib/apiFetch.ts` - Client-side security

## Production Checklist

- [ ] All secrets generated with `secrets.token_urlsafe(32)`
- [ ] HTTPS enforced for `PUBLIC_BASE_URL`
- [ ] Security headers present on all responses
- [ ] Rate limiting active with Redis
- [ ] CSRF protection enabled
- [ ] File upload validation active
- [ ] Error responses sanitized
- [ ] 2FA enabled for admin users
- [ ] Admin dashboard accessible
- [ ] Security tests passing

**Total Time: ~10 minutes**
