# 🚀 Go-Live "Green Light" Checklist

## Pre-Deployment Validation (10 minutes)

### ✅ Database & Schema
- [ ] Migrations applied successfully
- [ ] Schema matches expectations:
  - [ ] `scopes` is JSON type
  - [ ] `keyId` is unique and indexed
  - [ ] `disabledAt` is nullable and indexed
  - [ ] `requestsPerMinute` is indexed

### ✅ Environment Configuration
- [ ] `ACTION_SECRET` set and distinct per environment
- [ ] Staging and production have different secret values
- [ ] Environment variables validated

### ✅ Smoke Tests Pass
- [ ] Global secret bypass works
- [ ] Scoped key allowed/denied correctly
- [ ] Rate limiting (429) functions properly
- [ ] Error response formats are standardized

### ✅ Monitoring & Observability
- [ ] Dashboards deployed and live
- [ ] Alerts configured and active:
  - [ ] Scope denials monitoring
  - [ ] Rate limiting alerts
  - [ ] Authentication failure tracking
- [ ] Log aggregation working

### ✅ Documentation
- [ ] Customer guide deployed
- [ ] OpenAPI additions published
- [ ] Internal documentation updated
- [ ] Runbook procedures accessible

### ✅ Emergency Procedures
- [ ] Backout flag documented
- [ ] Emergency bypass procedures tested
- [ ] Rollback plan validated
- [ ] Incident response team notified

## One-Liner Validation Command

```bash
# Set your test variables
ORG=org_123
KEY="org_live_redacted"  # Replace with actual test key
SECRET="$ACTION_SECRET"

# Complete validation pipeline
pnpm prisma migrate deploy && pnpm prisma db pull && pnpm prisma generate \
 && pnpm typecheck && pnpm lint && pnpm build \
 && pnpm test -i org-apikeys-hardened.test.ts

# Secret bypass test
curl -sS -i -X POST -H "X-Action-Secret: $SECRET" \
 "http://localhost:3000/api/oncall/rota?orgId=$ORG" | sed -n '1,12p'

# Scope allowed test
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
 "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1" | sed -n '1,20p'

# Scope denied test
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
 "http://localhost:3000/api/orgs/$ORG/settings" | sed -n '1,20p'

# Rate limiting test (rpm=N → run N+1)
for i in {1..6}; do 
  curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "X-Org-Api-Key: $KEY" \
   "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1"
done
```

## Canary SQL Queries

### Pre-Traffic Validation
```sql
-- Keys used in last 24h
SELECT orgId, keyId, lastUsedAt 
FROM OrganizationApiKey
WHERE lastUsedAt > DATETIME('now','-1 day')
ORDER BY lastUsedAt DESC 
LIMIT 50;

-- Disabled keys (should have no recent activity)
SELECT keyId, disabledAt, lastUsedAt
FROM OrganizationApiKey 
WHERE disabledAt IS NOT NULL 
AND lastUsedAt > disabledAt;

-- Keys with null scopes (full access)
SELECT keyId, label, createdAt, lastUsedAt
FROM OrganizationApiKey 
WHERE scopes IS NULL 
AND revokedAt IS NULL 
AND disabledAt IS NULL;
```

### Post-Traffic Validation
```sql
-- Scope denial patterns
SELECT 
  JSON_EXTRACT(scopes, '$[0]') as first_scope,
  COUNT(*) as key_count
FROM OrganizationApiKey 
WHERE scopes IS NOT NULL 
AND revokedAt IS NULL 
GROUP BY first_scope;

-- Rate limit distribution
SELECT 
  requestsPerMinute,
  COUNT(*) as key_count
FROM OrganizationApiKey 
WHERE revokedAt IS NULL 
GROUP BY requestsPerMinute;
```

## Monitoring Quick Filters

### Datadog Log Pattern
```
(event:apikey.auth OR event:apikey.scope_denied OR event:apikey.rate_limited) env:prod
```

### Alert Validation Queries

#### Scope Denial Rate
```
sum(last_5m):events("event:apikey.scope_denied env:prod").as_count()
/
sum(last_5m):events("event:apikey.auth env:prod").as_count() > 0.01
```

