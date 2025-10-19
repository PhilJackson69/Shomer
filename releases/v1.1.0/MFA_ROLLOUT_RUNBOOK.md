# MFA Production Rollout Runbook

## Overview

This runbook provides step-by-step instructions for safely rolling out Multi-Factor Authentication (MFA) to production using staged cohorts, feature flags, and comprehensive monitoring.

## Pre-Rollout Checklist

### Prerequisites
- [ ] CI/CD pipeline is green
- [ ] All MFA tests are passing
- [ ] Recovery documentation is updated
- [ ] Support team is on-call and staffed
- [ ] Communications are drafted and approved
- [ ] Rollback procedures are tested
- [ ] Monitoring dashboards are deployed
- [ ] Alerting rules are active

### Environment Preparation
- [ ] Database migrations applied (`009_add_mfa_cohort.py`)
- [ ] Feature flags module deployed
- [ ] Metrics collection enabled
- [ ] Grafana dashboard imported
- [ ] Prometheus rules loaded

## Rollout Timeline (UTC)

### T-2 Days: Dry Run Mode
**Duration:** 48 hours  
**Mode:** `MFA_ROLLOUT_MODE=dryrun`

#### Objectives
- Validate rollout logic without enforcement
- Monitor metrics and alerting
- Identify any issues in the rollout pipeline

#### Steps
1. **Deploy Configuration**
   ```bash
   # Update environment variables
   export MFA_ROLLOUT_MODE=dryrun
   export MFA_PERCENT=0
   export MFA_COHORT_SOURCE=env
   export MFA_COHORT_USER_IDS=""
   
   # Restart application
   kubectl rollout restart deployment/shomer-api
   # OR
   docker-compose restart api
   ```

2. **Verify Dry Run Mode**
   ```bash
   # Check logs for dryrun decisions
   kubectl logs -f deployment/shomer-api | grep "MFA enforcement check"
   
   # Verify metrics are being recorded
   curl http://localhost:9090/api/v1/query?query=mfa_enforcement_would_block_total
   ```

3. **Monitor Key Metrics**
   - `mfa_enforcement_would_block_total` should increment
   - No actual enforcement blocks should occur
   - API latency should remain stable
   - Error rates should remain low

#### Success Criteria
- [ ] Dry run metrics are being recorded
- [ ] No enforcement blocks occur
- [ ] API performance is stable
- [ ] No critical alerts fired

#### Rollback Criteria
- [ ] Any critical alerts fire
- [ ] API latency increases > 50%
- [ ] Error rate increases > 2%
- [ ] Metrics collection fails

### T-1 Day: Cohort Mode
**Duration:** 24 hours  
**Mode:** `MFA_ROLLOUT_MODE=cohorts`

#### Objectives
- Test enforcement on a small group of users
- Validate cohort management functionality
- Monitor user experience and support volume

#### Steps
1. **Seed Cohort Users**
   ```bash
   # Add 5-10 admin users to cohort via environment
   export MFA_COHORT_USER_IDS="1,2,3,4,5"
   
   # OR add via database (preferred)
   psql -d shomer -c "
   INSERT INTO mfa_cohort_members (user_id, added_by, notes) 
   VALUES (1, 1, 'Initial rollout cohort'), 
          (2, 1, 'Initial rollout cohort'),
          (3, 1, 'Initial rollout cohort'),
          (4, 1, 'Initial rollout cohort'),
          (5, 1, 'Initial rollout cohort');
   "
   ```

2. **Deploy Cohort Configuration**
   ```bash
   export MFA_ROLLOUT_MODE=cohorts
   export MFA_COHORT_SOURCE=db
   
   # Restart application
   kubectl rollout restart deployment/shomer-api
   ```

3. **Verify Cohort Enforcement**
   ```bash
   # Check that cohort users are being enforced
   curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/admin/audit-logs
   # Should return 403 for cohort users without MFA
   ```

4. **Monitor Support Volume**
   - Watch for support tickets from cohort users
   - Monitor helpdesk channels
   - Track user feedback

#### Success Criteria
- [ ] Cohort users are properly enforced
- [ ] Non-cohort users are not affected
- [ ] Support ticket volume < 2 per hour
- [ ] User feedback is positive

