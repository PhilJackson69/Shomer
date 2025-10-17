# Shomer Platform Demo Guide

> **Complete step-by-step walkthrough of the Shomer platform features**

This guide will walk you through a complete demonstration of the Shomer platform, showcasing key features for community safety and security management.

## Prerequisites

Before starting the demo, ensure:

- ✅ Docker and Docker Compose are installed
- ✅ Shomer services are running
- ✅ Demo data has been seeded

## Quick Setup

```bash
# 1. Start all services
cd infra
docker compose up -d

# 2. Wait for services to be ready (about 30 seconds)
docker compose logs -f api  # Watch for "Application startup complete"

# 3. Seed demo data
docker compose exec api python demo_seed.py

# 4. Access the web interface
# Open: http://localhost:3000
```

## Demo Credentials

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Admin** | admin@shomer.local | admin123 | Full access |
| **Moderator** | moderator@shomer.local | mod123 | Triage & alerts |
| **User** | user@shomer.local | user123 | View only |

---

## Part 1: Dashboard Overview (5 minutes)

### Step 1.1: Login

1. Navigate to `http://localhost:3000`
2. Click **Login**
3. Enter credentials:
   - Email: `moderator@shomer.local`
   - Password: `mod123`
4. Click **Sign In**

**What you'll see:**
- Dashboard with incident summary
- Quick stats (total incidents, critical alerts, recent tips)
- Recent activity feed

### Step 1.2: Explore Dashboard

Navigate through the main sections:

- **Incidents** - Security incident tracking
- **Tips** - Community-submitted reports
- **Alerts** - Notification management
- **Events** - Event safety planning
- **Settings** - System configuration

---

## Part 2: Incident Triage Workflow (10 minutes)

### Step 2.1: View Incidents

1. Click **Incidents** in left navigation
2. Observe the incident list with:
   - **Color-coded severity** (Critical=red, High=orange, Medium=yellow)
   - **Status badges** (New, Investigating, Resolved)
   - **Risk scores** (0-100)
   - **Timestamps**

**Sample Incidents**:
- 🔴 Critical: "Graffiti with Threatening Message" (Score: 95)
- 🟠 High: "Suspicious Activity Near Community Center" (Score: 85)
- 🟡 Medium: "Online Harassment Campaign" (Score: 65)

### Step 2.2: Filter Incidents

Try the filtering options:

1. **By Severity**:
   - Click severity dropdown
   - Select "Critical"
   - View only critical incidents

2. **By Status**:
   - Click status dropdown
   - Select "New"
   - View unprocessed incidents

3. **By Date Range**:
   - Set "Last 24 hours"
   - View recent incidents only

4. **By Keyword**:
   - Search for "graffiti"
   - See matching incidents

### Step 2.3: Investigate an Incident

1. Click on **"Suspicious Activity Near Community Center"**
2. Review the detail drawer showing:
   - Full description
   - Risk factors analysis
   - Source link (if available)
   - Location information
   - Timeline

**Risk Factors Displayed**:
```
✓ Pattern recognition (repeated sightings)
✓ Location sensitivity (community center)
✓ Time of day (after hours)
Risk Score: 85/100
```

### Step 2.4: Update Incident Status

From the incident detail view:

1. Click **Actions** dropdown
2. Select **"Mark as Investigating"**
3. Add optional note: "Security team dispatched to review camera footage"
4. Click **Confirm**

**What happens**:
- Status changes from "New" → "Investigating"
- Audit log entry created
- Timeline updated
- Status badge color changes

### Step 2.5: Escalate High-Priority Incident

1. Open the **"Graffiti with Threatening Message"** incident
2. Note the Critical severity and 95 risk score
3. Click **Actions** → **"Escalate"**
4. In the escalation dialog:
   - Add note: "Forwarding to law enforcement. Preserving evidence."
   - Check "Notify security team"
5. Click **Escalate Incident**

**What happens**:
- Status changes to "Escalated"
- Notification queued (if configured)
- Higher priority in dashboard
- Red highlight indicator

---

## Part 3: Community Tips Review (8 minutes)

### Step 3.1: View Tips

1. Click **Tips** in left navigation
2. See 3 submitted tips with:
   - Submission timestamp
   - Location
   - Status (New, Escalated, Under Investigation)
   - Photo indicator (if present)

### Step 3.2: Review Tip Details

1. Click on **"Saw someone taking photos..."** tip
2. Detail drawer shows:
   - Full tip content
   - Submitter contact (if provided)
   - Location
   - Photo preview (placeholder)
   - EXIF metadata status

