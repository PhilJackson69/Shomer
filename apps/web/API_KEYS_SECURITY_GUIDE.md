# API Keys Security Guide

## Overview

This document outlines the security model, threat considerations, and deployment guidance for the hardened API key system.

## Security Model

### Authentication Methods

1. **Global Secret** (`X-Action-Secret`)
   - Bypasses all scopes and rate limiting
   - Used for internal system operations
   - Should be rotated regularly

2. **Organization API Keys** (`X-Org-Api-Key`)
   - Scoped access with rate limiting
   - Organization-specific
   - Can be disabled/revoked without deletion

### Scope System

#### Available Scopes

| Scope | Description | Category | Warning |
|-------|-------------|----------|---------|
| `rota.write` | Create and modify on-call schedules | Scheduling | - |
| `copy.week` | Copy weekly schedules | Scheduling | - |
| `seed.week` | Generate initial weekly schedules | Scheduling | - |
| `settings.write` | Modify organization settings | Administration | ⚠️ |
| `share.rotate` | Share and rotate on-call responsibilities | Scheduling | - |
| `webhook.manage` | Create, update, and delete webhooks | Integration | ⚠️ |
| `swap.approve` | Approve shift swap requests | Scheduling | - |
| `swap.decline` | Decline shift swap requests | Scheduling | - |

#### Scope Validation

- All scopes are validated against a canonical list
- Invalid scopes are rejected at key creation time
- Case-sensitive matching enforced
- Empty scope array = full access (backwards compatibility)

### Rate Limiting

#### Token Bucket Algorithm

- **Capacity**: Equal to `requestsPerMinute` (allows burst)
- **Refill Rate**: `requestsPerMinute / 60` tokens per second
- **Time Source**: Monotonic time (`performance.now()`)
- **Storage**: In-memory per process instance

#### Rate Limit Behavior

- `null` or `0` = unlimited requests
- Positive integer = requests per minute
- Burst allowed up to capacity
- Continuous refill over time

#### Throttling

- `lastUsedAt` updates throttled to once per minute per key
- Prevents database hot writes during high traffic

## Threat Model

### In-Memory Rate Limiting

**Threat**: Rate limiting is per-instance, not shared across horizontal deployments.

**Mitigation**: 
- Document this limitation clearly
- Consider Redis-based rate limiting for multi-instance deployments
- Monitor per-instance metrics
- Set lower RPM limits per instance if needed

### Key Compromise

**Threat**: API key exposed in logs, client-side code, or network traffic.

**Mitigation**:
- Keys are never logged in plaintext
- Automatic key redaction in security logs
- Immediate revocation capability
- Key rotation workflow

### Scope Escalation

**Threat**: Unauthorized access to sensitive operations.

**Mitigation**:
- Strict scope validation
- Principle of least privilege
- Powerful scopes marked with warnings
- Audit logging for all scope checks

### Rate Limit Bypass

**Threat**: Attempts to bypass rate limiting.

**Mitigation**:
- Monotonic time prevents clock manipulation
- Token bucket prevents simple bypass
- Global secret precedence clearly documented
- Rate limit headers in responses

## Deployment Considerations

### Single Instance Deployment

✅ **Recommended for**: Development, small production deployments

- In-memory rate limiting works correctly
- No additional infrastructure needed
- Simple monitoring and debugging

### Multi-Instance Deployment

⚠️ **Considerations**:

1. **Rate Limiting**: Each instance maintains separate buckets
   - Total capacity = `rpm × instance_count`
   - Consider reducing per-key RPM limits
   - Monitor aggregate usage across instances

2. **Monitoring**: 
   - Track rate limiting per instance
   - Alert on high rejection rates
   - Monitor key usage patterns

3. **Scaling**: 
   - Consider Redis-based rate limiting for high-scale deployments
   - Implement shared rate limiting if needed

### Redis-Based Rate Limiting (Future)

For high-scale deployments, consider implementing shared rate limiting:

```typescript
// Example Redis-based implementation
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function takeTokenRedis(key: string, rpm: number): Promise<boolean> {
  const bucketKey = `ratelimit:${key}`;
  const capacity = Math.max(1, rpm);
  const now = Date.now();
  
  const pipeline = redis.pipeline();
  pipeline.hincrby(bucketKey, 'tokens', -1);
  pipeline.hset(bucketKey, 'last', now);
  pipeline.expire(bucketKey, 120); // 2 minute TTL
  
  const results = await pipeline.exec();
  const tokens = results[0][1] as number;
  
  return tokens >= 0;
}
```

## Security Best Practices

### Key Management

1. **Rotation**: Rotate keys regularly (quarterly recommended)
2. **Revocation**: Revoke compromised keys immediately
3. **Monitoring**: Monitor key usage patterns
4. **Audit**: Regular audit of key permissions

### Scope Management

1. **Least Privilege**: Grant minimum required scopes
2. **Regular Review**: Review key scopes quarterly
3. **Powerful Scopes**: Extra caution for `settings.write` and `webhook.manage`
4. **Documentation**: Document scope requirements clearly

### Monitoring

1. **Security Events**: Monitor security logger output
2. **Rate Limiting**: Alert on high rejection rates
3. **Usage Patterns**: Monitor for unusual access patterns
4. **Failed Auth**: Alert on repeated authentication failures

## Error Response Format

All API key authentication errors follow a standardized format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human readable message",
    "details": {
      // Additional context (optional)
    }
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `invalid_key` | 401 | Missing, invalid, disabled, or expired key |
| `forbidden_scope` | 403 | Key lacks required scope |
| `rate_limited` | 429 | Rate limit exceeded |
| `internal_error` | 500 | Server error during authentication |

## Migration Guide

### From Legacy System

1. **Database Migration**: Run the provided migration
2. **Scope Migration**: Existing keys with null scopes get full access
3. **KeyId Generation**: Existing keys get keyId derived from keyHash
4. **Backwards Compatibility**: Legacy CSV scopes supported during transition

### Testing Migration

```bash
# Run tests to verify migration
npm test -- org-apikeys-hardened.test.ts

# Test scope validation
npm test -- --grep "Scope Validation"

# Test rate limiting
npm test -- --grep "Rate Limiting"
```

## Troubleshooting

### Common Issues

1. **Rate Limiting Not Working**
   - Check if `performance.now()` is available
   - Verify bucket key generation
   - Check for clock drift issues

2. **Scope Validation Failing**
   - Verify scope names match canonical list
   - Check for case sensitivity issues
   - Validate JSON parsing

3. **Database Performance**
   - Monitor `lastUsedAt` update frequency
   - Check index usage
   - Consider read replicas for auth queries

### Debugging

Enable debug logging:

```typescript
// Add to environment
DEBUG=security:*

// Or enable specific loggers
DEBUG=security:apikey,security:ratelimit
```

## Compliance

### Audit Requirements

- All authentication events logged
- Key creation/revocation tracked
- Scope changes audited
- Rate limiting violations logged

### Data Retention

- Security logs: 90 days minimum
- Key usage data: 30 days
- Audit trails: 1 year minimum

### Privacy

- No sensitive data in logs
- Key values never logged
- User data redacted appropriately
