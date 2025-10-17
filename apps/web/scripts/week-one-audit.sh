#!/bin/bash
# Week-One Audit Script
# Run this 7 days after go-live to audit API keys usage and optimization

set -e  # Exit on any error

echo "📊 API Keys Hardening - Week-One Audit"
echo "======================================"

# Configuration
DB_URL="${DATABASE_URL:-file:dev.db}"
DAYS_AGO=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "ℹ️  $1"
}

log_header() {
    echo -e "${BLUE}📋 $1${NC}"
}

# Database queries
query_db() {
    local query="$1"
    local description="$2"
    
    log_info "$description"
    echo "Query: $query"
    echo "---"
    
    # Use sqlite3 for local dev, psql for production
    if [[ "$DB_URL" == *"sqlite"* ]]; then
        sqlite3 "$DB_URL" "$query"
    else
        psql "$DB_URL" -c "$query"
    fi
    
    echo ""
}

# Audit functions
audit_scope_denials() {
    log_header "Top 10 Routes by Scope Denials"
    
    # This would typically come from your log aggregation system
    # For now, we'll show the query structure
    query_db "
        SELECT 
            route,
            COUNT(*) as denial_count,
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
        FROM SecurityEvents 
        WHERE event = 'apikey.scope_denied' 
        AND timestamp > datetime('now', '-$DAYS_AGO days')
        GROUP BY route 
        ORDER BY denial_count DESC 
        LIMIT 10;
    " "Routes with most scope denials (requires SecurityEvents table)"
    
    log_warning "Review these routes and contact organizations to right-size scopes"
}

audit_full_access_keys() {
    log_header "Keys with Full Access (scopes=null)"
    
    query_db "
        SELECT 
            keyId,
            label,
            orgId,
            createdAt,
            lastUsedAt,
            requestsPerMinute
        FROM OrganizationApiKey 
        WHERE scopes IS NULL 
        AND revokedAt IS NULL 
        AND disabledAt IS NULL
        ORDER BY lastUsedAt DESC;
    " "Keys with full access that should be reviewed"
    
    log_warning "Nudge owners to trim scopes to least privilege"
}

audit_unlimited_rate_limits() {
    log_header "Keys with Unlimited Rate Limits but High Usage"
    
    query_db "
        SELECT 
            keyId,
            label,
            orgId,
            lastUsedAt,
            requestsPerMinute
        FROM OrganizationApiKey 
        WHERE requestsPerMinute IS NULL 
        AND revokedAt IS NULL 
        AND disabledAt IS NULL
        AND lastUsedAt > datetime('now', '-1 day')
        ORDER BY lastUsedAt DESC;
    " "Unlimited keys with recent activity"
    
    log_warning "Consider setting sensible RPM caps for these keys"
}

audit_key_usage_patterns() {
    log_header "Key Usage Patterns"
    
    query_db "
        SELECT 
            CASE 
                WHEN requestsPerMinute IS NULL THEN 'Unlimited'
                WHEN requestsPerMinute <= 10 THEN 'Low (≤10)'
                WHEN requestsPerMinute <= 60 THEN 'Medium (11-60)'
                WHEN requestsPerMinute <= 300 THEN 'High (61-300)'
                ELSE 'Very High (>300)'
            END as rpm_category,
            COUNT(*) as key_count
        FROM OrganizationApiKey 
        WHERE revokedAt IS NULL 
        AND disabledAt IS NULL
        GROUP BY rpm_category
        ORDER BY key_count DESC;
    " "Distribution of rate limit settings"
    
    query_db "
        SELECT 
            CASE 
                WHEN scopes IS NULL THEN 'Full Access'
                WHEN json_array_length(scopes) = 1 THEN 'Single Scope'
                WHEN json_array_length(scopes) <= 3 THEN 'Few Scopes (2-3)'
                WHEN json_array_length(scopes) <= 6 THEN 'Many Scopes (4-6)'
                ELSE 'All Scopes (7+)'
            END as scope_category,
            COUNT(*) as key_count
        FROM OrganizationApiKey 
        WHERE revokedAt IS NULL 
        AND disabledAt IS NULL
        GROUP BY scope_category
        ORDER BY key_count DESC;
    " "Distribution of scope configurations"
}

