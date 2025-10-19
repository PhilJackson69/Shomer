# 🚀 Launch Day Runbook - v1.0.0

## Pre-Launch Checklist (T-30 minutes)

### 1. Announce Code Freeze
**Time: T-30 min**

Post in `#eng` and `#ops` channels:
```
🚨 CODE FREEZE ANNOUNCEMENT 🚨

Deploying v1.0.0 to 5% canary at [HH:MM].
Pager on SecOps.
Abort if page-level alert ≥5 min.

All hands on deck for monitoring.
```

### 2. Preflight Validation
**Time: T-30 min**

```bash
export PUBLIC_BASE_URL="https://prod.your-domain.com"
./scripts/preflight-validation.sh
```

**Expected Results:**
- ✅ All preflight checks PASS
- ✅ JWKS health verified
- ✅ Security headers present
- ✅ Cookie security configured

---

## Launch Sequence (T-0)

### 3. Initial Canary Deployment
**Time: T-0**

```bash
deploy --service api --env prod --version v1.0.0 --traffic 5%
```

**Immediate Actions:**
1. Open Grafana "Golden Signals" dashboard
2. Monitor these key metrics:
   - JWT verify %
   - JWKS p95 latency
   - CSRF mismatches
   - 5xx error rate

**Success Criteria:**
- No page-level alerts for 30 minutes
- JWT verify % < 2%
- JWKS p95 < 300ms
- CSRF mismatches < 50
- 5xx rate < 0.5%

---

## Gradual Rollout (T+30 min)

### 4. Traffic Increase - 25%
**Time: T+30 min**

**Prerequisites:**
- ✅ No page-level alerts sustained for 30 minutes
- ✅ All golden signals within thresholds

```bash
deploy --service api --env prod --traffic 25%
```

**Monitoring Period:** 10 minutes

### 5. Traffic Increase - 50%
**Time: T+40 min**

**Prerequisites:**
- ✅ No page-level alerts for 10 minutes
- ✅ Golden signals stable

```bash
deploy --service api --env prod --traffic 50%
```

**Monitoring Period:** 10 minutes

### 6. Full Deployment - 100%
**Time: T+50 min**

**Prerequisites:**
- ✅ No page-level alerts for 10 minutes
- ✅ Golden signals stable
- ✅ No customer impact reported

```bash
deploy --service api --env prod --traffic 100%
```

---

## Post-Deploy Verification (T+60 min)

### 7. Comprehensive Verification
**Time: T+60 min**

```bash
./scripts/post-deploy-verification.sh
```

**Expected Results:**
- ✅ All verification checks PASS
- ✅ Evidence captured
- ✅ Performance within thresholds

### 8. Evidence Archival
**Time: T+65 min**

```bash
# Archive all evidence to release folder
cp -r releases/v1.0.0-rc1/evidence/* releases/v1.0.0/
```

---

## 🚨 ABORT PROCEDURES

### Immediate Rollback Trigger
**Execute if ANY of these conditions occur:**

1. **Page-level alert sustained for 5+ minutes**
2. **JWT verify errors > 2% for 5+ minutes**
3. **JWKS p95 > 300ms for 5+ minutes**
4. **CSRF mismatches > 50 for 5+ minutes**
5. **5xx rate > 0.5% for 5+ minutes**
6. **Customer impact reported**

### Rollback Command
```bash
deploy --service api --env prod --version previous --traffic 100%
```

### Post-Rollback Actions
1. **Immediate Communication:**
   ```
   🚨 ROLLBACK EXECUTED 🚨
   
   Rolled back v1.0.0 due to [ALERT_TYPE].
   Investigating.
   No customer data impact.
   
   Services stable.
   Retrospective within 48 hours.
   ```

2. **Post in `#eng` and `#ops`:**
   ```
   Rolled back v1.0.0 due to <alert>.
   Investigating.
   No customer data impact.
   ```

