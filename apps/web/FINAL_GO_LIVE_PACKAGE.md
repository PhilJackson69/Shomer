# 🎉 Final Go-Live Package - Ready to Ship!

## 🎯 **Day-of-Deployment Control Plan**

### ✅ **Step 1: Confirm Preconditions (5 min)**
```bash
# Run on staging before prod
pnpm prisma migrate deploy
pnpm prisma db pull && pnpm prisma generate
pnpm build && pnpm test -i org-apikeys-hardened.test.ts
```

**Validation Checklist:**
- ✔️ Tests green
- ✔️ Lint/typecheck passes
- ✔️ Env var ACTION_SECRET present and unique per env

### ✅ **Step 2: Execute Deployment (CI/CD or Manual)**
1. Merge main → deploy via pipeline
2. Run `scripts/go-live-validation.sh` in the target env
3. Post results in Slack #platform-deploys thread

### ✅ **Step 3: 15-Minute Verification Window**

| Check | Expected | Owner |
|-------|----------|-------|
| Smoke test secret bypass | ✅ 2xx | Platform Eng |
| Scoped key (valid/invalid) | ✅ 2xx / 403 | QA |
| Rate limit test | ✅ 429 on N+1 requests | SRE |
| Logs appear in Datadog (event:apikey.*) | ✅ | Security Ops |
| Dashboards populated | ✅ | SRE |

### ✅ **Step 4: Active Monitoring (Day 0–1)**
- **Dashboard panel**: `apikey.scope_denied` rate < 1%
- **apikey.rate_limited** count stable
- **No disabledAt keys** passing auth
- **Alerts**: none fired

*If any threshold breached → follow Runbook Incident Card.*

### ✅ **Step 5: Customer Comms**
- Post changelog (template in `api-keys-customer-guide.md`) to release notes + status page
- Notify support to reference new error codes (`invalid_key`, `forbidden_scope`, `rate_limited`)

### ✅ **Step 6: 24-Hour Audit**
```bash
./apps/web/scripts/week-one-audit.sh --day0
```

**Review:**
- Top denied scopes
- Full-access keys (scopes = null)
- RPM usage spikes

*Document findings in `GO_LIVE_CHECKLIST.md` → Day-0 Card.*

### ✅ **Step 7: Week-One Review (T + 7 days)**
```bash
./apps/web/scripts/week-one-audit.sh --day7
```

**Validation:**
- ✅ All keys have scoped permissions
- ✅ Rate limits tuned per usage
- ✅ No anomalous auth failures

### ✅ **Step 8: Sign-off**
- All Day-7 metrics within targets
- Docs + Runbooks updated
- Incident cards tested
- Audit report filed (`FINAL_GO_LIVE_PACKAGE.md` → Appendix A)

### ✅ **Step 9: Archive**
```bash
# Tag release
git tag -a v1.0.0-api-key-hardening -m "API key scopes & rate limiting launch"
git push origin v1.0.0-api-key-hardening
```

- Export dashboards & attach to internal audit ticket

---

## 📦 **Complete Go-Live Bundle**

Your final go-live QA + ops bundle is ready! Everything is copy-pasteable and designed for immediate deployment and week-one audits.

## 🚀 **Go-Live "Green Light" Checklist**

### ✅ **Pre-Deployment (10 minutes)**
- [ ] Migrations applied, schema matches expectations
- [ ] `ACTION_SECRET` set & distinct per env
- [ ] Smoke tests pass (secret bypass, scope allow/deny, 429)
- [ ] Dashboards + alerts live
- [ ] Docs deployed (customer guide + OpenAPI additions)
- [ ] Backout flag documented

