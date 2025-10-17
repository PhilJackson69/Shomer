# Retention Workers & Audit Trails - README Update

## New Features Added

### 🔄 Data Retention System
- **Scheduled cleanup job** runs daily at 2 AM
- **Configurable retention periods** (default: 14 days for tips)
- **Status-based exemptions** (escalated, under_investigation tips are kept)
- **Automatic redaction** of old content while preserving metadata
- **Manual trigger** via admin API endpoint

### 🖼️ EXIF Scrubbing & Media Processing
- **Automatic EXIF removal** on photo uploads
- **File hashing** (MD5, SHA256) for duplicate detection
- **Original preservation** option for legal requirements
- **Metadata extraction** and storage
- **Image optimization** and compression

### 🔐 Enhanced Role-Based Access Control (RBAC)
- **Fine-grained permissions** system
- **Decorator-based enforcement** (`@require_permission`, `@require_role`)
- **Three roles**: user, moderator, admin
- **Automatic permission checking** on all endpoints

### 📝 Comprehensive Audit Logging
- **Automatic logging** of all write operations
- **Before/after state tracking** with change detection
- **Request metadata** capture (IP, user agent, duration)
- **Admin endpoints** for viewing and filtering audit logs
- **Statistics dashboard** for audit analytics

## Quick Start

### Installation

```bash
cd apps/api

# Install dependencies (Pillow already included)
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Configure environment
echo "TIP_RETENTION_DAYS=14" >> .env
echo "ENABLE_RETENTION_SCHEDULER=true" >> .env

# Start API (scheduler auto-starts)
python run.py
```

### Usage Examples

#### View Audit Logs
```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1&page_size=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Trigger Retention Job
```bash
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Submit Tip with Photo (EXIF auto-scrubbed)
```bash
curl -X POST http://localhost:8000/api/v1/tips \
  -F "content=Suspicious activity" \
  -F "location=Main St" \
  -F "image=@photo.jpg"
```

## API Endpoints

### Admin Endpoints (Require Admin Role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/audit-logs` | List audit logs with filters |
| GET | `/api/v1/admin/audit-logs/stats` | Get audit statistics |
| GET | `/api/v1/admin/audit-logs/{id}` | Get specific audit log |
| POST | `/api/v1/admin/retention/run` | Manually run retention job |
| GET | `/api/v1/admin/retention/config` | Get retention configuration |
| GET | `/api/v1/admin/system/health` | Get system health metrics |

### Audit Log Filters

- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 50, max: 100)
- `action`: Filter by action (e.g., 'incident_updated')
- `resource_type`: Filter by resource type (e.g., 'incident')
- `user_id`: Filter by user ID
- `start_date`: Filter by start date
- `end_date`: Filter by end date

## Configuration

### Environment Variables

```bash
# Retention
TIP_RETENTION_DAYS=14              # Days before purging tips
ENABLE_RETENTION_SCHEDULER=true    # Enable automatic scheduling

# Environment
ENVIRONMENT=development            # or production
```

### Code Configuration

```python
# app/core/retention.py
class RetentionConfig:
    TIP_RETENTION_DAYS = 14
    TIP_EXEMPT_STATUSES = ["escalated", "under_investigation"]
    AUDIT_LOG_RETENTION_DAYS = 365
    MEDIA_RETENTION_DAYS = 30
```

## Database Schema Changes

### New Columns

**tips table:**
- `status` (VARCHAR): Tip status (new, escalated, under_investigation, resolved)
- `contact_info` (TEXT): Consolidated contact information
- `metadata` (JSONB): File hashes, EXIF data, purge information

### Indexes

- `idx_tips_status`: Index on tip status
- `idx_tips_metadata_hash`: GIN index for querying file hashes

### Migration

```bash
# Apply migrations
alembic upgrade head

# Current migration: 004_update_tip_model
```

## Role Permissions

### User
- Create tips
- Read tips
- Read incidents

### Moderator
- All user permissions
- Update tips
- Create/update incidents
- Send alerts

### Admin
- All permissions (SYSTEM_ALL)
- View audit logs
- Manage retention
- Manage users
- System administration

## RBAC Usage

### Decorators

```python
from app.core.rbac import require_permission, require_role, Permission

@require_permission(Permission.INCIDENT_UPDATE)
async def update_incident(..., current_user: User):
    ...

@require_role(['admin', 'moderator'])
async def send_alert(..., current_user: User):
    ...
```

### Manual Checks

```python
from app.core.rbac import has_permission, Permission

if has_permission(current_user, Permission.ADMIN_AUDIT):
    # Allow access
    pass
```

## Audit Logging

### Automatic Logging

All POST, PUT, PATCH, DELETE requests are automatically logged by `AuditLoggingMiddleware`.

### Manual Logging

