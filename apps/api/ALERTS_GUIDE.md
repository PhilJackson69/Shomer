# Shomer Alert Service Guide

## Overview

The Alert Service provides a unified interface for sending notifications via multiple channels: SMS, Email, and Push notifications. It supports both production mode (using real providers) and development mode (console output only).

## Features

- **Multi-Channel Support**: SMS (Twilio), Email (SendGrid), Push (stub)
- **Dev Mode**: Print to console in development, no credentials needed
- **Database Tracking**: All alerts stored in database with status
- **Moderator Endpoint**: RESTful API for sending alerts
- **Provider Abstraction**: Easy to swap or add providers
- **Comprehensive Testing**: Fully tested with mocked providers

## Architecture

```
┌─────────────────────────────────────────┐
│         AlertService                    │
│  ┌───────────┬──────────────┬────────┐ │
│  │ SMS       │ Email        │ Push   │ │
│  │ Provider  │ Provider     │ Provider│ │
│  │ (Twilio)  │ (SendGrid)   │ (Stub) │ │
│  └───────────┴──────────────┴────────┘ │
└─────────────────────────────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Alert Model  │
         │  (Database)  │
         └──────────────┘
```

## Installation

### Dependencies

```bash
# Base installation (dev mode only)
pip install -e .

# Production SMS support (Twilio)
pip install -e ".[alerts]"

# Or install individually
pip install twilio sendgrid
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567

# SendGrid (Email)
SENDGRID_API_KEY=your_api_key
```

### Dev Mode

If credentials are not configured, the service automatically runs in dev mode:
- Alerts printed to console
- No actual SMS/email sent
- All alerts still stored in database with `status=sent` or `status=pending`

## Usage

### Programmatic API

#### Send SMS

```python
from app.services.alert_service import AlertService

service = AlertService(db=db_session)

result = await service.send_sms(
    to="+15551234567",
    message="Emergency alert: Incident reported at Main St.",
)

print(f"Success: {result.success}")
print(f"Message: {result.message}")
```

#### Send Email

```python
result = await service.send_email(
    to="user@example.com",
    subject="Security Alert",
    body="An incident has been reported in your area.",
)
```

#### Send Push Notification (Stub)

```python
result = await service.send_push(
    to="device_token_123",
    title="Security Alert",
    body="An incident has been reported.",
)
```

#### Multi-Channel Alert

```python
results = await service.send_multi_channel(
    channels=["sms", "email"],
    recipients={
        "sms": ["+15551234567", "+15559876543"],
        "email": ["user1@example.com", "user2@example.com"],
    },
    title="Critical Incident Alert",
    body="A critical incident has been reported at Main St and 5th Ave.",
    severity="critical",
)

# Check results
for channel, channel_results in results.items():
    for result in channel_results:
        print(f"{channel} to {result.recipient}: {result.success}")
```

### REST API

All endpoints require **moderator or admin** role.

#### Send Alert

**POST** `/api/v1/alerts/send`

Request:
```json
{
  "title": "Critical Incident Alert",
  "body": "A critical incident has been reported at Main St.",
  "severity": "critical",
  "channels": ["sms", "email"],
  "audience_filter": {
    "sms": ["+15551234567", "+15559876543"],
    "email": ["user1@example.com", "user2@example.com"]
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Sent 4 alerts",
  "results": {
    "sms": [
      {
        "success": true,
        "recipient": "+15551234567",
        "message": "SMS sent successfully (SID: SM123456)"
      },
      {
        "success": true,
        "recipient": "+15559876543",
        "message": "SMS sent successfully (SID: SM123457)"
      }
    ],
    "email": [
      {
        "success": true,
        "recipient": "user1@example.com",
        "message": "Email sent successfully (status: 202)"
      },
      {
        "success": true,
        "recipient": "user2@example.com",
        "message": "Email sent successfully (status: 202)"
      }
    ]
  },
  "total_sent": 4,
  "total_failed": 0
}
```

#### List Alerts

**GET** `/api/v1/alerts?page=1&page_size=50&channel=sms&status=sent`

