# v1.1.0 — MFA Production Rollout (staged + observability + rollback)

## Overview

This PR implements comprehensive staged rollout controls for Multi-Factor Authentication (MFA) enforcement in production, enabling safe deployment with feature flags, cohorts, metrics, alerts, and automated rollback procedures.

## What Changed

### 🚀 Feature Flags & Rollout Controls
- **New module**: `apps/api/app/flags/mfa.py` with rollout modes
- **Rollout modes**: `off` | `dryrun` | `cohorts` | `percent` | `on`
- **Cohort management**: Database table + environment variable fallback
- **Consistent hashing**: For percentage-based rollout

### 📊 Observability & Monitoring
- **Prometheus rules**: `ops/prometheus/prom_rules_mfa.yaml`
- **Grafana dashboard**: `ops/grafana/mfa_dashboard.json`
- **SLO definitions**: `ops/slo/mfa_slo.md`
- **Metrics**: Enforcement decisions, TOTP/recovery/WebAuthn verification, API latency

### 📚 Documentation & Procedures
- **Rollout runbook**: `releases/v1.1.0/MFA_ROLLOUT_RUNBOOK.md`
- **GO/NO-GO checklist**: `releases/v1.1.0/MFA_ROLLOUT_GO_NO_GO.md`
- **Updated MFA docs**: `docs/SECURITY_MFA.md`
- **Communication templates**: `comm/mfa-rollout-*.md`

### 🔧 Configuration & Testing
- **Environment variables**: Added rollout configuration to `env.example` and `docker-compose.yml`
- **Database migration**: `009_add_mfa_cohort.py` for cohort table
- **Comprehensive tests**: `apps/api/tests/test_mfa_rollout.py`

## How to Toggle Rollout Stages

### Environment Variables
```bash
# Rollout mode (off|dryrun|cohorts|percent|on)
MFA_ROLLOUT_MODE=off

# Percentage for percent mode (0-100)
MFA_PERCENT=0

# Cohort source (db|env)
MFA_COHORT_SOURCE=env

# Comma-separated user IDs for env fallback
MFA_COHORT_USER_IDS=
```

### Deployment Commands

#### Dry Run Mode (T-2d)
```bash
export MFA_ROLLOUT_MODE=dryrun
kubectl rollout restart deployment/shomer-api
# OR
docker-compose restart api
```

#### Cohort Mode (T-1d)
```bash
# Add users to cohort via database
psql -d shomer -c "
INSERT INTO mfa_cohort_members (user_id, added_by, notes) 
VALUES (1, 1, 'Initial rollout cohort'), 
       (2, 1, 'Initial rollout cohort'),
       (3, 1, 'Initial rollout cohort');
"

# Deploy cohort configuration
export MFA_ROLLOUT_MODE=cohorts
export MFA_COHORT_SOURCE=db
kubectl rollout restart deployment/shomer-api
```

#### Percentage Rollout (T-0)
```bash
# 25% rollout
export MFA_ROLLOUT_MODE=percent
export MFA_PERCENT=25
kubectl rollout restart deployment/shomer-api

# Wait 1 hour, then 50%
export MFA_PERCENT=50
kubectl rollout restart deployment/shomer-api

# Wait 1 hour, then 75%
export MFA_PERCENT=75
kubectl rollout restart deployment/shomer-api

# Wait 1 hour, then 100%
export MFA_PERCENT=100
kubectl rollout restart deployment/shomer-api
```

#### Full Enforcement (T+4h)
```bash
export MFA_ROLLOUT_MODE=on
kubectl rollout restart deployment/shomer-api
```

### Emergency Rollback
```bash
# Immediate rollback
export MFA_ROLLOUT_MODE=off
kubectl rollout restart deployment/shomer-api

# Clear rate limit buckets
redis-cli FLUSHDB
```

## Monitoring & Alerts

### Dashboard Access
- **Grafana Dashboard**: `https://grafana.shomer.local/d/mfa-rollout`
- **Prometheus Metrics**: `http://localhost:9090/api/v1/query?query=mfa_enforcement_decisions_total`

### Key Metrics to Monitor
- `mfa_enforcement_decisions_total` - Rollout decisions by mode
- `mfa_enforcement_blocked_total` - Users blocked by enforcement
- `mfa_enforcement_would_block_total` - Dry run would-block decisions
- `mfa_totp_verify_total` - TOTP verification attempts
- `mfa_api_latency_seconds` - MFA API endpoint latency

### Critical Alerts
- **MFAHighFailureRate**: > 15% failure rate for 10 minutes
- **MFAEnforcementBlocksSpike**: > 50 blocks in 10 minutes
- **MFAApiLatencyP95High**: P95 latency > 400ms for 5 minutes
- **MFASLOAvailabilityViolation**: Availability < 95% for 5 minutes

## Rollout Timeline