**EXIF Processing Info**:
```
✓ EXIF data scrubbed
✓ File hash generated: abc123placeholder
✓ GPS coordinates removed
Original preserved: No
```

### Step 3.3: Convert Tip to Incident

For high-value tips that require tracking:

1. Open tip: **"Found antisemitic flyers..."**
2. Click **"Convert to Incident"** button
3. In the conversion dialog:
   - Title: Auto-filled from tip content
   - Severity: Select **"High"**
   - Initial status: **"New"**
   - Copy location from tip
4. Click **Create Incident**

**What happens**:
- New incident created from tip content
- Tip status updated to "Escalated"
- Photo evidence linked to incident
- Audit trail preserved

### Step 3.4: Mark Tip as Reviewed

1. Open tip: **"Noticed the same unmarked white van..."**
2. Note it's already marked "Under Investigation"
3. Click **Actions** → **"Add Note"**
4. Enter: "Shared with local police. Case #12345"
5. Click **Save**

---

## Part 4: Send Test Alert (7 minutes)

### Step 4.1: Navigate to Alerts

1. Click **Alerts** in left navigation
2. View sent alert history:
   - Email alerts to security-team@example.com
   - SMS alerts to phone numbers
   - Status (Sent, Pending, Failed)

### Step 4.2: Compose New Alert

1. Click **"Compose Alert"** button
2. Alert composer opens with:
   - Severity presets
   - Channel selection (SMS/Email)
   - Template options
   - Recipient management

### Step 4.3: Send Test Email Alert

Configure the alert:

1. **Severity**: Select **"High"**
   - Auto-fills with high-priority template
   
2. **Subject**: "Security Incident Requires Attention"

3. **Message**:
   ```
   A high-priority security incident has been reported 
   and requires immediate review.
   
   Incident: Suspicious Activity Near Community Center
   Risk Score: 85/100
   Status: Investigating
   
   Please review the incident in the Shomer dashboard.
   ```

4. **Channels**: Check **Email**

5. **Recipients**: 
   - Option 1: **"Test send to self"** (recommended)
   - Option 2: Enter: `security-team@example.com`

6. Click **"Send Test Alert"**

**What happens**:
- Alert sent via configured email service
- Alert record created in database
- Audit log entry generated
- Success notification displayed

**Dev Mode Note**: 
> In development, the alert payload is logged to console instead of actually sending. Check API logs to see the alert details.

### Step 4.4: Send SMS Alert (Optional)

If SMS is configured:

1. Click **"Compose Alert"** again
2. **Severity**: Select **"Critical"**
3. **Message**: Keep it short (160 chars)
   ```
   URGENT: Critical incident reported. Review dashboard immediately.
   ```
4. **Channels**: Check **SMS**
5. **Recipients**: Enter test number: `+1-555-0199`
6. Click **"Send Alert"**

### Step 4.5: Review Alert History

1. Return to Alerts list
2. See your newly sent alert
3. Click on alert to view:
   - Full message content
   - Delivery status
   - Timestamp
   - Recipient information
   - Associated incident (if linked)

---

## Part 5: Review Audit Logs (6 minutes)

### Step 5.1: Access Audit Logs (Admin Only)

1. **Logout** from moderator account
2. **Login** as admin:
   - Email: `admin@shomer.local`
   - Password: `admin123`
3. Click **Settings** → **Audit Logs**

**Why Admin Only?**
> Audit logs contain sensitive system activity. Only admins should access the complete audit trail for compliance and security review.

### Step 5.2: Browse Audit Logs

The audit log shows:

- **Action**: Type of activity (incident_created, alert_sent, etc.)
- **User**: Who performed the action
- **Resource**: What was affected
- **Timestamp**: When it occurred
- **Details**: Before/after states and changes

**Sample Entries**:
```
[2 hours ago] moderator@shomer.local
  Action: incident_updated
  Resource: Incident #1
  Changes: status: new → investigating

[5 hours ago] moderator@shomer.local
  Action: alert_sent
  Resource: Alert #1
  Details: email to security-team@example.com

[6 hours ago] (Public)
  Action: tip_created
  Resource: Tip #1
  Details: has_image=true, location=Main Entrance
```

### Step 5.3: Filter Audit Logs

Try different filters:

1. **By Action**:
   - Select "incident_updated"
   - View only incident status changes

2. **By User**:
   - Select "moderator@shomer.local"
   - View all moderator actions

3. **By Date Range**:
   - Last 24 hours
   - Last 7 days
   - Custom range

4. **By Resource Type**:
   - Select "incident"
   - View incident-related changes only

### Step 5.4: Examine Change Details

1. Click on an **"incident_updated"** log entry
2. View detailed change tracking:

