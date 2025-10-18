# Shomer Operations Runbooks
# Incident response procedures for production operations

## Quick Reference

### Emergency Contacts
- **Primary On-Call**: [Contact Info]
- **Secondary On-Call**: [Contact Info]
- **Security Team**: [Contact Info]
- **Escalation**: [Contact Info]

### Critical Endpoints
- **Health Check**: `GET /api/v1/health`
- **JWKS**: `GET /.well-known/jwks.json`
- **Metrics**: `GET /metrics`
- **Admin Panel**: `GET /admin`

---

## Runbook 1: JWKS Outage Response

### Symptoms
- JWT verification errors spiking
- JWKS endpoint returning 5xx errors
- Authentication failures across the system
- Alert: `JWKSLatencyHigh` or `JWKSConnectionDown`

### Immediate Actions (0-5 minutes)

1. **Check JWKS endpoint status**
   ```bash
   curl -I "$PUBLIC_BASE_URL/.well-known/jwks.json"
   ```

2. **Check application logs**
   ```bash
   kubectl logs -l app=api --tail=100 | grep -i jwks
   ```

3. **Verify key rotation status**
   ```bash
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import get_key_rotation_info
   print(get_key_rotation_info())
   "
   ```

### Resolution Steps

#### Option A: Rollback Last Deploy
```bash
# Rollback to previous version
kubectl rollout undo deployment/api

# Verify rollback
kubectl rollout status deployment/api

# Check JWKS is working
curl -fsS "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys | length'
```

#### Option B: Bump CDN Cache (if rollback not possible)
```bash
# Increase CDN cache TTL to 10 minutes
# This varies by CDN provider:
# CloudFlare: Update cache-control header
# AWS CloudFront: Update TTL settings
# Azure CDN: Update cache rules

# Serve dual-key JWKS temporarily
kubectl patch deployment api -p '{"spec":{"template":{"metadata":{"annotations":{"force-reload":"'$(date +%s)'"}}}}}'
```

### Verification (5-10 minutes)

1. **Check JWKS latency**
   ```bash
   # Should be < 300ms
   curl -w "@curl-format.txt" -o /dev/null -s "$PUBLIC_BASE_URL/.well-known/jwks.json"
   ```

2. **Verify authentication**
   ```bash
   # Test with a valid token
   curl -H "Authorization: Bearer $TEST_TOKEN" "$PUBLIC_BASE_URL/api/v1/auth/me"
   ```

3. **Check metrics**
   ```bash
   # JWT error rate should be < 2%
   curl -s "$PROMETHEUS_URL/api/v1/query?query=jwt_verify_error_rate" | jq '.data.result[0].value[1]'
   ```

### Post-Incident (10+ minutes)

1. **Update monitoring**
   - Extend JWKS cache monitoring
   - Add key rotation health checks

2. **Document incident**
   - Record timeline and actions taken
   - Update runbook if needed

3. **Schedule key rotation review**
   - Review key rotation procedures
   - Test dual-key scenarios

---

## Runbook 2: Key Compromise Response

### Symptoms
- Unauthorized access detected
- Security event: `KeyCompromiseDetected`
- Suspicious authentication patterns
- Alert: `UnauthorizedAccessAttempts`

### Immediate Actions (0-2 minutes)

1. **Activate incident response**
   ```bash
   # Notify security team
   echo "SECURITY INCIDENT: Potential key compromise detected" | \
     curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"🚨 SECURITY INCIDENT: Potential key compromise detected"}' \
     "$SLACK_WEBHOOK_URL"
   ```

2. **Generate new keypair**
   ```bash
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import generate_rsa_keypair
   private_key, public_key = generate_rsa_keypair()
   print('New keypair generated')
   "
   ```

### Resolution Steps (2-15 minutes)

1. **Deploy new keypair**
   ```bash
   # Update Kubernetes secrets with new keys
   kubectl create secret generic jwt-keys \
     --from-literal=private-key="$NEW_PRIVATE_KEY" \
     --from-literal=public-key="$NEW_PUBLIC_KEY" \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Restart API deployment
   kubectl rollout restart deployment/api
   ```

2. **Force revoke-all for affected users**
   ```bash
   # Revoke all sessions for potentially compromised users
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import revoke_all_user_sessions
   revoke_all_user_sessions(affected_user_ids)
   "
   ```

3. **Update JWKS with new key**
   ```bash
   # Verify new key is in JWKS
   curl -fsS "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys[].kid'
   ```

### Verification (15-30 minutes)

