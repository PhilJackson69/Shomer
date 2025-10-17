# 🚀 Production SLO Monitoring Deployment Checklist

## ✅ Pre-Deployment Verification Complete

**Metrics Endpoint**: ✅ Working locally with all required metrics and labels  
**Recording Rules**: ✅ Created and tested  
**Alert Rules**: ✅ Google SRE burn-rate patterns implemented  
**Grafana Dashboard**: ✅ Enhanced with SLO panels  
**Runbook**: ✅ Comprehensive incident response guide  

---

## 🔧 Production Deployment Steps

### 1) Prometheus Scrape Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: shomer-api
    scrape_interval: 30s
    metrics_path: /api/v1/metrics
    static_configs:
      - targets: ["api.your.domain:80"]   # Update with your actual domain
        labels:
          service: shomer-api
          env: production
          cluster: prod-cluster-1
          region: us-east-1
```

**Reload Prometheus**:
```bash
curl -X POST http://prometheus.internal:9090/-/reload
```

### 2) Rules & Alerts Deployment

**Add rule files to `prometheus.yml`**:
```yaml
rule_files:
  - prometheus_rules_api_security_slo.yaml
  - prometheus_alerts_api_slo.yaml
```

**Deploy the files**:
```bash
# Copy to Prometheus rules directory
cp prometheus_rules_api_security_slo.yaml /etc/prometheus/rules/
cp prometheus_alerts_api_slo.yaml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus.internal:9090/-/reload
```

### 3) AlertManager Configuration

**Verify receivers** (Slack/PagerDuty) are valid and routes are configured.

**Test alert flow**:
```bash
# Temporarily lower threshold for testing (dev environment only)
# Change retry success threshold to < 100% for 1 minute
# Verify page/Slack message arrives
# Revert threshold after test
```

### 4) Grafana Dashboard Import

**Import dashboard**:
```bash
curl -X POST http://grafana.internal:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @grafana-api-security-dashboard.json
```

**Configure variables**:
- Set Prometheus datasource
- Configure service/env/cluster/region defaults
- Verify SLO panels are present (SLI gauge, burn-rate, error-budget remaining)

---

## 🔍 Quick Validation Commands

### Endpoint Check
```bash
curl -s http://api.your.domain/api/v1/metrics | head
```

### PromQL Spot-Checks

**CSRF Rotations/min**:
```promql
sum(rate(csrf_rotations_total[5m])) * 60
```

**Retry Success % (per service)**:
```promql
api:retry_success_pct:svc_env_cluster_region{service="shomer-api",env="production"}
```

**Idempotency % (per service)**:
```promql
api:idempotency_hit_pct:svc_env_cluster_region{service="shomer-api",env="production"}
```

**Degraded % (per service)**:
```promql
api:degraded_pct:svc_env_cluster_region{service="shomer-api",env="production"}
```

**SLI (writes availability)**:
```promql
api:writes_sli_pct:svc_env_cluster_region{service="shomer-api",env="production"}
```

**Note**: Burn-rate panels will populate after ~5–10 minutes of traffic.

---

## 📊 First 24–48h Monitoring Targets

### Key Metrics to Watch

| Metric | Target | Action Threshold |
|--------|--------|------------------|
| **401→retry success %** | ≥ 98–99.5% | Investigate if < 98% |
| **Degraded mode %** | Near 0% | > 5% warn, > 15% critical |
| **Idempotency %** | Typically < 5% | Spikes indicate retry storms |
| **Burn-rate** | ≪ 1× | > 6× warning, > 14.4× critical |

### Alert Thresholds Summary

**Critical Alerts**:
- Error budget burn > 14.4× (5m & 1h windows)
- Degraded responses > 15%
- Retry success < 95%
- Idempotency hits > 20%

**Warning Alerts**:
- Error budget burn > 6× (30m & 6h windows)
- Degraded responses > 5%
- Retry success < 98%
- Idempotency hits > 10%

---

## 🔧 Runbook Quick Reference

### CSRF Issues
- Verify proxy/CDN preserves `x-csrf-rotate` header
- Confirm `Set-Cookie` has `SameSite=Lax; Secure` (or `Strict`)
- Check auth backend availability

### Idempotency Issues
- Verify backing store TTL (5–15m)
- Check cache health if hit rate jumps
- Look for client retry storms

### Degraded Responses
- Verify rate-limit/backing store availability
- Confirm toggle/flag behavior
- Check dependency health

---

## 🎯 Success Criteria

**✅ Deployment Complete When**:
- [ ] Metrics endpoint accessible at `/api/v1/metrics`
- [ ] Prometheus scraping successfully
- [ ] Recording rules generating data
- [ ] Alerts evaluating (not firing)
- [ ] Grafana dashboard loading with data
- [ ] AlertManager routes configured
- [ ] Runbook accessible to team

**✅ Monitoring Operational When**:
- [ ] All key metrics showing expected values
- [ ] Burn-rate panels populated
- [ ] No critical alerts firing
- [ ] Team trained on runbook procedures

---

## 🔄 Future Enhancements

### Service-Specific SLOs
If you need different thresholds for different services:
```yaml
# Clone rules group with service-specific thresholds
- alert: ApiWritesSLOBurnCriticalPublic
  expr: (api:writes_burnrate:1h:svc_env_cluster_region > 10) and (service=~"public-api")
```

### Label Standardization
If you standardize on different label keys (e.g., `environment` instead of `env`):
- Update `sum by (...)` in recording rules once
- Panels and alerts will continue working automatically

### Additional Metrics
Consider adding:
- Request duration histograms for latency SLOs
- Synthetic monitoring for early detection
- Custom business metrics

---

## 🎉 You're Ready!

Your enterprise-grade SLO monitoring system is production-ready with:
- ✅ **Google SRE burn-rate patterns**
- ✅ **Environment/cluster/region awareness**
- ✅ **Comprehensive alerting**
- ✅ **Production runbook**
- ✅ **Verified metrics endpoint**

**Deploy with confidence!** 🚀

The system will provide comprehensive observability and incident response capabilities for your Shomer API from day one.
