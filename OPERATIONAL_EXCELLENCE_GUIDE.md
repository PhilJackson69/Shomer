# Shomer Operational Excellence Guide

## 🎯 Overview

This guide provides the complete operational framework for running and maintaining Shomer's self-auditing, self-healing deployment pipeline. The system implements the same layers that regulated fintech or defense cloud environments require.

## 🧭 Daily / Weekly Operational Routine

### Daily Operations

| Cadence | Action | Script | Purpose |
|---------|--------|--------|---------|
| Daily | Run full preflight + post-deploy verification in staging | `./scripts/complete-verification-flow.sh` | Validates all security controls before any deployment |
| Daily | Review Prometheus dashboard for JWT/JWKS/CSRF trends | Queries in `monitoring/golden-signals-queries.yaml` | Monitor security metrics and performance |
| Daily | Check GitHub Actions workflow status | `.github/workflows/production-verification-suite.yml` | Ensure automated verification pipeline is healthy |

### Weekly Operations

| Cadence | Action | Script | Purpose |
|---------|--------|--------|---------|
| Weekly | Run ZAP DAST baseline + Semgrep lane in CI | `.github/workflows/dast-security-scan.yml` | Automated security scanning |
| Weekly | Rotate log hash chains / verify immutability | `scripts/fast-remediation-playbook.sh verify-audit-chain` | Ensure audit trail integrity |
| Weekly | Review Grafana Golden Signals dashboard | `monitoring/dashboards/golden-signals-dashboard.json` | Performance and security trend analysis |

### Matched Cadence

| Cadence | Action | Script | Purpose |
|---------|--------|--------|---------|
| Monthly | Test revoke-all and refresh-family invalidation | `scripts/post-deploy-verification.sh` | Validate session management |
| Quarterly | Perform full key rotation & canary drill | `scripts/security-drill.sh` | Security readiness testing |

## 🛠️ Maintenance Tips

### Version Control Your Scripts
Tag each successful release with a security-vX.Y tag to reproduce validation results:

```bash
# After successful deployment
git tag -a security-v1.2.0 -m "Security validation v1.2.0 - All checks passed"
git push origin security-v1.2.0
```

### Evidence Archive
Dump all generated evidence/artifacts to an S3 bucket with lifecycle rules (keep 1 year):

```bash
# Upload evidence to S3
aws s3 sync verification-evidence-* s3://shomer-security-evidence/$(date +%Y-%m)/ \
  --storage-class STANDARD_IA \
  --lifecycle-configuration lifecycle.json
```

### Cron/CI Scheduling
Add a weekly GitHub Action that runs the full verification flow in staging and posts results to Slack:

```yaml
# .github/workflows/weekly-security-validation.yml
name: Weekly Security Validation
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
```

### Drill Reports
The security-drill.sh transcript doubles as a SOC2/ISO audit artifact—store it with date and signature hash:

```bash
# Generate signed drill report
./scripts/security-drill.sh > security-drill-$(date +%Y%m%d).log
gpg --sign --armor security-drill-$(date +%Y%m%d).log
```

## 🔧 GitHub Actions Workflow

The automated verification suite (`.github/workflows/production-verification-suite.yml`) provides:

### Pipeline Stages
1. **Security Preflight Validation** - Validates configuration and secrets
2. **Code Quality Gates** - ESLint, Semgrep, and raw fetch checks
3. **DAST Security Scan** - Dynamic application security testing
4. **Build and Test** - Application build and test execution
5. **Docker Build** - Container image creation and registry push
6. **Deploy to Staging** - Staging environment deployment
7. **Post-Deploy Verification** - Comprehensive post-deployment checks
8. **Production Deploy** - Production deployment with security drill
9. **Notify Completion** - Success/failure notifications

### Environment Protection
- **Staging**: Auto-deploys on successful verification
- **Production**: Requires manual approval and successful staging deployment

### Artifact Generation
- Verification reports with timestamps
- Evidence artifacts for audit/compliance
- Production deployment reports

## 📊 Grafana Golden Signals Dashboard

The dashboard (`monitoring/dashboards/golden-signals-dashboard.json`) visualizes:

### Security Metrics
- **JWT Verify Error Rate** - JWT verification failure percentage
- **JWKS P95 Latency** - JWKS endpoint performance
- **Refresh Token Reuse Detections** - Security violation monitoring
- **CSRF Mismatches** - CSRF protection effectiveness
- **HTTP 5xx Error Rate** - Application error monitoring

### Performance Metrics
- **Authentication Failure Rate** - Auth system health
- **Rate Limit Violations** - Abuse pattern detection
- **Database Connection Pool Utilization** - Database health
- **Redis Connection Health** - Cache system status
- **API Response Time P95** - API performance

### Infrastructure Metrics
- **Memory Usage** - Application memory consumption
- **CPU Usage** - CPU utilization
- **Disk Usage** - Storage utilization
- **Security Event Rate** - Security incident monitoring
- **Audit Log Write Rate** - Audit trail integrity

### Alert Thresholds
All metrics include configurable alert thresholds:
- **Critical**: Immediate response required
- **Warning**: Monitor and investigate
- **Info**: Track trends

## 🚀 Quick Start Commands

### Run Complete Verification Flow
```bash
# Set environment variables
export PUBLIC_BASE_URL="https://staging.shomer.example.com"
export ACCESS_TOKEN="your-jwt-token"

# Run complete verification
./scripts/complete-verification-flow.sh
```