### ✅ **One-Liner Validation**
```bash
# Set your test variables
ORG=org_123 KEY="org_live_redacted" SECRET="$ACTION_SECRET"

# Complete validation pipeline
pnpm prisma migrate deploy && pnpm prisma db pull && pnpm prisma generate \
 && pnpm typecheck && pnpm lint && pnpm build \
 && pnpm test -i org-apikeys-hardened.test.ts

# Secret bypass
curl -sS -i -X POST -H "X-Action-Secret: $SECRET" \
 "http://localhost:3000/api/oncall/rota?orgId=$ORG" | sed -n '1,12p'

# Scope OK
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
 "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1" | sed -n '1,20p'

# Scope denied
curl -sS -i -X POST -H "X-Org-Api-Key: $KEY" \
 "http://localhost:3000/api/orgs/$ORG/settings" | sed -n '1,20p'

# 429 (rpm=N → run N+1)
for i in {1..6}; do curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "X-Org-Api-Key: $KEY" \
 "http://localhost:3000/api/oncall/rota/copy-week?orgId=$ORG&from=2025-01-01&weeks=1"; done
```

## 📊 **Canary SQL Queries**

### **Pre-Traffic Validation**
```sql
-- Keys used in last 24h
SELECT orgId, keyId, lastUsedAt FROM OrganizationApiKey
WHERE lastUsedAt > DATETIME('now','-1 day')
ORDER BY lastUsedAt DESC LIMIT 50;

-- Disabled keys (should have no recent activity)
SELECT keyId, disabledAt, lastUsedAt
FROM OrganizationApiKey 
WHERE disabledAt IS NOT NULL 
AND lastUsedAt > disabledAt;
```

### **Post-Traffic Validation**
```sql
-- Scope denial patterns
SELECT 
  JSON_EXTRACT(scopes, '$[0]') as first_scope,
  COUNT(*) as key_count
FROM OrganizationApiKey 
WHERE scopes IS NOT NULL 
AND revokedAt IS NULL 
GROUP BY first_scope;
```

## 🔍 **Monitoring Quick Filters**

### **Datadog Log Pattern**
```
(event:apikey.auth OR event:apikey.scope_denied OR event:apikey.rate_limited) env:prod
```

### **Alert Validation**
```bash
# Scope denial rate
sum(last_5m):events("event:apikey.scope_denied env:prod").as_count()
/ sum(last_5m):events("event:apikey.auth env:prod").as_count() > 0.01

# Rate-limited surge
sum(last_5m):events("event:apikey.rate_limited env:prod").as_count() > 100
```

### **Prometheus Counters**
```promql
rate(apikey_auth_total[5m])
rate(apikey_scope_denied_total[5m])
rate(apikey_rate_limited_total[5m])
```

## 🚨 **Ops Runbook Snippets**

### **Rotate Compromised Key (Instant)**
```sql
UPDATE OrganizationApiKey SET disabledAt = CURRENT_TIMESTAMP WHERE keyId = ?;
-- Notify owner to create least-privilege replacement
-- Search last 24h logs by keyId for blast radius
```

### **"We're Getting 429s"**
```
1. Check apikey.rate_limited panel
2. Confirm legit volume vs bug
3. Horizontally scaled? Per-instance limiter → temporarily lower RPM per instance or move to shared store
4. Suggest client exponential backoff + jitter
```

### **Emergency Bypass (Auth Outage)**
```
Feature flag: treat scopes = null as full access and skip limiter
Keep schema; revert flag when stable
```