```json
{
  "before": {
    "status": "new",
    "severity": "high"
  },
  "after": {
    "status": "investigating",
    "severity": "high"
  },
  "changes": {
    "status": {
      "from": "new",
      "to": "investigating"
    }
  }
}
```

### Step 5.5: Export Audit Logs (Optional)

For compliance reporting:

1. Set desired filters
2. Click **"Export"** button
3. Choose format: CSV or JSON
4. Download audit log export

**Use Cases**:
- Compliance audits
- Security reviews
- Incident investigations
- Trend analysis

---

## Part 6: Event Safety Planning (8 minutes)

### Step 6.1: View Event

1. Click **Events** in left navigation
2. See the demo event: **"Annual Community Gathering"**
3. Event card shows:
   - Date: 14 days from now
   - Expected attendance: 500+
   - Risk level: Medium
   - Location: Central Park Pavilion

### Step 6.2: Review Event Details

Click on the event to view:

1. **Event Information**:
   - Full description
   - Start/end times
   - Venue details
   - Expected attendance

2. **Venue Details**:
   ```
   Capacity: 750 people
   Indoor portion: No (outdoor)
   Parking spaces: 200
   Accessible: Yes
   ```

### Step 6.3: Run Risk Advisor

The event already has risk analysis, but you can update it:

1. Click **"Update Risk Assessment"** button
2. Risk Advisor form shows:
   - Attendance size
   - Event type (gathering, service, education, etc.)
   - Time of day
   - Location type
   - Special considerations

3. Review calculated **Risk Score: 62/100**

**Risk Factors Identified**:
```
⚠️ Large attendance (500+)
⚠️ Outdoor venue
⚠️ Children present
⚠️ Evening component
⚠️ Multiple entry points
```

### Step 6.4: Review Security Recommendations

The system provides 7 detailed recommendations:

#### 🔴 **High Priority**

1. **Security Personnel**
   ```
   Deploy 8-10 security personnel throughout event.
   Position at entrances, parking areas, and children's zones.
   
   Rationale: Large attendance requires visible security 
   presence to deter incidents and respond quickly.
   ```

2. **Access Control**
   ```
   Implement bag check stations at all entry points.
   Use metal detector wands for random screening.
   
   Rationale: Outdoor events are vulnerable to weapons 
   and prohibited items being brought in.
   ```

3. **Medical Preparedness**
   ```
   Coordinate with local EMS. Have first aid station 
   staffed throughout event. Keep evacuation routes clear.
   
   Rationale: Large gathering requires medical readiness.
   Children's activities increase likelihood of minor injuries.
   ```

#### 🟡 **Medium Priority**

4. **Communication**
   - Radio network for security team
   - Designated emergency contact

5. **Perimeter Security**
   - Barrier fencing to define perimeter
   - Limit entry/exit points to 2-3 locations

6. **Weather Monitoring**
   - Monitor forecasts closely
   - Indoor backup plan ready

#### 🟢 **Low Priority**

7. **Parking Security**
   - Security volunteer in parking area
   - Temporary lighting for evening

### Step 6.5: Save Security Plan

1. Review all recommendations
2. Click **"Save as Draft Plan"** button
3. Plan saved with:
   - All recommendations
   - Risk assessment
   - Resource requirements
   - Implementation checklist

### Step 6.6: Export Event Plan

For distribution to security team:

1. Click **"Export Plan"** button
2. Choose format: PDF or Word
3. Download complete security plan including:
   - Event overview
   - Risk assessment
   - Detailed recommendations
   - Resource allocation
   - Emergency contacts
   - Evacuation procedures

---

## Part 7: System Administration (5 minutes)

### Step 7.1: User Management

1. Go to **Settings** → **Users**
2. View all user accounts:
   - Admin users (full access)
   - Moderators (triage & alerts)
   - Users (view only)

3. **Add New User** (optional):
   - Click "Add User"
   - Email: `newmod@example.com`
   - Role: Moderator
   - Send invitation email

### Step 7.2: Feed Management

1. Go to **Settings** → **Feeds**
2. View configured data sources:
   - RSS feeds (news, alerts)
   - Reddit monitors (configured subreddits)
   - Web scrapers (allow-listed sites)

3. **Toggle Feeds**:
   - Enable/disable individual feeds
   - View last sync time
   - Check error status

### Step 7.3: Retention Settings

1. Go to **Settings** → **Data Retention**
2. View retention policies:
   - **Tips**: 14 days (configurable)
   - **Audit Logs**: 365 days
   - **Media**: 30 days

3. **Exempt Statuses**:
   - Escalated tips (preserved)
   - Under investigation (preserved)