### Run Individual Verification Steps
```bash
# Preflight validation only
./scripts/preflight-validation.sh

# Post-deploy verification only
./scripts/post-deploy-verification.sh

# Security drill
./scripts/security-drill.sh
```

### Monitor Golden Signals
```bash
# View Prometheus queries
cat monitoring/golden-signals-queries.yaml

# Import Grafana dashboard
# Upload monitoring/dashboards/golden-signals-dashboard.json to Grafana
```

## 🔍 Troubleshooting Guide

### Common Issues

#### Preflight Validation Failures
```bash
# Check configuration
echo $PUBLIC_BASE_URL
echo $JWT_ALG
echo $COOKIE_DOMAIN

# Run individual checks
curl -fsS "$PUBLIC_BASE_URL/.well-known/jwks.json" | jq .
curl -fsSI "$PUBLIC_BASE_URL" | grep -i 'strict-transport-security'
```

#### Post-Deploy Verification Failures
```bash
# Check endpoint accessibility
curl -fsS "$PUBLIC_BASE_URL/api/v1/health"
curl -fsS "$PUBLIC_BASE_URL/api/v1/auth/login" -X POST

# Test security controls
curl -fsS "$PUBLIC_BASE_URL/api/v1/validation/url-scan" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://example.com"}'
```

#### Grafana Dashboard Issues
```bash
# Check Prometheus connectivity
curl -fsS http://localhost:9090/api/v1/query?query=up

# Verify metric availability
curl -fsS http://localhost:9090/api/v1/query?query=app_auth_jwt_verify_errors_total
```

### Fast Remediation Playbook
```bash
# Run fast remediation for specific issues
./scripts/fast-remediation-playbook.sh jwks-latency
./scripts/fast-remediation-playbook.sh jwt-errors
./scripts/fast-remediation-playbook.sh refresh-reuse
./scripts/fast-remediation-playbook.sh waf-false-positives
./scripts/fast-remediation-playbook.sh db-pool
./scripts/fast-remediation-playbook.sh memory-usage
./scripts/fast-remediation-playbook.sh all
```

## 📋 Evidence and Compliance

### Audit Trail
All verification runs generate evidence artifacts:
- **Preflight Evidence** - Configuration validation results
- **Post-Deploy Evidence** - Security control verification
- **Security Drill Evidence** - Incident response testing
- **JWKS Hash** - Cryptographic key integrity
- **Cosign Attestation** - Container image signing

### Compliance Reports
Generate compliance reports for:
- **SOC2** - Security and availability controls
- **ISO 27001** - Information security management
- **PCI DSS** - Payment card industry compliance
- **HIPAA** - Healthcare data protection

### Evidence Storage
```bash
# Archive evidence for compliance
tar -czf security-evidence-$(date +%Y%m%d).tar.gz \
  verification-evidence-* \
  preflight-evidence-* \
  post-deploy-evidence-*

# Upload to secure storage
aws s3 cp security-evidence-$(date +%Y%m%d).tar.gz \
  s3://shomer-compliance-evidence/
```

## 🧩 Optional Next Iterations

### FIDO2 / WebAuthn 2FA Integration
Replace TOTP for admins with hardware-based authentication:
- Hardware security keys (YubiKey, etc.)
- Biometric authentication
- Platform authenticators

### OPA / Rego Policies
Fine-grained RBAC enforcement:
- Policy as Code
- Dynamic authorization
- Context-aware access control

### Immutable JWKS Distribution
Signed CloudFront functions for JWKS distribution:
- Cryptographic signatures
- Content integrity verification
- Global distribution with caching

### Evidence Integration
Integrate Evidence Summaries into Grafana dashboard:
- Panel per script status
- Real-time verification results
- Historical trend analysis

## 🏁 Getting Started

### 1. Set Up Environment
```bash
# Clone repository
git clone https://github.com/your-org/shomer.git
cd shomer

# Install dependencies
pnpm install

# Configure environment
cp env.example .env
# Edit .env with your configuration
```

### 2. Run Initial Verification
```bash
# Set environment variables
export PUBLIC_BASE_URL="https://your-staging-url.com"
export ACCESS_TOKEN="your-jwt-token"

# Run complete verification flow
./scripts/complete-verification-flow.sh
```

### 3. Set Up Monitoring
```bash
# Start Prometheus and Grafana
docker-compose -f docker-compose.observability.yml up -d

# Import Grafana dashboard
# Upload monitoring/dashboards/golden-signals-dashboard.json

# Configure alerts
# Review monitoring/golden-signals-queries.yaml
```

### 4. Configure CI/CD
```bash
# Set up GitHub secrets
# - STAGING_URL
# - PROD_URL
# - GITHUB_TOKEN

# Enable GitHub Actions
# - production-verification-suite.yml
# - dast-security-scan.yml
# - security-audit.yml
```

## 🛡️ Security Best Practices

### Secrets Management
- Use GitHub Secrets for sensitive configuration
- Rotate secrets regularly
- Implement secret scanning in CI/CD

### Access Control
- Principle of least privilege
- Multi-factor authentication
- Regular access reviews

### Monitoring and Alerting
- Real-time security monitoring
- Automated incident response
- Regular security drills

### Compliance
- Regular security audits
- Evidence collection and storage
- Compliance reporting automation

## 📞 Support

For operational issues:
1. Check the troubleshooting guide above
2. Review evidence artifacts
3. Run fast remediation playbook
4. Escalate to security team

For system improvements:
1. Review monitoring dashboards
2. Analyze security trends
3. Implement additional controls
4. Update verification scripts

---

**🛡️ Shomer Operational Excellence - Enterprise-Grade Security Operations**
