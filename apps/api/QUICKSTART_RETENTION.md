# Quick Start: Retention & Audit System

## Overview

This guide will help you get the retention workers and audit trails system up and running quickly.

## Prerequisites

- Python 3.11+
- PostgreSQL running
- Redis running (for workers)
- Existing Shomer API installation

## Installation

### 1. Install Dependencies

```bash
cd apps/api

# Main dependencies (should already be installed)
pip install -r requirements.txt

# Pillow is required for EXIF processing (already in base deps)
pip install pillow
```

### 2. Configure Environment

Add to your `.env` file:

```bash
# Retention configuration
TIP_RETENTION_DAYS=14
ENABLE_RETENTION_SCHEDULER=true

# Environment
ENVIRONMENT=development
```

### 3. Run Database Migration

```bash
# Add tip metadata column
alembic upgrade head
```

## Usage

### Starting the API

The retention scheduler starts automatically when you run the API:

```bash
python run.py
```

You should see:
```
Application scheduler started
Scheduled jobs:
  - Data Retention Cleanup (retention_job)
```

### Manual Retention Job

#### Via API

```bash
# Requires admin authentication
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "message": "Retention job completed",
  "results": {
    "tips": {
      "tips_purged": 5,
      "cutoff_date": "2025-01-01T00:00:00",
      "retention_days": 14
    },
    "audit_logs": {
      "audit_logs_purged": 120,
      "cutoff_date": "2024-01-14T00:00:00",
      "retention_days": 365
    },
    "media": {
      "media_cleaned": 0
    }
  }
}
```

#### Via Python

```python
from app.core.retention import run_retention_job

results = run_retention_job()
print(results)
```

### Viewing Audit Logs

#### Get All Audit Logs (Paginated)

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1&page_size=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Filter by Action

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?action=incident_updated" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Filter by User

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?user_id=42" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Filter by Date Range

```bash
curl "http://localhost:8000/api/v1/admin/audit-logs?start_date=2025-01-01T00:00:00&end_date=2025-01-14T23:59:59" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Audit Statistics

```bash
curl http://localhost:8000/api/v1/admin/audit-logs/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Response:
```json
{
  "total_logs": 15000,
  "recent_24h": 250,
  "by_action": {
    "incident_created": 1200,
    "incident_updated": 3500,
    "tip_created": 5000
  },
  "by_resource": {
    "incident": 5000,
    "tip": 7000,
    "alert": 3000
  },
  "top_users": [
    {"user_id": 1, "count": 500},
    {"user_id": 2, "count": 350}
  ]
}
```

## EXIF Scrubbing

### Automatic on Upload

When users submit tips with photos, EXIF data is automatically scrubbed:

```bash
# Public tip submission
curl -X POST http://localhost:8000/api/v1/tips \
  -F "content=Suspicious activity observed" \
  -F "location=Main Street" \
  -F "image=@photo.jpg" \
  -F "legally_required=false"
```

The API will:
1. Extract EXIF data (GPS, camera info, timestamps)
2. Create a cleaned version without EXIF
3. Generate file hashes (MD5, SHA256)
4. Store metadata in the database
5. Optionally keep the original if `legally_required=true`

### Manual Processing

```python
from app.core.media import process_tip_photo

with open('photo.jpg', 'rb') as f:
    result = process_tip_photo(
        file=f,
        filename='photo.jpg',
        legally_required=False,
    )

print(f"Original size: {result['original_size']}")
print(f"Cleaned size: {result['cleaned_size']}")
print(f"Size reduction: {result['size_reduction']} bytes")
print(f"Had EXIF: {result['exif_metadata']['had_exif']}")
print(f"SHA256: {result['cleaned_hashes']['sha256']}")
```

## Role-Based Access Control

### Using Permission Decorators

```python
from fastapi import APIRouter, Depends
from app.core.rbac import require_permission, Permission
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

@router.put("/incidents/{incident_id}")
@require_permission(Permission.INCIDENT_UPDATE)
async def update_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
):
    # Only users with INCIDENT_UPDATE permission can access
    ...
```

### Using Role Decorators

```python
from app.core.rbac import require_role

@router.get("/admin/settings")
@require_role('admin')
async def admin_settings(current_user: User = Depends(get_current_user)):
    # Only admins can access
    ...

@router.post("/alerts/send")
@require_role(['admin', 'moderator'])
async def send_alert(current_user: User = Depends(get_current_user)):
    # Admins and moderators can access
    ...
```

### Checking Permissions Manually

```python
from app.core.rbac import has_permission, Permission

if has_permission(current_user, Permission.ADMIN_AUDIT):
    # User can view audit logs
    pass
```

## Audit Logging

### Automatic Logging

All write operations (POST, PUT, PATCH, DELETE) are automatically logged by the audit middleware.

