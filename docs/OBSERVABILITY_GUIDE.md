# Observability Guide - Shomer

**Version:** 1.0  
**Last Updated:** October 2025  
**Owner:** Platform Engineering

This guide covers the complete observability stack for Shomer, including metrics, logs, traces, and dashboards.

---

## Table of Contents

1. [Overview](#overview)
2. [Metrics](#metrics)
3. [Logging](#logging)
4. [Distributed Tracing](#distributed-tracing)
5. [Dashboards](#dashboards)
6. [Alerts](#alerts)
7. [Setup & Configuration](#setup--configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Shomer's observability stack provides comprehensive monitoring across three pillars:

- **Metrics** - Time-series data (Prometheus)
- **Logs** - Structured logging with correlation IDs
- **Traces** - Distributed tracing (OpenTelemetry + Jaeger/Tempo)

### Stack Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Metrics | Prometheus | Time-series metrics collection |
| Visualization | Grafana | Dashboard and alerting |
| Tracing | OpenTelemetry | Distributed trace collection |
| Trace Backend | Jaeger/Tempo | Trace storage and query |
| Logging | Structured JSON | Application logs |
| Log Aggregation | Loki (optional) | Centralized log storage |

---

## Metrics

### Key Metrics

#### HTTP Metrics

```promql
# Request rate
rate(http_requests_total[5m])

# Response time (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

#### Evidence Metrics

```promql
# Upload rate
rate(evidence_upload_total[1h])

# Verification success rate
sum(rate(evidence_verify_success_total[5m])) / sum(rate(evidence_verify_total[5m]))

# Export volume
rate(evidence_export_total[5m])

# Hash mismatches (should be 0)
sum(evidence_hash_mismatch_total)
```

#### Database Metrics

```promql
# Connection pool utilization
db_connection_pool_active / db_connection_pool_max

# Query duration
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))

# Active connections
db_connection_pool_active
```

#### Security Metrics

```promql
# Failed authentication
rate(http_requests_total{status="401"}[5m])

# Authorization failures
rate(http_requests_total{status="403"}[5m])

# Rate limit violations
rate(http_requests_total{status="429"}[5m])

# Signed URL 403s
rate(http_requests_total{status="403",path=~".*signed.*"}[5m])
```

### Custom Metrics

To add custom metrics in your code:

```python
from prometheus_client import Counter, Histogram, Gauge

# Counter for events
evidence_uploads = Counter(
    'evidence_upload_total',
    'Total evidence uploads',
    ['status', 'file_type']
)

# Histogram for timing
upload_duration = Histogram(
    'evidence_upload_duration_seconds',
    'Evidence upload duration',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

# Gauge for current values
active_uploads = Gauge(
    'evidence_active_uploads',
    'Currently active uploads'
)

# Usage
evidence_uploads.labels(status='success', file_type='image').inc()
with upload_duration.time():
    # ... upload logic
active_uploads.set(5)
```

---

## Logging

### Structured Logging

All logs are structured with correlation IDs for traceability:

```python
import logging
from app.core.observability import setup_logging

logger = setup_logging()

# Log with context
logger.info(
    "Evidence uploaded",
    extra={
        'request_id': request_id,
        'user_id': user.id,
        'evidence_id': evidence.id,
        'file_size': file_size,
        'file_type': file_type,
    }
)
```

### Log Format

```
2025-10-14T10:30:45+00:00 | INFO     | req-abc123 | user-456 | evidence-789 | app.services.evidence | Evidence uploaded successfully
```

### Log Fields

| Field | Description | Example |
|-------|-------------|---------|
| `timestamp` | ISO-8601 UTC | `2025-10-14T10:30:45+00:00` |
| `level` | Log level | `INFO`, `WARNING`, `ERROR` |
| `request_id` | Request correlation ID | `req-abc123` |
| `user_id` | User identifier | `user-456` |
| `evidence_id` | Evidence identifier | `evidence-789` |
| `trace_id` | OpenTelemetry trace ID | `a1b2c3d4...` |
| `span_id` | OpenTelemetry span ID | `e5f6g7h8...` |
| `logger` | Logger name | `app.services.evidence` |
| `message` | Log message | `Evidence uploaded successfully` |

### Log Levels

- **DEBUG** - Detailed diagnostic information
- **INFO** - General informational messages
- **WARNING** - Warning messages (potential issues)
- **ERROR** - Error messages (failures)
- **CRITICAL** - Critical failures requiring immediate attention

---

## Distributed Tracing

### OpenTelemetry Setup

Traces are automatically collected and exported to the OTLP endpoint.

#### Configuration

```bash
# .env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
OTEL_SERVICE_NAME=shomer-api
```

#### Automatic Instrumentation

The following are automatically instrumented:

- **FastAPI** - All HTTP endpoints
- **SQLAlchemy** - Database queries
- **Redis** - Cache operations (if configured)

#### Manual Instrumentation

For custom spans:

```python
from app.core.observability import get_tracer

tracer = get_tracer()

with tracer.start_as_current_span("custom_operation") as span:
    span.set_attribute("custom.attribute", "value")
    span.set_attribute("user.id", user_id)
    
    # ... your code
    
    span.set_attribute("status", "success")
```

#### Evidence Operation Tracing

Use the decorator for evidence operations:

```python
from app.core.observability import trace_evidence_operation

@trace_evidence_operation("upload")
async def upload_evidence(file: UploadFile, evidence_id: str):
    # Automatically traced with evidence.upload span
    # Includes evidence.id attribute
    ...
```

### Trace Propagation

Request IDs are propagated through the system:

1. **Request arrives** → `X-Request-ID` header extracted
2. **Trace created** → OpenTelemetry trace with same ID
3. **Logs enriched** → All logs include `trace_id` and `span_id`
4. **Downstream calls** → Trace context propagated via headers

### Viewing Traces

#### Jaeger UI

Access at `http://localhost:16686` (default)

**Find traces by:**
- Service: `shomer-api`
- Operation: `evidence.upload`, `GET /api/v1/evidence`, etc.
- Tags: `user.id`, `evidence.id`, `http.status_code`
- Duration: Find slow requests

#### Grafana Tempo

If using Tempo, traces are linked directly from metrics in Grafana.

---

## Dashboards

### Grafana Dashboard

Import the pre-built dashboard: `infra/grafana/dashboards/shomer.json`

#### Dashboard Sections

1. **API Latency** - p95/p99 response times
2. **Error Rate** - 4xx/5xx rates
3. **Evidence Uploads** - Upload rate per hour
4. **Verification Failures** - Verification failure count
5. **Export Spikes** - Export volume
6. **Signed URL 403s** - Failed signed URL access

#### Importing the Dashboard

**Option 1: Grafana UI**

1. Navigate to Grafana: `http://localhost:3000`
2. Go to **Dashboards** → **Import**
3. Upload `infra/grafana/dashboards/shomer.json`
4. Select Prometheus as data source
5. Click **Import**

**Option 2: Provisioning (Automated)**

```yaml
# grafana/provisioning/dashboards/shomer.yaml
apiVersion: 1

providers:
  - name: 'Shomer Dashboards'
    orgId: 1
    folder: 'Shomer'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

Place `shomer.json` in `/etc/grafana/provisioning/dashboards/`

#### Custom Dashboards

Create additional dashboards for:

- **Security** - Auth failures, rate limits, RBAC violations
- **Chain of Custody** - Custody events, verification rate
- **Business Metrics** - Tips submitted, incidents created, exports
- **Infrastructure** - CPU, memory, disk, network

---

## Alerts

### Alert Rules

Alerts are configured in the Grafana dashboard JSON and in `apps/api/app/core/observability.py`.

#### Critical Alerts

| Alert | Threshold | Response Time |
|-------|-----------|---------------|
| High 5xx Error Rate | > 1% | 15 minutes |
| Verification Failures | > 10 in 10 min | 15 minutes |
| Hash Mismatch | > 0 | Immediate |
| Backup Failed | > 24 hours | 1 hour |

#### Warning Alerts

| Alert | Threshold | Response Time |
|-------|-----------|---------------|
| Export Volume Spike | > 50/min | 1 hour |
| Disk Usage High | > 80% | 4 hours |
| Slow Queries | > 1s average | 4 hours |

### Alert Notifications

Configure notification channels in Grafana:

1. **Slack** - For critical alerts
2. **Email** - For warning alerts
3. **PagerDuty** - For on-call rotation (production)
4. **Webhook** - For custom integrations

#### Slack Integration

```yaml
# grafana/provisioning/notifiers/slack.yaml
notifiers:
  - name: slack-alerts
    type: slack
    uid: slack-alerts
    org_id: 1
    is_default: true
    send_reminder: true
    settings:
      url: ${SLACK_WEBHOOK_URL}
      recipient: '#alerts'
      username: Grafana
      uploadImage: true
```

### Alert Runbook

See `docs/POST_LAUNCH_MONITORING.md` for detailed runbooks on responding to alerts.

---

## Setup & Configuration

### Docker Compose Setup

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - ./infra/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./infra/grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana-data:/var/lib/grafana
  
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

volumes:
  prometheus-data:
  grafana-data:
```

### Prometheus Configuration

```yaml
# infra/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'shomer-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
```

### Application Configuration

```python
# apps/api/app/main.py
from app.core.observability import setup_logging, setup_opentelemetry
from prometheus_client import make_asgi_app

# Setup logging
logger = setup_logging(log_level="INFO")

# Setup OpenTelemetry
tracer = setup_opentelemetry(app)

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

---

## Troubleshooting

### Traces Not Appearing

**Problem:** No traces in Jaeger/Tempo

**Solutions:**

1. Check OTLP endpoint configuration:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   # Should be: http://jaeger:4317
   ```

2. Verify OpenTelemetry is enabled:
   ```bash
   echo $OTEL_ENABLED
   # Should be: true
   ```

3. Check Jaeger connectivity:
   ```bash
   curl http://jaeger:4317
   ```

4. Check application logs for OTEL errors:
   ```bash
   docker logs shomer-api | grep -i otel
   ```

### Metrics Not Showing in Grafana

**Problem:** Dashboard shows "No data"

**Solutions:**

1. Verify Prometheus is scraping:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Check metrics endpoint:
   ```bash
   curl http://localhost:8000/metrics
   ```

3. Verify Grafana data source:
   - Go to **Configuration** → **Data Sources**
   - Test Prometheus connection

4. Check query syntax in dashboard panels

### Logs Missing Context

**Problem:** Logs don't have `trace_id` or `span_id`

**Solutions:**

1. Ensure OpenTelemetry is enabled and working
2. Verify log record factory is configured:
   ```python
   from app.core.observability import setup_logging
   logger = setup_logging()
   ```

3. Check if middleware is adding request context

### High Cardinality Issues

**Problem:** Prometheus performance degradation

**Solutions:**

1. Limit label cardinality:
   ```python
   # BAD: High cardinality
   counter.labels(user_id=user.id, evidence_id=evidence.id).inc()
   
   # GOOD: Low cardinality
   counter.labels(status='success', file_type='image').inc()
   ```

2. Use histograms for aggregatable metrics
3. Consider metric relabeling in Prometheus

---

## Security Monitoring Integration

### Security Metrics

The observability stack includes comprehensive security monitoring:

```promql
# Authentication failures
rate(http_requests_total{status="401"}[5m])

# Authorization failures  
rate(http_requests_total{status="403"}[5m])

# Rate limiting violations
rate(http_requests_total{status="429"}[5m])

# Admin login attempts
rate(admin_login_total[5m])

# Evidence export volume (potential data exfiltration)
rate(evidence_export_total[5m])

# Hash verification failures (chain of custody)
sum(evidence_hash_mismatch_total)
```

### Security Alerts

Critical security alerts configured in Grafana:

| Alert | Threshold | Severity | Response Time |
|-------|-----------|----------|---------------|
| **High Auth Failures** | >10/min per IP | Critical | 15 minutes |
| **Admin Login** | Any successful | High | 5 minutes |
| **Export Volume Spike** | >50 records/min | High | 15 minutes |
| **Hash Mismatch** | >0 occurrences | Critical | Immediate |
| **Rate Limit Violations** | >5/hour per user | Medium | 30 minutes |

### Security Dashboard

Access the security dashboard at `http://localhost:3000/d/security`:

1. **Authentication Overview** - Login success/failure rates
2. **Authorization Monitoring** - Permission violations
3. **Rate Limiting Status** - Current rate limit violations
4. **Evidence Chain of Custody** - Hash verification status
5. **Admin Activity** - Administrative action tracking
6. **Export Monitoring** - Data export volume and patterns

### Incident Response Integration

Security events automatically trigger:

1. **Slack Alerts** - Real-time notifications to #security-alerts
2. **PagerDuty** - Escalation for critical issues (production)
3. **Log Correlation** - Automatic trace correlation for security events
4. **Evidence Preservation** - Automatic log preservation for incidents

## Best Practices

### Metrics

- ✅ Use counters for cumulative values (uploads, errors)
- ✅ Use histograms for timing and size distributions
- ✅ Use gauges for current state (active connections, queue depth)
- ✅ Keep label cardinality low (< 10 unique values per label)
- ✅ Include security context in metrics (auth_status, user_role)
- ❌ Don't use user IDs or evidence IDs as labels
- ❌ Don't expose sensitive data in metric labels

### Logging

- ✅ Use structured logging with consistent fields
- ✅ Include correlation IDs (request_id, trace_id)
- ✅ Log at appropriate levels
- ✅ Include context (user_id, evidence_id, operation)
- ✅ Include security context (auth_status, ip_address)
- ❌ Don't log sensitive data (passwords, tokens, PII)
- ❌ Don't log in tight loops (high volume)
- ❌ Don't log full request/response bodies

### Tracing

- ✅ Use automatic instrumentation when available
- ✅ Add custom attributes for business context
- ✅ Create spans for significant operations
- ✅ Propagate trace context across services
- ✅ Include security attributes (user_role, auth_status)
- ❌ Don't create spans for every function call
- ❌ Don't add high-cardinality attributes
- ❌ Don't include sensitive data in span attributes

### Security-Specific Practices

- ✅ Log all authentication attempts (success and failure)
- ✅ Log all authorization decisions
- ✅ Log all evidence operations with hash verification
- ✅ Monitor for unusual access patterns
- ✅ Alert on privilege escalation attempts
- ❌ Don't log actual passwords or tokens
- ❌ Don't log full file contents
- ❌ Don't expose internal system details in public metrics

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [OpenTelemetry Python](https://opentelemetry.io/docs/instrumentation/python/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)

---

**Document Owner:** Platform Engineering  
**Review Frequency:** Quarterly  
**Next Review:** January 2026