3. **Update Status Page:**
   - Switch to "Incident" template
   - Post rollback notification

---

## 📊 Monitoring Dashboard

### Golden Signals Dashboard
**URL:** `https://grafana.your-domain.com/d/golden-signals`

**Key Panels:**
- JWT Verify Error Rate
- JWKS Response Time (p95)
- CSRF Mismatch Count
- 5xx Error Rate
- Request Rate
- Response Time Distribution

### Alert Thresholds
- **Critical:** 5m & 1h burn > 14.4×
- **Warning:** 30m & 6h burn > 6×
- **Degraded:** > 15% critical, > 5% warning
- **Retry Success:** < 95% critical, < 98% warning

---

## 📞 Communication Plan

### Internal Channels
- **#eng:** Engineering team updates
- **#ops:** Operations team updates
- **#alerts:** Alert notifications
- **#status:** Status page updates

### External Communication
- **Status Page:** Real-time updates
- **Customer Support:** Prepared responses
- **Media:** Press release ready

---

## 🔧 Troubleshooting Guide

### Common Issues

#### High JWT Verify Errors
1. Check JWKS endpoint accessibility
2. Verify key rotation status
3. Check clock skew settings
4. Review token expiration

#### High JWKS Latency
1. Check CDN/cache configuration
2. Verify ETag headers
3. Check database connection pool
4. Review server resources

#### CSRF Mismatches
1. Verify CSRF token generation
2. Check cookie settings
3. Review SameSite configuration
4. Check token rotation timing

#### 5xx Errors
1. Check application logs
2. Verify database connectivity
3. Review external service calls
4. Check resource limits

---

## 📋 Success Criteria

### Launch Success
- ✅ 100% traffic on v1.0.0
- ✅ No page-level alerts for 1 hour
- ✅ All golden signals within thresholds
- ✅ Post-deploy verification passed
- ✅ Evidence archived

### 24-Hour Success
- ✅ No critical alerts
- ✅ Performance stable
- ✅ Customer satisfaction maintained
- ✅ Security metrics normal

---

## 📁 Evidence Collection

### Required Artifacts
- [ ] Preflight validation results
- [ ] Deployment logs
- [ ] Golden signals screenshots
- [ ] Post-deploy verification results
- [ ] Alert notifications (if any)
- [ ] Rollback logs (if applicable)

### Archive Location
```
releases/v1.0.0/
├── evidence/
│   ├── preflight-validation/
│   ├── deployment-logs/
│   ├── golden-signals/
│   ├── post-deploy-verification/
│   └── alerts/
└── runbook.md
```

---

## 🎯 Post-Launch Actions

### Immediate (First Hour)
- [ ] Monitor golden signals dashboard
- [ ] Watch for any alert escalations
- [ ] Verify customer-facing functionality
- [ ] Check performance metrics

### Short-term (24 Hours)
- [ ] Review all metrics and logs
- [ ] Conduct post-mortem (if issues)
- [ ] Update documentation
- [ ] Plan next iteration

### Long-term (1 Week)
- [ ] Analyze performance trends
- [ ] Review security metrics
- [ ] Gather customer feedback
- [ ] Plan future improvements

---

## 📞 Emergency Contacts

### On-Call Rotation
- **Primary:** [Name] - [Phone] - [Email]
- **Secondary:** [Name] - [Phone] - [Email]
- **Escalation:** [Name] - [Phone] - [Email]

### Key Stakeholders
- **Engineering Lead:** [Name] - [Phone] - [Email]
- **Security Lead:** [Name] - [Phone] - [Email]
- **Product Manager:** [Name] - [Phone] - [Email]
- **Customer Support:** [Name] - [Phone] - [Email]

---

## 🔄 Runbook Updates

This runbook should be updated after each deployment to:
- Reflect lessons learned
- Update contact information
- Refine procedures
- Add new monitoring metrics

**Last Updated:** [Date]
**Version:** 1.0
**Next Review:** [Date]