4. **Manual Trigger**:
   - Click "Run Retention Job Now"
   - View purge statistics

### Step 7.4: System Health

1. Go to **Settings** → **System Health**
2. View metrics:
   ```
   Database:
     Incidents: 8
     Tips: 3
     Alerts: 3
     Audit Logs: 15+
   
   Recent Activity (24h):
     Incidents created: 8
     Tips submitted: 3
   
   Status: ✅ Healthy
   ```

---

## Part 8: Advanced Features (Optional)

### NLP Risk Scoring

When creating or updating incidents, the system automatically:

1. **Analyzes text content** for:
   - Threat keywords
   - Hate speech patterns
   - Weapon mentions
   - Violence indicators

2. **Calculates risk score** based on:
   - Content analysis
   - Time of day
   - Location proximity
   - Historical patterns

3. **Generates risk factors**:
   - Pattern recognition
   - Location sensitivity
   - Time criticality

### EXIF Scrubbing

All uploaded photos are automatically processed:

1. **EXIF data removed**:
   - GPS coordinates
   - Camera make/model
   - Timestamps
   - Device information

2. **File hashing**:
   - MD5 and SHA256 hashes generated
   - Duplicate detection enabled
   - Integrity verification

3. **Optional original preservation**:
   - Legal flag for evidence chain
   - Separate secure storage
   - Audit trail maintained

### Automated Ingestion

Background workers continuously:

1. **Monitor RSS feeds**:
   - News sources
   - Alert services
   - Community boards

2. **Process content**:
   - NLP risk scoring
   - Auto-categorization
   - Duplicate detection

3. **Create incidents**:
   - High-risk content auto-flagged
   - Moderator review queue
   - Source attribution

---

## Demo Scenarios

### Scenario A: High-Threat Response

**Situation**: Critical graffiti incident discovered

1. Login as moderator
2. Find "Graffiti with Threatening Message" (Critical)
3. Review risk score: 95/100
4. Update status to "Escalated"
5. Send critical alert to security team
6. Document in notes: "Police report filed #12345"
7. Attach photos as evidence
8. Monitor for related incidents

**Timeline**: ~10 minutes  
**Outcome**: Documented, escalated, team notified

### Scenario B: Proactive Event Security

**Situation**: Planning upcoming large gathering

1. Login as admin
2. Open "Annual Community Gathering" event
3. Run risk advisor
4. Review 7 security recommendations
5. Export security plan
6. Share with security team
7. Implement high-priority items
8. Schedule security personnel

**Timeline**: ~15 minutes  
**Outcome**: Comprehensive security plan ready

### Scenario C: Community Tip Follow-up

**Situation**: Suspicious vehicle report

1. Login as moderator
2. Review tip about white van
3. Note it's under investigation
4. Check for similar reports (search function)
5. Convert to incident for tracking
6. Assign to security team member
7. Request license plate verification
8. Set follow-up reminder

**Timeline**: ~8 minutes  
**Outcome**: Tip properly triaged and tracked

---

## Troubleshooting

### Cannot Login

**Issue**: Invalid credentials

**Solution**:
```bash
# Reset demo data
docker compose exec api python demo_seed.py

# Credentials:
# moderator@shomer.local / mod123
# admin@shomer.local / admin123
```

### No Demo Data Visible

**Issue**: Database is empty

**Solution**:
```bash
# Run demo seed script
docker compose exec api python demo_seed.py
```

### Services Not Running

**Issue**: Docker containers stopped

**Solution**:
```bash
cd infra
docker compose up -d
docker compose ps  # Check status
```

### API Not Responding

**Issue**: API container crashed

**Solution**:
```bash
# Check logs
docker compose logs api

# Restart API
docker compose restart api
```

---

## Next Steps

After completing the demo:

1. **Explore API Documentation**:
   - Visit: http://localhost:8000/docs
   - Try interactive API endpoints
   - Review request/response schemas

2. **Customize Configuration**:
   - Edit `.env` file
   - Configure alert services (Twilio, SendGrid)
   - Add RSS feeds for ingestion

3. **Production Deployment**:
   - Review `infra/README.md`
   - Set strong secrets
   - Configure S3 storage
   - Set up SSL/TLS

4. **Integration**:
   - Connect to existing systems
   - Set up SSO authentication
   - Configure webhooks
   - Enable monitoring

---

## Feedback & Support

**Documentation**: `/docs` directory  
**API Docs**: http://localhost:8000/docs  
**Issues**: GitHub Issues  
**Email**: support@shomer.local

---

**Demo Version**: 1.0.0  
**Last Updated**: 2025-01-14