No code changes required!

### Manual Logging with Before/After

```python
from app.middleware.audit import create_audit_log

# Before update
before_state = {
    'status': incident.status,
    'severity': incident.severity,
}

# Perform update
incident.status = 'investigating'
incident.severity = 'high'

# After update
after_state = {
    'status': incident.status,
    'severity': incident.severity,
}

# Log the change
create_audit_log(
    action='incident_escalated',
    user_id=current_user.id,
    resource_type='incident',
    resource_id=str(incident.id),
    before=before_state,
    after=after_state,
    details={'reason': 'High threat level detected'},
)
```

## Configuration

### Retention Periods

Edit `app/core/retention.py`:

```python
class RetentionConfig:
    TIP_RETENTION_DAYS = 14  # Days before purging tips
    TIP_EXEMPT_STATUSES = ["escalated", "under_investigation"]
    AUDIT_LOG_RETENTION_DAYS = 365  # 1 year
    MEDIA_RETENTION_DAYS = 30
```

Or use environment variables:

```bash
TIP_RETENTION_DAYS=30  # Keep tips for 30 days instead
```

### Scheduler Timing

Edit `app/core/scheduler.py`:

```python
# Change from 2 AM to 3 AM
self.scheduler.add_job(
    run_retention_job,
    trigger=CronTrigger(hour=3, minute=0),  # Changed to 3 AM
    id='retention_job',
    name='Data Retention Cleanup',
)
```

### RBAC Permissions

Edit `app/core/rbac.py`:

```python
# Add new permission
class Permission:
    # ... existing permissions
    CUSTOM_PERMISSION = 'custom:permission'

# Assign to role
ROLE_PERMISSIONS = {
    'moderator': [
        # ... existing permissions
        Permission.CUSTOM_PERMISSION,
    ],
}
```

## Testing

### Run All Tests

```bash
cd apps/api
python -m pytest tests/ -v
```

### Test Specific Components

```bash
# Test retention
python -m pytest tests/test_retention.py -v

# Test EXIF scrubbing
python -m pytest tests/test_media.py -v

# Test RBAC
python -m pytest tests/test_rbac.py -v

# Test admin endpoints
python -m pytest tests/test_admin_endpoints.py -v
```

## Monitoring

### Database Queries

```sql
-- Check purged tips
SELECT COUNT(*) FROM tips 
WHERE metadata->>'purged' = 'true';

-- Recent audit logs
SELECT action, COUNT(*) 
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY action;

-- Top users by activity
SELECT user_id, COUNT(*) as action_count
FROM audit_logs 
WHERE user_id IS NOT NULL
GROUP BY user_id 
ORDER BY action_count DESC 
LIMIT 10;

-- Tips by status
SELECT status, COUNT(*) 
FROM tips 
GROUP BY status;
```

### System Health Check

```bash
curl http://localhost:8000/api/v1/admin/system/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Troubleshooting

### Scheduler Not Starting

**Issue**: Retention job not running

**Solution**:
1. Check logs for errors
2. Verify `ENABLE_RETENTION_SCHEDULER=true` in `.env`
3. Ensure `start_scheduler()` is called in `main.py`

```python
# In app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()  # Should be here
    yield
    stop_scheduler()
```

### EXIF Scrubbing Errors

**Issue**: Image processing fails

**Solution**:
1. Verify Pillow is installed: `pip install pillow`
2. Check image format is supported (JPEG, PNG, WEBP)
3. Verify image file is not corrupted

### Permission Denied Errors

**Issue**: 403 Forbidden on endpoints

**Solution**:
1. Check user role: `SELECT role FROM users WHERE id = YOUR_USER_ID;`
2. Verify permission mapping in `app/core/rbac.py`
3. Ensure decorator is applied correctly

### Audit Logs Growing Too Large

**Issue**: Database size increasing rapidly

**Solution**:
1. Reduce audit log retention period in config
2. Run retention job manually to purge old logs
3. Add more specific exclusions in audit middleware

## Next Steps

1. **Production Setup**: Configure proper storage (S3) for media files
2. **Monitoring**: Set up alerts for retention job failures
3. **Compliance**: Review retention periods with legal team
4. **Performance**: Add indexes if audit log queries are slow
5. **Backups**: Ensure purged data is backed up if needed

## Additional Resources

- Full documentation: `RETENTION_AUDIT_SUMMARY.md`
- API documentation: `http://localhost:8000/docs`
- Retention configuration: `app/core/retention.py`
- RBAC system: `app/core/rbac.py`
- Media processing: `app/core/media.py`

## Support

For issues or questions:
1. Check the comprehensive guide: `RETENTION_AUDIT_SUMMARY.md`
2. Review test files for examples
3. Check API logs for error details

