# Phase 3 Quick Start Guide

Get started with Shomer's Phase 3 observability and secret rotation features in under 15 minutes.

---

## Prerequisites

- Docker and Docker Compose installed
- Shomer API running (see main QUICKSTART.md)
- Python 3.11+ (for secret rotation)

---

## 1. Start Observability Stack (5 minutes)

### Launch Services

```bash
# Start Prometheus, Grafana, and Jaeger
docker compose -f docker-compose.observability.yml up -d

# Verify services are running
docker compose -f docker-compose.observability.yml ps
```

### Access Dashboards

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (admin/admin)
- **Jaeger:** http://localhost:16686

### Import Shomer Dashboard

**Option 1: Via Grafana UI**

1. Open Grafana: http://localhost:3000
2. Login (admin/admin)
3. Go to **Dashboards** → **Import**
4. Click **Upload JSON file**
5. Select `infra/grafana/dashboards/shomer.json`
6. Select **Prometheus** as data source
7. Click **Import**

**Option 2: Via Provisioning (Automatic)**

```bash
# Copy dashboard to provisioning directory
mkdir -p infra/grafana/dashboards
cp infra/grafana/dashboards/shomer.json infra/grafana/dashboards/

# Restart Grafana to load dashboard
docker compose -f docker-compose.observability.yml restart grafana
```

---

## 2. Enable Tracing in API (2 minutes)

### Update Environment Variables

Add to your `.env` file:

```bash
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=shomer-api
```

### Restart API

```bash
# If using Docker
docker compose restart api

# If running locally
# Stop and restart your API server
```

### Verify Tracing

```bash
# Make a test request
curl http://localhost:8000/api/v1/health

# Check Jaeger UI for traces
# Open: http://localhost:16686
# Service: shomer-api
# Operation: GET /api/v1/health
```

---

## 3. Test Secret Rotation (3 minutes)

### Install Dependencies

```bash
cd apps/api
pip install requests
```

### Run Dry Run

```bash
# Test secret rotation (no changes made)
DRY_RUN=true python app/scripts/rotate_secrets.py
```

**Expected Output:**
```
🔑 Rotating secrets - 2025-10-14
DRY RUN - Generating new values...

  ✓ JWT_SECRET: a1b2c3d4...
  ✓ SIGNED_URL_SECRET: e5f6g7h8...

ℹ DRY RUN - would write to .env.production
ℹ SLACK_WEBHOOK not set - skipping notification

✅ Secret rotation complete
```

### (Optional) Configure Slack Notifications

```bash
# Set webhook URL
export SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Run rotation again
DRY_RUN=true python app/scripts/rotate_secrets.py
```

---

## 4. Run Validation Script (2 minutes)

```bash
# Make script executable (Unix/Mac)
chmod +x verify-launch-phase3.sh

# Run validation
./verify-launch-phase3.sh

# Or with custom domain
./verify-launch-phase3.sh your-domain.com
```

**Expected Output:**
```
🧪 Shomer Phase 3 Launch Validation

✓ Strict-Transport-Security header present
✓ Secret rotation script exists
✓ Secret rotation script runs successfully
✓ Grafana dashboard configuration exists
✓ Observability module includes trace/span IDs
✓ Docker Compose is available
✓ All tests passed

✅ Validation Complete - All critical checks passed
```

---

## 5. Explore Features (5 minutes)

### View Metrics in Grafana

1. Open http://localhost:3000
2. Go to **Dashboards** → **Shomer - Production Monitoring**
3. Observe:
   - API Latency (p95/p99)
   - Error Rate
   - Evidence Uploads
   - Verification Failures

### View Traces in Jaeger

1. Open http://localhost:16686
2. Select service: **shomer-api**
3. Click **Find Traces**
4. Click on a trace to see details:
   - Request flow
   - Database queries
   - Timing information

### Query Metrics in Prometheus

1. Open http://localhost:9090
2. Try these queries:
   ```promql
   # Request rate
   rate(http_requests_total[5m])
   
   # p95 latency
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
   
   # Error rate
   sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
   ```

### Check Log Correlation

