# Post-Launch Monitoring & Watchlist

**Duration:** First 2 weeks after go-live  
**Review Frequency:** Daily (Week 1), Every 2 days (Week 2)  
**Owner:** Platform Engineering + On-Call

---

## SLO Targets

### Performance SLOs

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|----------------|-------------------|
| API p95 response time | < 300ms | > 500ms | > 1000ms |
| API p99 response time | < 1s | > 2s | > 5s |
| Evidence export p95 | < 2s | > 5s | > 10s |
| Evidence upload p95 | < 3s | > 10s | > 30s |
| Error rate | < 0.5% | > 1% | > 5% |
| Evidence verification success | > 99% | < 98% | < 95% |

### Availability SLOs

| Service | Target | Alert Threshold |
|---------|--------|----------------|
| API uptime | 99.9% | < 99.5% |
| Database uptime | 99.95% | < 99.9% |
| Evidence storage | 99.99% | < 99.95% |

---

## Security Watchlist

### 1. Authentication Anomalies

**Monitor:**
- Spike in 401 (Unauthorized) responses
- Spike in 403 (Forbidden) responses
- Failed login attempts per user
- Failed login attempts per IP

**Alert Thresholds:**
- > 50 failed logins per hour (single user)
- > 100 failed logins per hour (single IP)
- > 10% increase in 401/403 rate

**Dashboard Query (Prometheus):**
```promql
# Failed auth rate
rate(http_requests_total{status="401"}[5m])

# Failed authorization rate
rate(http_requests_total{status="403"}[5m])

# By endpoint
sum by (path) (rate(http_requests_total{status=~"401|403"}[5m]))
```

### 2. Rate Limit Violations

**Monitor:**
- 429 (Too Many Requests) responses
- Rate limit violations per IP
- Rate limit violations per user
- Repeated violations (potential abuse)

**Alert Thresholds:**
- > 100 rate limit violations per hour (system-wide)
- > 10 violations from single IP (potential DoS)

**Dashboard Query:**
```promql
# Rate limit rejections
sum(rate(http_requests_total{status="429"}[5m]))

# By IP
topk(10, sum by (ip) (rate(http_requests_total{status="429"}[1h])))
```

### 3. MIME/Extension Mismatches

**Monitor:**
- Uploads where MIME type doesn't match extension
- Unusual file types
- Large file uploads

**Alert Thresholds:**
- > 5 MIME mismatches per hour
- File size > 100MB (may indicate abuse)

**Log Query:**
```
evidence.upload.mime_mismatch > 5 in 1h
OR
evidence.upload.size > 100MB
```

### 4. Evidence Verification Failures

**Monitor:**
- Hash mismatches on verification
- File not found errors
- Verification failures per hour

**Alert Thresholds:**
- > 1 hash mismatch (CRITICAL - potential tampering)
- > 10 verification failures per hour

**Dashboard Query:**
```promql
# Verification failures
sum(rate(evidence_verify_failure_total[5m]))

# Hash mismatches (should be near zero)
sum(rate(evidence_hash_mismatch_total[5m]))
```

### 5. CSRF Violations

**Monitor:**
- CSRF token missing
- CSRF token invalid
- CSRF violations per IP

**Alert Thresholds:**
- > 20 CSRF violations per hour

**Dashboard Query:**
```promql
sum(rate(csrf_violation_total[5m]))
```

---

## Operational Watchlist

### 1. Queue Lag

**Monitor:**
- Ingestion queue depth
- Alert processing queue depth
- Queue processing time

**Alert Thresholds:**
- Ingestion queue > 1000 items
- Alert queue > 500 items
- Processing time > 5 minutes

**Query:**
```promql
# Queue depth
sum(queue_depth{queue="ingestion"})
sum(queue_depth{queue="alerts"})

# Processing lag
queue_processing_lag_seconds > 300
```

### 2. Database Performance

**Monitor:**
- Connection pool utilization
- Query execution time
- Slow query count
- Database disk usage
- Large object (BLOB) growth

**Alert Thresholds:**
- Connection pool > 80%
- Slow queries (> 1s) > 10/min
- Disk usage > 80%

