import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPublicNow } from '@/app/api/public/oncall/now/route';
import { GET as getPublicBadge } from '@/app/api/public/oncall/badge.svg/route';
import { findOrgByToken } from '@/lib/org-token';

// Mock dependencies
vi.mock('@/lib/org-token');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    onCall: {
      findFirst: vi.fn(),
    },
  },
}));

const mockFindOrgByToken = vi.mocked(findOrgByToken);

describe('Public JSON Now API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/public/oncall/now', () => {
    it('should return 404 for missing token', async () => {
      const request = new NextRequest('http://localhost/api/public/oncall/now');
      const response = await getPublicNow(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('should return 404 for invalid token', async () => {
      mockFindOrgByToken.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/public/oncall/now?token=invalid-token');
      const response = await getPublicNow(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('should return 200 with valid token and current shift', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock current shift
      mockPrisma.onCall.findFirst.mockResolvedValue({
        id: 'shift-1',
        userId: 'user-1',
        orgId: 'test-org',
        startsAt: new Date('2024-01-01T00:00:00Z'),
        endsAt: new Date('2024-01-01T12:00:00Z'),
        region: 'US',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      const request = new NextRequest('http://localhost/api/public/oncall/now?token=valid-token');
      const response = await getPublicNow(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.ok).toBe(true);
      expect(data.org).toEqual({
        id: 'test-org',
        name: 'Test Organization',
      });
      expect(data.now).toEqual({
        id: 'shift-1',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
        startsAt: '2024-01-01T00:00:00.000Z',
        endsAt: '2024-01-01T12:00:00.000Z',
        region: 'US',
      });
      expect(data.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Check caching headers
      expect(response.headers.get('cache-control')).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    });

    it('should return 200 with null now when no current shift', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock no current shift
      mockPrisma.onCall.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/public/oncall/now?token=valid-token');
      const response = await getPublicNow(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.ok).toBe(true);
      expect(data.now).toBeNull();
      expect(data.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

describe('Public SVG Badge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/public/oncall/badge.svg', () => {
    it('should return 404 for missing token', async () => {
      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(404);
    });

    it('should return 404 for invalid token', async () => {
      mockFindOrgByToken.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=invalid-token');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(404);
    });

    it('should return SVG with user name when current shift exists', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock current shift
      mockPrisma.onCall.findFirst.mockResolvedValue({
        id: 'shift-1',
        userId: 'user-1',
        orgId: 'test-org',
        startsAt: new Date('2024-01-01T00:00:00Z'),
        endsAt: new Date('2024-01-01T12:00:00Z'),
        region: 'US',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=valid-token&theme=light');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=300');
      
      const svgContent = await response.text();
      expect(svgContent).toContain('ON-CALL');
      expect(svgContent).toContain('John Doe');
      expect(svgContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(svgContent).toContain('<svg');
    });

    it('should return SVG with "—" when no current shift', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock no current shift
      mockPrisma.onCall.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=valid-token&theme=light');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(200);
      const svgContent = await response.text();
      expect(svgContent).toContain('ON-CALL');
      expect(svgContent).toContain('—');
    });

    it('should use light theme colors by default', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      mockPrisma.onCall.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=valid-token');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(200);
      const svgContent = await response.text();
      expect(svgContent).toContain('#F3F4F6'); // light background
      expect(svgContent).toContain('#374151'); // light label background
      expect(svgContent).toContain('#FFFFFF'); // light label foreground
      expect(svgContent).toContain('#111827'); // light value foreground
    });

    it('should use dark theme colors when theme=dark', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      mockPrisma.onCall.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=valid-token&theme=dark');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(200);
      const svgContent = await response.text();
      expect(svgContent).toContain('#111827'); // dark background
      expect(svgContent).toContain('#4B5563'); // dark label background
      expect(svgContent).toContain('#E5E7EB'); // dark label foreground
      expect(svgContent).toContain('#F9FAFB'); // dark value foreground
      
      // Ensure light theme colors are not present
      expect(svgContent).not.toContain('#F3F4F6'); // light background
      expect(svgContent).not.toContain('#374151'); // light label background
    });

    it('should handle user with email only (no name)', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock current shift with user having only email
      mockPrisma.onCall.findFirst.mockResolvedValue({
        id: 'shift-1',
        userId: 'user-1',
        orgId: 'test-org',
        startsAt: new Date('2024-01-01T00:00:00Z'),
        endsAt: new Date('2024-01-01T12:00:00Z'),
        region: 'US',
        user: {
          id: 'user-1',
          name: null,
          email: 'john@example.com',
        },
      });

      const request = new NextRequest('http://localhost/api/public/oncall/badge.svg?token=valid-token');
      const response = await getPublicBadge(request);
      
      expect(response.status).toBe(200);
      const svgContent = await response.text();
      expect(svgContent).toContain('ON-CALL');
      expect(svgContent).toContain('john@example.com');
    });
  });
});
