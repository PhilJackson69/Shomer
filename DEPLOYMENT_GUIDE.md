# 🚀 SLO Monitoring Deployment Guide

## ✅ Step 1: Metrics Endpoint Deployed

The FastAPI metrics endpoint is now working! Here's what we verified:

### Metrics Endpoint Test Results
```bash
curl -s http://localhost:8000/api/v1/metrics | head
```

**✅ SUCCESS**: All required metrics are present with correct labels:

- `csrf_rotations_total{service="shomer-api",env="development",cluster="local",region="us-east-1"} 1.0`
- `api_fetch_retry_total{service="shomer-api",env="development",cluster="local",region="us-east-1",outcome="success"} 1.0`
- `idempotency_hits_total{service="shomer-api",env="development",cluster="local",region="us-east-1"} 1.0`
- `http_write_requests_total{service="shomer-api",env="development",cluster="local",region="us-east-1",method="POST"} 1.0`
- `http_responses_total{service="shomer-api",env="development",cluster="local",region="us-east-1",method="POST",code="200",degraded="0"} 1.0`

**✅ Labels Confirmed**: `service`, `env`, `cluster`, `region` are all present and correctly formatted.

---

## 🔧 Step 2: Prometheus Scraping Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'shomer-api'
    static_configs:
      - targets: ["localhost:8000"]  # Update with your actual domain
    metrics_path: '/api/v1/metrics'
    scrape_interval: 30s
    relabel_configs:
      - source_labels: [__address__]
        target_label: service
        replacement: shomer-api
      # Add env/cluster/region via relabeling if not emitted by app
      - target_label: env
        replacement: production
      - target_label: cluster
        replacement: us-east-1
      - target_label: region
        replacement: us-east-1
```

**Reload Prometheus**:
```bash
curl -X POST http://prometheus:9090/-/reload
```

**Verify Target**:
```bash
curl "http://prometheus:9090/api/v1/targets" | jq '.data.activeTargets[] | select(.job=="shomer-api")'
```

---

## 📊 Step 3: Deploy Recording Rules

Copy the recording rules to Prometheus:

```bash
# Copy to Prometheus rules directory
cp prometheus_rules_api_security_slo.yaml /etc/prometheus/rules/
cp prometheus_rules_api_security.yaml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus:9090/-/reload
```

**Test Recording Rules**:
```bash
# These should return numbers shortly after traffic
curl "http://prometheus:9090/api/v1/query?query=api:writes_sli_pct:svc_env_cluster_region"
curl "http://prometheus:9090/api/v1/query?query=api:retry_success_pct:svc_env_cluster_region"
```

---

## 🚨 Step 4: Deploy Alert Rules

Add the alert rules:

```bash
# Copy alert rules
cp prometheus_alerts_api_slo.yaml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus:9090/-/reload
```

**Configure AlertManager** routing (example):
```yaml
route:
  group_by: ['alertname', 'service', 'env']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty'
  - match:
      severity: warning
    receiver: 'slack'

receivers:
- name: 'pagerduty'
  pagerduty_configs:
  - service_key: 'YOUR_PAGERDUTY_KEY'
- name: 'slack'
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK'
    channel: '#api-alerts'
```

**Test Alert** (temporarily lower thresholds in dev):
```bash
# Trigger test alert by setting very low thresholds
# Check AlertManager UI: http://alertmanager:9093
```

---

## 📈 Step 5: Import Grafana Dashboard

**Import Dashboard**:
```bash
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @grafana-api-security-dashboard.json
```

**Configure Variables**:
1. Go to Dashboard Settings → Variables
2. Set Prometheus datasource
3. Configure service, env, cluster, region variables
4. Test queries

---

## ✅ Step 6: Sanity Checklist (10 min)

Run through this checklist to verify everything is working:

### 1. Metrics Endpoint
```bash
# Should render without exceptions
curl -s http://localhost:8000/api/v1/metrics | head
```

### 2. Required Metrics Present
```bash
curl -s http://localhost:8000/api/v1/metrics | grep -E "(csrf_rotations_total|api_fetch_retry_total|http_responses_total|idempotency_hits_total)"
```

### 3. Recording Rules Exist
```bash
# Should return series
curl "http://prometheus:9090/api/v1/query?query=api:retry_success_pct:svc_env_cluster_region"
curl "http://prometheus:9090/api/v1/query?query=api:writes_sli_pct:svc_env_cluster_region"
```

### 4. Alerts Evaluating
- Check Prometheus UI → Status → Rules
- All alerts should show "Inactive" (not "Pending" or "Firing")

### 5. Grafana Panels Load
- Dashboard should load in < 1s
- All panels should show data (not "No data")

### 6. Test CSRF Rotation
```bash
# Generate some 401→retry traffic
curl -X POST http://localhost:8000/api/v1/test
# Check that csrf_rotations_total increments
```

---

## 📊 Step 7: Post-Deploy Monitoring (First 24h)

Watch these key metrics:

### Expected Values
- **Retry success %**: ≥ 98–99.5% in steady state
- **Degraded %**: Near 0%; small spikes during load surges OK
- **Idempotency %**: < 5% typical; higher may indicate UX issues
- **Burn-rate panels**: Should hover ≪1×; sustained >1× means budget burning too fast

### Alert Thresholds
- **Critical**: 5m & 1h burn > 14.4×
- **Warning**: 30m & 6h burn > 6×
- **Degraded responses**: > 15% critical, > 5% warning
- **Retry success**: < 95% critical, < 98% warning

---

## 🔧 Step 8: Runbook Integration

**Add to Wiki**:
1. Copy `docs/API_SECURITY_SLO_RUNBOOK.md` to your wiki
2. Update alert annotations with runbook URLs
3. Link to runbook in AlertManager notifications

**Example Alert Annotation**:
```yaml
annotations:
  runbook_url: "https://your-wiki.com/api-security-slo-runbook"
```

---

## 🎯 Optional Next Steps

### Service-Specific SLOs
If public APIs differ from internal dashboards:
```yaml
# Clone rules group with different thresholds
- alert: ApiWritesSLOBurnCriticalPublic
  expr: (api:writes_burnrate:1h:svc_env_cluster_region > 10) and (service=~"public-api")
```

### Latency SLOs
Add request duration histograms:
```python
request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "Request duration",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)
```

### Synthetic Monitoring
Add canary checks:
```python
# Tiny canary hitting GET /api/csrf + POST /api/thing every minute
# Export separate metric for early detection
```

---

## 🚨 Troubleshooting

### Common Issues

1. **No metrics appearing**: Check `/metrics` endpoint accessibility
2. **Labels missing**: Verify environment variables are set correctly
3. **Alerts not firing**: Check Prometheus rule evaluation
4. **Dashboard empty**: Ensure template variables are populated

### Debug Commands
```bash
# Check Prometheus targets
curl "http://prometheus:9090/api/v1/targets"

# Query specific metrics
curl "http://prometheus:9090/api/v1/query?query=csrf_rotations_total"

# Check recording rules
curl "http://prometheus:9090/api/v1/rules"
```

---

## 🎉 Success!

Your enterprise-grade SLO monitoring system is now deployed and ready to provide comprehensive observability for the Shomer API!

**Next**: Monitor for 24-48 hours and adjust thresholds based on actual traffic patterns.