**PostgreSQL Queries:**
```sql
-- Connection pool usage
SELECT count(*) * 100.0 / max_conn 
FROM pg_stat_activity, 
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') x;

-- Slow queries
SELECT query, mean_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Table bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Storage Usage

**Monitor:**
- Evidence storage disk usage
- Storage growth rate
- Orphaned files
- Backup storage usage

**Alert Thresholds:**
- Disk usage > 80%
- Growth rate > 10GB/day (unexpected)

**Query:**
```bash
# Disk usage
df -h /app/uploads

# Evidence file count
find /app/uploads/evidence -type f | wc -l

# Growth rate (bytes per day)
du -sb /app/uploads/evidence
```

### 4. Backup Health

**Monitor:**
- Backup success rate
- Backup size
- Backup duration
- Last successful backup time

**Alert Thresholds:**
- Backup failed (CRITICAL)
- No backup in 25 hours (daily backups)
- Backup duration > 1 hour

**Query:**
```bash
# Last backup
ls -lht backups/ | head -n 5

# Backup size trend
du -sh backups/backup-* | tail -n 7
```

---

## Governance Watchlist

### Weekly Transparency Mini-Report

**Metrics to Track:**

1. **Evidence Submissions**
   - Total submitted
   - By type (photo, video, document)
   - Anonymous vs. authenticated
   - Verification rate

2. **Tips & Incidents**
   - Tips submitted
   - Tips escalated to incidents
   - Incidents created
   - Incident resolution time

3. **Alerts**
   - Alerts triggered
   - Alert types
   - False positive rate
   - Alert response time

4. **Evidence Exports**
   - Total exports
   - By user role
   - By purpose (legal, audit, investigation)
   - Average export frequency

5. **Escalations**
   - Issues escalated
   - Escalation reasons
   - Resolution time
   - Stakeholder involvement

**Report Template:**

```markdown
# Shomer Weekly Transparency Report
**Week of:** [Start Date] to [End Date]

## Evidence Management
- Evidence submitted: [count]
- Verification success rate: [%]
- Evidence sealed (legal hold): [count]
- Evidence exports: [count]

## Tips & Incidents
- Tips submitted: [count]
- Tips escalated: [count]
- Incidents created: [count]
- Average resolution time: [hours]

## Security & Access
- Failed authentication attempts: [count]
- Rate limit violations: [count]
- RBAC violations: [count]
- Unusual access patterns: [count]

## System Health
- Uptime: [%]
- Average response time: [ms]
- Error rate: [%]
- Verification failures: [count]

## Issues & Actions
- [List any incidents]
- [Actions taken]
- [Follow-up required]

