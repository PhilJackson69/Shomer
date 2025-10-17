import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { requireOrgWriteAuthWithScope } from '../src/lib/org-auth-scoped';

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    ACTION_SECRET: 'test-action-secret',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Organization API Key Scopes and Rate Limiting', () => {
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

  describe('API Key Creation with Scopes', () => {
    it('should create API key with scopes and rate limit', async () => {
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['copy.week', 'settings.write'],
          requestsPerMinute: 60,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.key.label).toBe('Test Key');
      expect(data.key.scopes).toBe('copy.week,settings.write');
      expect(data.key.requestsPerMinute).toBe(60);
      expect(data.key.value).toBeDefined();

      testApiKey = data.key.value;
      testApiKeyId = data.key.id;
    });

    it('should list API keys with scopes and rate limits', async () => {
      // First create a key
      await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Test Key',
          scopes: ['rota.write', 'copy.week'],
          requestsPerMinute: 120,
        }),
      });

      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].scopes).toBe('copy.week,rota.write');
      expect(data.items[0].requestsPerMinute).toBe(120);
    });
  });

  describe('Scope Enforcement', () => {
    beforeEach(async () => {
      // Create API key with limited scopes
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Limited Key',
          scopes: ['copy.week'],
          requestsPerMinute: 2,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
      testApiKeyId = data.key.id;
    });

    it('should allow access with correct scope', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, ['copy.week']);
      expect(result.ok).toBe(true);
      expect(result.via).toBe('orgkey');
      expect(result.keyId).toBe(testApiKeyId);
    });

    it('should deny access with missing scope', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, ['rota.write']);
      expect(result).toBeInstanceOf(Response);
      
      const response = result as Response;
      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toBe('forbidden_scope');
      expect(data.required).toEqual(['rota.write']);
    });

    it('should bypass scopes with global secret', async () => {
      const req = new NextRequest('http://localhost/api/oncall/rota', {
        headers: {
          'X-Action-Secret': 'test-action-secret',
        },
      });

      const result = await requireOrgWriteAuthWithScope(req, testOrgId, ['rota.write']);
      expect(result.ok).toBe(true);
      expect(result.via).toBe('global');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Create API key with rate limit of 2 requests per minute
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Rate Limited Key',
          scopes: ['copy.week'],
          requestsPerMinute: 2,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
      testApiKeyId = data.key.id;
    });

    it('should allow requests within rate limit', async () => {
      const req1 = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const req2 = new NextRequest('http://localhost/api/oncall/rota/copy-week', {
        headers: {
          'X-Org-Api-Key': testApiKey,
        },
      });

      const result1 = await requireOrgWriteAuthWithScope(req1, testOrgId, ['copy.week']);
      const result2 = await requireOrgWriteAuthWithScope(req2, testOrgId, ['copy.week']);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });

    it('should rate limit when exceeded', async () => {
      // Make 3 requests (limit is 2)
      const requests = Array(3).fill(null).map(() => 
        new NextRequest('http://localhost/api/oncall/rota/copy-week', {
          headers: {
            'X-Org-Api-Key': testApiKey,
          },
        })
      );

      const results = await Promise.all(
        requests.map(req => requireOrgWriteAuthWithScope(req, testOrgId, ['copy.week']))
      );

      // First two should succeed
      expect(results[0].ok).toBe(true);
      expect(results[1].ok).toBe(true);

      // Third should be rate limited
      expect(results[2]).toBeInstanceOf(Response);
      const response = results[2] as Response;
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.error).toBe('rate_limited');
    });

    it('should not rate limit when requestsPerMinute is null', async () => {
      // Create API key without rate limit
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Unlimited Key',
          scopes: ['copy.week'],
          requestsPerMinute: null,
        }),
      });

      const data = await response.json();
      const unlimitedKey = data.key.value;

      // Make many requests
      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost/api/oncall/rota/copy-week', {
          headers: {
            'X-Org-Api-Key': unlimitedKey,
          },
        })
      );

      const results = await Promise.all(
        requests.map(req => requireOrgWriteAuthWithScope(req, testOrgId, ['copy.week']))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.ok).toBe(true);
      });
    });
  });

  describe('Route Integration Tests', () => {
    beforeEach(async () => {
      // Create API key with specific scopes
      const response = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'Route Test Key',
          scopes: ['copy.week'],
          requestsPerMinute: 60,
        }),
      });

      const data = await response.json();
      testApiKey = data.key.value;
    });

    it('should enforce scopes on copy-week route', async () => {
      // Test with correct scope
      const response1 = await fetch(
        `/api/oncall/rota/copy-week?orgId=${testOrgId}&from=2024-01-01&weeks=1`,
        {
          method: 'POST',
          headers: {
            'X-Org-Api-Key': testApiKey,
          },
        }
      );
      expect(response1.status).toBe(200);

      // Create key without copy.week scope
      const keyResponse = await fetch(`/api/orgs/${testOrgId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-action-secret',
        },
        body: JSON.stringify({
          label: 'No Copy Key',
          scopes: ['rota.write'],
          requestsPerMinute: 60,
        }),
      });

      const keyData = await keyResponse.json();
      const noCopyKey = keyData.key.value;

      // Test with incorrect scope
      const response2 = await fetch(
        `/api/oncall/rota/copy-week?orgId=${testOrgId}&from=2024-01-01&weeks=1`,
        {
          method: 'POST',
          headers: {
            'X-Org-Api-Key': noCopyKey,
          },
        }
      );
      expect(response2.status).toBe(403);
      
      const errorData = await response2.json();
      expect(errorData.error).toBe('forbidden_scope');
    });
  });
});