audit_security_events() {
    log_header "Security Event Summary"
    
    # This would come from your log aggregation system
    log_info "Security events from last $DAYS_AGO days:"
    echo "  - apikey.auth: Authentication attempts"
    echo "  - apikey.scope_denied: Scope denial events"
    echo "  - apikey.rate_limited: Rate limiting events"
    echo "  - apikey.invalid: Invalid key attempts"
    echo ""
    
    log_warning "Check your monitoring system for:"
    echo "  - Unusual authentication patterns"
    echo "  - Repeated scope denials from same keys"
    echo "  - Rate limiting spikes"
    echo "  - Invalid key attempts (potential attacks)"
}

audit_performance_metrics() {
    log_header "Performance Metrics"
    
    query_db "
        SELECT 
            COUNT(*) as total_keys,
            COUNT(CASE WHEN revokedAt IS NOT NULL THEN 1 END) as revoked_keys,
            COUNT(CASE WHEN disabledAt IS NOT NULL THEN 1 END) as disabled_keys,
            COUNT(CASE WHEN lastUsedAt > datetime('now', '-1 day') THEN 1 END) as active_today,
            COUNT(CASE WHEN lastUsedAt > datetime('now', '-7 days') THEN 1 END) as active_week
        FROM OrganizationApiKey;
    " "Key statistics summary"
    
    query_db "
        SELECT 
            AVG(CASE WHEN requestsPerMinute IS NOT NULL THEN requestsPerMinute END) as avg_rpm,
            MIN(requestsPerMinute) as min_rpm,
            MAX(requestsPerMinute) as max_rpm
        FROM OrganizationApiKey 
        WHERE revokedAt IS NULL 
        AND disabledAt IS NULL;
    " "Rate limit statistics"
}

generate_recommendations() {
    log_header "Recommendations"
    
    echo "Based on the audit results:"
    echo ""
    
    echo "🔒 Security:"
    echo "  - Review keys with full access (scopes=null)"
    echo "  - Implement scope-based access for all keys"
    echo "  - Monitor for unusual authentication patterns"
    echo ""
    
    echo "⚡ Performance:"
    echo "  - Set rate limits for unlimited keys with high usage"
    echo "  - Monitor rate limiting effectiveness"
    echo "  - Consider Redis-based rate limiting for scale"
    echo ""
    
    echo "📊 Monitoring:"
    echo "  - Set up alerts for scope denial spikes"
    echo "  - Monitor authentication success rates"
    echo "  - Track key usage patterns"
    echo ""
    
    echo "👥 Customer Success:"
    echo "  - Reach out to organizations with scope denials"
    echo "  - Provide guidance on least-privilege scopes"
    echo "  - Share best practices for rate limiting"
    echo ""
    
    echo "🔄 Process:"
    echo "  - Implement regular key audits (monthly)"
    echo "  - Create key rotation procedures"
    echo "  - Document scope requirements clearly"
}

# Main audit flow
main() {
    echo "Starting week-one audit..."
    echo "Auditing data from last $DAYS_AGO days"
    echo ""
    
    # Run all audits
    audit_scope_denials
    audit_full_access_keys
    audit_unlimited_rate_limits
    audit_key_usage_patterns
    audit_security_events
    audit_performance_metrics
    
    echo ""
    generate_recommendations
    
    echo ""
    echo "📋 Action Items:"
    echo "   1. Review scope denial patterns and contact affected organizations"
    echo "   2. Audit keys with full access and recommend scope trimming"
    echo "   3. Set rate limits for unlimited keys with high usage"
    echo "   4. Review security event patterns for anomalies"
    echo "   5. Update monitoring and alerting based on findings"
    echo ""
    echo "📅 Next Audit: Schedule for 30 days from now"
}

# Run main function
main "$@"