#### Rate-Limited Surge
```
sum(last_5m):events("event:apikey.rate_limited env:prod").as_count() > 100
```

### Prometheus Counters (if exported)
```promql
# Authentication success rate
rate(apikey_auth_total[5m])

# Scope denial rate
rate(apikey_scope_denied_total[5m])

# Rate limiting volume
rate(apikey_rate_limited_total[5m])
```

## Ops Runbook Snippets

### Rotate Compromised Key (Instant)
```sql
-- Disable immediately
UPDATE OrganizationApiKey 
SET disabledAt = CURRENT_TIMESTAMP 
WHERE keyId = 'compromised-key-id';

-- Notify owner to create least-privilege replacement
-- Search last 24h logs by keyId for blast radius
```

### "We're Getting 429s"
```
1. Check apikey.rate_limited panel
2. Confirm legit volume vs bug
3. Horizontally scaled? Per-instance limiter → temporarily lower RPM per instance or move to shared store
4. Suggest client exponential backoff + jitter
```

### Emergency Bypass (Auth Outage)
```
Feature flag: treat scopes = null as full access and skip limiter
Keep schema; revert flag when stable
```

## Customer-Facing Changelog

```
## API Keys: Scopes + Rate Limits

### New Features
- **Least-privilege scopes per key**: Grant only the permissions needed
- **Optional per-key Requests-Per-Minute**: Token bucket with continuous refill
- **Standardized error JSON**: Clear error codes (invalid_key, forbidden_scope, rate_limited)
- **Self-serve UI**: View scopes, RPM, and last used time

### For Integrators
- If you see `403 forbidden_scope`, create a new key with the required scope(s)
- If you hit `429 rate_limited`, add retry with exponential backoff
- Global `X-Action-Secret` bypass unchanged (no rate limit)

### Migration
- Existing keys continue to work unchanged
- New keys can be created with specific scopes
- Rate limits are optional (null = unlimited)
```

## Day-0 / Day-7 Audit Cards

### Day-0 (T+60 minutes)
- [ ] Scope denial rate < 1% overall
- [ ] Rate-limited events within expected range for RPM settings
- [ ] No disabled keys making successful calls
- [ ] Authentication success rate > 99%
- [ ] Error response formats consistent

### Day-7 Audit
- [ ] **Top 10 routes by scope_denied** → outreach to orgs to right-size scopes
- [ ] **Keys with scopes=null (full access)** → nudge owners to trim
- [ ] **Any key with RPM unset but bursty use** → set a sensible RPM cap
- [ ] **Review security log patterns** → identify unusual activity
- [ ] **Customer feedback collected** → address any integration issues

## Final "Go" Message Template

```
🚀 Ship ✅ — Org API Keys hardening is live.

✅ Scopes & per-key RPM now enforced
✅ Global X-Action-Secret bypass unchanged (no rate limit)
✅ New dashboards + alerts active
✅ Customer docs & OpenAPI updated

📊 Monitoring: Check #platform-dashboards for real-time metrics
🚨 Alerts: Scope denials, rate limiting, auth failures

📚 Docs: [Customer Guide](link) | [API Reference](link) | [Runbook](link)

⚠️ If you see 403 forbidden_scope or 429 rate_limited, follow the runbook (linked). 
Ping #oncall-platform for anomalies.

🎯 Day-0 check: Scope denial rate < 1%, no disabled keys active
```

## Success Criteria

### Immediate (T+0)
- ✅ All smoke tests pass
- ✅ No authentication errors
- ✅ Monitoring dashboards active
- ✅ Alerts configured and tested

### Short-term (T+1 hour)
- ✅ Scope denial rate < 1%
- ✅ Rate limiting within expected bounds
- ✅ No disabled keys making calls
- ✅ Customer integrations working

### Medium-term (T+1 week)
- ✅ Scope optimization outreach complete
- ✅ Full-access keys reviewed
- ✅ Rate limit tuning complete
- ✅ Security log patterns analyzed

---

**Status**: 🚀 Ready for Go-Live
**Confidence**: High
**Timeline**: 10 minutes validation + 60 minutes monitoring