Response:
```json
{
  "alerts": [
    {
      "id": 1,
      "channel": "sms",
      "recipient": "+15551234567",
      "subject": null,
      "message": "Emergency alert...",
      "status": "sent",
      "sent_at": "2025-01-14T12:00:00Z",
      "created_at": "2025-01-14T12:00:00Z",
      "metadata": {
        "severity": "critical",
        "provider_response": {
          "sid": "SM123456"
        }
      }
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 50
}
```

#### Get Alert by ID

**GET** `/api/v1/alerts/{alert_id}`

#### Get Alert Statistics

**GET** `/api/v1/alerts/stats`

Response:
```json
{
  "by_status": {
    "sent": 95,
    "pending": 3,
    "failed": 2
  },
  "by_channel": {
    "sms": 50,
    "email": 45,
    "push": 5
  },
  "total": 100,
  "recent_24h": 25
}
```

## Providers

### SMS Provider (Twilio)

**Configuration:**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+15551234567
```

**Features:**
- E.164 phone number format
- SMS status tracking
- Delivery receipts via webhook (future)

**Limitations:**
- 160 character recommended limit
- International rates vary
- Requires phone number verification in trial mode

### Email Provider (SendGrid)

**Configuration:**
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

**Features:**
- Plain text and HTML support
- Custom from address/name via metadata
- Delivery tracking

**Example with custom from:**
```python
result = await service.send_email(
    to="user@example.com",
    subject="Alert",
    body="Message",
    metadata={
        "from_email": "alerts@yourorg.com",
        "from_name": "Your Org Security"
    }
)
```

### Push Provider (Stub)

Currently a stub implementation. To implement:

1. Choose a provider:
   - Firebase Cloud Messaging (FCM)
   - Apple Push Notification Service (APNS)
   - OneSignal
   - Pusher

2. Update `push_provider.py`:
```python
from firebase_admin import messaging

class FCMPushProvider(AlertProvider):
    async def send(self, to: str, subject: str | None, body: str, 
                   metadata: dict | None = None) -> AlertResult:
        message = messaging.Message(
            notification=messaging.Notification(
                title=subject or "Alert",
                body=body
            ),
            token=to
        )
        response = messaging.send(message)
        return AlertResult(success=True, channel="push", 
                         recipient=to, message=f"Sent: {response}")
```

## Database Schema

### Alert Table

```sql
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    
    -- Channel and recipient
    channel VARCHAR NOT NULL,  -- 'sms', 'email', 'push'
    recipient VARCHAR NOT NULL,
    
    -- Message content
    subject VARCHAR,
    message TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_channel ON alerts(channel);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
```

### Migration

```bash
# Run migration to add new columns
alembic upgrade head
```

## Testing

### Run Tests

```bash
# All alert service tests
pytest tests/test_alert_service.py -v

# Specific test
pytest tests/test_alert_service.py::TestAlertService::test_send_sms_dev_mode -v

# With coverage
pytest tests/test_alert_service.py --cov=app.services
```

### Test Coverage

- ✅ Dev mode SMS sending
- ✅ Dev mode email sending
- ✅ Push notification stub
- ✅ Multi-channel sending
- ✅ Metadata storage
- ✅ Mocked Twilio provider
- ✅ Mocked SendGrid provider
- ✅ Provider failures
- ✅ Partial failures (some channels succeed)
- ✅ Unknown channel handling

### Example Test

```python
@pytest.mark.asyncio
async def test_send_sms_with_mock():
    service = AlertService(dev_mode=False)
    
    # Mock Twilio response
    mock_result = AlertResult(
        success=True,
        channel="sms",
        recipient="+15551234567",
        message="SMS sent",
        provider_response={"sid": "SM123"}
    )
    
    with patch.object(service.sms_provider, 'send', return_value=mock_result):
        result = await service.send_sms(
            to="+15551234567",
            message="Test"
        )
        
        assert result.success is True
        assert result.provider_response["sid"] == "SM123"
```

## Dev Mode Example

```python
service = AlertService(dev_mode=True)

result = await service.send_sms(
    to="+15551234567",
    message="This is a test alert"
)