#### Rollback Criteria
- [ ] Support ticket volume > 5 per hour
- [ ] User complaints about lockouts
- [ ] Any critical alerts fire
- [ ] Cohort enforcement fails

### T-0: Percentage Rollout
**Duration:** 4 hours  
**Mode:** `MFA_ROLLOUT_MODE=percent`

#### Objectives
- Gradually increase enforcement percentage
- Monitor system performance and user impact
- Validate consistent hashing behavior

#### Stage 1: 25% Rollout (1 hour)
```bash
export MFA_ROLLOUT_MODE=percent
export MFA_PERCENT=25

kubectl rollout restart deployment/shomer-api
```

**Health Checks (every 15 minutes):**
- [ ] 5xx error rate < 1%
- [ ] P95 latency < 200ms
- [ ] 429 rate on `/mfa/*` < 0.1/s
- [ ] Helpdesk volume < 3 tickets/hour
- [ ] `mfa.enforcement.blocked` < 20/hour

#### Stage 2: 50% Rollout (1 hour)
```bash
export MFA_PERCENT=50
kubectl rollout restart deployment/shomer-api
```

**Health Checks (every 15 minutes):**
- [ ] 5xx error rate < 1%
- [ ] P95 latency < 200ms
- [ ] 429 rate on `/mfa/*` < 0.1/s
- [ ] Helpdesk volume < 5 tickets/hour
- [ ] `mfa.enforcement.blocked` < 40/hour

#### Stage 3: 75% Rollout (1 hour)
```bash
export MFA_PERCENT=75
kubectl rollout restart deployment/shomer-api
```

**Health Checks (every 15 minutes):**
- [ ] 5xx error rate < 1%
- [ ] P95 latency < 200ms
- [ ] 429 rate on `/mfa/*` < 0.1/s
- [ ] Helpdesk volume < 8 tickets/hour
- [ ] `mfa.enforcement.blocked` < 60/hour

#### Stage 4: 100% Rollout (1 hour)
```bash
export MFA_PERCENT=100
kubectl rollout restart deployment/shomer-api
```

**Health Checks (every 15 minutes):**
- [ ] 5xx error rate < 1%
- [ ] P95 latency < 200ms
- [ ] 429 rate on `/mfa/*` < 0.1/s
- [ ] Helpdesk volume < 10 tickets/hour
- [ ] `mfa.enforcement.blocked` < 80/hour

#### Success Criteria
- [ ] All health checks pass for 1 hour
- [ ] No critical alerts fired
- [ ] User adoption rate > 80%
- [ ] Support volume manageable

#### Rollback Criteria
- [ ] Any health check fails
- [ ] Critical alerts fire
- [ ] Support volume > 15 tickets/hour
- [ ] User complaints spike

### T+4 Hours: Full Enforcement
**Duration:** Ongoing  
**Mode:** `MFA_ROLLOUT_MODE=on`

#### Objectives
- Enable full MFA enforcement for all admin users
- Monitor long-term stability
- Begin post-rollout validation

#### Steps
1. **Deploy Full Enforcement**
   ```bash
   export MFA_ROLLOUT_MODE=on
   kubectl rollout restart deployment/shomer-api
   ```

2. **Monitor for 24 Hours**
   - Watch all SLO metrics
   - Monitor error budgets
   - Track user adoption
   - Monitor support volume

3. **Post-Rollout Validation**
   - [ ] All SLOs met for 24 hours
   - [ ] Error budget > 50% remaining
   - [ ] User satisfaction > 4.0/5.0
   - [ ] No security incidents

## Health Check Commands

### System Health
```bash
# Check application health
curl http://localhost:8000/health

# Check database connectivity
psql -d shomer -c "SELECT 1"

# Check Redis connectivity
redis-cli ping
```

### MFA Metrics
```bash
# Check enforcement decisions
curl "http://localhost:9090/api/v1/query?query=mfa_enforcement_decisions_total"

# Check failure rates
curl "http://localhost:9090/api/v1/query?query=rate(mfa_totp_verify_total{status=\"failure\"}[5m])"

# Check latency
curl "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(mfa_api_latency_seconds_bucket[5m]))"
```