1. **Check authentication flow**
   ```bash
   # Test login with new key
   curl -X POST "$PUBLIC_BASE_URL/api/v1/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

2. **Verify old tokens are rejected**
   ```bash
   # Old tokens should be rejected
   curl -H "Authorization: Bearer $OLD_TOKEN" "$PUBLIC_BASE_URL/api/v1/auth/me"
   # Should return 401
   ```

3. **Monitor error rates**
   ```bash
   # JWT error rate should spike temporarily then normalize
   watch -n 5 'curl -s "$PROMETHEUS_URL/api/v1/query?query=jwt_verify_error_rate" | jq ".data.result[0].value[1]"'
   ```

### Post-Incident (30+ minutes)

1. **Remove old key post-TTL**
   ```bash
   # Wait for max token TTL + grace period
   # Then remove old key from JWKS
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import remove_old_key_from_jwks
   remove_old_key_from_jwks(old_key_id)
   "
   ```

2. **Publish incident note**
   - Document the incident
   - Notify affected users
   - Update security procedures

3. **Review security procedures**
   - Audit key rotation process
   - Review access controls
   - Update monitoring rules

---

## Runbook 3: Rate Limit Spike Response

### Symptoms
- High number of 429 responses
- Alert: `RateLimitViolationsHigh`
- API performance degradation
- Increased error rates

### Immediate Actions (0-2 minutes)

1. **Check rate limit metrics**
   ```bash
   # Check current rate limit violations
   curl -s "$PROMETHEUS_URL/api/v1/query?query=rate_limit_violations" | jq '.data.result[0].value[1]'
   ```

2. **Identify offending IPs**
   ```bash
   # Check access logs for high-frequency IPs
   kubectl logs -l app=api --tail=1000 | \
     awk '{print $1}' | sort | uniq -c | sort -nr | head -10
   ```

### Resolution Steps (2-10 minutes)

1. **Temporary IP blocking (if needed)**
   ```bash
   # Block offending IPs temporarily
   kubectl exec -it deployment/api -- python -c "
   from app.core.rate_limiting import block_ip_temporarily
   for ip in offending_ips:
       block_ip_temporarily(ip, duration_minutes=30)
   "
   ```

2. **Raise per-principal limits (if legitimate traffic)**
   ```bash
   # Increase rate limits for specific users/IPs
   kubectl exec -it deployment/api -- python -c "
   from app.core.rate_limiting import adjust_rate_limit
   adjust_rate_limit(principal, new_limit)
   "
   ```

3. **Scale up resources (if capacity issue)**
   ```bash
   # Scale API deployment
   kubectl scale deployment api --replicas=5
   
   # Check resource usage
   kubectl top pods -l app=api
   ```

### Verification (10-15 minutes)

1. **Monitor rate limit metrics**
   ```bash
   # Rate limit violations should decrease
   watch -n 10 'curl -s "$PROMETHEUS_URL/api/v1/query?query=rate_limit_violations" | jq ".data.result[0].value[1]"'
   ```

2. **Check API performance**
   ```bash
   # Response times should improve
   curl -w "@curl-format.txt" -o /dev/null -s "$PUBLIC_BASE_URL/api/v1/health"
   ```

3. **Test normal traffic**
   ```bash
   # Verify legitimate requests work
   curl -H "Authorization: Bearer $TEST_TOKEN" "$PUBLIC_BASE_URL/api/v1/tips"
   ```

### Post-Incident (15+ minutes)

1. **Analyze root cause**
   - Review access patterns
   - Check for DDoS attacks
   - Verify legitimate traffic patterns

2. **Adjust rate limits**
   - Update global rate limits if needed
   - Fine-tune per-endpoint limits
   - Update WAF rules

3. **Document findings**
   - Record incident details
   - Update rate limiting policies
   - Improve monitoring

---

## Runbook 4: Database Connection Issues

### Symptoms
- Database connection errors
- Alert: `DatabaseConnectionPoolHigh`
- Slow query responses
- Application timeouts

### Immediate Actions (0-2 minutes)

1. **Check database status**
   ```bash
   # Check database pod status
   kubectl get pods -l app=postgres
   
   # Check database logs
   kubectl logs -l app=postgres --tail=50
   ```

2. **Check connection pool metrics**
   ```bash
   # Check connection pool utilization
   curl -s "$PROMETHEUS_URL/api/v1/query?query=db_connection_pool_utilization" | jq '.data.result[0].value[1]'
   ```

### Resolution Steps (2-15 minutes)

1. **Restart database (if needed)**
   ```bash
   # Restart database pod
   kubectl rollout restart deployment/postgres
   
   # Wait for restart
   kubectl rollout status deployment/postgres
   ```

2. **Scale database connections**
   ```bash
   # Increase connection pool size
   kubectl patch deployment api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"DB_POOL_SIZE","value":"20"}]}]}}}}'
   ```

3. **Check for long-running queries**
   ```bash
   # Check active connections
   kubectl exec -it deployment/postgres -- psql -c "
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
   "
   ```

### Verification (15-20 minutes)

1. **Check connection pool health**
   ```bash
   # Connection pool should be < 80%
   curl -s "$PROMETHEUS_URL/api/v1/query?query=db_connection_pool_utilization" | jq '.data.result[0].value[1]'
   ```

2. **Test database queries**
   ```bash
   # Test basic database operations
   kubectl exec -it deployment/api -- python -c "
   from app.core.database import get_db
   db = next(get_db())
   result = db.execute('SELECT 1').fetchone()
   print('Database connection test:', result)
   "
   ```

3. **Monitor query performance**
   ```bash
   # Check query response times
   curl -w "@curl-format.txt" -o /dev/null -s "$PUBLIC_BASE_URL/api/v1/health"
   ```

### Post-Incident (20+ minutes)

1. **Analyze root cause**
   - Review slow query logs
   - Check for connection leaks
   - Analyze usage patterns

2. **Optimize database**
   - Add missing indexes
   - Optimize slow queries
   - Adjust connection pool settings

3. **Update monitoring**
   - Add database-specific alerts
   - Improve connection pool monitoring
   - Set up query performance tracking

---

## Runbook 5: Security Event Response

### Symptoms
- Security event alerts
- Unusual authentication patterns
- Potential security breaches
- Alert: `SecurityEventRateHigh`

### Immediate Actions (0-2 minutes)

1. **Assess threat level**
   ```bash
   # Check security event details
   kubectl logs -l app=api --tail=100 | grep -i "SECURITY_EVENT"
   ```

2. **Check authentication patterns**
   ```bash
   # Review recent auth attempts
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import get_recent_auth_attempts
   attempts = get_recent_auth_attempts(minutes=30)
   print(f'Recent auth attempts: {len(attempts)}')
   "
   ```

### Resolution Steps (2-15 minutes)

1. **Block suspicious IPs**
   ```bash
   # Block IPs with suspicious activity
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import block_suspicious_ips
   block_suspicious_ips(suspicious_ips, duration_hours=24)
   "
   ```

2. **Force password resets**
   ```bash
   # Force password reset for affected users
   kubectl exec -it deployment/api -- python -c "
   from app.core.security import force_password_reset
   force_password_reset(affected_user_ids)
   "
   ```

3. **Enable additional monitoring**
   ```bash
   # Increase security monitoring
   kubectl patch deployment api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"SECURITY_MONITORING_LEVEL","value":"high"}]}]}}}}'
   ```

### Verification (15-30 minutes)

1. **Monitor security events**
   ```bash
   # Security event rate should decrease
   watch -n 30 'curl -s "$PROMETHEUS_URL/api/v1/query?query=security_event_rate" | jq ".data.result[0].value[1]"'
   ```

2. **Check blocked IPs**
   ```bash
   # Verify IPs are blocked
   curl -H "X-Forwarded-For: $BLOCKED_IP" "$PUBLIC_BASE_URL/api/v1/health"
   # Should return 403
   ```

3. **Test normal operations**
   ```bash
   # Verify legitimate users can still access
   curl -H "Authorization: Bearer $LEGITIMATE_TOKEN" "$PUBLIC_BASE_URL/api/v1/tips"
   ```

### Post-Incident (30+ minutes)

1. **Investigate root cause**
   - Analyze security logs
   - Check for data breaches
   - Review access patterns

2. **Update security measures**
   - Strengthen authentication
   - Update monitoring rules
   - Review access controls

3. **Notify stakeholders**
   - Document incident
   - Notify affected users
   - Report to security team

---

## Monitoring Commands

### Health Check Commands
```bash
# Application health
curl -fsS "$PUBLIC_BASE_URL/api/v1/health"