# Console output:
# ================================================================================
# [DEV MODE] SMS Alert
# ================================================================================
# To: +15551234567
# 
# This is a test alert
# ================================================================================
```

## Best Practices

### 1. Always Use Database Session

```python
# Good
service = AlertService(db=db_session)
result = await service.send_sms(...)

# Bad (alerts won't be stored)
service = AlertService()
result = await service.send_sms(...)
```

### 2. Include Metadata

```python
result = await service.send_sms(
    to="+15551234567",
    message="Alert message",
    metadata={
        "severity": "high",
        "incident_id": 123,
        "sent_by_user_id": 456
    }
)
```

### 3. Handle Failures

```python
result = await service.send_sms(to=phone, message=msg)

if not result.success:
    logger.error(f"Failed to send SMS: {result.error}")
    # Maybe retry or escalate
```

### 4. Use Multi-Channel for Critical Alerts

```python
# Critical alerts should go via multiple channels
if incident.severity == "critical":
    await service.send_multi_channel(
        channels=["sms", "email"],
        recipients={
            "sms": get_oncall_phones(),
            "email": get_oncall_emails()
        },
        title="CRITICAL: Active shooter reported",
        body=incident.description,
        severity="critical"
    )
```

## Integration Examples

### With Incident Creation

```python
# When high-risk incident is created
if incident.severity in ["high", "critical"]:
    alert_service = AlertService(db=db)
    
    # Get moderators and admins
    moderators = db.query(User).filter(
        User.role.in_(["moderator", "admin"])
    ).all()
    
    # Send alerts
    await alert_service.send_multi_channel(
        channels=["sms", "email"],
        recipients={
            "sms": [u.phone for u in moderators if u.phone],
            "email": [u.email for u in moderators]
        },
        title=f"{incident.severity.upper()}: {incident.title}",
        body=incident.description,
        severity=incident.severity,
        metadata={"incident_id": incident.id}
    )
```

### With Tips

```python
# When high-priority tip is received
if tip.priority == "urgent":
    await alert_service.send_sms(
        to=settings.EMERGENCY_PHONE,
        message=f"URGENT TIP: {tip.content[:100]}...",
        metadata={"tip_id": tip.id}
    )
```

## Monitoring

### Query Alert Statistics

```sql
-- Success rate by channel
SELECT 
    channel,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
    ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM alerts
GROUP BY channel;

-- Recent failures
SELECT * FROM alerts
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Alerts by hour
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as count
FROM alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### API Stats Endpoint

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/alerts/stats
```

## Troubleshooting

### SMS Not Sending

1. **Check Twilio credentials:**
   ```bash
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   echo $TWILIO_FROM_NUMBER
   ```

2. **Verify phone numbers are E.164 format:**
   ```
   Good: +15551234567
   Bad: 555-123-4567, (555) 123-4567
   ```

3. **Check Twilio console for errors:**
   - Login to twilio.com
   - Check SMS logs
   - Verify phone number verification (trial accounts)

### Email Not Sending

1. **Check SendGrid API key:**
   ```bash
   echo $SENDGRID_API_KEY
   ```

2. **Verify from address:**
   - Must be verified sender in SendGrid
   - Check spam folder

3. **Check SendGrid activity:**
   - Login to sendgrid.com
   - Check Activity Feed

### Database Errors

1. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

2. **Check database connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM alerts LIMIT 1;"
   ```

## Security Considerations

1. **Credentials**: Never commit credentials to git
2. **Access Control**: Only moderators/admins can send alerts
3. **Rate Limiting**: Consider implementing rate limits
4. **PII**: Phone numbers and emails are sensitive data
5. **Audit Trail**: All alerts logged to database

## Future Enhancements

- [ ] Push notification implementation (FCM/APNS)
- [ ] SMS delivery webhooks
- [ ] Email click tracking
- [ ] Alert templates
- [ ] Scheduled alerts
- [ ] Alert groups/channels
- [ ] Rate limiting
- [ ] Retry logic for failures
- [ ] Batch sending
- [ ] Internationalization (i18n)

## API Reference

See OpenAPI docs at `/docs` for complete API reference.

## Support

For issues or questions:
1. Check this guide
2. Review test cases in `tests/test_alert_service.py`
3. Check provider documentation (Twilio, SendGrid)

