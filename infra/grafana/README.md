# Grafana Configuration for Shomer

This directory contains Grafana dashboards and data source configurations for Shomer monitoring.

---

## Directory Structure

```
grafana/
├── dashboards/
│   └── shomer.json              # Main production monitoring dashboard
├── datasources/
│   ├── prometheus.yml           # Prometheus data source
│   └── jaeger.yml               # Jaeger tracing data source
├── provisioning.yml             # Dashboard provisioning config
└── README.md                    # This file
```

---

## Quick Start

### 1. Start Grafana

```bash
# From project root
docker compose -f docker-compose.observability.yml up -d grafana
```

### 2. Access Grafana

- **URL:** http://localhost:3000
- **Default Credentials:** admin / admin
- **First Login:** Change default password when prompted

### 3. Import Dashboard

**Automatic (via provisioning):**

Dashboard is automatically loaded if you use the provided docker-compose.observability.yml.

**Manual:**

1. Go to **Dashboards** → **Import**
2. Upload `dashboards/shomer.json`
3. Select **Prometheus** data source
4. Click **Import**

---

## Dashboard Overview

### Shomer - Production Monitoring

**File:** `dashboards/shomer.json`

**Widgets:**

1. **API Latency (p95 / p99)**
   - Shows 95th and 99th percentile response times
   - Target: p95 < 300ms, p99 < 1s
   - Alert: p95 > 500ms (yellow), > 1s (red)

2. **Error Rate**
   - 4xx and 5xx error rates
   - Target: < 0.5% for 5xx
   - Alert: > 1% (critical)

3. **Evidence Uploads per Hour**
   - Volume of evidence uploads
   - Useful for capacity planning

4. **Evidence Verification Failures**
   - Number of verification failures
   - Alert: > 10 in 10 minutes

5. **Export Spikes**
   - Chain-of-custody export rate
   - Alert: > 50/minute

6. **Signed URL 403 Rate**
   - Failed signed URL access attempts
   - Alert: > 5% of requests

**Refresh:** 30 seconds  
**Time Range:** Last 6 hours (configurable)

---

## Data Sources

### Prometheus

**File:** `datasources/prometheus.yml`

**Configuration:**
- **URL:** http://prometheus:9090
- **Access:** Proxy (via Grafana backend)
- **Scrape Interval:** 15s
- **Default:** Yes

**Metrics Available:**
- `http_requests_total` - Request count by status, method, path
- `http_request_duration_seconds` - Request latency histogram
- `evidence_upload_total` - Evidence uploads
- `evidence_verify_failure_total` - Verification failures
- `evidence_export_total` - Evidence exports

### Jaeger (Tracing)

**File:** `datasources/jaeger.yml`

**Configuration:**
- **URL:** http://jaeger:16686
- **Access:** Proxy
- **Trace to Logs:** Linked to Prometheus

**Usage:**
- View distributed traces
- Correlate traces with logs via trace_id
- Debug performance issues

---

## Customization

### Adding New Panels

1. Open dashboard in Grafana
2. Click **Add Panel**
3. Select visualization type
4. Write PromQL query
5. Configure thresholds and alerts
6. Click **Save**
7. Export JSON and save to `dashboards/`

### Example Queries

**Request Rate:**
```promql
rate(http_requests_total[5m])
```

**Error Rate:**
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

**p95 Latency:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Evidence Upload Rate:**
```promql
rate(evidence_upload_total[1h])
```

### Creating New Dashboards

1. Create dashboard in Grafana UI
2. Add panels and configure
3. Export JSON:
   - Dashboard Settings → JSON Model
   - Copy JSON
   - Save to `dashboards/<name>.json`
4. Update `provisioning.yml` if needed

---

## Alerts

### Configured Alerts

Alerts are defined in dashboard JSON:

| Alert | Condition | Severity |
|-------|-----------|----------|
| High 5xx Error Rate | > 1% | Critical |
| Verification Failures | > 10 in 10 min | High |

### Alert Notifications

**Setup Notification Channels:**

1. Go to **Alerting** → **Notification channels**
2. Click **Add channel**
3. Configure (Slack, Email, PagerDuty, etc.)
4. Test notification
5. Link to alert rules

**Example: Slack Channel**

```yaml
name: slack-alerts
type: slack
settings:
  url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
  recipient: '#alerts'
  username: Grafana
  uploadImage: true
```

---

## Provisioning

Grafana can automatically load dashboards and data sources on startup.

**Enabled by:**
- `datasources/*.yml` files
- `provisioning.yml` configuration
- Volume mounts in docker-compose

**Benefits:**
- No manual configuration
- Version controlled
- Reproducible deployments

**Configuration:**

```yaml
# provisioning.yml
apiVersion: 1
providers:
  - name: 'Shomer Dashboards'
    folder: 'Shomer'
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
```

---

## Troubleshooting

### Dashboard Shows "No Data"

**Cause:** Prometheus not connected or no metrics

**Solutions:**

1. Check Prometheus data source:
   ```
   Configuration → Data Sources → Prometheus → Test
   ```

2. Verify Prometheus is scraping:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

3. Check API metrics endpoint:
   ```bash
   curl http://localhost:8000/metrics
   ```

### Alerts Not Firing

**Cause:** Alert rules not configured or notification channel missing

**Solutions:**

1. Check alert rules in dashboard
2. Verify notification channel configured
3. Test notification channel
4. Check alert history in Grafana

### Dashboard Import Fails

**Cause:** Invalid JSON or missing data source

**Solutions:**

1. Validate JSON:
   ```bash
   python -m json.tool dashboards/shomer.json
   ```

2. Check data source exists
3. Update data source UID in JSON if needed

---

## Production Considerations

### Security

- **Change default password** immediately
- **Enable HTTPS** in production
- **Restrict access** via firewall or auth proxy
- **Use read-only** database users for data sources
- **Enable audit logging**

### Performance

- **Limit time range** on dashboards (avoid "Last 30 days")
- **Use recording rules** in Prometheus for heavy queries
- **Set query timeout** (default: 60s)
- **Monitor Grafana memory** usage

### High Availability

- **Use external database** (PostgreSQL)
- **Store dashboards** in Git
- **Automate provisioning** via Infrastructure as Code
- **Backup Grafana data** regularly

---

## Resources

### Documentation
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Shomer Observability Guide](../../docs/OBSERVABILITY_GUIDE.md)

### Dashboard Examples
- [Grafana Dashboard Library](https://grafana.com/grafana/dashboards/)
- [Awesome Prometheus Alerts](https://awesome-prometheus-alerts.grep.to/)

### Related Files
- `../../docs/OBSERVABILITY_GUIDE.md` - Full observability guide
- `../../docs/POST_LAUNCH_MONITORING.md` - Monitoring runbooks
- `../prometheus/prometheus.yml` - Prometheus config

---

**Questions?** See [OBSERVABILITY_GUIDE.md](../../docs/OBSERVABILITY_GUIDE.md) for detailed documentation.

