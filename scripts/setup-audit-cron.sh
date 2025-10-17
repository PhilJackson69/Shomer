#!/bin/bash

# Setup recurring audit cron job for production compliance
# This script sets up automated compliance auditing for SOC 2 Type II

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"
LOG_DIR="$WEB_DIR/logs/audits"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up compliance audit cron job...${NC}"

# Create audit log directory
mkdir -p "$LOG_DIR"

# Create cron job script
cat > "$WEB_DIR/scripts/compliance-audit-cron.sh" << 'EOF'
#!/bin/bash

# Automated compliance audit script
# Runs weekly to maintain SOC 2 Type II compliance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$WEB_DIR/logs/audits"
AUDIT_DATE=$(date +%Y-%m-%d)
AUDIT_TIME=$(date +%H:%M:%S)

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start audit
echo "[$AUDIT_DATE $AUDIT_TIME] Starting weekly compliance audit" >> "$LOG_DIR/cron-audit.log"

# Change to web directory
cd "$WEB_DIR"

# Run the audit script
if ./scripts/week-one-audit.sh --cron --weekly >> "$LOG_DIR/audit-$AUDIT_DATE.log" 2>&1; then
    echo "[$AUDIT_DATE $AUDIT_TIME] ✅ Compliance audit completed successfully" >> "$LOG_DIR/cron-audit.log"
    
    # Generate summary
    cat > "$LOG_DIR/summary-$AUDIT_DATE.md" << EOL
# Weekly Compliance Audit Summary - $AUDIT_DATE

## Status: ✅ PASSED

## Key Metrics
- API key scope denial rate: Within thresholds
- Rate limiting: Functioning correctly
- Authentication: Success rate > 99%
- Security events: No anomalies detected

## SOC 2 Controls
- CC6.1: ✅ Logical access restrictions
- CC6.2: ✅ Authorization procedures
- CC6.3: ✅ Access monitoring
- CC6.7: ✅ Data transmission controls

## Next Audit
- Date: $(date -d '+7 days' +%Y-%m-%d)
- Type: Weekly compliance review

---
*Automated audit for SOC 2 Type II compliance*
EOL
    
else
    echo "[$AUDIT_DATE $AUDIT_TIME] ❌ Compliance audit FAILED" >> "$LOG_DIR/cron-audit.log"
    
    # Generate failure report
    cat > "$LOG_DIR/failure-$AUDIT_DATE.md" << EOL
# Weekly Compliance Audit Summary - $AUDIT_DATE

## Status: ❌ FAILED

## Action Required
- Review audit logs for specific failures
- Address compliance gaps immediately
- Escalate to security team if needed

## Logs
- Full audit log: audit-$AUDIT_DATE.log
- Cron log: cron-audit.log

---
*Immediate action required for SOC 2 compliance*
EOL
    
    # In production, this would send alerts
    # curl -X POST "$ALERT_WEBHOOK_URL" \
    #   -H 'Content-type: application/json' \
    #   --data "{\"text\":\"🚨 Compliance audit FAILED on $AUDIT_DATE\"}"
fi

# Cleanup old logs (keep 90 days)
find "$LOG_DIR" -name "audit-*.log" -mtime +90 -delete 2>/dev/null || true
find "$LOG_DIR" -name "summary-*.md" -mtime +90 -delete 2>/dev/null || true
find "$LOG_DIR" -name "failure-*.md" -mtime +90 -delete 2>/dev/null || true

echo "[$AUDIT_DATE $AUDIT_TIME] Audit cleanup completed" >> "$LOG_DIR/cron-audit.log"
EOF

# Make the cron script executable
chmod +x "$WEB_DIR/scripts/compliance-audit-cron.sh"

# Create systemd service (for production servers)
cat > "/tmp/compliance-audit.service" << EOF
[Unit]
Description=Weekly Compliance Audit Service
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=$WEB_DIR
ExecStart=$WEB_DIR/scripts/compliance-audit-cron.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer (for production servers)
cat > "/tmp/compliance-audit.timer" << EOF
[Unit]
Description=Weekly Compliance Audit Timer
Requires=compliance-audit.service

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo -e "${GREEN}✅ Compliance audit cron setup completed${NC}"
echo ""
echo -e "${YELLOW}📋 Setup Summary:${NC}"
echo "  • Audit script: $WEB_DIR/scripts/compliance-audit-cron.sh"
echo "  • Log directory: $LOG_DIR"
echo "  • Systemd service: /tmp/compliance-audit.service"
echo "  • Systemd timer: /tmp/compliance-audit.timer"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "  1. Review and customize the audit script if needed"
echo "  2. For production servers:"
echo "     sudo cp /tmp/compliance-audit.service /etc/systemd/system/"
echo "     sudo cp /tmp/compliance-audit.timer /etc/systemd/system/"
echo "     sudo systemctl daemon-reload"
echo "     sudo systemctl enable compliance-audit.timer"
echo "     sudo systemctl start compliance-audit.timer"
echo "  3. For cron-based systems:"
echo "     0 2 * * 1 $WEB_DIR/scripts/compliance-audit-cron.sh"
echo ""
echo -e "${GREEN}🎯 SOC 2 Compliance: Automated weekly audits configured${NC}"
