# Shomer Pilot Runbook

**Version:** 1.0  
**Last Updated:** October 2025  
**Status:** Pre-Pilot

This runbook guides the pilot deployment of Shomer's evidence management system with chain-of-custody tracking.

---

## Table of Contents

1. [Pre-Pilot Checklist](#pre-pilot-checklist)
2. [Pilot Launch](#pilot-launch)
3. [Operational Controls](#operational-controls)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Incident Response](#incident-response)
6. [Daily Operations](#daily-operations)
7. [Evidence Acknowledgment Templates](#evidence-acknowledgment-templates)
8. [Escalation Tree](#escalation-tree)

---

## Pre-Pilot Checklist

### Infrastructure

- [ ] Production environment deployed (`docker-compose.prod.yml`)
- [ ] TLS certificates installed and valid
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Backup system tested and verified
- [ ] Redis connected for rate limiting
- [ ] Monitoring/logging configured

### Security

- [ ] All secrets rotated (JWT, API keys, database passwords)
- [ ] CORS locked to production web origin
- [ ] CSRF protection enabled
- [ ] Rate limits configured (60/min IP, 10/min user, 5/min exports)
- [ ] Evidence immutability triggers deployed (migration 006)
- [ ] EXIF stripping enabled for image uploads

### User Accounts

Create initial user accounts:

```bash
# Admin accounts (2)
python apps/api/seed.py create-user admin1@shomer.app --role admin --password <secure-password>
python apps/api/seed.py create-user admin2@shomer.app --role admin --password <secure-password>

# Moderator accounts (2)
python apps/api/seed.py create-user mod1@shomer.app --role moderator --password <secure-password>
python apps/api/seed.py create-user mod2@shomer.app --role moderator --password <secure-password>
```

- [ ] Admin accounts created and tested
- [ ] Moderator accounts created and tested
- [ ] Default passwords changed
- [ ] 2FA enabled for admin accounts (if available)

### Feature Flags

```bash
# Enable evidence feature
export FEATURE_EVIDENCE=true

# Configure retention
export TIP_RETENTION_DAYS=14
export ENABLE_RETENTION_SCHEDULER=true
```

- [ ] Evidence feature enabled
- [ ] Retention windows configured
- [ ] Auto-delete policies reviewed

### Documentation

- [ ] Oversight board briefed on pilot
- [ ] Transparency report cadence documented
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Data retention policy documented

### Testing

Run the dry run workflow:

```bash
# 1. Upload test evidence
export TOKEN="admin-jwt-token"
export API="https://shomer.app"

# Upload photo
curl -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_photo.jpg" \
  -F "evidence_type=photo" \
  -F "description=Pilot test - photo" \
  -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Upload PDF
curl -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_document.pdf" \
  -F "evidence_type=document" \
  -F "description=Pilot test - document" \
  -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Upload video (test large file)
curl -X POST "$API/api/v1/evidence/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_video.mp4" \
  -F "evidence_type=video" \
  -F "description=Pilot test - video" \
  -F "submitted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 2. Verify evidence
curl -X POST "$API/api/v1/evidence/1/verify" \
  -H "Authorization: Bearer $TOKEN"

# 3. Seal evidence (legal hold)
curl -X POST "$API/api/v1/evidence/2/seal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Pilot test - legal hold",
    "hold_until": "2026-12-31T23:59:59Z"
  }'

# 4. Export PDFs
curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/1/export-chain-of-custody" \
  -o evidence_1_coc.pdf

curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/2/export-chain-of-custody" \
  -o evidence_2_coc.pdf

curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/3/export-chain-of-custody" \
  -o evidence_3_coc.pdf
```

- [ ] Photo upload successful
- [ ] PDF upload successful
- [ ] Video upload successful
- [ ] Verification passed for all
- [ ] Seal operation successful
- [ ] PDFs exported successfully
- [ ] PDFs reviewed by legal counsel

---

## Pilot Launch

### Launch Day Checklist

**T-1 Day:**
- [ ] All pre-pilot checklist items completed
- [ ] Backup taken and verified
- [ ] On-call schedule confirmed
- [ ] Communication templates ready
- [ ] Monitoring dashboards configured

**Launch Day:**
1. [ ] Final backup taken
2. [ ] Services health check passed
3. [ ] Announce pilot to stakeholders
4. [ ] Monitor logs for first 4 hours
5. [ ] Verify first real evidence submission
6. [ ] Send confirmation to submitter

**T+1 Day:**
- [ ] Review overnight logs
- [ ] Check for any incidents
- [ ] Verify backup ran successfully
- [ ] Review access logs

### Launch Communication

**Internal Announcement:**
```
Subject: Shomer Evidence System Pilot Launch

The Shomer evidence management system pilot is now live.

Key Features:
- Secure evidence submission with cryptographic verification
- Immutable chain-of-custody tracking
- Legal-compliant PDF exports
- EXIF metadata stripping for privacy

Pilot Duration: 30 days
Pilot Users: [List organizations/users]

Support:
- Primary: admin1@shomer.app
- Secondary: admin2@shomer.app
- On-call: [Phone number]

Documentation: https://docs.shomer.app
```

**User Communication:**
```
Subject: Welcome to the Shomer Evidence System Pilot

You have been invited to participate in the Shomer evidence management pilot.

What to Expect:
- Secure evidence submission
- Automatic integrity verification
- Chain-of-custody documentation
- Privacy protection (EXIF stripping)

Getting Started:
1. Log in at https://shomer.app
2. Review the user guide
3. Submit test evidence
4. Verify you can export chain-of-custody PDFs

Support: support@shomer.app
Emergency: [Phone number]
```

---

## Operational Controls

### Retention Windows

**Tips & Access Logs:**
- Default retention: 14 days
- Legal hold: Indefinite (requires admin action)
- Purge time: 02:00 UTC daily

**Evidence:**
- Default: No auto-delete
- Legal hold: Indefinite (sealed items)
- Manual deletion: Requires admin approval + audit log

**Audit Logs:**
- Retention: 90 days minimum
- Export: Monthly to cold storage
- Never purge chain-of-custody records

### Oversight

**Weekly Review:**
- [ ] Review evidence submission volume
- [ ] Check verification success rate
- [ ] Review access logs for anomalies
- [ ] Check export volume
- [ ] Review any manual actions (seals, deletions)

**Monthly Report:**
- Evidence submitted: [count]
- Evidence verified: [count]
- Evidence sealed: [count]
- PDFs exported: [count]
- Failed verifications: [count]
- Incidents: [count]

---

## Monitoring & Alerts

### Critical Alerts (15-minute SLA)

**High 5xx Error Rate:**
- **Threshold:** >5% of requests return 5xx
- **Action:** Check API logs, database connectivity, disk space
- **Escalation:** Platform engineer

**Evidence Verification Failures:**
- **Threshold:** >10 failures in 5 minutes
- **Action:** Check storage integrity, file system
- **Escalation:** Security team + Platform engineer

**High Export Volume:**
- **Threshold:** >50 exports in 5 minutes
- **Action:** Check for abuse, verify legitimate usage
- **Escalation:** Security team

### Warning Alerts (1-hour SLA)

- Database disk usage >80%
- Storage disk usage >80%
- Rate limit rejections >100/hour
- Failed login attempts >50/hour

### Dashboard Metrics

Monitor these key metrics:

```
Evidence Flow:
- Uploads per hour
- Verification success rate
- Export requests per hour

System Health:
- API response time (p50, p95, p99)
- Database query time
- Storage I/O utilization

Security:
- Failed authentication attempts
- Rate limit rejections
- CSRF violations

Integrity:
- Evidence verification pass/fail ratio
- Hash mismatch incidents
- Sealed evidence modifications (should be 0)
```

---

## Incident Response

### Severity Levels

**Severity 1 (Critical):**
- Evidence integrity compromised
- Database corruption
- Data breach
- Complete system outage

**Response:** Immediate page, all hands on deck

**Severity 2 (High):**
- Partial system outage
- Performance degradation
- Failed evidence verification
- Security incident

**Response:** Page on-call, escalate if not resolved in 30 min

**Severity 3 (Medium):**
- Non-critical feature broken
- Elevated error rates
- Configuration issues

**Response:** Ticket created, addressed during business hours

### Incident Procedures

#### Evidence Integrity Incident

**Symptoms:**
- Evidence verification fails
- Hash mismatches detected
- Suspicious access patterns

**Response:**
1. **Immediately:** Stop all writes to affected evidence
   ```bash
   # Emergency read-only mode
   docker exec shomer-api python -c "
   from app.db.base import engine
   engine.execute('ALTER USER shomer_prod SET default_transaction_read_only = on;')
   "
   ```

2. **Assess scope:**
   ```bash
   # Check recent verifications
   psql $DATABASE_URL -c "
     SELECT id, reference_number, verified_at, sha256_hash 
     FROM evidence 
     WHERE verified_at > NOW() - INTERVAL '1 hour';
   "
   ```

3. **Isolate affected evidence:**
   - Mark as compromised in database
   - Seal evidence (legal hold)
   - Document incident in chain-of-custody

4. **Investigate:**
   - Review access logs
   - Check file system integrity
   - Examine audit logs

5. **Recover:**
   - Restore from backup if necessary
   - Re-verify all evidence
   - Document findings

6. **Report:**
   - Notify oversight board
   - Document in incident log
   - Update procedures if needed

#### Data Breach Response

**If evidence or PII is compromised:**

1. **Contain:** Stop the breach source immediately
2. **Assess:** Determine what data was accessed/exfiltrated
3. **Notify:** Legal team, oversight board, affected individuals
4. **Document:** Complete forensic analysis
5. **Remediate:** Fix vulnerability, improve security
6. **Report:** File required breach notifications

---

## Daily Operations

### Morning Checklist (30 minutes)

```bash
# 1. Check service health
curl https://shomer.app/health

# 2. Review overnight logs
docker logs shomer-api --since 24h | grep ERROR

# 3. Check disk usage
docker exec shomer-db df -h /var/lib/postgresql/data
docker exec shomer-api df -h /app/uploads

# 4. Verify backup ran
ls -lh backups/ | tail -n 5

# 5. Review metrics dashboard
# Open Grafana/monitoring dashboard
```

- [ ] All services healthy
- [ ] No critical errors in logs
- [ ] Disk usage <80%
- [ ] Backup completed successfully
- [ ] Metrics within normal ranges

### Weekly Tasks (1 hour)

**Monday:**
- [ ] Review week's evidence submissions
- [ ] Check verification success rate
- [ ] Review any manual actions (seals, exports)
- [ ] Test backup restore (sample)

**Wednesday:**
- [ ] Review rate limit effectiveness
- [ ] Check for suspicious access patterns
- [ ] Update documentation if needed

**Friday:**
- [ ] Weekly report to oversight board
- [ ] Review on-call schedule for next week
- [ ] Plan any maintenance for weekend

### Monthly Tasks (4 hours)

- [ ] Rotate secrets (if policy requires)
- [ ] Full backup restore drill
- [ ] Security audit
- [ ] Performance review
- [ ] User feedback review
- [ ] Transparency report
- [ ] Update pilot documentation

---

## Evidence Acknowledgment Templates

### Evidence Received Acknowledgment

**Email Template:**

```
Subject: Evidence Received - Ref #[REFERENCE_NUMBER]

Your evidence submission has been received and securely stored.

Reference Number: [REFERENCE_NUMBER]
Submitted: [TIMESTAMP]
File: [FILENAME]
SHA-256 Hash: [HASH]

Next Steps:
1. Your evidence has been automatically verified
2. A chain-of-custody log is being maintained
3. You can verify integrity at any time: https://shomer.app/verify/[REFERENCE_NUMBER]

Important:
- Keep this reference number for your records
- Do not share the verification link publicly
- Contact support@shomer.app with questions

Verification Link (private):
https://shomer.app/verify/[REFERENCE_NUMBER]

---
This is an automated message. Your privacy is protected.
No personally identifying information is included in this acknowledgment.
```

### Evidence Sealed Notification

```
Subject: Evidence Sealed (Legal Hold) - Ref #[REFERENCE_NUMBER]

Evidence with reference number [REFERENCE_NUMBER] has been placed under legal hold.

Sealed By: [USER_EMAIL]
Sealed At: [TIMESTAMP]
Reason: [REASON]
Hold Until: [DATE] (if specified)

This evidence:
- Cannot be modified or deleted
- Is subject to preservation requirements
- May be used in legal proceedings

For questions, contact legal@shomer.app
```

### Export Confirmation

```
Subject: Chain of Custody Export - Ref #[REFERENCE_NUMBER]

A chain-of-custody PDF has been exported for evidence [REFERENCE_NUMBER].

Exported By: [USER_EMAIL]
Export Time: [TIMESTAMP]
Purpose: [PURPOSE]

This action has been logged in the chain-of-custody.

PDF Contents:
- Complete evidence metadata
- Full chain-of-custody timeline
- Integrity verification status
- QR code for online verification

For questions, contact support@shomer.app
```

---

## Escalation Tree

### Level 1: On-Call Engineer (Response: 15 minutes)
- **Contact:** [Phone], [Email]
- **Handles:** System outages, performance issues, minor incidents
- **Escalates to:** Level 2 if not resolved in 30 minutes

### Level 2: Senior Engineer (Response: 30 minutes)
- **Contact:** [Phone], [Email]
- **Handles:** Complex technical issues, security incidents
- **Escalates to:** Level 3 for critical incidents

### Level 3: Engineering Lead (Response: 1 hour)
- **Contact:** [Phone], [Email]
- **Handles:** Major incidents, architecture decisions
- **Escalates to:** Level 4 for data breaches or legal issues

### Level 4: Leadership + Legal (Response: 2 hours)
- **Contact:** [Phone], [Email]
- **Handles:** Data breaches, legal incidents, PR issues
- **Authority:** Can make executive decisions

### External Contacts

**Law Enforcement (if criminal activity):**
- FBI Cyber Division: [Contact]
- Local Police: [Contact]

**Legal Counsel:**
- Primary: [Name], [Contact]
- Secondary: [Name], [Contact]

**Oversight Board:**
- Chair: [Name], [Contact]
- Members: [List]

---

## Pilot Success Criteria

### Quantitative Metrics

After 30-day pilot:

- [ ] >90% evidence verification success rate
- [ ] <1% false positive hash mismatches
- [ ] <5% 5xx error rate
- [ ] <0.1% chain-of-custody incidents
- [ ] 100% backup success rate
- [ ] <2s average upload time
- [ ] <5s average export time

### Qualitative Feedback

- [ ] User satisfaction survey >4/5
- [ ] Legal counsel approval of PDF format
- [ ] Oversight board confidence in controls
- [ ] No critical security incidents
- [ ] Documentation deemed adequate

### Pilot Review Meeting

Schedule 30-day pilot review:

**Attendees:**
- Engineering lead
- Product manager
- Legal counsel
- Oversight board representative
- Pilot users (sample)

**Agenda:**
1. Review quantitative metrics
2. Review incidents (if any)
3. User feedback discussion
4. Legal/compliance review
5. Decision: continue, modify, or terminate pilot

---

## Post-Pilot Actions

### If Successful

1. [ ] Gradual rollout to additional users
2. [ ] Update documentation based on lessons learned
3. [ ] Implement user-requested features
4. [ ] Establish ongoing operational procedures
5. [ ] Transition from pilot to production support

### If Issues Found

1. [ ] Document all issues and lessons learned
2. [ ] Develop remediation plan
3. [ ] Re-run pilot after fixes
4. [ ] Update this runbook

---

## Quick Reference

### Emergency Commands

**Stop all evidence uploads:**
```bash
# Set API to maintenance mode
docker exec shomer-api touch /tmp/maintenance
```

**Immediate backup:**
```bash
docker exec shomer-db pg_dump -U $POSTGRES_USER $POSTGRES_DB > emergency-backup-$(date +%Y%m%d-%H%M%S).sql
```

**Check evidence integrity:**
```bash
# Verify random sample of 10 evidence items
curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/evidence/verify-random?count=10"
```

**View recent chain-of-custody:**
```bash
psql $DATABASE_URL -c "
  SELECT timestamp, action, evidence_id, action_by_name 
  FROM chain_of_custody 
  ORDER BY timestamp DESC 
  LIMIT 20;
"
```

### Support Contacts

- **Primary:** admin1@shomer.app, [Phone]
- **Secondary:** admin2@shomer.app, [Phone]
- **Emergency:** [On-call pager]
- **Legal:** legal@shomer.app

---

**Document Version:** 1.0  
**Next Review:** [Date]  
**Owner:** [Name]

