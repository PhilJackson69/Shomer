# API Security & SLO Runbook

**Services:** Shomer API (FastAPI backend)  
**Owners:** @web-team, @security, @sre  
**Pager:** PD: Web/API; Slack: #api-alerts

## 1) First Actions (within 5 minutes)

- Acknowledge page in PagerDuty
- Check Grafana dashboard "API Security Hardening — CSRF / Idempotency / Degraded"
- Identify blast radius: filter by `env`, `cluster`, `region`, `service`
- Look at **burn-rate** (5m/1h & 30m/6h). If ≥ critical thresholds, start mitigation

## 2) Fast Mitigations

### CSRF retry/rotate low success
- Verify proxy/CDN passes `x-csrf-rotate` header
- Confirm `Set-Cookie` CSRF cookie flags: `SameSite=Lax; Secure` (or `Strict` per design)
- Check 401/419 spikes & auth backend availability
- Roll back last front-end deploy if regression suspected

### Degraded responses high
- Check rate limit/redis/cache health
- Toggle degraded-mode flag off/on (if safe) to confirm symptom source
- Reduce traffic: enable protection (WAF rules) or scale out dependency

### Idempotency hits high
- Look for client retry storms (release, flaky network)
- Verify UI double-submit protections
- Ensure idempotency store TTL (5–15m) healthy

## 3) Diagnostics

- Error samples in logs (Loki): filter by `service`, `env`, `cluster`
- Compare **CSRF rotations/min** vs **writes/min**
- Inspect **401→retry success %** trend
- Check **error budget burn** across time windows

## 4) Escalation

- If no improvement in 15 minutes: page Security (CSRF/auth), SRE (infra), and Web lead
- Post status in #api-incidents

## 5) Aftercare

- Create incident doc with timeline
- Add a Playwright regression for the failing path(s)
- Adjust thresholds if too noisy/lax based on postmortem

---

## Alert Definitions

### SLO Burn Alerts

**ApiWritesSLOBurnCritical**
- **Trigger:** Error budget burning >14.4× (5m & 1h windows)
- **SLO Target:** 99.9% availability
- **Action:** Immediate investigation of recent deploys, upstreams, CSRF/auth paths

**ApiWritesSLOBurnWarning**
- **Trigger:** Error budget burning >6× (30m & 6h windows)
- **Action:** Watch closely or begin mitigation

### Hygiene Alerts

**ApiDegradedResponsesHigh**
- **Trigger:** >15% responses flagged as degraded
- **Action:** Check rate limit stores, caches, dependencies

**ApiFetchRetrySuccessLow**
- **Trigger:** <95% success rate for 401→retry
- **Action:** CSRF rotation/auth instability or upstream timeouts

**ApiIdempotencyHitRateHigh**
- **Trigger:** >20% idempotency hits
- **Action:** Likely duplicate submissions or retry storm

**CsrfRotationsMissing**
- **Trigger:** ~0 rotations/min while writes ongoing
- **Action:** Proxy stripping headers? Client not primed/rotating?

---

## Metrics Reference

### Recording Rules

- `api:writes_rate:svc_env_cluster_region` - Write request rate
- `api:csrf_rotations_per_min:svc_env_cluster_region` - CSRF rotations per minute
- `api:retry_success_pct:svc_env_cluster_region` - Retry success percentage
- `api:idempotency_hit_pct:svc_env_cluster_region` - Idempotency hit percentage
- `api:degraded_pct:svc_env_cluster_region` - Degraded response percentage
- `api:writes_sli_pct:svc_env_cluster_region` - Write SLI (2xx/total)
- `api:writes_burnrate:*:svc_env_cluster_region` - Error budget burn rates

### Fallback Rules (service-only labels)

- `api:*:by_service_only` - Same metrics grouped by service only

---

## Configuration

### SLO Target Adjustment

To change SLO target, modify `slo:error_budget` in `prometheus_alerts_api_slo.yaml`:

- 99.9% → `0.001`
- 99.95% → `0.0005`
- 99.99% → `0.0001`

### Label Customization

If your metrics use different label keys, update the `by (...)` clauses:

- `environment` instead of `env`
- `kubernetes_cluster` instead of `cluster`
- `aws_region` instead of `region`

---

## Troubleshooting

### Common Issues

1. **No metrics appearing**: Check if Prometheus is scraping your service
2. **Labels not matching**: Verify your metrics use the expected label names
3. **Alerts not firing**: Check Prometheus rule evaluation and AlertManager configuration
4. **Dashboard panels empty**: Ensure template variables are populated correctly

### Debugging Commands

```bash
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Query specific metrics
curl "http://prometheus:9090/api/v1/query?query=csrf_rotations_total"

# Check recording rules
curl "http://prometheus:9090/api/v1/query?query=api:csrf_rotations_per_min:svc_env_cluster_region"

# Test alert rules
curl "http://prometheus:9090/api/v1/rules"
```

---

## Maintenance

### Regular Tasks

- **Weekly**: Review alert thresholds and adjust if needed
- **Monthly**: Analyze error budget consumption trends
- **Quarterly**: Update SLO targets based on business requirements

### Performance Tuning

For bursty traffic patterns:
- Lengthen short windows (e.g., 10m/2h & 1h/24h)
- Raise critical multipliers slightly to avoid flapping
- Consider per-service SLO targets for different traffic patterns
