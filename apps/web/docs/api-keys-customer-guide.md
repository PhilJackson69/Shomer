# API Keys - Customer Guide

## Overview

API keys provide programmatic access to your organization's data with fine-grained permissions and rate limiting.

## Authentication

Use one of these headers for API authentication:

### Global Secret (Internal Automation)
```
X-Action-Secret: your-global-secret
```
- Bypasses all scopes and rate limits
- For internal automation and system operations
- Should be rotated regularly

### Organization API Key (Scoped Access)
```
X-Org-Api-Key: your-org-api-key
```
- Subject to scope restrictions and rate limits
- Organization-specific access
- Can be disabled/revoked without deletion

## Scopes

API keys can be granted specific scopes to limit access:

| Scope | Description | Category |
|-------|-------------|----------|
| `rota.write` | Create and modify on-call schedules | Scheduling |
| `copy.week` | Copy weekly schedules | Scheduling |
| `seed.week` | Generate initial weekly schedules | Scheduling |
| `settings.write` | Modify organization settings | Administration ⚠️ |
| `share.rotate` | Share and rotate on-call responsibilities | Scheduling |
| `webhook.manage` | Create, update, and delete webhooks | Integration ⚠️ |
| `swap.approve` | Approve shift swap requests | Scheduling |
| `swap.decline` | Decline shift swap requests | Scheduling |

⚠️ **Warning**: Scopes marked with warning icons grant powerful permissions. Use with caution.

## Rate Limiting

### Token Bucket Algorithm
- **Capacity**: Equal to your `requestsPerMinute` setting (allows initial burst)
- **Refill Rate**: Continuous refill at `requestsPerMinute / 60` tokens per second
- **Unlimited**: Set `requestsPerMinute` to `null` for unlimited requests

### Rate Limit Behavior
```javascript
// Example: 60 requests per minute
// - Allows burst of 60 requests immediately
// - Refills 1 token per second continuously
// - 4th request in rapid succession: allowed (burst)
// - 61st request in same minute: rate limited
```

### Horizontal Scaling Note
Rate limits apply **per instance**. If you're using multiple server instances, your total capacity is `requestsPerMinute × instance_count`.

## Error Responses

All API errors follow a standardized format:

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

### Common Error Codes

#### 401 - Invalid Key
```json
{
  "error": {
    "code": "invalid_key",
    "message": "Missing or invalid API key"
  }
}
```

**Causes**:
- Missing `X-Org-Api-Key` header
- Invalid key format
- Key has been revoked
- Key has expired
- Key has been disabled

#### 403 - Forbidden Scope
```json
{
  "error": {
    "code": "forbidden_scope",
    "message": "Requires scope settings.write",
    "details": {
      "required": "settings.write",
      "available": ["rota.write", "copy.week"]
    }
  }
}
```

**Causes**:
- API key lacks required scope for the operation
- Check the `available` scopes in the error details

#### 429 - Rate Limited
```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded",
    "details": {
      "retryAfter": 60
    }
  }
}
```

**Causes**:
- Exceeded your `requestsPerMinute` limit
- Wait for tokens to refill or implement exponential backoff

## Best Practices

### Key Management
1. **Rotate regularly** (quarterly recommended)
2. **Use minimal scopes** (principle of least privilege)
3. **Monitor usage** through your dashboard
4. **Revoke immediately** if compromised

### Client Implementation
```javascript
// Example with exponential backoff
async function apiCallWithBackoff(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Org-Api-Key': process.env.API_KEY,
          ...options.headers,
        },
      });
      
      if (response.status === 429 && i < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### Error Handling
```javascript
async function handleApiResponse(response) {
  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case 'invalid_key':
        // Key is invalid, expired, or revoked
        console.error('API key issue:', error.error.message);
        break;
        
      case 'forbidden_scope':
        // Key lacks required scope
        console.error('Insufficient permissions:', error.error.message);
        console.log('Available scopes:', error.error.details.available);
        break;
        
      case 'rate_limited':
        // Rate limit exceeded
        console.error('Rate limited, retry after:', error.error.details.retryAfter);
        break;
        
      default:
        console.error('API error:', error.error.message);
    }
    
    throw new Error(error.error.message);
  }
  
  return response.json();
}
```

## Troubleshooting

### "I'm getting 429 errors"
1. Check your `requestsPerMinute` setting
2. Verify you're not making requests too quickly
3. Implement exponential backoff in your client
4. Consider if you need unlimited rate limits

### "I'm getting 403 errors"
1. Check the required scope in the error message
2. Verify your API key has the necessary scopes
3. Contact support if you need additional permissions

### "I'm getting 401 errors"
1. Verify your API key is correct
2. Check if the key has been revoked or expired
3. Ensure you're using the correct header name (`X-Org-Api-Key`)

### Key Rotation
1. Create a new API key with the same scopes
2. Update your client applications
3. Test the new key
4. Revoke the old key
5. Monitor for any issues

## Support

For additional help:
- Check the [API documentation](https://your-api-docs.com)
- Review the [security guide](API_KEYS_SECURITY_GUIDE.md)
- Contact support with your organization ID and key prefix
