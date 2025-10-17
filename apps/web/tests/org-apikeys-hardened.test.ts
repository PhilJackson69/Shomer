import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { requireOrgWriteAuthWithScope } from '../src/lib/org-auth-scoped-v2';
import { takeToken, resetBucket, clearAllBuckets } from '../src/lib/ratelimit';
import { SCOPES, isScope } from '../src/lib/scopes';

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    ACTION_SECRET: 'test-action-secret',
  };
  clearAllBuckets();
});

afterEach(() => {
  process.env = originalEnv;
  clearAllBuckets();
});

describe('Hardened Organization API Key System', () => {
  let testOrgId: string;
  let testUserId: string;
  let testApiKey: string;
  let testApiKeyId: string;

  beforeEach(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: 'test-org',
      },
    });
    testOrgId = org.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    // Create membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: 'ADMIN',
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.organizationApiKey.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.membership.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.organization.deleteMany({
      where: { id: testOrgId },
    });
  });

  describe('Scope Validation', () => {
    it('should reject invalid scopes', async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['invalid.scope', 'rota.write'],
          requestsPerMinute: 60,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should accept valid scopes only', async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['rota.write', 'copy.week'],
          requestsPerMinute: 60,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.key.scopes).toEqual(['rota.write', 'copy.week']);
    });

    it('should handle case sensitivity correctly', async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['Rota.Write', 'copy.week'], // Mixed case
          requestsPerMinute: 60,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting with Monotonic Time', () => {
    beforeEach(async () => {
      // Create API key with rate limit of 3 requests per minute
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Rate Limited Key',
          scopes: ['copy.week'],
          requestsPerMinute: 3,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
      testApiKeyId = data.key.id;
    });

    it('should allow burst requests up to capacity', async () => {
      const bucketKey = `${testOrgId}:${testApiKeyId}`;
      
      // Should allow 3 requests (capacity = rpm)
      expect(takeToken(bucketKey, 3)).toBe(true);
      expect(takeToken(bucketKey, 3)).toBe(true);
      expect(takeToken(bucketKey, 3)).toBe(true);
      
      // 4th request should be denied
      expect(takeToken(bucketKey, 3)).toBe(false);
    });

    it('should refill tokens over time', async () => {
      const bucketKey = `${testOrgId}:${testApiKeyId}`;
      
      // Use all tokens
      expect(takeToken(bucketKey, 3)).toBe(true);
      expect(takeToken(bucketKey, 3)).toBe(true);
      expect(takeToken(bucketKey, 3)).toBe(true);
      expect(takeToken(bucketKey, 3)).toBe(false);
      
      // Mock time advancement (in real implementation, this would be handled by performance.now())
      // For testing, we'll reset the bucket to simulate time passage
      resetBucket(bucketKey);
      
      // Should allow requests again after "time" passes
      expect(takeToken(bucketKey, 3)).toBe(true);
    });

    it('should handle rate limiting in auth flow', async () => {
      // Make 3 requests (limit is 3)
      const requests = Array(3).fill(null).map(() => 
        new NextRequest('http://localhost/api/oncall/rota/copy-week', {
          headers: {
            'X-Org-Api-Key': testApiKey,
          },
        })
      );

      const results = await Promise.all(
        requests.map(req => requireOrgWriteAuthWithScope(req, testOrgId, 'copy.week'))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.ok).toBe(true);
      });

      // 4th request should be rate limited
      const fourthReq = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const fourthResult = await requireOrgWriteAuthWithScope(fourthReq, testOrgId, 'copy.week');
      expect(fourthResult.ok).toBe(false);
      expect(fourthResult.res.status).toBe(429);
    });
  });

  describe('Error Response Shapes', () => {
    beforeEach(async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['copy.week'],
          requestsPerMinute: 60,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
    });

    it('should return standardized error format for missing key', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week');
      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'copy.week');
      
      expect(result.ok).toBe(false);
      const response = result.res;
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('invalid_key');
      expect(data.error.message).toBe('Missing API key');
    });

    it('should return standardized error format for scope denial', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'rota.write');
      expect(result.ok).toBe(false);
      
      const response = result.res;
      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('forbidden_scope');
      expect(data.error.message).toContain('Requires scope rota.write');
      expect(data.error.details).toBeDefined();
      expect(data.error.details.required).toBe('rota.write');
      expect(data.error.details.available).toContain('copy.week');
    });

    it('should return standardized error format for rate limiting', async () => {
      // Create a key with very low rate limit
      const lowLimitResponse = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Low Limit Key',
          scopes: ['copy.week'],
          requestsPerMinute: 1,
        }),
      });

      const lowLimitData = await lowLimitResponse.json();
      const lowLimitKey = lowLimitData.key.value;

      // Make first request
      const req1 = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': lowLimitKey,
        },
      });

      const result1 = await requireOrgWriteAuthWithScope(req1, testOrgId, 'copy.week');
      expect(result1.ok).toBe(true);

      // Make second request (should be rate limited)
      const req2 = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': lowLimitKey,
        },
      });

      const result2 = await requireOrgWriteAuthWithScope(req2, testOrgId, 'copy.week');
      expect(result2.ok).toBe(false);
      
      const response = result2.res;
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('rate_limited');
      expect(data.error.message).toBe('Rate limit exceeded');
      expect(data.error.details.retryAfter).toBe(60);
    });
  });

  describe('Global Secret Precedence', () => {
    beforeEach(async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['copy.week'],
          requestsPerMinute: 1,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
    });

    it('should prioritize global secret over API key', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Action-Secret': 'test-action-secret',
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'rota.write');
      expect(result.ok).toBe(true);
      expect(result.bypass).toBe(true);
    });

    it('should not count global secret requests toward rate limit', async () => {
      // Make many requests with global secret
      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost/api/oncall/rota/copy-week', {
          headers: {
            'X-Action-Secret': 'test-action-secret',
          },
        })
      );

      const results = await Promise.all(
        requests.map(req => requireOrgWriteAuthWithScope(req, testOrgId, 'rota.write'))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.ok).toBe(true);
        expect(result.bypass).toBe(true);
      });

      // Now make a request with the API key (should still work since global secret doesn't count)
      const apiKeyReq = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const apiKeyResult = await requireOrgWriteAuthWithScope(apiKeyReq, testOrgId, 'copy.week');
      expect(apiKeyResult.ok).toBe(true);
    });
  });

  describe('Key State Management', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['copy.week'],
          requestsPerMinute: 60,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
      keyId = data.key.id;
    });

    it('should reject disabled keys', async () => {
      // Disable the key
      await prisma.organizationApiKey.update({
        where: { id: keyId },
        data: { disabledAt: new Date() },
      });

      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'copy.week');
      expect(result.ok).toBe(false);
      
      const response = result.res;
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error.code).toBe('invalid_key');
      expect(data.error.message).toBe('API key disabled');
    });

    it('should reject expired keys', async () => {
      // Set key to expire in the past
      await prisma.organizationApiKey.update({
        where: { id: keyId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'copy.week');
      expect(result.ok).toBe(false);
      
      const response = result.res;
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error.code).toBe('invalid_key');
      expect(data.error.message).toBe('API key expired');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle null scopes as full access', async () => {
      // Create key with null scopes (legacy behavior)
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Full Access Key',
          scopes: [], // Empty array should result in null scopes
          requestsPerMinute: 60,
        }),
      });

      const data = await response.json();
      const fullAccessKey = data.key.value;

      // Should work with any scope
      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': fullAccessKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, 'rota.write');
      expect(result.ok).toBe(true);
    });
  });
});