| Stage | Duration | Mode | Health Checks |
|-------|----------|------|---------------|
| T-2d | 48h | `dryrun` | Metrics recording, no enforcement |
| T-1d | 24h | `cohorts` | 5-10 users, < 2 tickets/hour |
| T-0 | 4h | `percent` | 25% → 50% → 75% → 100% |
| T+4h | Ongoing | `on` | Full enforcement, SLO monitoring |

## Health Check Commands

### System Health
```bash
# Application health
curl http://localhost:8000/health

# Database connectivity
psql -d shomer -c "SELECT 1"

# Redis connectivity
redis-cli ping
```

### MFA Metrics
```bash
# Enforcement decisions
curl "http://localhost:9090/api/v1/query?query=mfa_enforcement_decisions_total"

# Failure rates
curl "http://localhost:9090/api/v1/query?query=rate(mfa_totp_verify_total{status=\"failure\"}[5m])"

# Latency
curl "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(mfa_api_latency_seconds_bucket[5m]))"
```

### Rollout Status
```bash
# Current rollout mode
curl "http://localhost:9090/api/v1/query?query=mfa_enforcement_decisions_total{mode!=\"off\"}"

# Cohort membership
psql -d shomer -c "SELECT COUNT(*) FROM mfa_cohort_members"

# Enforcement blocks
curl "http://localhost:9090/api/v1/query?query=rate(mfa_enforcement_blocked_total[5m])"
```

## SLO Targets

- **Availability**: 95% for MFA authentication flows
- **Latency**: P95 < 200ms for MFA API endpoints
- **Error Rate**: < 5% for MFA operations
- **Support Volume**: < 5 tickets per day related to MFA enforcement

## Testing

### Run Tests
```bash
# MFA rollout tests
cd apps/api
pytest tests/test_mfa_rollout.py -v

# All MFA tests
pytest tests/test_mfa_*.py -v
```

### Test Coverage
- ✅ Rollout mode transitions
- ✅ Cohort membership logic
- ✅ Percentage-based rollout
- ✅ Consistent hashing
- ✅ Edge cases and error handling
- ✅ Metrics and observability

## Documentation Links

- **Rollout Runbook**: `releases/v1.1.0/MFA_ROLLOUT_RUNBOOK.md`
- **GO/NO-GO Checklist**: `releases/v1.1.0/MFA_ROLLOUT_GO_NO_GO.md`
- **SLO Documentation**: `ops/slo/mfa_slo.md`
- **MFA Security Guide**: `docs/SECURITY_MFA.md`

## Acceptance Criteria

- [x] Rollout flags & cohorts implemented
- [x] Environment variables surfaced
- [x] Database migrations included
- [x] Prometheus rules & Grafana dashboard added
- [x] Runbook + GO/NO-GO + rollback docs present
- [x] Tests cover rollout modes; CI stays green
- [x] PR open with clear operator instructions

## Files Changed

### Core Implementation
- `apps/api/app/flags/mfa.py` - Feature flags module
- `apps/api/app/models/mfa.py` - Added MFACohortMember model
- `apps/api/app/api/deps.py` - Updated enforcement gate
- `apps/api/app/core/config.py` - Added rollout configuration
- `apps/api/app/core/metrics.py` - Added MFA metrics

### Database
- `apps/api/alembic/versions/009_add_mfa_cohort.py` - Cohort table migration

### Observability
- `ops/prometheus/prom_rules_mfa.yaml` - Prometheus alerting rules
- `ops/grafana/mfa_dashboard.json` - Grafana dashboard
- `ops/slo/mfa_slo.md` - Service level objectives

### Documentation
- `releases/v1.1.0/MFA_ROLLOUT_RUNBOOK.md` - Rollout procedures
- `releases/v1.1.0/MFA_ROLLOUT_GO_NO_GO.md` - GO/NO-GO checklist
- `docs/SECURITY_MFA.md` - Updated with rollout modes
- `comm/mfa-rollout-slack.md` - Internal communication template
- `comm/mfa-rollout-statuspage.md` - External communication template

### Configuration
- `env.example` - Added rollout environment variables
- `docker-compose.yml` - Added rollout configuration

### Testing
- `apps/api/tests/test_mfa_rollout.py` - Comprehensive rollout tests

## Next Steps

1. **Review and Approve** this PR
2. **Deploy to Staging** for validation
3. **Run Dry Run Mode** for 48 hours
4. **Execute Rollout** following the runbook
5. **Monitor SLOs** and error budgets
6. **Document Lessons Learned** post-rollout

---

**Ready for Production Rollout** 🚀

This implementation provides a boringly safe MFA cutover with:
- ✅ Measurable rollout progress
- ✅ Reversible deployment controls  
- ✅ Operator-friendly interfaces
- ✅ Comprehensive monitoring
- ✅ Automated rollback procedures
