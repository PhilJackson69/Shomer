# Retention Workers & Audit Trails - Implementation Summary

## ✅ Complete Implementation

### Overview
Comprehensive data retention system with EXIF scrubbing, enhanced audit trails with before/after tracking, and role-based access control enforcement.

---

## 1. Data Retention System

### A. Retention Worker (`app/core/retention.py`)

**Features**:
- ✅ Scheduled job for automatic cleanup
- ✅ Configurable retention periods
- ✅ Status-based exemptions
- ✅ Audit logging of all purge operations

**Retention Policies**:
```python
TIP_RETENTION_DAYS = 14  # Configurable via env
TIP_EXEMPT_STATUSES = ["escalated", "under_investigation"]
AUDIT_LOG_RETENTION_DAYS = 365  # 1 year
MEDIA_RETENTION_DAYS = 30
```

**Purge Operations**:
1. **Tip Content Purging**:
   - Redacts content: `[REDACTED - Retention policy applied]`
   - Removes contact information
   - Removes photo references
   - Keeps metadata for audit purposes
   - Preserves tips with exempt statuses

2. **Audit Log Purging**:
   - Removes logs older than 365 days
   - Maintains compliance with data retention laws

3. **Media Cleanup**:
   - Removes orphaned media files
   - Cleans up storage space

**Usage**:
```python
from app.core.retention import run_retention_job

# Run manually
results = run_retention_job()

# Scheduled (automatic)
# Runs daily at 2 AM via APScheduler
```

**Output Example**:
```json
{
  "tips": {
    "tips_purged": 15,
    "cutoff_date": "2025-01-01T00:00:00",
    "retention_days": 14
  },
  "audit_logs": {
    "audit_logs_purged": 250,
    "cutoff_date": "2024-01-14T00:00:00",
    "retention_days": 365
  },
  "media": {
    "media_cleaned": 0
  }
}
```

---

## 2. EXIF Scrubbing & Media Processing

### A. Media Processor (`app/core/media.py`)

**Features**:
- ✅ Automatic EXIF removal on upload
- ✅ File hashing (MD5, SHA256)
- ✅ Original file preservation (if legally required)
- ✅ Metadata extraction and logging

**EXIF Scrubbing**:
```python
from app.core.media import process_tip_photo

# Process uploaded photo
result = process_tip_photo(
    file=uploaded_file,
    filename="photo.jpg",
    legally_required=False  # Set True to keep original
)

# Result contains:
# - cleaned_bytes: EXIF-stripped image
# - original_bytes: Original (if legally_required=True)
# - cleaned_hashes: File hashes
# - exif_metadata: Extracted EXIF data
```

**Processing Steps**:
1. Extract EXIF data (GPS, camera info, timestamps)
2. Create new image without EXIF
3. Convert to RGB (if needed)
4. Optimize and compress
5. Generate file hashes (MD5, SHA256)
6. Store metadata for audit

**Metadata Captured**:
```json
{
  "original_format": "JPEG",
  "size": [1920, 1080],
  "mode": "RGB",
  "had_exif": true,
  "exif_tags_count": 25,
  "exif_summary": {
    "make": "Apple",
    "model": "iPhone 12",
    "datetime": "2025:01:14 12:00:00",
    "gps": "present"
  }
}
```

**File Hashing**:
```json
{
  "original_hashes": {
    "md5": "abc123...",
    "sha256": "def456...",
    "size": 2048576
  },
  "cleaned_hashes": {
    "md5": "ghi789...",
    "sha256": "jkl012...",
    "size": 1536432
  }
}
```

**Storage Options**:
1. **Default**: Store only cleaned version
2. **Legally Required**: Store both original and cleaned
   - Use when evidence chain of custody needed
   - Configured per-upload with flag

---

## 3. Role-Based Access Control (RBAC)

### A. RBAC System (`app/core/rbac.py`)

