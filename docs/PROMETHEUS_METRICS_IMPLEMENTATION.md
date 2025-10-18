# Prometheus Metrics Implementation Guide

## Overview

This guide explains how to implement Prometheus metrics in the Shomer API to support the enterprise-grade SLO monitoring system.

## Current Status

The Shomer API currently uses Sentry for error tracking but doesn't have Prometheus metrics. This implementation adds the necessary metrics to support the SLO monitoring rules.

## Required Metrics

Based on the SLO monitoring rules, we need these metrics:

### Core Metrics
- `csrf_rotations_total` - Counter for CSRF token rotations
- `api_fetch_retry_total{outcome="success"|"failure"}` - Counter for API retry attempts
- `idempotency_hits_total` - Counter for idempotency key hits
- `http_write_requests_total` - Counter for write requests (POST/PUT/PATCH/DELETE)
- `http_responses_total{degraded="0"|"1", code="2xx|4xx|5xx", method="POST|PUT|PATCH|DELETE"}` - Counter for HTTP responses

### Label Structure

All metrics should include these labels:
- `service` - Service name (e.g., "shomer-api")
- `env` - Environment (e.g., "production", "staging", "development")
- `cluster` - Cluster identifier (e.g., "us-east-1", "eu-west-1")
- `region` - Region identifier (e.g., "us-east-1", "eu-west-1")

## Implementation Steps

### 1. Add Dependencies

Add to `pyproject.toml`:
```toml
prometheus-client = "^0.20.0"
```

### 2. Create Metrics Module

Create `app/core/metrics.py` with Prometheus metrics definitions.

### 3. Integrate with Middleware

Update existing middleware to emit metrics:
- CSRF middleware → `csrf_rotations_total`
- Idempotency middleware → `idempotency_hits_total`
- Rate limiting middleware → `http_responses_total`
- Request logging → `http_write_requests_total`

### 4. Add Metrics Endpoint

Add `/metrics` endpoint for Prometheus scraping.

### 5. Configure Prometheus

Update Prometheus configuration to scrape the `/metrics` endpoint.

## Environment Variables

Add these environment variables for metric labels:

```bash
# Service identification
SERVICE_NAME=shomer-api
ENVIRONMENT=production
CLUSTER_NAME=us-east-1
REGION=us-east-1

# Prometheus configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
```

## Deployment Considerations

### Development
- Use `ENVIRONMENT=development`
- Set `CLUSTER_NAME` and `REGION` to local values
- Enable Prometheus scraping on localhost

### Production
- Use `ENVIRONMENT=production`
- Set actual cluster and region values
- Configure Prometheus to scrape all instances
- Set up service discovery for dynamic targets

## Monitoring Setup

### Prometheus Configuration
```yaml
scrape_configs:
  - job_name: 'shomer-api'
    static_configs:
      - targets: ['shomer-api:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard
Import the updated `grafana-api-security-dashboard.json` which includes SLO panels.

### AlertManager
Configure AlertManager to route alerts to your notification channels.

## Testing

### Local Testing
1. Start the API with metrics enabled
2. Generate some traffic
3. Check `/metrics` endpoint
4. Verify metrics appear in Prometheus
5. Test alert rules

### Production Testing
1. Deploy with metrics enabled
2. Monitor for 24-48 hours
3. Adjust thresholds based on actual traffic patterns
4. Fine-tune alert rules

## Troubleshooting

### Common Issues

1. **Metrics not appearing**: Check if `/metrics` endpoint is accessible
2. **Labels missing**: Verify environment variables are set correctly
3. **Alerts not firing**: Check Prometheus rule evaluation
4. **Dashboard empty**: Ensure template variables are populated

### Debug Commands

```bash
# Check metrics endpoint
curl http://localhost:8000/metrics

# Query Prometheus
curl "http://prometheus:9090/api/v1/query?query=csrf_rotations_total"

# Check recording rules
curl "http://prometheus:9090/api/v1/query?query=api:csrf_rotations_per_min:svc_env_cluster_region"
```

## Next Steps

1. Implement the metrics module
2. Update middleware to emit metrics
3. Add metrics endpoint
4. Configure Prometheus scraping
5. Test the complete monitoring stack
6. Deploy to production
7. Monitor and adjust thresholds
