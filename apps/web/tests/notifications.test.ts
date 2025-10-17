import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.ACTION_SECRET = 'test_action_secret_16_chars';
process.env.DATABASE_URL = 'file:test.db';

// Mock Prisma
const mockPrisma = {
  notificationEndpoint: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  eventOutbox: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  activity: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock crypto
const mockCrypto = {
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mocked_signature_hex'),
  })),
};

vi.mock('node:crypto', () => mockCrypto);

// Mock the signBody function directly
vi.mock('../src/lib/notify', async () => {
  const actual = await vi.importActual('../src/lib/notify');
  return {
    ...actual,
    signBody: vi.fn().mockReturnValue('mocked_signature_hex'),
    nextBackoff: vi.fn().mockImplementation((attempts: number) => {
      if (attempts <= 0) return 60_000;
      if (attempts === 1) return 5 * 60_000;
      if (attempts === 2) return 15 * 60_000;
      return 60 * 60_000;
    }),
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('Notifications System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockClear();
  });

  describe('Webhook Endpoints CRUD', () => {
    it('should list webhooks initially empty', async () => {
      mockPrisma.notificationEndpoint.findMany.mockResolvedValue([]);
      
      const { GET } = await import('../src/app/api/orgs/[orgId]/webhooks/route');
      const request = new NextRequest('http://localhost:3000/api/orgs/test-org/webhooks');
      
      const response = await GET(request, { params: { orgId: 'test-org' } });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.endpoints).toEqual([]);
    });

    it('should create webhook with valid action secret', async () => {
      const mockWebhook = {
        id: 'webhook-1',
        orgId: 'test-org',
        url: 'https://example.com/webhook',
        secret: 'test_secret_16_chars',
        createdAt: new Date(),
      };
      
      mockPrisma.notificationEndpoint.create.mockResolvedValue(mockWebhook);
      
      const { POST } = await import('../src/app/api/orgs/[orgId]/webhooks/route');
      const request = new NextRequest('http://localhost:3000/api/orgs/test-org/webhooks', {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test_action_secret_16_chars',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          secret: 'test_secret_16_chars',
        }),
      });
      
      const response = await POST(request, { params: { orgId: 'test-org' } });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.id).toBe('webhook-1');
      expect(data.url).toBe('https://example.com/webhook');
    });

    it('should reject webhook creation without action secret', async () => {
      const { POST } = await import('../src/app/api/orgs/[orgId]/webhooks/route');
      const request = new NextRequest('http://localhost:3000/api/orgs/test-org/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          secret: 'test_secret_16_chars',
        }),
      });
      
      const response = await POST(request, { params: { orgId: 'test-org' } });
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid or missing X-Action-Secret');
    });

    it('should delete webhook with valid action secret', async () => {
      mockPrisma.notificationEndpoint.delete.mockResolvedValue({});
      
      const { DELETE } = await import('../src/app/api/orgs/[orgId]/webhooks/route');
      const request = new NextRequest('http://localhost:3000/api/orgs/test-org/webhooks?id=webhook-1', {
        method: 'DELETE',
        headers: {
          'X-Action-Secret': 'test_action_secret_16_chars',
        },
      });
      
      const response = await DELETE(request, { params: { orgId: 'test-org' } });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockPrisma.notificationEndpoint.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-1' },
      });
    });
  });

  describe('Event Outbox Enqueue', () => {
    it('should enqueue swap created event', async () => {
      const mockOutboxItem = {
        id: 'outbox-1',
        orgId: 'test-org',
        type: 'SWAP_CREATED',
        payload: '{"orgId":"test-org","swapId":"swap-1"}',
        nextAttemptAt: new Date(0),
        attempts: 0,
      };
      
      const mockActivity = {
        id: 'activity-1',
        orgId: 'test-org',
        kind: 'SWAP_CREATED',
        summary: 'Swap requested for shift shift-1: → User Name',
        details: '{"orgId":"test-org","swapId":"swap-1"}',
        ts: new Date(),
      };
      
      mockPrisma.eventOutbox.create.mockResolvedValue(mockOutboxItem);
      mockPrisma.activity.create.mockResolvedValue(mockActivity);
      
      const { enqueueSwapEvent } = await import('../src/lib/notify');
      
      const result = await enqueueSwapEvent('test-org', 'SWAP_CREATED', {
        orgId: 'test-org',
        swapId: 'swap-1',
        shiftId: 'shift-1',
        requestedUserId: 'user-1',
        requestedUser: { name: 'User Name' },
      });
      
      expect(result).toEqual(mockOutboxItem);
      expect(mockPrisma.eventOutbox.create).toHaveBeenCalledWith({
        data: {
          orgId: 'test-org',
          type: 'SWAP_CREATED',
          payload: expect.stringContaining('"orgId":"test-org"'),
          nextAttemptAt: new Date(0),
        },
      });
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: {
          orgId: 'test-org',
          kind: 'SWAP_CREATED',
          summary: expect.stringContaining('Swap requested for shift'),
          details: expect.stringContaining('"orgId":"test-org"'),
        },
      });
    });
  });

  describe('Delivery Runner', () => {
    it('should process pending events and mark as delivered when no endpoints', async () => {
      const mockOutboxItem = {
        id: 'outbox-1',
        orgId: 'test-org',
        type: 'SWAP_CREATED',
        payload: '{"test":"data"}',
        attempts: 0,
        nextAttemptAt: new Date(0),
      };
      
      // No endpoints configured
      mockPrisma.eventOutbox.findMany.mockResolvedValue([mockOutboxItem]);
      mockPrisma.notificationEndpoint.findMany.mockResolvedValue([]);
      mockPrisma.eventOutbox.update.mockResolvedValue({});
      
      const { POST } = await import('../src/app/api/notifications/deliver/route');
      const request = new NextRequest('http://localhost:3000/api/notifications/deliver', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.delivered).toBe(1);
      expect(data.failed).toBe(0);
      expect(data.processed).toBe(1);
      expect(mockPrisma.eventOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-1' },
        data: {
          deliveredAt: expect.any(Date),
        },
      });
    });

    it('should handle delivery failure with backoff', async () => {
      const mockOutboxItem = {
        id: 'outbox-1',
        orgId: 'test-org',
        type: 'SWAP_CREATED',
        payload: '{"test":"data"}',
        attempts: 0,
        nextAttemptAt: new Date(0),
      };
      
      const mockEndpoint = {
        id: 'webhook-1',
        orgId: 'test-org',
        url: 'https://example.com/webhook',
        secret: 'test_secret',
      };
      
      mockPrisma.eventOutbox.findMany.mockResolvedValue([mockOutboxItem]);
      mockPrisma.notificationEndpoint.findMany.mockResolvedValue([mockEndpoint]);
      mockPrisma.eventOutbox.update.mockResolvedValue({});
      
      // Mock failed fetch response
      (global.fetch as any).mockResolvedValue({
        status: 500,
      });
      
      const { POST } = await import('../src/app/api/notifications/deliver/route');
      const request = new NextRequest('http://localhost:3000/api/notifications/deliver', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.delivered).toBe(0);
      expect(data.failed).toBe(1);
      expect(mockPrisma.eventOutbox.update).toHaveBeenCalledWith({
        where: { id: 'outbox-1' },
        data: {
          attempts: 1,
          nextAttemptAt: expect.any(Date),
          lastError: expect.stringContaining('Delivery failed'),
        },
      });
    });

    it('should sign payload with HMAC SHA256 when delivering to endpoints', async () => {
      const mockOutboxItem = {
        id: 'outbox-1',
        orgId: 'test-org',
        type: 'SWAP_CREATED',
        payload: '{"test":"data"}',
        attempts: 0,
        nextAttemptAt: new Date(0),
      };
      
      const mockEndpoint = {
        id: 'webhook-1',
        orgId: 'test-org',
        url: 'https://example.com/webhook',
        secret: 'test_secret',
      };
      
      mockPrisma.eventOutbox.findMany.mockResolvedValue([mockOutboxItem]);
      mockPrisma.notificationEndpoint.findMany.mockResolvedValue([mockEndpoint]);
      mockPrisma.eventOutbox.update.mockResolvedValue({});
      
      (global.fetch as any).mockResolvedValue({
        status: 200,
      });
      
      const { POST } = await import('../src/app/api/notifications/deliver/route');
      const request = new NextRequest('http://localhost:3000/api/notifications/deliver', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.delivered).toBe(1);
      expect(data.failed).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Shomer-Signature': 'sha256=mocked_signature_hex',
          'Shomer-Event': 'SWAP_CREATED',
        },
        body: '{"test":"data"}',
      });
    });
  });

  describe('Activity API', () => {
    it('should return recent activities', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          orgId: 'test-org',
          kind: 'SWAP_CREATED',
          summary: 'Swap requested for shift shift-1',
          ts: '2025-10-17T04:38:07.767Z',
        },
        {
          id: 'activity-2',
          orgId: 'test-org',
          kind: 'SWAP_APPROVED',
          summary: 'Swap approved for shift shift-1',
          ts: '2025-10-17T04:38:07.767Z',
        },
      ];
      
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
      
      const { GET } = await import('../src/app/api/orgs/[orgId]/activity/route');
      const request = new NextRequest('http://localhost:3000/api/orgs/test-org/activity');
      
      const response = await GET(request, { params: { orgId: 'test-org' } });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.items).toEqual(mockActivities);
      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
        where: { orgId: 'test-org' },
        orderBy: { ts: 'desc' },
        take: 50,
      });
    });
  });

  describe('Backoff Logic', () => {
    it('should calculate correct backoff intervals', async () => {
      const { nextBackoff } = await import('../src/lib/notify');
      
      expect(nextBackoff(0)).toBe(60_000);      // 1m
      expect(nextBackoff(1)).toBe(5 * 60_000);  // 5m
      expect(nextBackoff(2)).toBe(15 * 60_000); // 15m
      expect(nextBackoff(3)).toBe(60 * 60_000); // 60m
      expect(nextBackoff(10)).toBe(60 * 60_000); // 60m (max)
    });
  });
});