**Prepared by:** [Name]
**Reviewed by:** [Oversight Board Member]
```

---

## Monitoring Dashboards

### Dashboard 1: System Health (Overview)

**Metrics:**
- Request rate (req/s)
- Response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Active connections
- Database query time

**Refresh:** 30 seconds

### Dashboard 2: Evidence Flow

**Metrics:**
- Evidence uploads per hour
- Upload success rate
- Verification success rate
- Export requests per hour
- Average file size

**Refresh:** 1 minute

### Dashboard 3: Security

**Metrics:**
- Authentication failures
- Authorization failures (RBAC)
- Rate limit violations
- CSRF violations
- Suspicious IPs (top 10)

**Refresh:** 1 minute

### Dashboard 4: Chain of Custody

**Metrics:**
- Chain-of-custody events per hour
- Events by type (SUBMITTED, VERIFIED, SEALED, etc.)
- Evidence verification rate
- Hash mismatches (should be 0)

**Refresh:** 5 minutes

---

## Alert Configuration

### Critical Alerts (Immediate Response)

1. **Evidence Hash Mismatch**
   - Query: `evidence_hash_mismatch_total > 0`
   - Response: 15 minutes
   - Action: Immediate investigation, seal affected evidence

2. **High 5xx Error Rate**
   - Query: `rate(http_requests_total{status=~"5.."}[5m]) > 0.05`
   - Response: 15 minutes
   - Action: Check logs, database, storage

3. **Backup Failed**
   - Query: `time() - backup_last_success_timestamp > 86400`
   - Response: 1 hour
   - Action: Investigate and re-run backup

### High Priority Alerts (1 Hour Response)

1. **Verification Failure Spike**
   - Query: `increase(evidence_verify_failure_total[5m]) > 10`
   - Response: 1 hour
   - Action: Check storage integrity

2. **Export Volume Spike**
   - Query: `rate(evidence_export_total[5m]) > 50`
   - Response: 1 hour
   - Action: Check for abuse or bulk export

3. **Database Connection Pool Exhausted**
   - Query: `db_connection_pool_utilization > 0.9`
   - Response: 1 hour
   - Action: Scale connections or investigate leaks

### Warning Alerts (4 Hour Response)

1. **Disk Usage High**
   - Query: `disk_usage_percent > 0.8`
   - Response: 4 hours
   - Action: Clean up or expand storage

2. **Slow Queries**
   - Query: `db_query_duration_seconds > 1`
   - Response: 4 hours
   - Action: Optimize or add indexes

---

## Daily Review Checklist (Week 1)

**Time Required:** 15-30 minutes

- [ ] Review overnight logs for errors
- [ ] Check all SLOs against targets
- [ ] Review security alerts (401, 403, 429)
- [ ] Check evidence verification rate
- [ ] Review backup status
- [ ] Check disk usage trends
- [ ] Review any escalations
- [ ] Update incident log if needed

**Sign-off:** [Name], [Date]

---

## Bi-Daily Review Checklist (Week 2)

**Time Required:** 15-20 minutes

- [ ] Review error rates and trends
- [ ] Check SLO compliance
- [ ] Review evidence metrics
- [ ] Check for any anomalies
- [ ] Review backup status
- [ ] Update weekly report data

**Sign-off:** [Name], [Date]

---

## Incident Response Runbook

See `docs/PILOT_RUNBOOK.md` for detailed incident response procedures.

**Quick Reference:**

1. **Evidence Integrity Issue**
   - Stop writes immediately
   - Investigate scope
   - Seal affected evidence
   - Notify oversight board

2. **High Error Rate**
   - Check service health
   - Review recent deployments
   - Check database connectivity
   - Scale if needed

3. **Security Incident**
   - Isolate affected systems
   - Preserve evidence
   - Notify security team
   - Follow incident response plan

---

## Post-Launch Success Criteria

After 2 weeks, evaluate:

- [ ] All SLOs met consistently
- [ ] No critical incidents
- [ ] < 3 high-priority incidents
- [ ] User feedback positive
- [ ] Oversight board satisfied
- [ ] No evidence integrity issues

**If Successful:** Transition to normal operations
**If Issues:** Extend monitoring period or roll back

---

---

## Secret Rotation (Phase 3)

### Rotation Cadence

**Schedule:** Automated rotation every 30 days (1st of each month at 5:00 AM UTC)

**Rotated Secrets:**
- `JWT_SECRET` - JSON Web Token signing key
- `SIGNED_URL_SECRET` - Signed URL generation key

### Rotation Process

#### Automated (GitHub Actions)

Rotation runs automatically via GitHub Actions workflow:

```yaml
# .github/workflows/rotate-secrets.yml
on:
  schedule:
    - cron: "0 5 1 * *"  # 1st of every month at 5:00 AM UTC
```

**What happens:**
1. Script generates new cryptographically secure secrets
2. New secrets are written to `.env.production`
3. Changes are committed to repository
4. Slack notification sent (if configured)

**Manual Trigger:**

To manually trigger rotation:

```bash
# Via GitHub Actions UI
Go to Actions → Rotate Secrets → Run workflow

# Or locally (dry run first)
DRY_RUN=true python apps/api/app/scripts/rotate_secrets.py
python apps/api/app/scripts/rotate_secrets.py
```

#### Post-Rotation Actions

**Required after rotation:**

1. **Update Production Environment**
   ```bash
   # Copy new secrets from .env.production to your secret manager
   # AWS Secrets Manager example:
   aws secretsmanager update-secret \
     --secret-id shomer/jwt-secret \
     --secret-string "$(grep JWT_SECRET .env.production | cut -d= -f2)"
   ```

2. **Restart Application**
   ```bash
   # Docker
   docker compose restart api
   
   # Kubernetes
   kubectl rollout restart deployment/shomer-api
   ```

3. **Verify Functionality**
   ```bash
   # Test authentication
   curl -X POST https://your-domain.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   
   # Test signed URLs
   curl https://your-domain.com/api/v1/evidence/1/download
   ```

4. **Monitor for Issues**
   - Watch error rate for 30 minutes post-restart
   - Check for authentication failures
   - Verify signed URLs still work

### Rotation Alerts

**Slack Notification Format:**

```
🔑 Shomer Secrets Rotated
Date: 2025-11-01
Keys Rotated: JWT_SECRET, SIGNED_URL_SECRET

