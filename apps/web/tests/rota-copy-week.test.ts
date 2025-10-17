import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/oncall/rota/copy-week/route';
import { prisma } from '@/lib/prisma';

// Mock the action auth
vi.mock('@/lib/action-auth', () => ({
  requireActionSecret: vi.fn().mockReturnValue({ ok: true }),
}));

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    onCall: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    onCallAudit: {
      create: vi.fn(),
    },
  },
}));

describe('Rota Copy Week API', () => {
  const mockOrgId = 'org_123';
  const mockUserId1 = 'user_1';
  const mockUserId2 = 'user_2';
  const mockStartDate = '2025-01-20'; // Monday
  const mockActionSecret = 'test_secret_16chars';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock successful auth
    const { requireActionSecret } = await import('@/lib/action-auth');
    requireActionSecret.mockReturnValue({ ok: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return 401 when missing X-Action-Secret header', async () => {
    // Mock environment variable
    const originalEnv = process.env.ACTION_SECRET;
    process.env.ACTION_SECRET = 'test_secret';
    
    // Mock the function to return 401 response
    const { requireActionSecret } = await import('@/lib/action-auth');
    requireActionSecret.mockReturnValue(
      NextResponse.json({ error: 'Invalid or missing X-Action-Secret header' }, { status: 401 })
    );

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=1`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid or missing X-Action-Secret header');
    
    // Restore environment
    process.env.ACTION_SECRET = originalEnv;
  });

  it('should create the same number of shifts as the source week (happy path)', async () => {
    // Mock source shifts
    const mockSourceShifts = [
      {
        id: 'shift_1',
        userId: mockUserId1,
        startsAt: new Date('2025-01-20T09:00:00.000Z'),
        endsAt: new Date('2025-01-20T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: {
          id: mockUserId1,
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      {
        id: 'shift_2',
        userId: mockUserId2,
        startsAt: new Date('2025-01-21T09:00:00.000Z'),
        endsAt: new Date('2025-01-21T17:00:00.000Z'),
        region: 'US-West',
        orgId: mockOrgId,
        user: {
          id: mockUserId2,
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      },
      {
        id: 'shift_3',
        userId: mockUserId1,
        startsAt: new Date('2025-01-22T09:00:00.000Z'),
        endsAt: new Date('2025-01-22T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: {
          id: mockUserId1,
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
    ];

    // Mock no existing overlaps
    prisma.onCall.findMany
      .mockResolvedValueOnce(mockSourceShifts) // Source week query
      .mockResolvedValueOnce([]) // Overlap check for shift 1
      .mockResolvedValueOnce([]) // Overlap check for shift 2
      .mockResolvedValueOnce([]); // Overlap check for shift 3

    // Mock successful creates
    prisma.onCall.create
      .mockResolvedValueOnce({ id: 'new_shift_1', ...mockSourceShifts[0] })
      .mockResolvedValueOnce({ id: 'new_shift_2', ...mockSourceShifts[1] })
      .mockResolvedValueOnce({ id: 'new_shift_3', ...mockSourceShifts[2] });

    // Mock successful audit creates
    prisma.onCallAudit.create
      .mockResolvedValueOnce({ id: 'audit_1' })
      .mockResolvedValueOnce({ id: 'audit_2' })
      .mockResolvedValueOnce({ id: 'audit_3' });

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=1`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(3);
    expect(data.skipped).toBe(0);
    expect(data.targetFrom).toBe('2025-01-27T00:00:00.000Z');
    expect(data.targetTo).toBe('2025-02-02T23:59:59.999Z');

    // Verify prisma calls
    expect(prisma.onCall.findMany).toHaveBeenCalledTimes(4); // 1 source + 3 overlap checks
    expect(prisma.onCall.create).toHaveBeenCalledTimes(3);
    expect(prisma.onCallAudit.create).toHaveBeenCalledTimes(3);
  });

  it('should skip all shifts when running twice (idempotency)', async () => {
    // Mock source shifts
    const mockSourceShifts = [
      {
        id: 'shift_1',
        userId: mockUserId1,
        startsAt: new Date('2025-01-20T09:00:00.000Z'),
        endsAt: new Date('2025-01-20T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: { id: mockUserId1, name: 'John Doe', email: 'john@example.com' },
      },
    ];

    // Mock existing overlaps (target shifts already exist)
    prisma.onCall.findMany
      .mockResolvedValueOnce(mockSourceShifts) // Source week query
      .mockResolvedValueOnce([{ id: 'existing_shift' }]); // Overlap check - found existing

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=1`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(1);

    // Verify no creates were called
    expect(prisma.onCall.create).not.toHaveBeenCalled();
    expect(prisma.onCallAudit.create).not.toHaveBeenCalled();
  });

  it('should handle mixed case: pre-create one colliding shift', async () => {
    // Mock source shifts
    const mockSourceShifts = [
      {
        id: 'shift_1',
        userId: mockUserId1,
        startsAt: new Date('2025-01-20T09:00:00.000Z'),
        endsAt: new Date('2025-01-20T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: { id: mockUserId1, name: 'John Doe', email: 'john@example.com' },
      },
      {
        id: 'shift_2',
        userId: mockUserId2,
        startsAt: new Date('2025-01-21T09:00:00.000Z'),
        endsAt: new Date('2025-01-21T17:00:00.000Z'),
        region: 'US-West',
        orgId: mockOrgId,
        user: { id: mockUserId2, name: 'Jane Smith', email: 'jane@example.com' },
      },
    ];

    // Mock overlap checks: first shift has overlap, second doesn't
    prisma.onCall.findMany
      .mockResolvedValueOnce(mockSourceShifts) // Source week query
      .mockResolvedValueOnce([{ id: 'existing_shift' }]) // Overlap check for shift 1 - found existing
      .mockResolvedValueOnce([]); // Overlap check for shift 2 - no overlap

    // Mock successful create for second shift
    prisma.onCall.create.mockResolvedValueOnce({ id: 'new_shift_2', ...mockSourceShifts[1] });
    prisma.onCallAudit.create.mockResolvedValueOnce({ id: 'audit_2' });

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=1`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(1);

    // Verify only one create was called
    expect(prisma.onCall.create).toHaveBeenCalledTimes(1);
    expect(prisma.onCallAudit.create).toHaveBeenCalledTimes(1);
  });

  it('should validate query parameters correctly', async () => {
    // Test missing orgId
    const request1 = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?from=${mockStartDate}&weeks=1`
    );

    const response1 = await POST(request1);
    const data1 = await response1.json();

    expect(response1.status).toBe(400);
    expect(data1.error).toBe('Validation error');

    // Test invalid date format
    const request2 = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=invalid-date&weeks=1`
    );

    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(400);
    expect(data2.error).toBe('Validation error');

    // Test weeks out of range
    const request3 = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=13`
    );

    const response3 = await POST(request3);
    const data3 = await response3.json();

    expect(response3.status).toBe(400);
    expect(data3.error).toBe('Validation error');
  });

  it('should handle different week offsets correctly', async () => {
    const mockSourceShifts = [
      {
        id: 'shift_1',
        userId: mockUserId1,
        startsAt: new Date('2025-01-20T09:00:00.000Z'),
        endsAt: new Date('2025-01-20T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: { id: mockUserId1, name: 'John Doe', email: 'john@example.com' },
      },
    ];

    // Mock no overlaps
    prisma.onCall.findMany
      .mockResolvedValueOnce(mockSourceShifts)
      .mockResolvedValueOnce([]);

    // Mock successful create
    prisma.onCall.create.mockResolvedValueOnce({ id: 'new_shift_1', ...mockSourceShifts[0] });
    prisma.onCallAudit.create.mockResolvedValueOnce({ id: 'audit_1' });

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=2`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(0);
    
    // Verify target dates are 14 days later (2 weeks)
    expect(data.targetFrom).toBe('2025-02-03T00:00:00.000Z');
    expect(data.targetTo).toBe('2025-02-09T23:59:59.999Z');
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    prisma.onCall.findMany.mockRejectedValueOnce(new Error('Database connection failed'));

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}&weeks=1`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database connection failed');
  });

  it('should default weeks to 1 when not provided', async () => {
    const mockSourceShifts = [
      {
        id: 'shift_1',
        userId: mockUserId1,
        startsAt: new Date('2025-01-20T09:00:00.000Z'),
        endsAt: new Date('2025-01-20T17:00:00.000Z'),
        region: 'US-East',
        orgId: mockOrgId,
        user: { id: mockUserId1, name: 'John Doe', email: 'john@example.com' },
      },
    ];

    // Mock no overlaps
    prisma.onCall.findMany
      .mockResolvedValueOnce(mockSourceShifts)
      .mockResolvedValueOnce([]);

    // Mock successful create
    prisma.onCall.create.mockResolvedValueOnce({ id: 'new_shift_1', ...mockSourceShifts[0] });
    prisma.onCallAudit.create.mockResolvedValueOnce({ id: 'audit_1' });

    const request = new NextRequest(
      `http://localhost:3000/api/oncall/rota/copy-week?orgId=${mockOrgId}&from=${mockStartDate}`
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(0);
    
    // Verify target dates are 7 days later (1 week default)
    expect(data.targetFrom).toBe('2025-01-27T00:00:00.000Z');
    expect(data.targetTo).toBe('2025-02-02T23:59:59.999Z');
  });
});
