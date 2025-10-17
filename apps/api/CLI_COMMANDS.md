# CLI Commands Reference

## Data Retention

### Run Retention Job Manually

```bash
# Method 1: Via Python
cd apps/api
python -c "from app.core.retention import run_retention_job; print(run_retention_job())"

# Method 2: Via API (requires admin token)
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Check Retention Configuration

```bash
curl http://localhost:8000/api/v1/admin/retention/config \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Audit Logs

### View Recent Audit Logs

```bash
# Last 10 logs
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1&page_size=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Filter by action
curl "http://localhost:8000/api/v1/admin/audit-logs?action=incident_updated" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Filter by date range
curl "http://localhost:8000/api/v1/admin/audit-logs?start_date=2025-01-01&end_date=2025-01-14" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

### Get Audit Statistics

```bash
curl http://localhost:8000/api/v1/admin/audit-logs/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

## System Health

### Check System Health

```bash
curl http://localhost:8000/api/v1/admin/system/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

### Basic Health Check

```bash
curl http://localhost:8000/health
```

## Database

### Run Migrations

```bash
cd apps/api

# Upgrade to latest
alembic upgrade head

# Check current version
alembic current

# View migration history
alembic history
```

### Direct Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# Check purged tips
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tips WHERE metadata->>'purged' = 'true';"

# Audit log summary
psql $DATABASE_URL -c "SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY COUNT(*) DESC LIMIT 10;"

# Recent activity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours';"
```

## Testing

### Run All Tests

```bash
cd apps/api
python -m pytest tests/ -v
```

### Run Specific Test Suites

```bash
# Retention tests
python -m pytest tests/test_retention.py -v

# Media/EXIF tests
python -m pytest tests/test_media.py -v

# RBAC tests
python -m pytest tests/test_rbac.py -v

# Admin endpoint tests
python -m pytest tests/test_admin_endpoints.py -v

# NLP tests
python -m pytest tests/test_nlp.py -v

# Alert service tests
python -m pytest tests/test_alert_service.py -v
```

### Run Tests with Coverage

```bash
python -m pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

## Development

### Start API Server

```bash
cd apps/api

# Development mode
python run.py

# With auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Start Redis (if not running)

```bash
# macOS/Linux
redis-server

# Windows
redis-server.exe
```

### Start PostgreSQL (if not running)

```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql

# Windows
# Use pgAdmin or Services panel
```

## Ingestion

### Run Ingestion Manually

```bash
cd apps/api
python -m ingestion run_once
```

### Manage Feeds via API

```bash
# List feeds
curl http://localhost:8000/api/v1/ingestion/feeds \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Disable a feed
curl -X PUT "http://localhost:8000/api/v1/ingestion/feeds/FEED_ID/disable" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Enable a feed
curl -X PUT "http://localhost:8000/api/v1/ingestion/feeds/FEED_ID/enable" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## NLP

### Test NLP Scoring

```bash
curl -X POST http://localhost:8000/api/v1/nlp/score \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test message to score"}'
```

### Run NLP Demo

```bash
cd apps/api
python examples/nlp_demo.py
```

## Alerts

### Send Test Alert

```bash
# SMS
curl -X POST http://localhost:8000/api/v1/alerts/send \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "sms",
    "recipients": ["+1234567890"],
    "message": "Test alert message"
  }'

# Email
curl -X POST http://localhost:8000/api/v1/alerts/send \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "recipients": ["user@example.com"],
    "subject": "Test Alert",
    "message": "This is a test alert"
  }'
```

## Tips

### Submit Public Tip

```bash
# Without photo
curl -X POST http://localhost:8000/api/v1/tips \
  -F "content=Suspicious activity observed" \
  -F "location=Main Street"

# With photo
curl -X POST http://localhost:8000/api/v1/tips \
  -F "content=Suspicious activity observed" \
  -F "location=Main Street" \
  -F "image=@photo.jpg"

# With legal hold on original
curl -X POST http://localhost:8000/api/v1/tips \
  -F "content=Evidence submission" \
  -F "legally_required=true" \
  -F "image=@evidence.jpg"
```

## Incidents

### List Incidents

```bash
curl "http://localhost:8000/api/v1/incidents?skip=0&limit=10" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Create Incident

```bash
curl -X POST http://localhost:8000/api/v1/incidents \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security Incident",
    "description": "Detailed description",
    "severity": "high",
    "status": "new"
  }'
```

## User Management

### Create User

```bash
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "role": "user"
  }'
```

### Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=SecurePassword123"
```

## Utilities

### Generate Test Data

```bash
cd apps/api
python seed.py
```

### Clear Test Data

```bash
# WARNING: This will delete all data
psql $DATABASE_URL -c "TRUNCATE tips, incidents, alerts, audit_logs CASCADE;"
```

### Export Audit Logs

```bash
# Export to JSON
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1&page_size=1000" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  > audit_logs_export.json

# Export to CSV (via psql)
psql $DATABASE_URL -c "COPY (SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000) TO STDOUT CSV HEADER" \
  > audit_logs_export.csv
```

## Production

### Check Logs

```bash
# If using systemd
journalctl -u shomer-api -f

# If using Docker
docker logs -f shomer-api

# Direct file
tail -f /var/log/shomer/api.log
```

### Restart Services

```bash
# Systemd
sudo systemctl restart shomer-api

# Docker
docker-compose restart api

# PM2
pm2 restart shomer-api
```

### Database Backup

```bash
# Full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
psql $DATABASE_URL < backup_20250114_120000.sql
```

## Monitoring

### Watch Scheduler Status

```bash
# Check if scheduler is running
curl http://localhost:8000/api/v1/admin/system/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.scheduler_status'

# Watch logs for scheduler activity
tail -f logs/app.log | grep "scheduler"
```

### Monitor Database Size

```bash
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Check Redis Status

```bash
redis-cli ping
redis-cli info | grep used_memory_human
```

## Environment Variables

### Set for Development

```bash
# Create .env file
cp env.example .env

# Edit values
export DATABASE_URL=postgresql://user:pass@localhost/shomer
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=your-secret-key
export TIP_RETENTION_DAYS=14
```

### Set for Production

```bash
# Using systemd
sudo systemctl edit shomer-api
# Add: Environment="TIP_RETENTION_DAYS=30"

# Using Docker
# Edit docker-compose.yml environment section

# Using .env file
echo "TIP_RETENTION_DAYS=30" >> /etc/shomer/.env
```

## Quick Reference

| Task | Command |
|------|---------|
| Start API | `python run.py` |
| Run tests | `pytest tests/ -v` |
| Run migrations | `alembic upgrade head` |
| Run retention | `python -c "from app.core.retention import run_retention_job; run_retention_job()"` |
| View audit logs | `curl localhost:8000/api/v1/admin/audit-logs -H "Authorization: Bearer $TOKEN"` |
| Check health | `curl localhost:8000/health` |
| Submit tip | `curl -X POST localhost:8000/api/v1/tips -F "content=Test"` |
| Backup DB | `pg_dump $DATABASE_URL > backup.sql` |