```bash
# Make a request and note the trace ID
curl -v http://localhost:8000/api/v1/health

# Check logs for trace ID
docker logs shomer-api | grep <trace_id>
```

---

## 6. Setup GitHub Actions (3 minutes)

### Configure Slack Webhook (Optional)

```bash
# Add GitHub secret
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### Test Workflow

1. Go to GitHub repository
2. Click **Actions**
3. Select **Rotate Secrets**
4. Click **Run workflow**
5. Select **dry_run: true**
6. Click **Run workflow**
7. Monitor execution

---

## Troubleshooting

### Grafana Dashboard Not Showing Data

**Problem:** Dashboard shows "No data"

**Solution:**
```bash
# Check Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Check API metrics endpoint
curl http://localhost:8000/metrics

# Verify Prometheus data source in Grafana
# Configuration → Data Sources → Prometheus → Test
```

### Traces Not Appearing in Jaeger

**Problem:** No traces visible

**Solution:**
```bash
# Check OTEL configuration
echo $OTEL_ENABLED
echo $OTEL_EXPORTER_OTLP_ENDPOINT

# Check Jaeger is running
docker ps | grep jaeger

# Check API logs for OTEL errors
docker logs shomer-api | grep -i otel

# Test OTLP endpoint
curl http://localhost:4317
```

### Secret Rotation Script Fails

**Problem:** Script errors or fails

**Solution:**
```bash
# Check Python version (need 3.11+)
python --version

# Install dependencies
pip install requests

# Run with verbose output
python app/scripts/rotate_secrets.py

# Check write permissions
touch .env.production
```

---

## Next Steps

### Production Deployment

1. **Read Full Documentation:**
   - `docs/OBSERVABILITY_GUIDE.md` - Complete observability guide
   - `docs/POST_LAUNCH_MONITORING.md` - Monitoring and runbooks
   - `PHASE_3_LAUNCH_VALIDATION_SUMMARY.md` - Phase 3 summary

2. **Configure Production Environment:**
   ```bash
   # Set production OTEL endpoint
   OTEL_EXPORTER_OTLP_ENDPOINT=https://your-jaeger-instance:4317
   
   # Set Grafana admin password
   GRAFANA_PASSWORD=strong-password-here
   
   # Configure Slack webhook
   SLACK_WEBHOOK=https://hooks.slack.com/...
   ```

3. **Setup Alert Notifications:**
   - Configure Slack/email notifications in Grafana
   - Test critical alerts
   - Document on-call procedures

4. **Schedule Secret Rotation:**
   - Verify GitHub Actions workflow runs monthly
   - Test rotation in staging first
   - Document post-rotation procedures

5. **Monitor & Iterate:**
   - Watch dashboards for first 24 hours
   - Adjust alert thresholds as needed
   - Review trace samples
   - Update documentation

---

## Quick Reference

### URLs
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (admin/admin)
- **Jaeger:** http://localhost:16686
- **API Metrics:** http://localhost:8000/metrics

### Commands
```bash
# Start observability stack
docker compose -f docker-compose.observability.yml up -d

# Stop observability stack
docker compose -f docker-compose.observability.yml down

# View logs
docker compose -f docker-compose.observability.yml logs -f

# Test secret rotation
DRY_RUN=true python apps/api/app/scripts/rotate_secrets.py

# Run validation
./verify-launch-phase3.sh
```

### Key Files
- `infra/grafana/dashboards/shomer.json` - Dashboard configuration
- `apps/api/app/core/observability.py` - Observability module
- `apps/api/app/scripts/rotate_secrets.py` - Secret rotation script
- `.github/workflows/rotate-secrets.yml` - Rotation workflow

---

## Support

### Documentation
- **Observability Guide:** `docs/OBSERVABILITY_GUIDE.md`
- **Monitoring Guide:** `docs/POST_LAUNCH_MONITORING.md`
- **Phase 3 Summary:** `PHASE_3_LAUNCH_VALIDATION_SUMMARY.md`

### Issues
- Check logs: `docker logs <container-name>`
- Review validation output: `./verify-launch-phase3.sh`
- Consult runbooks in `docs/POST_LAUNCH_MONITORING.md`

---

**Happy Monitoring! 🎉**

