# Key Compromise Runbook

## Overview
This runbook provides procedures for handling suspected or confirmed JWT key compromise incidents.

## Severity Levels
- **Critical**: Private key confirmed compromised
- **High**: Private key suspected compromised
- **Medium**: Key rotation required for compliance

## Immediate Response (0-15 minutes)

### 1. Assess and Contain
```bash
# Check for suspicious activity
curl "$PROMETHEUS_URL/api/v1/query?query=increase(security_events_total{severity=\"HIGH\"}[1h])"

# Check for algorithm confusion attempts
curl "$PROMETHEUS_URL/api/v1/query?query=increase(security_algorithm_confusion_attempts_total[1h])"

# Check for unauthorized token usage
curl "$PROMETHEUS_URL/api/v1/query?query=rate(security_token_verification_errors_total[5m])"
```

### 2. Generate New Keypair
```bash
# Generate new RSA keypair
openssl genrsa -out new_private_key.pem 2048
openssl rsa -in new_private_key.pem -pubout -out new_public_key.pem

# Generate new EdDSA keypair (alternative)
openssl genpkey -algorithm Ed25519 -out new_ed25519_private.pem
openssl pkey -in new_ed25519_private.pem -pubout -out new_ed25519_public.pem

# Update key ID for rotation
export JWT_KEY_ID="shomer-key-$(date +%Y%m%d%H%M%S)"
export JWT_KEY_VERSION="v$(date +%Y%m%d%H%M%S)"
```

### 3. Deploy New Keys
```bash
# Update environment variables
export JWT_PRIVATE_KEY="$(cat new_private_key.pem)"
export JWT_PUBLIC_KEY="$(cat new_public_key.pem)"

# Deploy with new keys
kubectl set env deployment/shomer-api JWT_PRIVATE_KEY="$JWT_PRIVATE_KEY"
kubectl set env deployment/shomer-api JWT_PUBLIC_KEY="$JWT_PUBLIC_KEY"
kubectl set env deployment/shomer-api JWT_KEY_ID="$JWT_KEY_ID"

# Restart deployment to pick up new keys
kubectl rollout restart deployment/shomer-api
```

## User Impact Mitigation (15-30 minutes)

### 1. Revoke All Active Sessions
```bash
# Revoke refresh token families for all users
# This forces re-authentication with new keys

# Script to revoke all sessions (run with caution)
python3 - <<'EOF'
import requests
import os

# Get admin token for mass revocation
admin_token = os.environ.get("ADMIN_TOKEN")
base_url = os.environ.get("PUBLIC_BASE_URL")

# In production, this would be a batch operation
# For now, log the requirement
print("REQUIRED: Revoke all refresh token families")
print("This should be done via database update or Redis flush")
print("All users will need to re-authenticate")
EOF
```

### 2. Emergency Communication
- [ ] Send security notice to all users
- [ ] Update status page with security incident
- [ ] Notify compliance team if required
- [ ] Document incident for audit trail

### 3. Monitor User Impact
```bash
# Monitor authentication success rate
watch -n 10 'curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(security_token_verification_total{status=\"success\"}[5m])" | jq ".data.result[0].value[1]"'

# Monitor login attempts
watch -n 10 'curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{path=\"/api/v1/auth/login\",status=\"200\"}[5m])" | jq ".data.result[0].value[1]"'
```

## Recovery Procedures (30-60 minutes)

### 1. Verify New Key Deployment
```bash
# Test JWKS endpoint with new keys
curl -s "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.'

# Verify new key ID is present
curl -s "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys[].kid'

# Test token creation with new keys
python3 - <<'EOF'
import jwt
import os
from app.core.security import create_access_token

# Test token creation
test_token = create_access_token("test-user")
print(f"New token created: {test_token[:50]}...")

# Verify token can be decoded
from app.core.security import decode_token
decoded = decode_token(test_token)
print(f"Token decoded successfully: {decoded}")
EOF
```

### 2. Remove Compromised Keys
```bash
# After confirming new keys work, remove old keys from JWKS
# This happens automatically when only new keys are deployed

# Verify old keys are no longer in JWKS
curl -s "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys[].kid'
```

### 3. Monitor for Residual Issues
```bash
# Monitor for any remaining authentication issues
watch -n 30 'curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(security_token_verification_errors_total[5m])" | jq ".data.result[0].value[1]"'

# Check for any suspicious activity
watch -n 60 'curl -s "$PROMETHEUS_URL/api/v1/query?query=increase(security_events_total{severity=\"HIGH\"}[10m])" | jq ".data.result[0].value[1]"'
```

## Post-Incident Actions (60+ minutes)

### 1. Security Audit
- [ ] Analyze logs for unauthorized access
- [ ] Check for any data breaches
- [ ] Review access patterns during compromise window
- [ ] Document all actions taken

### 2. Update Security Procedures
- [ ] Review key rotation procedures
- [ ] Update incident response plan
- [ ] Improve monitoring coverage
- [ ] Schedule security training updates

### 3. Compliance and Reporting
- [ ] Document incident for audit trail
- [ ] Notify compliance team
- [ ] Update security documentation
- [ ] Schedule post-incident review

## Key Rotation Best Practices

### 1. Regular Rotation Schedule
- **Routine**: Quarterly key rotation
- **Emergency**: Immediate rotation on suspicion
- **Compliance**: As required by regulations

### 2. Key Management
```bash
# Secure key storage
# Store keys in encrypted environment variables or secret management system
# Never commit keys to version control
# Use different keys for different environments

# Key versioning
export JWT_KEY_VERSION="v$(date +%Y%m%d)"
export JWT_KEY_ID="shomer-key-${JWT_KEY_VERSION}"
```

### 3. Graceful Rotation
```bash
# Support multiple keys during rotation period
# Keep old keys in JWKS until all tokens expire + grace period
# Use key versioning to track rotation status
```

## Monitoring and Alerting

### Key Metrics
- Key rotation success rate: `rate(security_key_rotation_total{status="success"}[5m])`
- Authentication success rate: `rate(security_token_verification_total{status="success"}[5m])`
- Security events: `increase(security_events_total{severity="HIGH"}[5m])`
- Algorithm confusion attempts: `increase(security_algorithm_confusion_attempts_total[5m])`

### Alert Thresholds
- Key rotation failures: > 0 in 5 minutes
- Authentication failures: > 5% in 5 minutes
- Security events: > 0 high severity in 5 minutes
- Algorithm confusion: > 0 attempts in 5 minutes

## Emergency Contacts
- **Security Team**: security@shomer.app
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Legal/Compliance**: legal@shomer.app
- **Executive Team**: executives@shomer.app

## Related Documentation
- [JWKS Application Runbook](./JWKS_OUTAGE_RUNBOOK.md)
- [Security Monitoring Guide](../OBSERVABILITY_GUIDE.md)
- [Incident Response Plan](../INCIDENT_RESPONSE.md)
- [Key Management Policy](../KEY_MANAGEMENT_POLICY.md)
