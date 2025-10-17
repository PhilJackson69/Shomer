import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgWriteAuth, generateOrgApiKey } from '@/lib/org-auth';

// Mock environment variables
const originalEnv = process.env;

describe('Organization API Keys', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ACTION_SECRET: 'test_secret_16chars' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('generateOrgApiKey', () => {
    it('should generate a valid API key with correct format', () => {
      const orgId = 'test-org-123';
      const result = generateOrgApiKey(orgId);
      
      expect(result.prefix).toMatch(/^org_test_/);
      expect(result.value).toMatch(/^org_test_.*\./);
      expect(result.hash).toHaveLength(64); // SHA256 hex length
      expect(result.value).toContain(result.prefix);
    });

    it('should generate unique keys for different orgs', () => {
      const result1 = generateOrgApiKey('org1');
      const result2 = generateOrgApiKey('org2');
      
      expect(result1.prefix).not.toBe(result2.prefix);
      expect(result1.value).not.toBe(result2.value);
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('requireOrgWriteAuth', () => {
    const mockOrgId = 'test-org-123';
    
    it('should accept global action secret', async () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Action-Secret': 'test_secret_16chars' }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toEqual({ ok: true, via: 'global' });
    });

    it('should reject invalid global action secret', async () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Action-Secret': 'wrong_secret' }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    it('should reject request without any auth headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/test');

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    it('should accept valid org API key and update lastUsedAt', async () => {
      // Create a test API key
      const { prefix, value, hash } = generateOrgApiKey(mockOrgId);
      
      const mockKey = {
        id: 'key-123',
        orgId: mockOrgId,
        prefix,
        hash,
        revokedAt: null,
        expiresAt: null,
      };

      // Mock Prisma calls
      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockKey);
      vi.mocked(prisma.organizationApiKey.update).mockResolvedValue({} as any);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Org-Api-Key': value }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toEqual({ ok: true, via: 'orgkey', keyId: 'key-123' });
      expect(prisma.organizationApiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { lastUsedAt: expect.any(Date) }
      });
    });

    it('should reject expired org API key', async () => {
      const { prefix, value, hash } = generateOrgApiKey(mockOrgId);
      
      const mockKey = {
        id: 'key-123',
        orgId: mockOrgId,
        prefix,
        hash,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockKey);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Org-Api-Key': value }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    it('should reject revoked org API key', async () => {
      const { prefix, value, hash } = generateOrgApiKey(mockOrgId);
      
      const mockKey = {
        id: 'key-123',
        orgId: mockOrgId,
        prefix,
        hash,
        revokedAt: new Date(), // Revoked
        expiresAt: null,
      };

      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockKey);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Org-Api-Key': value }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });

    it('should reject non-existent org API key', async () => {
      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Org-Api-Key': 'org_test_invalid_key' }
      });

      const result = await requireOrgWriteAuth(req, mockOrgId);
      
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    });
  });

  describe('API Routes', () => {
    const mockOrgId = 'test-org-123';
    
    describe('GET /api/orgs/:orgId/api-keys', () => {
      it('should list API keys for an organization', async () => {
        const mockKeys = [
          {
            id: 'key-1',
            label: 'CI Pipeline',
            prefix: 'org_test_abc123',
            createdAt: new Date('2024-01-01'),
            expiresAt: null,
            revokedAt: null,
            lastUsedAt: new Date('2024-01-02'),
          },
          {
            id: 'key-2',
            label: null,
            prefix: 'org_test_def456',
            createdAt: new Date('2024-01-03'),
            expiresAt: new Date('2024-12-31'),
            revokedAt: null,
            lastUsedAt: null,
          }
        ];

        vi.mocked(prisma.organizationApiKey.findMany).mockResolvedValue(mockKeys);

        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.items).toHaveLength(2);
        expect(data.items[0].label).toBe('CI Pipeline');
        expect(data.items[1].label).toBeNull();
      });
    });

    describe('POST /api/orgs/:orgId/api-keys', () => {
      it('should create a new API key with global secret', async () => {
        const { prefix, value, hash } = generateOrgApiKey(mockOrgId);
        
        const mockCreatedKey = {
          id: 'key-new',
          label: 'Test Key',
          prefix,
          createdAt: new Date(),
          expiresAt: null,
        };

        vi.mocked(prisma.organizationApiKey.create).mockResolvedValue(mockCreatedKey);

        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Action-Secret': 'test_secret_16chars'
          },
          body: JSON.stringify({
            label: 'Test Key',
            expiresAt: null
          })
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.key.value).toBeDefined();
        expect(data.key.label).toBe('Test Key');
        expect(data.key.prefix).toBe(prefix);
      });

      it('should create a new API key with org API key', async () => {
        const { prefix: existingPrefix, value: existingValue, hash: existingHash } = generateOrgApiKey(mockOrgId);
        const { prefix: newPrefix, value: newValue, hash: newHash } = generateOrgApiKey(mockOrgId);
        
        const mockExistingKey = {
          id: 'key-existing',
          orgId: mockOrgId,
          prefix: existingPrefix,
          hash: existingHash,
          revokedAt: null,
          expiresAt: null,
        };

        const mockCreatedKey = {
          id: 'key-new',
          label: 'Test Key',
          prefix: newPrefix,
          createdAt: new Date(),
          expiresAt: null,
        };

        vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockExistingKey);
        vi.mocked(prisma.organizationApiKey.update).mockResolvedValue({} as any);
        vi.mocked(prisma.organizationApiKey.create).mockResolvedValue(mockCreatedKey);

        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Org-Api-Key': existingValue
          },
          body: JSON.stringify({
            label: 'Test Key',
            expiresAt: null
          })
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.key.value).toBeDefined();
        expect(data.key.label).toBe('Test Key');
      });

      it('should reject request without auth', async () => {
        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            label: 'Test Key'
          })
        });

        expect(response.status).toBe(401);
      });
    });

    describe('DELETE /api/orgs/:orgId/api-keys', () => {
      it('should revoke an API key', async () => {
        const { prefix, value, hash } = generateOrgApiKey(mockOrgId);
        
        const mockKey = {
          id: 'key-existing',
          orgId: mockOrgId,
          prefix,
          hash,
          revokedAt: null,
          expiresAt: null,
        };

        vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockKey);
        vi.mocked(prisma.organizationApiKey.update).mockResolvedValue({} as any);

        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys?id=key-123`, {
          method: 'DELETE',
          headers: {
            'X-Action-Secret': 'test_secret_16chars'
          }
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(prisma.organizationApiKey.update).toHaveBeenCalledWith({
          where: { id: 'key-123' },
          data: { revokedAt: expect.any(Date) }
        });
      });

      it('should reject request without id parameter', async () => {
        const response = await fetch(`http://localhost:3000/api/orgs/${mockOrgId}/api-keys`, {
          method: 'DELETE',
          headers: {
            'X-Action-Secret': 'test_secret_16chars'
          }
        });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Write Route Integration', () => {
    it('should allow copy-week with org API key', async () => {
      const { prefix, value, hash } = generateOrgApiKey('test-org');
      
      const mockKey = {
        id: 'key-123',
        orgId: 'test-org',
        prefix,
        hash,
        revokedAt: null,
        expiresAt: null,
      };

      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(mockKey);
      vi.mocked(prisma.organizationApiKey.update).mockResolvedValue({} as any);
      vi.mocked(prisma.onCall.findMany).mockResolvedValue([]);

      const response = await fetch(
        'http://localhost:3000/api/oncall/rota/copy-week?orgId=test-org&from=2025-01-20&weeks=1',
        {
          method: 'POST',
          headers: {
            'X-Org-Api-Key': value
          }
        }
      );

      // Should not be 401 (unauthorized)
      expect(response.status).not.toBe(401);
    });

    it('should reject copy-week without auth headers', async () => {
      const response = await fetch(
        'http://localhost:3000/api/oncall/rota/copy-week?orgId=test-org&from=2025-01-20&weeks=1',
        {
          method: 'POST'
        }
      );

      expect(response.status).toBe(401);
    });

    it('should reject copy-week with invalid org API key', async () => {
      vi.mocked(prisma.organizationApiKey.findFirst).mockResolvedValue(null);

      const response = await fetch(
        'http://localhost:3000/api/oncall/rota/copy-week?orgId=test-org&from=2025-01-20&weeks=1',
        {
          method: 'POST',
          headers: {
            'X-Org-Api-Key': 'org_test_invalid_key'
          }
        }
      );

      expect(response.status).toBe(401);
    });
  });
});