# Database health
kubectl exec -it deployment/postgres -- pg_isready

# Redis health
kubectl exec -it deployment/redis -- redis-cli ping

# JWKS health
curl -fsS "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq '.keys | length'
```

### Metrics Commands
```bash
# JWT error rate
curl -s "$PROMETHEUS_URL/api/v1/query?query=jwt_verify_error_rate" | jq '.data.result[0].value[1]'

# JWKS latency
curl -s "$PROMETHEUS_URL/api/v1/query?query=jwks_p95_latency" | jq '.data.result[0].value[1]'

# CSRF mismatches
curl -s "$PROMETHEUS_URL/api/v1/query?query=csrf_mismatch_total" | jq '.data.result[0].value[1]'

# Rate limit violations
curl -s "$PROMETHEUS_URL/api/v1/query?query=rate_limit_violations" | jq '.data.result[0].value[1]'
```

### Log Commands
```bash
# Recent errors
kubectl logs -l app=api --tail=100 | grep -i error

# Security events
kubectl logs -l app=api --tail=100 | grep -i "SECURITY_EVENT"

# Authentication failures
kubectl logs -l app=api --tail=100 | grep -i "auth.*fail"
```

---

## Emergency Contacts

### Escalation Matrix
1. **Level 1**: On-call engineer (0-15 minutes)
2. **Level 2**: Senior engineer (15-30 minutes)
3. **Level 3**: Engineering manager (30-60 minutes)
4. **Level 4**: CTO (60+ minutes)

### Communication Channels
- **Slack**: #incidents
- **PagerDuty**: [Integration]
- **Email**: incidents@shomer.local
- **Phone**: [Emergency number]

### Post-Incident Process
1. **Immediate**: Fix the issue
2. **Within 1 hour**: Document what happened
3. **Within 24 hours**: Post-mortem meeting
4. **Within 1 week**: Implement improvements