### Rollout Status
```bash
# Check current rollout mode
curl "http://localhost:9090/api/v1/query?query=mfa_enforcement_decisions_total{mode!=\"off\"}"

# Check cohort membership
psql -d shomer -c "SELECT COUNT(*) FROM mfa_cohort_members"

# Check enforcement blocks
curl "http://localhost:9090/api/v1/query?query=rate(mfa_enforcement_blocked_total[5m])"
```

## Rollback Procedures

### Immediate Rollback (Emergency)
```bash
# Switch to OFF mode immediately
export MFA_ROLLOUT_MODE=off
kubectl rollout restart deployment/shomer-api

# Clear rate limit buckets
redis-cli FLUSHDB

# Post incident note
echo "MFA rollout rolled back due to [REASON] at $(date)" >> /var/log/mfa-rollout.log
```

### Gradual Rollback
```bash
# Reduce percentage gradually
export MFA_PERCENT=50
kubectl rollout restart deployment/shomer-api

# Wait 30 minutes, then reduce further
export MFA_PERCENT=25
kubectl rollout restart deployment/shomer-api

# Wait 30 minutes, then disable
export MFA_ROLLOUT_MODE=off
kubectl rollout restart deployment/shomer-api
```

### Post-Rollback Actions
1. **Incident Response**
   - [ ] Open P1 incident ticket
   - [ ] Notify stakeholders
   - [ ] Begin root cause analysis
   - [ ] Schedule post-mortem

2. **Communication**
   - [ ] Update status page
   - [ ] Notify users via email
   - [ ] Post internal update
   - [ ] Update runbook with lessons learned

3. **Recovery Planning**
   - [ ] Identify and fix root cause
   - [ ] Update rollout plan
   - [ ] Schedule retry (minimum 24 hours)
   - [ ] Get stakeholder approval

## Support Procedures

### User Lockout Resolution
1. **Verify User Identity**
   - Check user account status
   - Verify admin role
   - Confirm MFA requirements

2. **Provide Recovery Options**
   - Issue new recovery codes
   - Reset MFA settings
   - Temporary bypass (audit logged)

3. **Follow-up Actions**
   - User education
   - MFA setup assistance
   - Monitor for repeat issues

### Recovery Code Exhaustion
1. **Immediate Response**
   - Issue new recovery codes
   - Reset MFA settings
   - Log security event

2. **Investigation**
   - Check for suspicious activity
   - Review MFA attempt logs
   - Verify user identity

3. **Prevention**
   - User education
   - MFA method diversification
   - Enhanced monitoring

## Communication Templates

### Internal Slack Notification
```
🚨 MFA Rollout Status Update

Stage: [CURRENT_STAGE]
Mode: [ROLLOUT_MODE]
Status: [SUCCESS/WARNING/CRITICAL]

Key Metrics:
- Enforcement Blocks: [COUNT]
- Support Tickets: [COUNT]
- Error Rate: [PERCENTAGE]
- Latency P95: [MS]

Next Action: [NEXT_STEP]
ETA: [TIMESTAMP]

Dashboard: https://grafana.shomer.local/d/mfa-rollout
```

### External Status Page Update
```
MFA Rollout in Progress

We are currently rolling out enhanced security features including Multi-Factor Authentication (MFA) for admin accounts.

Current Status: [STAGE]
Impact: Minimal - affecting [PERCENTAGE]% of admin users
ETA: [COMPLETION_TIME]

If you experience any issues, please contact support.
```

## Owner Matrix

| Role | Primary | Secondary | Escalation |
|------|---------|-----------|------------|
| Engineering | SRE Lead | Senior Engineer | Engineering Manager |
| Security | Security Lead | Security Engineer | CISO |
| Support | Support Lead | Support Engineer | Support Manager |
| Product | Product Manager | Product Owner | VP Product |

## Post-Rollout Activities

### Week 1
- [ ] Daily SLO monitoring
- [ ] User feedback collection
- [ ] Support ticket analysis
- [ ] Performance optimization

### Week 2
- [ ] User adoption analysis
- [ ] Security audit
- [ ] Documentation updates
- [ ] Training materials

### Month 1
- [ ] SLO validation
- [ ] Error budget analysis
- [ ] User satisfaction survey
- [ ] Process improvements

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-18  
**Next Review:** 2025-04-18  
**Owner:** SRE Team  
**Approved By:** Engineering Manager, Security Lead, Product Manager
