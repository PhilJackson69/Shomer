import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getOrgSettings, POST as postOrgSettings } from '@/app/api/orgs/[orgId]/settings/route';
import { prisma } from '@/lib/prisma';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    organizationSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const mockPrisma = vi.mocked(prisma);

describe('Organization Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/orgs/:orgId/settings', () => {
    it('should return 404 when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/orgs/nonexistent/settings');
      const response = await getOrgSettings(request, { params: Promise.resolve({ orgId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Organization not found');
    });

    it('should return default settings when no settings exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.organizationSetting.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings');
      const response = await getOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.settings).toEqual({
        preferredTimezone: 'UTC',
        displayName: null,
        showRegion: true,
        timeFormat: '24h',
      });
    });

    it('should return existing settings when they exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.organizationSetting.findUnique.mockResolvedValue({
        orgId: 'test-org',
        preferredTimezone: 'America/Los_Angeles',
        displayName: 'Test Org Display Name',
        showRegion: false,
        timeFormat: '12h',
      } as any);

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings');
      const response = await getOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.settings).toEqual({
        preferredTimezone: 'America/Los_Angeles',
        displayName: 'Test Org Display Name',
        showRegion: false,
        timeFormat: '12h',
      });
    });
  });

  describe('POST /api/orgs/:orgId/settings', () => {
    it('should return 401 when X-Action-Secret header is missing', async () => {
      // Set up environment for the test
      process.env.ACTION_SECRET = 'test-secret-16-chars';
      const request = new NextRequest('http://localhost/api/orgs/test-org/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org',
          showRegion: true,
          timeFormat: '12h',
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or missing X-Action-Secret header');
    });

    it('should return 401 when X-Action-Secret header is invalid', async () => {
      // Set a different action secret in environment
      process.env.ACTION_SECRET = 'correct-secret-16-chars';

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'wrong-secret',
        },
        body: JSON.stringify({
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org',
          showRegion: true,
          timeFormat: '12h',
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or missing X-Action-Secret header');
    });

    it('should return 404 when organization not found', async () => {
      process.env.ACTION_SECRET = 'test-secret-16-chars';

      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/orgs/nonexistent/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-secret-16-chars',
        },
        body: JSON.stringify({
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org',
          showRegion: true,
          timeFormat: '12h',
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Organization not found');
    });

    it('should return 400 when validation fails', async () => {
      process.env.ACTION_SECRET = 'test-secret-16-chars';

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-secret-16-chars',
        },
        body: JSON.stringify({
          preferredTimezone: '', // Invalid: empty string
          displayName: 'Test Org',
          showRegion: true,
          timeFormat: 'invalid', // Invalid: not 24h or 12h
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Validation error');
      expect(data.details).toBeDefined();
    });

    it('should create new settings when none exist', async () => {
      process.env.ACTION_SECRET = 'test-secret-16-chars';

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      const mockSettings = {
        orgId: 'test-org',
        preferredTimezone: 'America/Los_Angeles',
        displayName: 'Test Org Display Name',
        showRegion: false,
        timeFormat: '12h',
      };

      mockPrisma.organizationSetting.upsert.mockResolvedValue(mockSettings as any);

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-secret-16-chars',
        },
        body: JSON.stringify({
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org Display Name',
          showRegion: false,
          timeFormat: '12h',
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.settings).toEqual({
        preferredTimezone: 'America/Los_Angeles',
        displayName: 'Test Org Display Name',
        showRegion: false,
        timeFormat: '12h',
      });

      expect(mockPrisma.organizationSetting.upsert).toHaveBeenCalledWith({
        where: { orgId: 'test-org' },
        update: {
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org Display Name',
          showRegion: false,
          timeFormat: '12h',
        },
        create: {
          orgId: 'test-org',
          preferredTimezone: 'America/Los_Angeles',
          displayName: 'Test Org Display Name',
          showRegion: false,
          timeFormat: '12h',
        },
      });
    });

    it('should update existing settings', async () => {
      process.env.ACTION_SECRET = 'test-secret-16-chars';

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      const mockSettings = {
        orgId: 'test-org',
        preferredTimezone: 'Europe/London',
        displayName: null,
        showRegion: true,
        timeFormat: '24h',
      };

      mockPrisma.organizationSetting.upsert.mockResolvedValue(mockSettings as any);

      const request = new NextRequest('http://localhost/api/orgs/test-org/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': 'test-secret-16-chars',
        },
        body: JSON.stringify({
          preferredTimezone: 'Europe/London',
          displayName: null,
          showRegion: true,
          timeFormat: '24h',
        }),
      });

      const response = await postOrgSettings(request, { params: Promise.resolve({ orgId: 'test-org' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.settings).toEqual({
        preferredTimezone: 'Europe/London',
        displayName: null,
        showRegion: true,
        timeFormat: '24h',
      });
    });
  });
});