**Permission Model**:
```python
# Permissions defined
TIP_CREATE, TIP_READ, TIP_UPDATE, TIP_DELETE
INCIDENT_CREATE, INCIDENT_READ, INCIDENT_UPDATE, INCIDENT_DELETE
ALERT_CREATE, ALERT_READ, ALERT_SEND
ADMIN_USERS, ADMIN_SETTINGS, ADMIN_AUDIT, ADMIN_INGESTION
SYSTEM_ALL  # Admin wildcard
```

**Role Mapping**:
```python
ROLE_PERMISSIONS = {
    'user': [
        'tip:create',
        'tip:read',
        'incident:read',
    ],
    'moderator': [
        'tip:create', 'tip:read', 'tip:update',
        'incident:create', 'incident:read', 'incident:update',
        'alert:create', 'alert:read', 'alert:send',
    ],
    'admin': [
        'system:all',  # All permissions
    ],
}
```

**Usage with Decorators**:
```python
from app.core.rbac import require_permission, require_role, Permission

# Require specific permission
@require_permission(Permission.INCIDENT_UPDATE)
async def update_incident(..., current_user: User = Depends(...)):
    ...

# Require specific role(s)
@require_role('admin')
async def admin_only(..., current_user: User = Depends(...)):
    ...

@require_role(['admin', 'moderator'])
async def moderator_or_admin(..., current_user: User = Depends(...)):
    ...
```

**Permission Checking**:
```python
from app.core.rbac import has_permission

if has_permission(user, Permission.ADMIN_AUDIT):
    # User can access audit logs
    pass
```

---

## 4. Enhanced Audit Logging

### A. Audit Middleware (`app/middleware/audit.py`)

**Features**:
- ✅ Automatic logging of all write operations
- ✅ Before/after state tracking
- ✅ Change detection and summary
- ✅ Request metadata capture
- ✅ Performance tracking

**What Gets Logged**:
```python
WRITE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Captured data:
- User ID
- Action (create/update/delete)
- Resource type and ID
- Request body (before state)
- Response status
- Duration (ms)
- IP address
- User agent
- Changes (field-by-field diff)
```

**Example Audit Log Entry**:
```json
{
  "id": 12345,
  "action": "incident_updated",
  "user_id": 42,
  "resource_type": "incident",
  "resource_id": "789",
  "details": {
    "method": "PUT",
    "path": "/api/v1/incidents/789",
    "status_code": 200,
    "duration_ms": 45.23,
    "ip_address": "192.168.1.1",
    "before": {
      "status": "new",
      "severity": "medium"
    },
    "after": {
      "status": "investigating",
      "severity": "high"
    },
    "changes": {
      "status": {
        "from": "new",
        "to": "investigating"
      },
      "severity": {
        "from": "medium",
        "to": "high"
      }
    }
  },
  "created_at": "2025-01-14T12:00:00Z"
}
```

**Manual Audit Logging**:
```python
from app.middleware.audit import create_audit_log

# Log custom action
create_audit_log(
    action='incident_escalated',
    user_id=user.id,
    resource_type='incident',
    resource_id=str(incident.id),
    before={'status': 'new'},
    after={'status': 'escalated'},
    details={'reason': 'High threat level'},
)
```

---

## 5. Admin Endpoints

### A. Audit Log Endpoints (`app/api/v1/endpoints/admin.py`)

#### `GET /api/v1/admin/audit-logs`

**Purpose**: View audit logs with filtering and pagination

**Parameters**:
- `page`: Page number (default: 1)
- `page_size`: Items per page (max: 100)
- `action`: Filter by action
- `resource_type`: Filter by resource type
- `user_id`: Filter by user
- `start_date`: Filter by date range (start)
- `end_date`: Filter by date range (end)

**Response**:
```json
{
  "items": [
    {
      "id": 12345,
      "action": "incident_updated",
      "user_id": 42,
      "resource_type": "incident",
      "resource_id": "789",
      "details": {...},
      "created_at": "2025-01-14T12:00:00Z"
    }
  ],
  "total": 1500,
  "page": 1,
  "page_size": 50,
  "total_pages": 30
}
```

#### `GET /api/v1/admin/audit-logs/stats`

**Purpose**: Get audit log statistics

**Response**:
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

#### `GET /api/v1/admin/audit-logs/{log_id}`

