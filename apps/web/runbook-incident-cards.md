# API Keys - Incident Response Runbook

## 🚨 Incident Response Cards

### Card 1: Rotate Compromised Key

**Severity**: High
**Impact**: Potential unauthorized access

#### Immediate Actions (0-5 minutes)
```sql
-- 1. Disable the compromised key immediately
UPDATE OrganizationApiKey 
SET disabledAt = CURRENT_TIMESTAMP 
WHERE keyId = 'compromised-key-id';

-- 2. Verify the key is disabled
SELECT keyId, disabledAt, label 
FROM OrganizationApiKey 
WHERE keyId = 'compromised-key-id';
```

#### Investigation (5-15 minutes)
```bash
# Search security logs for the compromised key
grep "keyId:compromised-key-id" /var/log/security.log | tail -100

# Check for unusual access patterns
grep "apikey.auth.*keyId:compromised-key-id" /var/log/security.log | \
  awk '{print $1, $2}' | sort | uniq -c | sort -nr

# Look for scope denials (potential privilege escalation attempts)
grep "apikey.scope_denied.*keyId:compromised-key-id" /var/log/security.log
```

#### Recovery (15-30 minutes)
1. **Notify key owner** via email/Slack
2. **Create replacement key** with minimal scopes
3. **Update client applications** with new key
4. **Verify new key works** with test requests
5. **Delete old key record** (optional, for audit)

#### Communication Template
```
🚨 SECURITY ALERT: API Key Compromised

Key ID: {keyId}
Organization: {orgId}
Label: {label}

Actions taken:
✅ Key disabled immediately
✅ Access logs reviewed
✅ Replacement key created

Next steps:
1. Update your applications with the new key
2. Test the new key functionality
3. Delete the old key from your systems

New key: {newKeyValue}
```

---

### Card 2: Customer "We're Getting 429s"

**Severity**: Medium
**Impact**: Service degradation for customer

#### Diagnosis (0-5 minutes)
```bash
# Check rate limiting for specific org/key
grep "apikey.rate_limited.*orgId:customer-org" /var/log/security.log | tail -20

# Check current rate limit settings
SELECT keyId, label, requestsPerMinute, lastUsedAt 
FROM OrganizationApiKey 
WHERE orgId = 'customer-org' 
AND revokedAt IS NULL 
AND disabledAt IS NULL;

# Check request volume patterns
grep "apikey.auth.*orgId:customer-org" /var/log/security.log | \
  awk '{print $1, $2}' | sort | uniq -c | sort -nr
```

#### Root Cause Analysis
1. **Legitimate high volume**: Customer needs higher rate limits
2. **Bug in client**: Infinite retry loops, missing backoff
3. **Misconfigured rate limit**: Too low for normal usage
4. **Horizontal scaling**: Multiple instances hitting same limit

#### Solutions

**Option A: Increase Rate Limit (if legitimate)**
```sql
UPDATE OrganizationApiKey 
SET requestsPerMinute = 300  -- Increase from current value
WHERE keyId = 'customer-key-id';
```

**Option B: Client-Side Fix (if bug)**
```javascript
// Provide customer with backoff implementation
async function apiCallWithBackoff(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

**Option C: Temporary Unlimited (emergency)**
```sql
UPDATE OrganizationApiKey 
SET requestsPerMinute = NULL  -- Unlimited
WHERE keyId = 'customer-key-id';
```

#### Communication Template
```
🔧 Rate Limiting Issue Resolved

Issue: API key hitting rate limits
Key ID: {keyId}
Organization: {orgId}

Root cause: {cause}
Solution: {solution}

Next steps:
1. Monitor usage patterns
2. Implement client-side backoff
3. Consider permanent rate limit adjustment

Contact us if issues persist.
```

---

### Card 3: Emergency Bypass (System-Wide Issue)

**Severity**: Critical
**Impact**: All API key authentication failing

#### Emergency Actions (0-2 minutes)
```bash
# Set emergency bypass flag
export EMERGENCY_BYPASS_SCOPES=true

# Restart application services
kubectl rollout restart deployment/api-service
# or
docker-compose restart api

# Verify bypass is active
curl -H "X-Org-Api-Key: any-key" \
  "https://api.example.com/health" | jq '.emergency_bypass'
```

#### Investigation (2-10 minutes)
```bash
# Check application logs for errors
kubectl logs -f deployment/api-service | grep -i "auth\|scope\|rate"

# Check database connectivity
kubectl exec -it deployment/api-service -- \
  npx prisma db execute --stdin <<< "SELECT 1"

# Check rate limiter state
kubectl exec -it deployment/api-service -- \
  node -e "console.log(require('./lib/ratelimit').getBucketState('test'))"
```

#### Recovery Steps
1. **Identify root cause** (database, memory, configuration)
2. **Fix underlying issue**
3. **Test authentication** with sample requests
4. **Disable emergency bypass**
5. **Monitor for stability**

#### Communication Template
```
🚨 SYSTEM ALERT: API Authentication Bypass Active

