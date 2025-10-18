# JWKS Outage Runbook

## Overview
This runbook provides step-by-step procedures for handling JWKS endpoint outages that can cause widespread authentication failures.

## Severity Levels
- **Critical**: JWKS endpoint completely unreachable
- **High**: JWKS endpoint responding with 5xx errors
- **Medium**: JWKS endpoint high latency (>300ms p95)

## Immediate Response (0-5 minutes)

### 1. Assess Impact
```bash
# Check JWKS endpoint status
curl -I "$PUBLIC_BASE_URL/.well-known/jwks.json"

# Check error rates
curl "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{path=\"/.well-known/jwks.json\",status=~\"5..\"}[5m])"

# Check authentication success rate
curl "$PROMETHEUS_URL/api/v1/query?query=rate(security_token_verification_total{status=\"success\"}[5m])"
```

### 2. Immediate Mitigation
```bash
# Roll back to previous deployment (serves last good JWKS)
kubectl rollout undo deployment/shomer-api
# OR
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up -d

# Temporarily extend cache at CDN edge to 10 minutes
# (Update CDN configuration or contact CDN provider)
```

### 3. Emergency Communication
- [ ] Notify security team
- [ ] Update status page
- [ ] Send incident notification to stakeholders

## Recovery Procedures (5-30 minutes)

### 1. Hotfix Deployment
```bash
# Deploy hotfix serving both old+new keys
# This ensures backward compatibility during rotation

# Update JWKS to include both keys temporarily
# Deploy with emergency flag
kubectl set env deployment/shomer-api EMERGENCY_KEY_ROTATION=true
```

### 2. Verify Recovery
```bash
# Test JWKS endpoint
curl -s "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.'

# Verify key count (should have both old and new keys)
curl -s "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys | length'

# Test token verification
python3 - <<'EOF'
import jwt
import requests
from jwt import PyJWKClient

# Test with both old and new keys
jwks_url = "$PUBLIC_BASE_URL/.well-known/jwks.json"
test_token = "$TEST_ACCESS_TOKEN"

jwks_client = PyJWKClient(jwks_url)
signing_key = jwks_client.get_signing_key_from_jwt(test_token)
decoded = jwt.decode(test_token, signing_key.key, algorithms=['RS256', 'EdDSA'], audience='shomer')
print("Token verification successful")
EOF
```

### 3. Monitor Recovery
```bash
# Monitor JWKS endpoint health
watch -n 5 'curl -s -w "Status: %{http_code}, Time: %{time_total}s\n" "$PUBLIC_BASE_URL/.well-known/jwks.json" -o /dev/null'

# Monitor authentication success rate
watch -n 10 'curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(security_token_verification_total{status=\"success\"}[5m])" | jq ".data.result[0].value[1]"'
```

## Post-Incident Actions (30+ minutes)

### 1. Remove Emergency Keys
```bash
# After confirming stability, remove old keys from JWKS
# Deploy with only current keys
kubectl set env deployment/shomer-api EMERGENCY_KEY_ROTATION=false
```

### 2. Root Cause Analysis
- [ ] Analyze logs for root cause
- [ ] Check for configuration errors
- [ ] Verify key generation process
- [ ] Review deployment pipeline

### 3. Preventive Measures
- [ ] Implement JWKS health checks
- [ ] Add automated rollback triggers
- [ ] Improve monitoring coverage
- [ ] Update deployment procedures

## Key Metrics to Monitor
- JWKS endpoint availability: `up{job="shomer-api",path="/.well-known/jwks.json"}`
- JWKS response time: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path="/.well-known/jwks.json"}[5m]))`
- Token verification success rate: `rate(security_token_verification_total{status="success"}[5m])`
- Authentication error rate: `rate(http_requests_total{path="/api/v1/auth/*",status=~"5.."}[5m])`

## Emergency Contacts
- **Security Team**: security@shomer.app
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **DevOps Team**: devops@shomer.app

## Related Documentation
- [Key Compromise Runbook](./KEY_COMPROMISE_RUNBOOK.md)
- [Security Monitoring Guide](../OBSERVABILITY_GUIDE.md)
- [JWT Configuration Guide](../JWT_CONFIGURATION.md)