**Purpose**: Get specific audit log entry

**Response**: Single audit log object with full details

#### `POST /api/v1/admin/retention/run`

**Purpose**: Manually trigger retention job

**Response**:
```json
{
  "success": true,
  "message": "Retention job completed",
  "results": {
    "tips": {...},
    "audit_logs": {...},
    "media": {...}
  }
}
```

#### `GET /api/v1/admin/retention/config`

**Purpose**: Get retention configuration

**Response**:
```json
{
  "tip_retention_days": 14,
  "tip_exempt_statuses": ["escalated", "under_investigation"],
  "audit_log_retention_days": 365,
  "media_retention_days": 30
}
```

#### `GET /api/v1/admin/system/health`

**Purpose**: Get system health metrics

**Response**:
```json
{
  "status": "healthy",
  "database": {
    "incidents": 1500,
    "tips": 3000,
    "alerts": 500,
    "audit_logs": 15000
  },
  "recent_24h": {
    "incidents": 50,
    "tips": 100
  },
  "timestamp": "2025-01-14T12:00:00Z"
}
```

---

## 6. Scheduled Jobs

### A. Application Scheduler (`app/core/scheduler.py`)

**Scheduler Configuration**:
```python
from app.core.scheduler import start_scheduler, stop_scheduler

# Start scheduler (in main.py)
start_scheduler()

# Scheduled jobs:
# 1. Retention job - Daily at 2 AM
#    - Purges old tips
#    - Cleans audit logs
#    - Removes orphaned media
```

**Job Schedule**:
| Job | Trigger | Description |
|-----|---------|-------------|
| retention_job | Daily at 2 AM | Data retention cleanup |
| (Future) health_check | Hourly | System health monitoring |

**Manual Trigger**:
```python
from app.core.scheduler import get_scheduler

scheduler = get_scheduler()
scheduler.run_job_now('retention_job')  # Run immediately
```

---

## 7. Configuration

### Environment Variables

Add to `.env`:

```bash
# Retention configuration
TIP_RETENTION_DAYS=14

# Enable/disable scheduler
ENABLE_RETENTION_SCHEDULER=true
```

### Code Configuration

**RetentionConfig** (`app/core/retention.py`):
```python
class RetentionConfig:
    TIP_RETENTION_DAYS = 14
    TIP_EXEMPT_STATUSES = ["escalated", "under_investigation"]
    AUDIT_LOG_RETENTION_DAYS = 365
    MEDIA_RETENTION_DAYS = 30
```

---

## 8. Database Changes

### Audit Log Enhancements

**Existing Schema**:
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR NOT NULL,
    user_id INTEGER REFERENCES users(id),
    resource_type VARCHAR NOT NULL,
    resource_id VARCHAR,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

**Details JSONB Structure**:
```json
{
  "method": "PUT",
  "path": "/api/v1/incidents/789",
  "status_code": 200,
  "duration_ms": 45.23,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "before": {...},
  "after": {...},
  "changes": {...}
}
```

---

## 9. Testing

### Manual Testing

```bash
# Test retention job
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# View audit logs
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1&page_size=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get audit stats
curl http://localhost:8000/api/v1/admin/audit-logs/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test EXIF scrubbing
python -c "
from app.core.media import process_tip_photo
result = process_tip_photo(open('test.jpg', 'rb'), 'test.jpg')
print(result['exif_metadata'])
"
```

### Unit Tests

**Test Retention**:
```python
def test_purge_old_tips(db_session):
    # Create old tip
    tip = Tip(content="Test", created_at=datetime.now() - timedelta(days=20))
    db_session.add(tip)
    db_session.commit()
    
    # Run retention
    worker = RetentionWorker(db_session)
    result = worker.purge_old_tips()
    
    # Verify purged
    assert result['tips_purged'] > 0
    db_session.refresh(tip)
    assert tip.content == "[REDACTED - Retention policy applied]"
```

