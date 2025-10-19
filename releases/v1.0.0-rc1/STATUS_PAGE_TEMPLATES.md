# 📢 Status Page Templates - v1.0.0

## 1. Planned Maintenance (Pre-Deploy)

### Template
```
🔧 PLANNED MAINTENANCE

We are deploying a backend update between [HH:MM]–[HH:MM] UTC.
No downtime expected.

We will monitor key authentication and API metrics throughout the deployment.

Expected Impact: None
Duration: ~60 minutes
```

### Example
```
🔧 PLANNED MAINTENANCE

We are deploying a backend update between 14:00–15:00 UTC.
No downtime expected.

We will monitor key authentication and API metrics throughout the deployment.

Expected Impact: None
Duration: ~60 minutes
```

---

## 2. Incident (If Rollback Required)

### Template
```
🚨 INCIDENT REPORT

We identified elevated authentication errors following a deployment.
We rolled back within 5 minutes.

Services are stable; we are investigating and will post a retrospective within 48 hours.

Impact: Authentication errors for 5 minutes
Status: Resolved
Next Update: Within 24 hours
```

### Example
```
🚨 INCIDENT REPORT

We identified elevated authentication errors following a deployment.
We rolled back within 5 minutes.

Services are stable; we are investigating and will post a retrospective within 48 hours.

Impact: Authentication errors for 5 minutes
Status: Resolved
Next Update: Within 24 hours
```

---

## 3. Post-Launch Success

### Template
```
✅ DEPLOYMENT COMPLETED

Deployment completed successfully.
Authentication and API latencies are normal.

We will continue heightened monitoring for 24 hours.

Status: All systems operational
Next Update: Within 24 hours
```

### Example
```
✅ DEPLOYMENT COMPLETED

Deployment completed successfully.
Authentication and API latencies are normal.

We will continue heightened monitoring for 24 hours.

Status: All systems operational
Next Update: Within 24 hours
```

---

## 4. Monitoring Update

### Template
```
📊 MONITORING UPDATE

Current Status: [STATUS]
JWT Verify Rate: [X]%
JWKS Latency: [X]ms
CSRF Mismatches: [X]
5xx Error Rate: [X]%

All metrics within normal thresholds.
```

### Example
```
📊 MONITORING UPDATE

Current Status: All systems operational
JWT Verify Rate: 0.8%
JWKS Latency: 245ms
CSRF Mismatches: 12
5xx Error Rate: 0.1%

All metrics within normal thresholds.
```

---

## 5. Escalation Notice

### Template
```
⚠️ ESCALATION NOTICE

We are experiencing [ISSUE_TYPE] affecting [SERVICE].
Our team is actively investigating.

Impact: [IMPACT_DESCRIPTION]
Status: Investigating
Next Update: Within 30 minutes
```

### Example
```
⚠️ ESCALATION NOTICE

We are experiencing elevated error rates affecting authentication.
Our team is actively investigating.

Impact: Some users may experience login delays
Status: Investigating
Next Update: Within 30 minutes
```

---

## 6. Resolution Notice

### Template
```
✅ ISSUE RESOLVED

The [ISSUE_TYPE] has been resolved.
All services are operating normally.

Impact: [IMPACT_DESCRIPTION]
Status: Resolved
Next Update: Post-mortem within 48 hours
```

### Example
```
✅ ISSUE RESOLVED

The authentication error issue has been resolved.
All services are operating normally.

Impact: Authentication errors for 15 minutes
Status: Resolved
Next Update: Post-mortem within 48 hours
```

---

## 7. Maintenance Complete

### Template
```
✅ MAINTENANCE COMPLETE

Scheduled maintenance has been completed successfully.
All services are operating normally.

Duration: [X] minutes
Impact: None
Status: All systems operational
```

### Example
```
✅ MAINTENANCE COMPLETE

Scheduled maintenance has been completed successfully.
All services are operating normally.

Duration: 45 minutes
Impact: None
Status: All systems operational
```

---

## 📋 Status Page Guidelines

### Communication Principles
1. **Transparency:** Be honest about issues and impact
2. **Timeliness:** Update within 15 minutes of status changes
3. **Clarity:** Use simple, non-technical language
4. **Consistency:** Follow the same format for similar updates

### Update Frequency
- **Incidents:** Every 15 minutes until resolved
- **Maintenance:** Start, progress, completion
- **Monitoring:** Every hour during critical periods
- **Resolutions:** Immediate when issue is resolved

### Escalation Triggers
- **Critical:** Service down, data loss, security breach
- **High:** Significant performance degradation
- **Medium:** Minor issues affecting some users
- **Low:** Cosmetic issues, planned maintenance

### Contact Information
- **Status Page:** [URL]
- **Support:** [Email]
- **Emergency:** [Phone]
- **Social Media:** [Twitter/LinkedIn]

---

## 🔄 Template Usage

### When to Use Each Template
1. **Planned Maintenance:** Before scheduled deployments
2. **Incident:** When rollback is required
3. **Post-Launch Success:** After successful deployment
4. **Monitoring Update:** During critical monitoring periods
5. **Escalation Notice:** When investigating issues
6. **Resolution Notice:** When issues are resolved
7. **Maintenance Complete:** After planned maintenance

### Customization Guidelines
- Replace `[PLACEHOLDER]` with actual values
- Update timestamps to current time
- Include specific metrics when available
- Add relevant contact information
- Include next update timeframe

---

## 📞 Emergency Communication

### Internal Channels
- **Slack:** #status, #alerts, #eng, #ops
- **Email:** status@company.com
- **Phone:** Emergency hotline

### External Channels
- **Status Page:** Primary communication
- **Social Media:** Twitter, LinkedIn
- **Press:** Media relations team
- **Customers:** Support team

### Communication Hierarchy
1. **Status Page:** Primary source of truth
2. **Slack:** Internal team updates
3. **Email:** Formal notifications
4. **Phone:** Emergency escalations

---

## 📊 Metrics to Include

### Key Performance Indicators
- **JWT Verify Rate:** Authentication success rate
- **JWKS Latency:** Key validation performance
- **CSRF Mismatches:** Security metric
- **5xx Error Rate:** Server error rate
- **Response Time:** API performance
- **Uptime:** Service availability

### Thresholds
- **JWT Verify Rate:** < 2% error rate
- **JWKS Latency:** < 300ms p95
- **CSRF Mismatches:** < 50 per hour
- **5xx Error Rate:** < 0.5%
- **Response Time:** < 1s p95
- **Uptime:** > 99.9%

---

## 🔄 Template Maintenance

### Regular Updates
- **Monthly:** Review and update templates
- **Quarterly:** Add new templates as needed
- **Annually:** Complete template overhaul

### Version Control
- **Version:** 1.0
- **Last Updated:** [Date]
- **Next Review:** [Date]
- **Owner:** [Team/Person]

### Feedback Collection
- **Internal:** Team feedback on clarity
- **External:** Customer feedback on communication
- **Metrics:** Response time to updates
- **Analytics:** Status page engagement