⚠️ Action Required: Update production environment variables
```

**Alert Runbook:**

| Alert | Action |
|-------|--------|
| Rotation succeeded | Follow post-rotation actions above |
| Rotation failed | Check GitHub Actions logs, re-run manually |
| Auth failures spike post-rotation | Verify new secrets deployed correctly |
| Signed URL 403s spike | Check SIGNED_URL_SECRET updated in all environments |

---

## Observability & Monitoring (Phase 3)

### Grafana Dashboard

**Dashboard:** `Shomer - Production Monitoring`  
**Import:** `infra/grafana/dashboards/shomer.json`  
**Access:** `http://grafana.your-domain.com` (or `http://localhost:3000`)

#### Dashboard Widgets

1. **API Latency (p95 / p99)**
   - Target: p95 < 300ms, p99 < 1s
   - Alert: p95 > 500ms

2. **Error Rate**
   - Target: < 0.5% 5xx errors
   - Alert: > 1% 5xx errors (CRITICAL)

3. **Evidence Uploads per Hour**
   - Track upload volume trends
   - Alert: Unusual spike (> 5x normal)

4. **Evidence Verification Failures**
   - Target: < 1 failure per hour
   - Alert: > 10 failures in 10 minutes (HIGH)

5. **Export Spikes**
   - Normal: < 30 exports/minute
   - Alert: > 50 exports/minute

6. **Signed URL 403 Rate**
   - Target: < 1% of signed URL requests
   - Alert: > 5% 403 rate

#### Importing Dashboard

**Via Grafana UI:**

1. Navigate to **Dashboards** → **Import**
2. Upload `infra/grafana/dashboards/shomer.json`
3. Select **Prometheus** as data source
4. Click **Import**

**Via Provisioning:**

```bash
# Copy dashboard to Grafana provisioning directory
cp infra/grafana/dashboards/shomer.json \
   /etc/grafana/provisioning/dashboards/

# Restart Grafana
docker compose restart grafana
```

### Distributed Tracing

**Backend:** Jaeger / Tempo  
**Access:** `http://jaeger.your-domain.com:16686` (or `http://localhost:16686`)

**Configuration:**

```bash
# .env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
OTEL_SERVICE_NAME=shomer-api
```

**What's Traced:**

- All HTTP requests (automatic via FastAPI instrumentation)
- Database queries (automatic via SQLAlchemy instrumentation)
- Evidence operations (custom spans: `evidence.upload`, `evidence.verify`, etc.)
- Chain-of-custody events

**Trace Context in Logs:**

All logs now include:
- `trace_id` - OpenTelemetry trace ID (32 hex chars)
- `span_id` - OpenTelemetry span ID (16 hex chars)

Example log:
```
2025-10-14T10:30:45+00:00 | INFO | req-abc123 | a1b2c3d4e5f6... | e5f6g7h8... | user-456 | evidence-789 | app.services.evidence | Evidence uploaded
```

**Finding Traces:**

1. **From Logs:**
   - Copy `trace_id` from log
   - Search in Jaeger UI by trace ID

2. **From Metrics:**
   - In Grafana, click on a spike in the dashboard
   - Select **Explore Traces** (if Tempo configured)

3. **By Operation:**
   - Filter by service: `shomer-api`
   - Filter by operation: `evidence.upload`, `GET /api/v1/evidence`, etc.

### Log Aggregation

Logs are structured with the following fields:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO-8601 UTC timestamp |
| `level` | Log level (INFO, WARNING, ERROR, CRITICAL) |
| `request_id` | Request correlation ID |
| `trace_id` | OpenTelemetry trace ID |
| `span_id` | OpenTelemetry span ID |
| `user_id` | User identifier |
| `evidence_id` | Evidence identifier |
| `message` | Log message |

**Query Examples:**

```bash
# Find all logs for a specific trace
grep "a1b2c3d4e5f6" /var/log/shomer/api.log

# Find all evidence upload failures
grep "evidence.upload" /var/log/shomer/api.log | grep "ERROR"

# Find all logs for a specific user
grep "user-456" /var/log/shomer/api.log
```

