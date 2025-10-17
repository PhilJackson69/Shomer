# Zero-Code Pilot Pack

> **Launch a community safety monitoring system in 24 hours using free tools**

This guide provides everything you need to start monitoring community safety using no-code tools like Google Forms, Slack, Google Sheets, and Zapier - no programming required!

**Perfect for:**
- Testing the Shomer concept before full deployment
- Small communities with limited technical resources
- Pilot programs and proof-of-concepts
- Volunteer-run safety initiatives

**Time to Setup:** 2-4 hours  
**Monthly Cost:** $0-$20 (Zapier free tier is sufficient for pilots)

---

## Table of Contents

1. [Google Alerts & RSS Monitoring](#1-google-alerts--rss-monitoring)
2. [Tip Submission Form](#2-tip-submission-form)
3. [SMS Alert Templates](#3-sms-alert-templates)
4. [Volunteer Coordination Spreadsheet](#4-volunteer-coordination-spreadsheet)
5. [Moderator Training Checklist](#5-moderator-training-checklist)
6. [Quick Start Guide](#quick-start-guide)

---

## 1. Google Alerts & RSS Monitoring

### Keywords List for Community Safety Monitoring

Use these keywords to set up Google Alerts for your community. Replace `[COMMUNITY]` with your community name, location, or organization.

#### 🔴 **Critical Keywords (Immediate Alert)**

Copy and paste into Google Alerts:

```
"[COMMUNITY]" AND (threat OR attack OR vandalism OR graffiti)
"[COMMUNITY]" AND (antisemitic OR hate crime OR harassment)
"[COMMUNITY]" AND (suspicious package OR bomb threat)
"[COMMUNITY]" AND (security incident OR emergency)
"[COMMUNITY]" synagogue AND (threat OR security OR incident)
```

#### 🟡 **Medium Priority Keywords (Daily Digest)**

```
"[COMMUNITY]" AND (safety concern OR security concern)
"[COMMUNITY]" AND (police report OR incident report)
"[COMMUNITY]" AND (community watch OR neighborhood watch)
"[COMMUNITY]" AND (security alert OR safety alert)
local news "[COMMUNITY]" crime
```

#### 🟢 **Monitoring Keywords (Weekly Digest)**

```
"[COMMUNITY]" AND (event security OR event safety)
"[COMMUNITY]" AND (security tips OR safety tips)
"[COMMUNITY]" AND (crime statistics OR safety report)
community meeting "[COMMUNITY]" safety
```

### Step-by-Step: Google Alerts Setup

1. **Go to Google Alerts**: https://www.google.com/alerts

2. **For each keyword above**:
   - Paste the keyword into the search box
   - Click "Show options"
   - Configure settings:
     - **How often**: As-it-happens (Critical), At most once a day (Medium), At most once a week (Low)
     - **Sources**: News, Blogs
     - **Language**: English (or your language)
     - **Region**: Your country/region
     - **How many**: All results
     - **Deliver to**: Create RSS feed

3. **Copy RSS feed URLs** (you'll need these for Slack integration)

### RSS to Slack Integration

**Option 1: Using Slack RSS App (Free)**

1. **Add RSS App to Slack**:
   - Go to your Slack workspace
   - Click "Add apps" → Search for "RSS"
   - Install the RSS app

2. **Create dedicated channels**:
   ```
   #security-alerts-critical
   #security-alerts-medium
   #security-monitoring
   ```

3. **Subscribe to RSS feeds**:
   - In each channel, type: `/feed subscribe [RSS_FEED_URL]`
   - Example: `/feed subscribe https://www.google.com/alerts/feeds/...`

4. **Configure notifications**:
   - Critical channel: @channel mentions
   - Medium channel: Regular notifications
   - Monitoring channel: Muted by default

**Option 2: Using Zapier (More Control)**

1. **Create a Zap**: https://zapier.com/app/zaps

2. **Trigger**: RSS by Zapier
   - Feed URL: Your Google Alert RSS feed
   - Trigger: New Item in Feed

3. **Action**: Slack - Send Channel Message
   - Channel: #security-alerts-critical
   - Message template:
   ```
   🚨 *New Security Alert*
   
   *Title:* {{title}}
   *Source:* {{link}}
   *Snippet:* {{description}}
   
   _Published: {{published}}_
   ```

4. **Test and turn on**

### RSS Feeds to Monitor (Besides Google Alerts)

Add these RSS feeds to your monitoring:

| Feed | URL Pattern | Priority |
|------|-------------|----------|
| Local Police Blotter | `[city].gov/police/rss` | High |
| Local News Crime Section | `[newspaper].com/crime/rss` | Medium |
| ADL Security Advisories | `adl.org/news/rss` | Medium |
| FBI Public Alerts | `fbi.gov/feeds/alerts` | High |
| Community Board | Your local board RSS | Low |

---

## 2. Tip Submission Form

### Google Form Template

Create a Google Form with these exact fields. You can copy-paste this structure:

#### Form Settings
- **Title**: "Community Safety Tip Submission"
- **Description**: 
  ```
  Submit anonymous tips about security concerns in our community. 
  Your information helps keep everyone safe.
  
  ⚠️ For emergencies, call 911 immediately.
  
  Privacy: Do not include names or personal information unless necessary 
  for investigation. All submissions are handled confidentially.
  ```
- **Collect email**: Optional
- **Response receipts**: Optional
- **Allow response editing**: No

#### Form Fields

**Field 1: Type of Concern** (Multiple choice, Required)
```
○ Suspicious Activity
○ Threatening Behavior
○ Vandalism or Property Damage
○ Online Harassment
○ Security Vulnerability
○ Hate Speech or Symbols
○ Other
```

**Field 2: Description** (Long answer, Required)
```
Question: Please describe what you observed
Help text: Include what happened, when it occurred, and any relevant details. 
           Be as specific as possible.
Validation: Minimum 20 characters
```

**Field 3: Location** (Short answer, Required)
```
Question: Where did this occur?
Help text: Specific address, building name, or general area
Example: "Main Street near the community center" or "Parking lot B"
```

**Field 4: Date and Time** (Date + Short answer)
```
Question: When did this occur?
Help text: Approximate date and time if you don't remember exactly
```

**Field 5: Photo Evidence** (File upload, Optional)
```
Question: Upload photos or videos (if available)
Help text: Photos of incidents, suspicious activity, or evidence
File types: Images, Videos
Max file size: 10 MB
Max files: 3
```

**Field 6: Urgency Level** (Multiple choice, Required)
```
Question: How urgent is this concern?
○ 🔴 URGENT - Immediate threat or ongoing incident
○ 🟡 MODERATE - Concerning but not immediate danger
○ 🟢 LOW - Information for awareness only
```

**Field 7: Contact Information** (Short answer, Optional)
```
Question: Contact information (optional)
Help text: Email or phone if you're willing to be contacted for follow-up.
           Anonymous submissions are welcome.
```

**Field 8: Consent** (Checkbox, Required)
```
☑ I understand this information will be reviewed by community safety volunteers 
  and may be shared with appropriate authorities if necessary.
```

**Field 9: Additional Comments** (Long answer, Optional)
```
Question: Any additional information?
```

### Google Form → Slack + Sheets Automation

**Using Zapier (Recommended)**

**Zap 1: Google Forms → Slack**

1. **Trigger**: Google Forms - New Response
   - Choose your form
   - Choose the spreadsheet (auto-created)

2. **Filter** (Optional): Only If - Urgency Level → Contains → "URGENT"

3. **Action**: Slack - Send Channel Message
   - Channel: #security-tips (or #security-urgent for urgent)
   - Message format:
   ```
   {{urgency_emoji}} *New Tip Submitted*
   
   *Type:* {{type_of_concern}}
   *Urgency:* {{urgency_level}}
   *Location:* {{location}}
   *Date/Time:* {{date_and_time}}
   
   *Description:*
   {{description}}
   
   *Contact:* {{contact_information}}
   *Submitted:* {{submission_timestamp}}
   
   📊 [View in Sheet]({{spreadsheet_url}})
   ```

4. **Action 2**: Google Sheets - Create Spreadsheet Row (backup)

**Zap 2: Urgent Tips → SMS Alert**

1. **Trigger**: Google Forms - New Response

2. **Filter**: Only If - Urgency Level → Contains → "URGENT"

3. **Action**: SMS by Zapier - Send SMS
   - To: Your security team lead phone number
   - Message:
   ```
   🚨 URGENT TIP SUBMITTED
   
   Type: {{type_of_concern}}
   Location: {{location}}
   
   Check Slack #security-urgent for details.
   ```

### Enhanced Response Spreadsheet

The Google Form automatically creates a spreadsheet. Enhance it with these additional columns:

| Column | Formula/Value | Purpose |
|--------|---------------|---------|
| Status | Dropdown: New, Reviewing, Investigated, Resolved | Track progress |
| Assigned To | Dropdown: Team member names | Ownership |
| Priority Score | =IF(REGEXMATCH(F2,"URGENT"),3,IF(REGEXMATCH(F2,"MODERATE"),2,1)) | Auto-score |
| Review Notes | Free text | Investigation notes |
| Action Taken | Free text | Resolution details |
| Date Resolved | Date | Closure tracking |
| Follow-up Required | Checkbox | Flag for follow-up |
| Related Incident # | Number | Link to other incidents |

**Conditional Formatting**:
- Urgent tips: Red background
- Moderate tips: Yellow background
- Resolved: Green text
- Overdue (>24hrs, no status): Orange background

---

## 3. SMS Alert Templates

### Severity Ladder & Templates

Copy-paste ready templates for quick SMS alerts. Keep under 160 characters for single SMS.

#### 🔴 **CRITICAL (Immediate Threat)**

**Template 1: Active Threat**
```
🚨 CRITICAL ALERT
Active threat reported at [LOCATION]. 
Avoid area. Call 911 if nearby.
Details: [SHORT_DESCRIPTION]
- Security Team
```

**Template 2: Facility Threat**
```
🚨 URGENT: Security incident at [FACILITY_NAME].
Building evacuating. Stay away.
Updates: [SLACK_CHANNEL]
Call 911 for emergencies.
```

**Template 3: Credible Threat**
```
🚨 ALERT: Credible threat received.
[BRIEF_DESCRIPTION]
Increasing security. Report suspicious activity to [CONTACT].
- Safety Team
```

#### 🟡 **HIGH (Significant Concern)**

**Template 1: Suspicious Activity**
```
⚠️ Security Advisory
Suspicious activity reported near [LOCATION].
Increase vigilance. Report concerns to [CONTACT].
More: [LINK]
```

**Template 2: Vandalism/Damage**
```
⚠️ Alert: Vandalism at [LOCATION].
[BRIEF_DESCRIPTION]
Police notified. Extra patrols requested.
Questions: [CONTACT]
```

**Template 3: Online Threat**
```
⚠️ Online threat detected against [TARGET].
Authorities notified. Monitor social media.
Report similar content to [EMAIL].
```

#### 🟢 **MEDIUM (Awareness)**

**Template 1: General Advisory**
```
ℹ️ Security Update:
[BRIEF_DESCRIPTION]
No immediate action needed.
Stay alert. Details: [LINK]
```

**Template 2: Event Security**
```
ℹ️ Event Security Notice
Enhanced security at [EVENT] on [DATE].
Bag checks, increased patrols.
Questions: [CONTACT]
```

**Template 3: All-Clear**
```
✅ UPDATE: Situation at [LOCATION] resolved.
Normal operations resumed.
Thank you for vigilance.
- Security Team
```

### Severity Decision Matrix

Use this table to determine which template to use:

| Severity | Characteristics | Response Time | Examples |
|----------|----------------|---------------|----------|
| **🔴 CRITICAL** | Immediate danger, active threat, evacuation needed | Send immediately | Active shooter, bomb threat, assault in progress |
| **🟡 HIGH** | Significant concern, potential danger, requires attention | Within 1 hour | Vandalism, credible threat, suspicious package |
| **🟢 MEDIUM** | Awareness, no immediate danger, informational | Within 24 hours | Event security, policy updates, all-clear notices |

### SMS Distribution Lists

Create these groups in your SMS tool:

| List Name | Recipients | Use For |
|-----------|-----------|---------|
| **Emergency-All** | All community members opted in | Critical alerts only |
| **Security-Team** | Security volunteers, leadership | All alerts |
| **Leadership** | Board, directors, key leaders | High and Critical |
| **Event-Staff** | Event coordinators, venue staff | Event-specific alerts |
| **Parents** | Parents/guardians (opt-in) | Alerts affecting children/youth |

### SMS Best Practices

✅ **DO:**
- Keep messages under 160 characters
- Include clear action items
- Provide a link for more details
- Include sender identification
- Send test alerts regularly
- Log all alerts sent

❌ **DON'T:**
- Send during sleeping hours unless critical
- Over-alert (causes alert fatigue)
- Include sensitive personal information
- Use ALL CAPS (except for CRITICAL)
- Send without reviewing for accuracy

---

## 4. Volunteer Coordination Spreadsheet

### Master Volunteer Tracker

Create a Google Sheet with these columns. Copy this structure:

#### Tab 1: Volunteer Roster

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| **Volunteer ID** | Auto-number | Unique ID | V001 |
| **Name** | Text | Full name | John Smith |
| **Email** | Email | Primary contact | john@example.com |
| **Phone** | Phone | Mobile number | (555) 123-4567 |
| **Role** | Dropdown | Primary role | Monitor, Responder, Admin |
| **Status** | Dropdown | Current status | Active, On Leave, Inactive |
| **Background Check** | Dropdown | Clearance status | Complete, Pending, Not Required |
| **Training Complete** | Checkbox | Training status | ☑ |
| **Certifications** | Text | Special skills | First Aid, CPR, Security Training |
| **Availability** | Text | Days/times available | Mon-Wed evenings, weekends |
| **Preferred Tasks** | Multi-select | Task preferences | Monitoring, Events, Tips Review |
| **Last Active** | Date | Last contribution | 2025-01-10 |
| **Shifts This Month** | Number | Current month shifts | 4 |
| **Total Hours** | Number | Lifetime hours | 127 |
| **Notes** | Text | Additional info | Speaks Spanish, Has car |

#### Tab 2: Shift Schedule

| Column | Type | Description |
|--------|------|-------------|
| **Date** | Date | Shift date |
| **Time Slot** | Text | Start-End time |
| **Role Needed** | Dropdown | Type of coverage |
| **Assigned To** | Dropdown (from Roster) | Volunteer name |
| **Location** | Text | Where (if applicable) |
| **Status** | Dropdown | Filled, Open, Cancelled |
| **Backup** | Dropdown | Backup volunteer |
| **Check-in Time** | Time | Actual start |
| **Check-out Time** | Time | Actual end |
| **Incident Reports** | Number | # of incidents |
| **Notes** | Text | Shift summary |

#### Tab 3: Incident Log

| Column | Type | Description |
|--------|------|-------------|
| **Incident #** | Auto-number | Unique ID |
| **Date** | Date | When occurred |
| **Time** | Time | When occurred |
| **Reported By** | Dropdown | Volunteer who reported |
| **Type** | Dropdown | Category |
| **Severity** | Dropdown | Critical, High, Medium, Low |
| **Location** | Text | Where |
| **Description** | Text | What happened |
| **Action Taken** | Text | Response |
| **Police Involved** | Checkbox | Y/N |
| **Case Number** | Text | Police case # |
| **Status** | Dropdown | Open, Investigating, Resolved |
| **Resolved Date** | Date | When closed |
| **Follow-up Needed** | Checkbox | Y/N |

#### Tab 4: Training Tracker

| Column | Type | Description |
|--------|------|-------------|
| **Volunteer Name** | Dropdown | From roster |
| **Orientation Complete** | Checkbox | ☑ |
| **Orientation Date** | Date | When completed |
| **Safety Protocols** | Checkbox | ☑ |
| **Communication Systems** | Checkbox | ☑ |
| **De-escalation Training** | Checkbox | ☑ |
| **First Aid/CPR** | Checkbox | ☑ |
| **Background Check** | Checkbox | ☑ |
| **Annual Refresher** | Date | Last refresher |
| **Next Refresher Due** | Date (auto) | =EDATE(I2,12) |
| **Certificates on File** | Checkbox | ☑ |
| **Training Notes** | Text | Additional training |

### Dropdowns for Consistency

**Role Options:**
```
Monitor (watches alerts/feeds)
Responder (handles incidents)
Coordinator (schedules/manages)
Trainer (trains others)
Admin (system management)
```

**Status Options:**
```
Active
On Leave
Inactive
Alumni
```

**Incident Type Options:**
```
Suspicious Activity
Vandalism
Harassment
Threat (Online)
Threat (Physical)
Security Vulnerability
False Alarm
Other
```

**Severity Options:**
```
🔴 Critical
🟡 High
🟢 Medium
⚪ Low
```

### Useful Filters & Views

Create these filtered views:

1. **Active Volunteers**: Status = "Active"
2. **Training Needed**: Training Complete = Unchecked
3. **Available This Week**: Filter by Availability
4. **Open Shifts**: Status = "Open"
5. **Pending Incidents**: Status = "Open" OR "Investigating"
6. **This Month's Activity**: Date within current month

### Automated Calculations

Add these formulas to summary section:

```
Active Volunteers: =COUNTIF(Status_Range,"Active")
Total Shifts This Month: =COUNTIF(Shift_Date_Range,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1))
Average Hours per Volunteer: =AVERAGE(Total_Hours_Range)
Incidents This Week: =COUNTIFS(Incident_Date_Range,">="&TODAY()-7)
Training Completion Rate: =COUNTIF(Training_Complete_Range,TRUE)/COUNTA(Name_Range)
```

### Sharing & Permissions

**Permission Levels:**
- **View Only**: All volunteers (read-only access)
- **Edit**: Coordinators (can modify shifts, add notes)
- **Owner**: Administrators (full access, including volunteer roster)

**Protect Sensitive Data:**
- Lock Volunteer Roster tab (contact info)
- Protect formula cells
- Limit edit access to coordinators only

---

## 5. Moderator Training Checklist

### Complete Training Program (10 Core Modules)

Copy this checklist for each new moderator. Check off as completed.

```markdown
## Moderator Training Checklist

**Trainee Name:** ___________________________
**Training Start Date:** ___________________________
**Expected Completion:** ___________________________
**Trainer:** ___________________________

---

### ☐ 1. Platform Orientation (30 minutes)
**Objective:** Understand the mission and how all tools work together

- [ ] Review community safety mission and goals
- [ ] Tour of all platforms (Slack, Google Forms, Sheets)
- [ ] Understand information flow (tip → review → action)
- [ ] Review volunteer roles and responsibilities
- [ ] Understand chain of command and escalation paths

**Sign-off:** _____________ Date: _____________

---

### ☐ 2. Tip Review & Triage (45 minutes)
**Objective:** Learn how to evaluate and prioritize community tips

- [ ] Access Google Form responses
- [ ] Use the severity decision matrix
- [ ] Practice categorizing 5 sample tips
- [ ] Learn when to escalate vs. handle directly
- [ ] Understand documentation requirements

**Practical Exercise:** Review 3 historical tips and categorize
**Sign-off:** _____________ Date: _____________

---

### ☐ 3. Incident Documentation (30 minutes)
**Objective:** Properly document incidents for tracking and legal purposes

- [ ] Learn required fields for incident reports
- [ ] Practice writing clear, factual descriptions
- [ ] Understand photo/evidence handling
- [ ] Learn redaction guidelines (protecting privacy)
- [ ] Review retention policies

**Practical Exercise:** Document 1 sample incident from description
**Sign-off:** _____________ Date: _____________

---

### ☐ 4. Communication Protocols (45 minutes)
**Objective:** Master communication channels and escalation procedures

- [ ] Slack channel purposes and etiquette
- [ ] When and how to use @channel vs. direct messages
- [ ] SMS alert approval process
- [ ] Email templates for follow-ups
- [ ] Emergency contact list and when to use

**Practical Exercise:** Draft 1 alert message for review
**Sign-off:** _____________ Date: _____________

---

### ☐ 5. Privacy & Confidentiality (30 minutes)
**Objective:** Understand legal and ethical obligations

- [ ] Review confidentiality agreement
- [ ] Learn what information can/cannot be shared
- [ ] Understand FERPA, HIPAA basics (if applicable)
- [ ] Practice redacting sensitive information
- [ ] Know consequences of privacy violations

**Practical Exercise:** Redact a sample tip to remove PII
**Sign-off:** _____________ Date: _____________

---

### ☐ 6. De-escalation & Safety (45 minutes)
**Objective:** Handle tense situations and maintain personal safety

- [ ] Verbal de-escalation techniques
- [ ] Recognize signs of escalation
- [ ] When to involve law enforcement
- [ ] Personal safety protocols
- [ ] Self-care and secondary trauma awareness

**Practical Exercise:** Role-play 2 de-escalation scenarios
**Sign-off:** _____________ Date: _____________

---

### ☐ 7. Technology Systems (30 minutes)
**Objective:** Navigate all technical tools confidently

- [ ] Google Forms administration
- [ ] Google Sheets filters and views
- [ ] Slack advanced features (threads, reactions, reminders)
- [ ] Zapier automation overview (viewing, not editing)
- [ ] Mobile access for urgent responses

**Practical Exercise:** Find specific information using filters
**Sign-off:** _____________ Date: _____________

---

### ☐ 8. Bias Awareness & Cultural Sensitivity (45 minutes)
**Objective:** Ensure fair and equitable treatment of all reports

- [ ] Recognize implicit bias in tip evaluation
- [ ] Cultural sensitivity in communication
- [ ] Avoiding profiling and discrimination
- [ ] Accessible communication practices
- [ ] Trauma-informed approach

**Practical Exercise:** Discuss 2 case studies on bias
**Sign-off:** _____________ Date: _____________

---

### ☐ 9. Emergency Response Procedures (30 minutes)
**Objective:** Know exactly what to do in crisis situations

- [ ] Memorize 3-step emergency protocol
- [ ] Practice using emergency contact list
- [ ] Understand bomb threat procedures
- [ ] Review active threat response
- [ ] Know evacuation procedures for facilities

**Practical Exercise:** Walk through 1 emergency scenario
**Sign-off:** _____________ Date: _____________

---

### ☐ 10. Shadow Shift & Final Assessment (2 hours)
**Objective:** Demonstrate readiness to moderate independently

- [ ] Complete 1 shadow shift with experienced moderator
- [ ] Review actual tips independently, compare assessments
- [ ] Practice end-to-end workflow (tip → action → documentation)
- [ ] Ask questions and clarify procedures
- [ ] Receive feedback on performance

**Assessment Results:**
- [ ] Demonstrated understanding of all modules
- [ ] Comfortable with technology systems
- [ ] Exercises good judgment in prioritization
- [ ] Communicates clearly and professionally
- [ ] Understands privacy and safety protocols

**Final Sign-off:** 
**Trainer:** _____________ Date: _____________
**Trainee:** _____________ Date: _____________
**Program Lead:** _____________ Date: _____________

---

### Post-Training Requirements

- [ ] Background check completed
- [ ] Signed confidentiality agreement on file
- [ ] Added to moderator communication channels
- [ ] Access granted to all necessary systems
- [ ] Added to on-call rotation

**Status:** ☐ Training Complete ☐ Full Access Granted ☐ Ready for Independent Work

---

### Ongoing Development

**Monthly Check-ins:** Scheduled for ___________________________
**Annual Refresher:** Due by ___________________________
**Advanced Training Opportunities:** ___________________________
```

---

## Quick Start Guide

### Week 1: Setup

**Day 1-2: Information Gathering**
1. Set up Google Alerts (30 keywords)
2. Create Slack workspace with 5 channels
3. Configure RSS → Slack integration
4. Test alert delivery

**Day 3-4: Tip System**
1. Create Google Form for tips
2. Set up Zapier automation (Form → Slack)
3. Create response tracking spreadsheet
4. Test with 3 dummy submissions

**Day 5-7: Team Coordination**
1. Create volunteer coordination spreadsheet
2. Recruit 5-10 volunteers
3. Set up communication channels
4. Schedule first training session

### Week 2: Training & Launch

**Day 8-10: Training**
1. Train first batch of moderators (5 people)
2. Review all 10 training modules
3. Practice with sample incidents
4. Grant system access

**Day 11-12: Soft Launch**
1. Announce tip line to 50 trusted community members
2. Monitor closely for issues
3. Respond to first real tips
4. Refine processes

**Day 13-14: Full Launch**
1. Public announcement
2. Distribute SMS templates to team
3. Begin regular monitoring schedule
4. First week review and adjustments

### Month 1 Goals

- ✅ 50+ community members know about tip line
- ✅ 5-10 trained moderators
- ✅ 10+ tips received and processed
- ✅ 0 missed critical alerts
- ✅ Response time under 2 hours for urgent tips

---

## Tools & Resources

### Free Tools Used

| Tool | Purpose | Free Tier Limits | Cost if Exceeded |
|------|---------|------------------|------------------|
| **Google Forms** | Tip submission | Unlimited | Always free |
| **Google Sheets** | Data tracking | Unlimited | Always free |
| **Google Alerts** | Monitoring | 1000 alerts | Always free |
| **Slack** | Communication | 10,000 messages searchable | $7.25/user/month |
| **Zapier** | Automation | 100 tasks/month | $19.99/month for 750 tasks |
| **RSS Feed** | Content aggregation | Unlimited | Always free |

### Upgrade Path

**When to upgrade to full Shomer platform:**
- Processing 50+ tips per month
- Need for advanced analytics
- Want automated risk scoring
- Require audit trails for compliance
- Team larger than 20 volunteers
- Multiple communities/locations

**Migration path:**
- Export all Google Sheets data
- Import into Shomer database
- Train team on new platform
- Maintain old system for 30 days (parallel)
- Full cutover after validation

---

## Support & Questions

### Troubleshooting

**Zapier not triggering:**
- Check Zap is turned on
- Verify Google Form permissions
- Test with manual trigger
- Check task history for errors

**Slack alerts not posting:**
- Verify RSS app is installed
- Check feed URL is valid
- Ensure channel permissions
- Test feed in RSS reader first

**Form submissions not recording:**
- Check Google Sheets connection
- Verify form is accepting responses
- Check quota limits (shouldn't hit)
- Try incognito mode test

### Getting Help

**Community Resources:**
- Slack Community: https://shomer-community.slack.com
- Documentation: https://github.com/shomer/docs
- Video Tutorials: https://youtube.com/shomer-tutorials

**Professional Setup:**
Contact us for guided setup assistance:
- **Email**: setup@shomer.local
- **Consultation**: 1-hour free consultation available

---

## Success Stories

> "We went from scattered emails and phone calls to an organized system in one weekend. The volunteer coordination spreadsheet alone saved us 10 hours per month."
> 
> — *Temple Beth Shalom Safety Committee*

> "Google Alerts caught a credible threat that we might have missed. The immediate Slack notification got our team mobilized in under 10 minutes."
> 
> — *Community Watch Program, Chicago*

> "Training checklist ensured every volunteer had consistent preparation. No more assuming people knew the protocols."
> 
> — *School Safety Coordinator*

---

## Appendix: Copy-Paste Templates

### Quick Reference Card (Print and Laminate)

```
╔════════════════════════════════════════════════════════════╗
║           COMMUNITY SAFETY QUICK REFERENCE                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  🚨 EMERGENCY: Call 911 First                              ║
║                                                            ║
║  📝 Submit Tip: [YOUR_GOOGLE_FORM_LINK]                    ║
║                                                            ║
║  💬 Slack Channels:                                        ║
║     #security-alerts-critical - Urgent only                ║
║     #security-tips - Community reports                     ║
║     #security-team - Team coordination                     ║
║                                                            ║
║  📊 Severity Guide:                                        ║
║     🔴 CRITICAL - Immediate threat, active danger          ║
║     🟡 HIGH - Significant concern, needs attention         ║
║     🟢 MEDIUM - Awareness, no immediate danger             ║
║                                                            ║
║  📞 Emergency Contacts:                                    ║
║     Security Lead: [PHONE]                                 ║
║     Police Non-Emergency: [PHONE]                          ║
║     Crisis Hotline: [PHONE]                                ║
║                                                            ║
║  ⏰ Response Time Targets:                                 ║
║     Critical: Immediate (< 15 min)                         ║
║     High: Within 1 hour                                    ║
║     Medium: Within 24 hours                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

**Version:** 1.0  
**Last Updated:** January 14, 2025  
**Maintained by:** Shomer Team  
**License:** CC BY-SA 4.0

