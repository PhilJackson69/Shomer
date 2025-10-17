import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET as getRotaCsv } from '@/app/api/oncall/rota.csv/route';
import { GET as getRotaIcs } from '@/app/api/oncall/rota.ics/route';
import { POST as rotateToken } from '@/app/api/orgs/[orgId]/rotate-share-token/route';
import { prisma } from '@/lib/prisma';
import { findOrgByToken, rotateOrgShareToken } from '@/lib/org-token';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    onCall: {
      findMany: vi.fn(),
    },
    onCallAudit: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the action auth
vi.mock('@/lib/action-auth', () => ({
  requireActionSecret: vi.fn(),
}));

// Mock the org-token helper
vi.mock('@/lib/org-token', () => ({
  findOrgByToken: vi.fn(),
  rotateOrgShareToken: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockRequireActionSecret = vi.mocked(await import('@/lib/action-auth')).requireActionSecret;
const mockFindOrgByToken = vi.mocked(findOrgByToken);
const mockRotateOrgShareToken = vi.mocked(rotateOrgShareToken);

describe('OnCall Share Token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Token-based CSV Export', () => {
    it('should return 400 when neither orgId nor token provided', async () => {
      const request = new NextRequest('http://localhost/api/oncall/rota.csv');
      
      const response = await getRotaCsv(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('orgId_or_token_required');
    });

    it('should return 404 for invalid token', async () => {
      mockFindOrgByToken.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?token=invalid-token');
      
      const response = await getRotaCsv(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('invalid_token');
    });

    it('should return CSV with valid token', async () => {
      // Mock token lookup
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token-123',
      });

      // Mock shifts data
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?token=valid-token-123');
      
      const response = await getRotaCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(csvContent).toContain('shift_id,org_id,user_id,user_name,starts_at_utc,ends_at_utc,duration_hours,region');
      expect(csvContent).toContain('shift1,test-org,user1,John Doe');
    });
  });

  describe('Token-based ICS Export', () => {
    it('should return 404 for invalid token', async () => {
      mockFindOrgByToken.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?token=invalid-token');
      
      const response = await getRotaIcs(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('invalid_token');
    });

    it('should return ICS with valid token', async () => {
      // Mock token lookup
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token-123',
      });

      // Mock shifts data
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?token=valid-token-123');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('BEGIN:VEVENT');
      expect(icsContent).toContain('UID:shift_shift1@shomer');
      expect(icsContent).toContain('SUMMARY:On-Call: John Doe (@Test Organization)');
    });
  });

  describe('Token Rotation', () => {
    it('should return 401 when missing X-Action-Secret header', async () => {
      // Mock auth failure
      const mockResponse = new Response(
        JSON.stringify({ error: 'Invalid or missing X-Action-Secret header' }),
        { status: 401 }
      );
      Object.setPrototypeOf(mockResponse, NextResponse.prototype);
      mockRequireActionSecret.mockReturnValue(mockResponse as any);

      const request = new NextRequest('http://localhost/api/orgs/test-org/rotate-share-token', {
        method: 'POST',
      });
      
      const response = await rotateToken(request, { params: { orgId: 'test-org' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('X-Action-Secret');
    });

    it('should successfully rotate token', async () => {
      // Mock auth success
      mockRequireActionSecret.mockReturnValue({ ok: true });

      // Mock token rotation
      mockRotateOrgShareToken.mockResolvedValue('new-token-456');

      const request = new NextRequest('http://localhost/api/orgs/test-org/rotate-share-token', {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test-secret',
        },
      });
      
      const response = await rotateToken(request, { params: { orgId: 'test-org' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.shareToken).toBe('new-token-456');
      expect(mockRotateOrgShareToken).toHaveBeenCalledWith('test-org');
    });

    it('should invalidate old token after rotation', async () => {
      const oldToken = 'old-token-123';
      const newToken = 'new-token-456';

      // Mock token lookup - first call returns org, second call returns null (invalidated)
      mockFindOrgByToken
        .mockResolvedValueOnce({
          id: 'test-org',
          name: 'Test Organization',
          shareToken: oldToken,
        })
        .mockResolvedValueOnce(null);

      // Mock shifts for old token
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      // Test old token works initially
      const oldTokenRequest = new NextRequest(`http://localhost/api/oncall/rota.csv?token=${oldToken}`);
      const oldTokenResponse = await getRotaCsv(oldTokenRequest);
      expect(oldTokenResponse.status).toBe(200);

      // Simulate token rotation
      mockRotateOrgShareToken.mockResolvedValue(newToken);

      // Mock auth success for rotation
      mockRequireActionSecret.mockReturnValue({ ok: true });

      const rotateRequest = new NextRequest('http://localhost/api/orgs/test-org/rotate-share-token', {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test-secret',
        },
      });
      
      const rotateResponse = await rotateToken(rotateRequest, { params: { orgId: 'test-org' } });
      expect(rotateResponse.status).toBe(200);

      // Test old token now fails
      const invalidTokenRequest = new NextRequest(`http://localhost/api/oncall/rota.csv?token=${oldToken}`);
      const invalidTokenResponse = await getRotaCsv(invalidTokenRequest);
      const invalidTokenData = await invalidTokenResponse.json();

      expect(invalidTokenResponse.status).toBe(404);
      expect(invalidTokenData.error).toBe('invalid_token');
    });
  });

  describe('Internal orgId Access', () => {
    it('should still work with orgId parameter (internal access)', async () => {
      // Mock organization exists
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      // Mock shifts data
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=test-org');
      
      const response = await getRotaCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(csvContent).toContain('shift_id,org_id,user_id,user_name,starts_at_utc,ends_at_utc,duration_hours,region');
    });

    it('should work with orgId for ICS export', async () => {
      // Mock organization exists
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      // Mock shifts data
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('BEGIN:VEVENT');
    });
  });

  describe('Organization Scoping', () => {
    it('should only return data for the organization associated with the token', async () => {
      // Mock token lookup for org A
      mockFindOrgByToken.mockResolvedValue({
        id: 'org-a',
        name: 'Organization A',
        shareToken: 'token-org-a',
      });

      // Mock shifts data for org A only
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift-a-1',
          orgId: 'org-a',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: 'US-East',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?token=token-org-a');
      
      const response = await getRotaCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      
      // Verify the query was scoped to org-a
      expect(mockPrisma.onCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-a',
          }),
        })
      );
      
      // Verify CSV contains only org-a data
      expect(csvContent).toContain('org-a');
      expect(csvContent).not.toContain('org-b');
    });
  });
});