---

## Alert Runbook Links

Detailed runbooks for common alerts:

| Alert | Runbook | Severity |
|-------|---------|----------|
| High 5xx Error Rate | [5xx Runbook](#high-5xx-error-rate-runbook) | Critical |
| Verification Failures | [Verify Runbook](#verification-failures-runbook) | High |
| Export Volume Spike | [Export Runbook](#export-volume-spike-runbook) | Warning |
| Secret Rotation Failed | [Rotation Runbook](#secret-rotation-runbook) | High |

### High 5xx Error Rate Runbook

**Alert:** 5xx error rate > 1%

**Response Time:** 15 minutes

**Steps:**

1. **Check Recent Deployments**
   ```bash
   git log -n 5 --oneline
   kubectl rollout history deployment/shomer-api
   ```

2. **Check Application Logs**
   ```bash
   docker logs shomer-api --tail 100 | grep ERROR
   ```

3. **Check Database Connectivity**
   ```bash
   docker exec shomer-db pg_isready
   ```

4. **Check Resource Usage**
   ```bash
   docker stats shomer-api
   ```

5. **Rollback if Needed**
   ```bash
   kubectl rollout undo deployment/shomer-api
   ```

### Verification Failures Runbook

**Alert:** > 10 verification failures in 10 minutes

**Response Time:** 15 minutes

**Steps:**

1. **Check Storage Health**
   ```bash
   # Check disk space
   df -h /app/uploads
   
   # Check file system errors
   dmesg | grep -i error
   ```

2. **Check for Hash Mismatches** (CRITICAL)
   ```bash
   grep "hash_mismatch" /var/log/shomer/api.log
   ```
   
   If hash mismatches found:
   - **Immediately seal affected evidence**
   - **Notify oversight board**
   - **Investigate potential tampering**

3. **Check Recent Evidence**
   ```bash
   # Find recently verified evidence
   docker exec shomer-db psql -U shomer -c \
     "SELECT id, status, verified_at FROM evidence ORDER BY verified_at DESC LIMIT 10;"
   ```

4. **Verify Backup Integrity**
   ```bash
   # Run backup verification
   ./scripts/backup-restore-drill.sh
   ```

### Export Volume Spike Runbook

**Alert:** > 50 exports per minute

**Response Time:** 1 hour

**Steps:**

1. **Check Who's Exporting**
   ```bash
   # Query recent exports
   docker exec shomer-db psql -U shomer -c \
     "SELECT user_id, COUNT(*) as export_count 
      FROM chain_of_custody_events 
      WHERE event_type = 'EXPORTED' 
        AND created_at > NOW() - INTERVAL '1 hour' 
      GROUP BY user_id 
      ORDER BY export_count DESC;"
   ```

2. **Check for Automation/Abuse**
   - Single user with many exports? → Possible abuse
   - Multiple users? → Legitimate activity or coordinated abuse

3. **Rate Limit if Needed**
   ```python
   # Temporarily reduce export rate limit
   # Edit apps/api/app/core/config.py
   RATE_LIMIT_EXPORTS = "10/hour"  # Down from 50/hour
   ```

4. **Contact User if Suspicious**
   - Review audit logs
   - Contact user to understand intent

### Secret Rotation Runbook

**Alert:** Secret rotation workflow failed

**Response Time:** 1 hour

**Steps:**

1. **Check GitHub Actions Logs**
   - Go to **Actions** → **Rotate Secrets** → Latest run
   - Review error messages

2. **Run Rotation Manually**
   ```bash
   cd apps/api
   DRY_RUN=true python app/scripts/rotate_secrets.py
   # If dry run succeeds:
   python app/scripts/rotate_secrets.py
   ```

3. **Common Issues:**
   - **Permission error:** Check GitHub token has write permissions
   - **Slack webhook error:** Verify SLACK_WEBHOOK secret configured
   - **Python import error:** Check dependencies installed

4. **Verify Secrets Updated**
   ```bash
   # Check .env.production has new entries
   tail -n 10 .env.production
   ```

---

**Document Owner:** Platform Engineering  
**Review Frequency:** Daily (Week 1), Every 2 days (Week 2)  
**Next Review:** After 2-week period