## 📢 **Customer-Facing Changelog**

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
```

## 📅 **Day-0 / Day-7 Audit Cards**

### **Day-0 (T+60 min)**
- [ ] Scope denial rate < 1% overall
- [ ] Rate-limited events within expected range for RPM settings
- [ ] No disabled keys making successful calls
- [ ] Authentication success rate > 99%

### **Day-7 Audit**
- [ ] **Top 10 routes by scope_denied** → outreach to orgs to right-size scopes
- [ ] **Keys with scopes=null (full access)** → nudge owners to trim
- [ ] **Any key with RPM unset but bursty use** → set a sensible RPM cap
- [ ] **Review security log patterns** → identify unusual activity

## 📱 **Final "Go" Message Template**

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

## 🛠️ **Automated Scripts & CI/CD**

### **Go-Live Validation Script**
```bash
# Run immediately after deployment
./apps/web/scripts/go-live-validation.sh
```

**Features**:
- ✅ Environment validation
- ✅ Database schema checks
- ✅ Build and test validation
- ✅ Smoke tests (secret bypass, scopes, rate limiting)
- ✅ Monitoring validation
- ✅ Colored output with clear success/failure indicators

### **Week-One Audit Script**
```bash
# Run 7 days after go-live
./apps/web/scripts/week-one-audit.sh
```

**Features**:
- ✅ Scope denial pattern analysis
- ✅ Full-access key identification
- ✅ Rate limit usage analysis
- ✅ Security event review
- ✅ Performance metrics
- ✅ Actionable recommendations

### **GitHub Actions - Automated Validation**
```yaml
# .github/workflows/api-key-hardening.yml
# Runs on every merge to main
```

**Features**:
- ✅ Automated testing on merge
- ✅ Schema drift detection
- ✅ Environment variable validation
- ✅ PR comment with results
- ✅ Artifact upload for debugging

### **Compliance Audit Automation**
```yaml
# .github/workflows/compliance-audit.yml
# Runs weekly for SOC 2 compliance
```

**Features**:
- ✅ Weekly automated audits
- ✅ SOC 2 Type II controls verification
- ✅ Compliance report generation
- ✅ Issue creation for failures
- ✅ 365-day artifact retention

### **Release Management**
```yaml
# .github/workflows/release-tagging.yml
# Automated versioning and deployment
```

**Features**:
- ✅ Semantic versioning (patch/minor/major)
- ✅ GitHub release creation
- ✅ Slack notifications
- ✅ Deployment issue tracking
- ✅ Status page updates

## 🎯 **Success Criteria**

### **Immediate (T+0)**
- ✅ All smoke tests pass
- ✅ No authentication errors
- ✅ Monitoring dashboards active
- ✅ Alerts configured and tested

### **Short-term (T+1 hour)**
- ✅ Scope denial rate < 1%
- ✅ Rate limiting within expected bounds
- ✅ No disabled keys making calls
- ✅ Customer integrations working

### **Medium-term (T+1 week)**
- ✅ Scope optimization outreach complete
- ✅ Full-access keys reviewed
- ✅ Rate limit tuning complete
- ✅ Security log patterns analyzed

## 🚀 **Deployment Confidence**

**Risk Level**: LOW
- Comprehensive validation scripts
- Complete monitoring configuration
- Detailed incident response procedures
- Customer documentation ready
- Automated audit procedures

**Timeline**: 
- Go-live validation: 10 minutes
- Initial monitoring: 60 minutes
- Week-one audit: 30 minutes

## 📞 **Support Resources**

### **Documentation**
- **Go-Live Checklist**: `GO_LIVE_CHECKLIST.md`
- **Security Guide**: `API_KEYS_SECURITY_GUIDE.md`
- **Deployment Package**: `DEPLOYMENT_PACKAGE.md`
- **Customer Guide**: `docs/api-keys-customer-guide.md`

### **Scripts**
- **Go-Live Validation**: `scripts/go-live-validation.sh`
- **Week-One Audit**: `scripts/week-one-audit.sh`
- **Post-Merge Validation**: `scripts/post-merge-validation.sh`
- **Release Creation**: `scripts/create-release.sh`
- **Audit Cron Setup**: `scripts/setup-audit-cron.sh`

### **CI/CD Workflows**
- **API Key Validation**: `.github/workflows/api-key-hardening.yml`
- **Compliance Audit**: `.github/workflows/compliance-audit.yml`
- **Release Tagging**: `.github/workflows/release-tagging.yml`

### **Monitoring & Compliance**
- **Dashboard Exports**: `monitoring/dashboards/api_keys.json`
- **SOC 2 Documentation**: `monitoring/dashboards/README.md`

### **Incident Response**
- **Runbook**: `runbook-incident-cards.md`
- **Emergency Procedures**: Emergency bypass flag
- **Escalation Paths**: On-call, security, customer success

---

## 🎉 **Ready to Ship!**

Your complete go-live package is ready with:
- ✅ **Copy-pasteable validation commands**
- ✅ **Automated go-live script**
- ✅ **Week-one audit automation**
- ✅ **Complete monitoring configuration**
- ✅ **Incident response procedures**
- ✅ **Customer communication templates**

**Status**: 🚀 Ready for Production Deployment
**Confidence**: High
**Timeline**: 10 minutes validation + 60 minutes monitoring

**Let's ship it! 🚀**
