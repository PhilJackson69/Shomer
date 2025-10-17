import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/oncall/rota/seed-week/route';
import { prisma } from '@/lib/prisma';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      create: vi.fn(),
    },
    onCall: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    onCallAudit: {
      create: vi.fn(),
    },
  },
}));

// Mock the action auth
vi.mock('@/lib/action-auth', () => ({
  requireActionSecret: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockRequireActionSecret = vi.mocked(await import('@/lib/action-auth')).requireActionSecret;

describe('OnCall Seed Week API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return 401 when missing X-Action-Secret header', async () => {
    // Mock auth failure - return NextResponse instance
    const mockResponse = new Response(
      JSON.stringify({ error: 'Invalid or missing X-Action-Secret header' }),
      { status: 401 }
    );
    // Make it look like a NextResponse instance
    Object.setPrototypeOf(mockResponse, NextResponse.prototype);
    mockRequireActionSecret.mockReturnValue(mockResponse as any);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=2024-01-01');
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('X-Action-Secret');
  });

  it('should return 401 when invalid X-Action-Secret header', async () => {
    // Mock auth failure - return NextResponse instance
    const mockResponse = new Response(
      JSON.stringify({ error: 'Invalid or missing X-Action-Secret header' }),
      { status: 401 }
    );
    // Make it look like a NextResponse instance
    Object.setPrototypeOf(mockResponse, NextResponse.prototype);
    mockRequireActionSecret.mockReturnValue(mockResponse as any);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'wrong-secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('X-Action-Secret');
  });

  it('should successfully create 7 demo shifts', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    // Mock organization exists
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    // Mock existing users
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user1', name: 'User 1', email: 'user1@test.com' },
      { id: 'user2', name: 'User 2', email: 'user2@test.com' },
    ] as any);

    // Mock no overlaps
    mockPrisma.onCall.findMany.mockResolvedValue([]);

    // Mock successful shift creation
    mockPrisma.onCall.create.mockResolvedValue({
      id: 'shift1',
      orgId: 'test-org',
      userId: 'user1',
      startsAt: new Date('2024-01-01T09:00:00.000Z'),
      endsAt: new Date('2024-01-01T17:00:00.000Z'),
      region: null,
    } as any);

    // Mock successful audit creation
    mockPrisma.onCallAudit.create.mockResolvedValue({
      id: 'audit1',
      action: 'CREATE',
      shiftId: 'shift1',
      userId: 'system',
      orgId: 'test-org',
      newData: '{}',
    } as any);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(7);
    
    // Verify 7 shifts were created
    expect(mockPrisma.onCall.create).toHaveBeenCalledTimes(7);
    expect(mockPrisma.onCallAudit.create).toHaveBeenCalledTimes(7);
  });

  it('should create demo user when fewer than 2 users exist', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    // Mock organization exists
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    // Mock only 1 user exists initially
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        { id: 'user1', name: 'User 1', email: 'user1@test.com' },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'user1', name: 'User 1', email: 'user1@test.com' },
        { id: 'demo-user', name: 'Demo OnCall User 1234567890', email: 'demo_oncall_user@local' },
      ] as any);

    // Mock demo user creation
    mockPrisma.user.create.mockResolvedValue({
      id: 'demo-user',
      name: 'Demo OnCall User 1234567890',
      email: 'demo_oncall_user@local',
    } as any);

    // Mock membership creation
    mockPrisma.membership.create.mockResolvedValue({
      id: 'membership1',
      userId: 'demo-user',
      orgId: 'test-org',
      role: 'VIEWER',
    } as any);

    // Mock no overlaps
    mockPrisma.onCall.findMany.mockResolvedValue([]);

    // Mock successful shift creation
    mockPrisma.onCall.create.mockResolvedValue({
      id: 'shift1',
      orgId: 'test-org',
      userId: 'user1',
      startsAt: new Date('2024-01-01T09:00:00.000Z'),
      endsAt: new Date('2024-01-01T17:00:00.000Z'),
      region: null,
    } as any);

    // Mock successful audit creation
    mockPrisma.onCallAudit.create.mockResolvedValue({
      id: 'audit1',
      action: 'CREATE',
      shiftId: 'shift1',
      userId: 'system',
      orgId: 'test-org',
      newData: '{}',
    } as any);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(7);
    
    // Verify demo user was created
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'demo_oncall_user@local',
        name: expect.stringContaining('Demo OnCall User'),
        role: 'VIEWER',
      },
    });
    
    // Verify membership was created
    expect(mockPrisma.membership.create).toHaveBeenCalledWith({
      data: {
        userId: 'demo-user',
        orgId: 'test-org',
        role: 'VIEWER',
      },
    });
  });

  it('should not create overlapping shifts', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    // Mock organization exists
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    // Mock existing users
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user1', name: 'User 1', email: 'user1@test.com' },
      { id: 'user2', name: 'User 2', email: 'user2@test.com' },
    ] as any);

    // Mock overlaps for some shifts
    mockPrisma.onCall.findMany
      .mockResolvedValueOnce([]) // No overlap for first shift
      .mockResolvedValueOnce([{ id: 'existing-shift' }]) // Overlap for second shift
      .mockResolvedValueOnce([]) // No overlap for third shift
      .mockResolvedValue([]); // No overlaps for remaining shifts

    // Mock successful shift creation (only for non-overlapping shifts)
    mockPrisma.onCall.create.mockResolvedValue({
      id: 'shift1',
      orgId: 'test-org',
      userId: 'user1',
      startsAt: new Date('2024-01-01T09:00:00.000Z'),
      endsAt: new Date('2024-01-01T17:00:00.000Z'),
      region: null,
    } as any);

    // Mock successful audit creation
    mockPrisma.onCallAudit.create.mockResolvedValue({
      id: 'audit1',
      action: 'CREATE',
      shiftId: 'shift1',
      userId: 'system',
      orgId: 'test-org',
      newData: '{}',
    } as any);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.created).toBe(6); // Only 6 shifts created due to 1 overlap
    
    // Verify only 6 shifts were created (skipped the overlapping one)
    expect(mockPrisma.onCall.create).toHaveBeenCalledTimes(6);
    expect(mockPrisma.onCallAudit.create).toHaveBeenCalledTimes(6);
  });

  it('should return 404 when organization not found', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    // Mock organization not found
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=nonexistent-org&start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Organization not found');
  });

  it('should return 400 for invalid date format', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?orgId=test-org&start=invalid-date', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Validation error');
  });

  it('should return 400 for missing orgId parameter', async () => {
    // Mock auth success
    mockRequireActionSecret.mockReturnValue({ ok: true });

    const request = new NextRequest('http://localhost/api/oncall/rota/seed-week?start=2024-01-01', {
      headers: {
        'X-Action-Secret': 'test_secret',
      },
    });
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Validation error');
  });
});