**Test EXIF Scrubbing**:
```python
def test_exif_removal():
    processor = MediaProcessor()
    
    # Load image with EXIF
    with open('test_with_exif.jpg', 'rb') as f:
        cleaned, metadata = processor.scrub_exif(f)
    
    assert metadata['had_exif'] is True
    assert len(cleaned) > 0
    
    # Verify EXIF removed
    cleaned_image = Image.open(io.BytesIO(cleaned))
    assert cleaned_image._getexif() is None
```

**Test RBAC**:
```python
def test_permission_check():
    user = User(role='moderator')
    
    assert has_permission(user, Permission.INCIDENT_UPDATE) is True
    assert has_permission(user, Permission.ADMIN_AUDIT) is False
```

---

## 10. Security Considerations

### Implemented

✅ **Data Minimization**: Automatic purging of old data  
✅ **EXIF Removal**: Prevents location tracking  
✅ **File Hashing**: Detects duplicates and tampering  
✅ **Audit Trail**: Complete history of all changes  
✅ **RBAC**: Granular access control  
✅ **Before/After Tracking**: Change accountability  

### Best Practices

1. **Retention Compliance**: Configure retention periods per local laws
2. **Legal Holds**: Use exempt statuses for active investigations
3. **Original Preservation**: Use `legally_required=True` only when needed
4. **Audit Review**: Regularly review audit logs for anomalies
5. **Access Control**: Strict RBAC enforcement on all endpoints
6. **Hash Verification**: Use SHA256 for file integrity checks

---

## 11. Monitoring

### Metrics to Track

1. **Retention Jobs**:
   - Tips purged per run
   - Audit logs purged per run
   - Job execution time
   - Errors/failures

2. **Audit Logs**:
   - Total log count
   - Growth rate
   - Top actions
   - Top users

3. **Media Processing**:
   - Files processed
   - EXIF removal rate
   - Storage saved
   - Duplicate detections

### Queries

```sql
-- Check purged tips
SELECT COUNT(*) FROM tips 
WHERE metadata->>'purged' = 'true';

-- Audit log growth
SELECT DATE(created_at), COUNT(*) 
FROM audit_logs 
GROUP BY DATE(created_at) 
ORDER BY DATE(created_at) DESC 
LIMIT 30;

-- Top actions
SELECT action, COUNT(*) 
FROM audit_logs 
GROUP BY action 
ORDER BY COUNT(*) DESC;
```

---

## 12. Quick Start

### 1. Enable Retention System

```bash
cd apps/api

# Install dependencies (already in base)
pip install pillow

# Configure retention
echo "TIP_RETENTION_DAYS=14" >> .env

# Run migrations (if needed)
alembic upgrade head

# Start API (scheduler auto-starts)
python run.py
```

### 2. Test Retention Job

```bash
# Manual trigger via API
curl -X POST http://localhost:8000/api/v1/admin/retention/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Or via Python
python -c "from app.core.retention import run_retention_job; print(run_retention_job())"
```

### 3. View Audit Logs

```bash
# Via API
curl "http://localhost:8000/api/v1/admin/audit-logs?page=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Via database
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## Status

**✅ ALL FEATURES COMPLETE AND PRODUCTION-READY**

### Implemented

1. ✅ Scheduled retention job (APScheduler)
2. ✅ Tip purging (14 days configurable, exempt statuses)
3. ✅ EXIF scrubbing on upload
4. ✅ File hashing (MD5, SHA256)
5. ✅ Original preservation (legal flag)
6. ✅ RBAC enforcement (decorators)
7. ✅ Audit logging (before/after)
8. ✅ Admin audit log endpoint (filters, pagination)
9. ✅ Retention config endpoint
10. ✅ System health endpoint

### Files Created

- `app/core/retention.py` - Retention worker
- `app/core/media.py` - EXIF scrubbing & hashing
- `app/core/rbac.py` - Role-based access control
- `app/core/scheduler.py` - APScheduler setup
- `app/middleware/audit.py` - Enhanced audit middleware
- `app/api/v1/endpoints/admin.py` - Admin endpoints

### Documentation

- `RETENTION_AUDIT_SUMMARY.md` - This comprehensive guide

---

For integration examples and advanced usage, see individual module docstrings.

