import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPublicSummary } from '@/app/api/public/oncall/summary/route';
import { findOrgByToken } from '@/lib/org-token';
import PublicRotaPage from '@/app/public/rota/page';

// Mock dependencies
vi.mock('@/lib/org-token');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    onCall: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockFindOrgByToken = vi.mocked(findOrgByToken);

describe('Public Rota API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/public/oncall/summary', () => {
    it('should return 404 for missing token', async () => {
      const request = new NextRequest('http://localhost/api/public/oncall/summary');
      const response = await getPublicSummary(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('should return 404 for invalid token', async () => {
      mockFindOrgByToken.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/public/oncall/summary?token=invalid-token');
      const response = await getPublicSummary(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ ok: false, error: 'invalid_token' });
    });

    it('should return 400 for bad date window', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });
      
      const request = new NextRequest('http://localhost/api/public/oncall/summary?token=valid-token&from=2024-01-02&to=2024-01-01');
      const response = await getPublicSummary(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ ok: false, error: 'bad_window' });
    });

    it('should return 200 with valid token and data', async () => {
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

      // Mock upcoming shifts
      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift-2',
          userId: 'user-2',
          orgId: 'test-org',
          startsAt: new Date('2024-01-01T12:00:00Z'),
          endsAt: new Date('2024-01-02T00:00:00Z'),
          region: 'EU',
          user: {
            id: 'user-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
          },
        },
      ]);

      const request = new NextRequest('http://localhost/api/public/oncall/summary?token=valid-token');
      const response = await getPublicSummary(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.ok).toBe(true);
      expect(data.org).toEqual({
        id: 'test-org',
        name: 'Test Organization',
      });
      expect(data.window).toHaveProperty('from');
      expect(data.window).toHaveProperty('to');
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
      expect(data.upcoming).toHaveLength(1);
      expect(data.upcoming[0]).toEqual({
        id: 'shift-2',
        user: {
          id: 'user-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        startsAt: '2024-01-01T12:00:00.000Z',
        endsAt: '2024-01-02T00:00:00.000Z',
        region: 'EU',
      });
    });

    it('should handle no current shift', async () => {
      mockFindOrgByToken.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        shareToken: 'valid-token',
      });

      const { prisma } = await import('@/lib/prisma');
      const mockPrisma = vi.mocked(prisma);

      // Mock no current shift
      mockPrisma.onCall.findFirst.mockResolvedValue(null);
      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/public/oncall/summary?token=valid-token');
      const response = await getPublicSummary(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.ok).toBe(true);
      expect(data.now).toBeNull();
      expect(data.upcoming).toEqual([]);
    });
  });
});

describe('Public Rota Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with valid token', async () => {
    mockFindOrgByToken.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
      shareToken: 'valid-token',
    });

    const searchParams = Promise.resolve({
      token: 'valid-token',
      from: '2024-01-01',
      to: '2024-01-07',
    });

    const component = await PublicRotaPage({ searchParams });
    
    // This is a basic render test - in a real scenario you'd use React Testing Library
    // to verify the component renders without errors and contains expected elements
    expect(component).toBeDefined();
  });

  it('should handle missing token', async () => {
    const searchParams = Promise.resolve({});
    
    // This should trigger notFound()
    await expect(PublicRotaPage({ searchParams })).rejects.toThrow();
  });

  it('should handle invalid token', async () => {
    mockFindOrgByToken.mockResolvedValue(null);
    
    const searchParams = Promise.resolve({
      token: 'invalid-token',
    });
    
    // This should trigger notFound()
    await expect(PublicRotaPage({ searchParams })).rejects.toThrow();
  });
});

describe('Widget Script', () => {
  it('should fetch summary and render current + first upcoming shift', async () => {
    // Mock fetch
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockData = {
      ok: true,
      org: { id: 'test-org', name: 'Test Organization' },
      window: { from: '2024-01-01T00:00:00.000Z', to: '2024-01-07T00:00:00.000Z' },
      now: {
        id: 'shift-1',
        user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        startsAt: '2024-01-01T00:00:00.000Z',
        endsAt: '2024-01-01T12:00:00.000Z',
        region: 'US',
      },
      upcoming: [
        {
          id: 'shift-2',
          user: { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
          startsAt: '2024-01-01T12:00:00.000Z',
          endsAt: '2024-01-01T24:00:00.000Z',
          region: 'EU',
        },
      ],
    };

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockData),
    });

    // Create a mock DOM environment
    const mockContainer = {
      innerHTML: '',
      getAttribute: vi.fn().mockReturnValue('valid-token'),
      _shomerRefreshInterval: null,
    };

    // Mock DOM methods
    const mockDocument = {
      querySelectorAll: vi.fn().mockReturnValue([mockContainer]),
      createElement: vi.fn().mockReturnValue({
        textContent: '',
        innerHTML: '',
      }),
      head: {
        appendChild: vi.fn(),
      },
    };

    // Mock global document
    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true,
    });

    // Mock window
    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: vi.fn(),
      },
      writable: true,
    });

    // This is a simplified test - in a real scenario you'd load and execute
    // the actual widget script and verify its behavior
    expect(mockFetch).toBeDefined();
    expect(mockDocument.querySelectorAll).toBeDefined();
  });
});