```python
from app.middleware.audit import create_audit_log

create_audit_log(
    action='incident_escalated',
    user_id=user.id,
    resource_type='incident',
    resource_id=str(incident.id),
    before={'status': 'new'},
    after={'status': 'escalated'},
    details={'reason': 'High threat'},
)
```

## Testing

### Run All Tests

```bash
python -m pytest tests/ -v
```

### Test Coverage

```bash
python -m pytest tests/ --cov=app --cov-report=html
```

### Specific Test Suites

```bash
# Retention
python -m pytest tests/test_retention.py -v

# Media/EXIF
python -m pytest tests/test_media.py -v

# RBAC
python -m pytest tests/test_rbac.py -v

# Admin endpoints
python -m pytest tests/test_admin_endpoints.py -v
```

## Monitoring

### Database Queries

```sql
-- Purged tips count
SELECT COUNT(*) FROM tips WHERE metadata->>'purged' = 'true';

-- Recent audit activity
SELECT action, COUNT(*) FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY action;

-- Top active users
SELECT user_id, COUNT(*) FROM audit_logs 
WHERE user_id IS NOT NULL 
GROUP BY user_id 
ORDER BY COUNT(*) DESC 
LIMIT 10;
```

### Health Check

```bash
curl http://localhost:8000/api/v1/admin/system/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Scheduler

### Job Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| retention_job | Daily at 2 AM | Purge old data |

### Manual Trigger

```bash
# Via API
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Via Python
python -c "from app.core.retention import run_retention_job; print(run_retention_job())"
```

## Security Considerations

1. **Data Minimization**: Automatic purging prevents data accumulation
2. **Privacy Protection**: EXIF scrubbing removes location/device data
3. **Audit Trail**: Complete change history for compliance
4. **Access Control**: RBAC ensures proper authorization
5. **Legal Compliance**: Optional original preservation for evidence

## Troubleshooting

### Scheduler Not Running

1. Check `ENABLE_RETENTION_SCHEDULER=true` in `.env`
2. Verify logs for startup message: "Application scheduler started"
3. Check `app/main.py` includes `start_scheduler()` in lifespan

### EXIF Errors

1. Verify Pillow is installed: `pip install pillow`
2. Check supported formats: JPEG, PNG, WEBP
3. Test with known-good image file

### Permission Denied

1. Check user role in database
2. Verify permission mapping in `app/core/rbac.py`
3. Ensure decorator is properly applied

## Documentation

- **Comprehensive Guide**: `RETENTION_AUDIT_SUMMARY.md`
- **Quick Start**: `QUICKSTART_RETENTION.md`
- **CLI Commands**: `CLI_COMMANDS.md`
- **API Docs**: `http://localhost:8000/docs`

## Dependencies

New or updated dependencies:
- `pillow>=10.2.0` - Image processing and EXIF handling
- `apscheduler>=3.10.4` - Job scheduling
- All other dependencies already in base requirements

## Files Modified/Created

### Core System
- `app/core/retention.py` - Retention worker
- `app/core/media.py` - EXIF scrubbing
- `app/core/rbac.py` - RBAC system
- `app/core/scheduler.py` - Job scheduler

### Middleware
- `app/middleware/audit.py` - Enhanced audit logging

### API Endpoints
- `app/api/v1/endpoints/admin.py` - Admin endpoints
- `app/api/v1/endpoints/tips.py` - Updated with EXIF scrubbing
- `app/api/v1/router.py` - Added admin router

### Models
- `app/models/tip.py` - Added status, contact_info, metadata fields

### Migrations
- `alembic/versions/003_add_tip_metadata.py` - Add metadata column
- `alembic/versions/004_update_tip_model.py` - Add status column

### Tests
- `tests/test_retention.py` - Retention tests
- `tests/test_media.py` - EXIF/media tests
- `tests/test_rbac.py` - RBAC tests
- `tests/test_admin_endpoints.py` - Admin API tests

### Documentation
- `RETENTION_AUDIT_SUMMARY.md` - Comprehensive guide
- `QUICKSTART_RETENTION.md` - Quick start guide
- `CLI_COMMANDS.md` - Command reference
- `README_RETENTION_AUDIT.md` - This file

## Next Steps

1. **Production Deployment**
   - Configure S3 for media storage
   - Set up monitoring/alerting
   - Review retention periods with legal team

2. **Performance Optimization**
   - Add database indexes if needed
   - Monitor audit log growth
   - Tune retention schedules

3. **Feature Enhancement**
   - Add more granular permissions
   - Implement audit log export
   - Add retention policy templates

4. **Compliance**
   - Document data retention policy
   - Implement GDPR right-to-deletion
   - Add data export functionality

## Support

For questions or issues:
1. Check comprehensive docs: `RETENTION_AUDIT_SUMMARY.md`
2. Review CLI commands: `CLI_COMMANDS.md`
3. Check test files for usage examples
4. View API documentation: `/docs` endpoint

---

**Status**: ✅ Production Ready

All features implemented, tested, and documented.