Status: Emergency bypass enabled
Duration: {duration}
Impact: All API keys treated as full access

Actions taken:
✅ Emergency bypass activated
✅ Investigation in progress
✅ Root cause: {cause}

ETA for resolution: {eta}
```

---

### Card 4: Scope Denial Spike

**Severity**: Medium
**Impact**: Customers unable to access features

#### Investigation (0-5 minutes)
```bash
# Check scope denial rates
grep "apikey.scope_denied" /var/log/security.log | \
  awk '{print $NF}' | sort | uniq -c | sort -nr

# Check for recent scope changes
grep "apikey.created\|apikey.revoked" /var/log/security.log | tail -20

# Check specific denied scopes
grep "apikey.scope_denied" /var/log/security.log | \
  grep -o 'need:[^,]*' | sort | uniq -c | sort -nr
```

#### Common Causes
1. **Recent scope changes**: Keys created with limited scopes
2. **API changes**: New endpoints requiring additional scopes
3. **Client bugs**: Using wrong keys for operations
4. **Configuration errors**: Keys created with wrong scopes

#### Solutions

**Option A: Grant Missing Scopes**
```sql
-- Find keys missing specific scope
SELECT keyId, label, scopes 
FROM OrganizationApiKey 
WHERE orgId = 'customer-org' 
AND scopes NOT LIKE '%missing-scope%'
AND revokedAt IS NULL;

-- Update key with missing scope
UPDATE OrganizationApiKey 
SET scopes = JSON_ARRAY_APPEND(scopes, '$', 'missing-scope')
WHERE keyId = 'customer-key-id';
```

**Option B: Temporary Full Access**
```sql
-- Grant temporary full access
UPDATE OrganizationApiKey 
SET scopes = NULL  -- Full access
WHERE keyId = 'customer-key-id';
```

#### Communication Template
```
🔧 Scope Access Issue Resolved

Issue: API key scope denials
Key ID: {keyId}
Organization: {orgId}
Missing scope: {scope}

Root cause: {cause}
Solution: {solution}

Please review your key scopes and update as needed.
```

---

### Card 5: Database Performance Degradation

**Severity**: High
**Impact**: Slow API responses, potential timeouts

#### Investigation (0-5 minutes)
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%OrganizationApiKey%' 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
WHERE tablename = 'OrganizationApiKey'
ORDER BY idx_scan DESC;

-- Check table size and bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables 
WHERE tablename = 'OrganizationApiKey';
```

#### Common Issues
1. **Missing indexes**: Queries scanning full table
2. **Hot writes**: Too many lastUsedAt updates
3. **Table bloat**: High update/delete activity
4. **Connection pool exhaustion**: Too many concurrent queries

#### Solutions

**Option A: Add Missing Indexes**
```sql
-- Add indexes if missing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_apikeys_keyid 
ON OrganizationApiKey(keyId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_apikeys_rpm 
ON OrganizationApiKey(requestsPerMinute);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_apikeys_disabled 
ON OrganizationApiKey(disabledAt);
```

**Option B: Reduce Write Frequency**
```javascript
// Increase lastUsedAt throttling
const THROTTLE_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 1
```

**Option C: Connection Pool Tuning**
```javascript
// Increase connection pool size
const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=20"
    }
  }
});
```

#### Communication Template
```
🔧 Database Performance Issue Resolved

Issue: Slow API key authentication queries
Impact: {impact}
Duration: {duration}

Root cause: {cause}
Solution: {solution}

Monitoring: Enhanced database monitoring added
```

---

## 📊 Monitoring Checklist

### Daily Checks
- [ ] Authentication success rate > 99%
- [ ] Scope denial rate < 1%
- [ ] Rate limiting volume within normal range
- [ ] No authentication errors in logs

### Weekly Checks
- [ ] Review key creation/revocation patterns
- [ ] Check for unused or expired keys
- [ ] Verify rate limit settings are appropriate
- [ ] Review security log patterns

### Monthly Checks
- [ ] Audit key permissions and usage
- [ ] Review and rotate global secrets
- [ ] Check database performance metrics
- [ ] Update documentation and runbooks

## 🚀 Escalation Procedures

### Level 1: Customer Impact
- Scope denials > 5% of requests
- Rate limiting > 50% of requests
- Authentication failures > 10% of requests

### Level 2: System Impact
- Database performance degradation
- Memory leaks in rate limiter
- Security incidents (compromised keys)

### Level 3: Critical System Failure
- Complete authentication failure
- Database connectivity issues
- Security breaches

## 📞 Contact Information

### On-Call Engineer
- Primary: [Your on-call rotation]
- Secondary: [Backup on-call]
- Escalation: [Engineering manager]

### Security Team
- Primary: [Security team contact]
- Emergency: [Security incident response]

### Customer Success
- Primary: [Customer success contact]
- Escalation: [Customer success manager]
