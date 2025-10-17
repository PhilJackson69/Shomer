# Monitoring Dashboards

This directory contains SOC 2 compliant dashboard exports for production monitoring.

## Dashboard Files

- `api_keys.json` - API Key Hardening monitoring dashboard
  - Authentication success rates
  - Scope denial monitoring (<1% threshold)
  - Rate limiting metrics
  - Security event logs
  - Top denied scopes analysis

## Compliance Features

### SOC 2 Type II Controls
- ✅ **CC6.1**: Logical and physical access restrictions
- ✅ **CC6.2**: Prior authorization for access
- ✅ **CC6.3**: System access monitoring
- ✅ **CC6.7**: Data transmission and disposal controls

### ISO 27001 Controls
- ✅ **A.9.4.2**: Secure log-on procedures
- ✅ **A.10.10.2**: Monitoring system use
- ✅ **A.12.4.1**: Event logging
- ✅ **A.13.1.1**: Network controls

## Import Instructions

### Datadog
```bash
# Import dashboard
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @monitoring/dashboards/api_keys.json
```

### Grafana
```bash
# Import dashboard
curl -X POST "http://grafana:3000/api/dashboards/db" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
  -d @monitoring/dashboards/api_keys.json
```

## Alert Configuration

The dashboard includes pre-configured alerts for:
- Scope denial rate > 1%
- Rate limiting surge > 100 requests
- Authentication failures
- Security event anomalies

## Audit Trail

All dashboard changes are tracked in version control with:
- Author attribution
- Timestamp logging
- Compliance metadata
- Change documentation

## Maintenance

- **Weekly**: Review alert thresholds and adjust based on usage patterns
- **Monthly**: Validate compliance controls and update documentation
- **Quarterly**: Full audit of monitoring coverage and SOC 2 alignment
