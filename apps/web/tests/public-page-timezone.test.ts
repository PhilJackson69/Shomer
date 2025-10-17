import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPublicSummary } from '@/app/api/public/oncall/summary/route';
import { prisma } from '@/lib/prisma';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    organizationSetting: {
      findUnique: vi.fn(),
    },
    onCall: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock the org-token module
vi.mock('@/lib/org-token', () => ({
  findOrgByToken: vi.fn(),
}));

// Mock the org-settings module
vi.mock('@/lib/org-settings', () => ({
  getOrganizationSettings: vi.fn(),
  getDisplayName: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const { findOrgByToken } = await import('@/lib/org-token');
const { getOrganizationSettings, getDisplayName } = await import('@/lib/org-settings');

const mockFindOrgByToken = vi.mocked(findOrgByToken);
const mockGetOrganizationSettings = vi.mocked(getOrganizationSettings);
const mockGetDisplayName = vi.mocked(getDisplayName);

describe('Public Page Timezone Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should use organization timezone and display name in public summary', async () => {
    // Mock organization found by token
    mockFindOrgByToken.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
      shareToken: 'test-token',
    } as any);

    // Mock organization settings
    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'America/Los_Angeles',
      displayName: 'Test Org Display Name',
      showRegion: true,
      timeFormat: '12h',
    });

    // Mock display name function
    mockGetDisplayName.mockReturnValue('Test Org Display Name');

    // Mock on-call data
    mockPrisma.onCall.findFirst.mockResolvedValue(null); // No current on-call
    mockPrisma.onCall.findMany.mockResolvedValue([
      {
        id: 'shift1',
        orgId: 'test-org',
        userId: 'user1',
        startsAt: new Date('2024-01-01T09:00:00.000Z'),
        endsAt: new Date('2024-01-01T17:00:00.000Z'),
        region: 'US-West',
        user: {
          id: 'user1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
    ] as any);

    const request = new NextRequest('http://localhost/api/public/oncall/summary?token=test-token');
    const response = await getPublicSummary(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.org.name).toBe('Test Org Display Name');
    expect(data.settings).toEqual({
      preferredTimezone: 'America/Los_Angeles',
      displayName: 'Test Org Display Name',
      showRegion: true,
      timeFormat: '12h',
    });

    // Verify that organization settings were fetched
    expect(mockGetOrganizationSettings).toHaveBeenCalledWith('test-org');
    expect(mockGetDisplayName).toHaveBeenCalledWith('Test Organization', {
      preferredTimezone: 'America/Los_Angeles',
      displayName: 'Test Org Display Name',
      showRegion: true,
      timeFormat: '12h',
    });
  });

  it('should use default settings when organization has no custom settings', async () => {
    // Mock organization found by token
    mockFindOrgByToken.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
      shareToken: 'test-token',
    } as any);

    // Mock default organization settings
    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'UTC',
      displayName: null,
      showRegion: true,
      timeFormat: '24h',
    });

    // Mock display name function (should return org name when no display name)
    mockGetDisplayName.mockReturnValue('Test Organization');

    // Mock on-call data
    mockPrisma.onCall.findFirst.mockResolvedValue(null);
    mockPrisma.onCall.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/public/oncall/summary?token=test-token');
    const response = await getPublicSummary(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.org.name).toBe('Test Organization');
    expect(data.settings).toEqual({
      preferredTimezone: 'UTC',
      displayName: null,
      showRegion: true,
      timeFormat: '24h',
    });
  });

  it('should handle timezone conversion correctly', async () => {
    // Mock organization found by token
    mockFindOrgByToken.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
      shareToken: 'test-token',
    } as any);

    // Mock organization settings with Pacific timezone
    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'America/Los_Angeles',
      displayName: null,
      showRegion: true,
      timeFormat: '12h',
    });

    mockGetDisplayName.mockReturnValue('Test Organization');

    // Mock on-call data with UTC times
    mockPrisma.onCall.findFirst.mockResolvedValue({
      id: 'current-shift',
      orgId: 'test-org',
      userId: 'user1',
      startsAt: new Date('2024-01-01T09:00:00.000Z'), // 9 AM UTC
      endsAt: new Date('2024-01-01T17:00:00.000Z'),   // 5 PM UTC
      region: 'US-West',
      user: {
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
      },
    } as any);

    mockPrisma.onCall.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/public/oncall/summary?token=test-token');
    const response = await getPublicSummary(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.now).toBeDefined();
    expect(data.now.startsAt).toBe('2024-01-01T09:00:00.000Z'); // UTC times preserved in API
    expect(data.now.endsAt).toBe('2024-01-01T17:00:00.000Z');
    expect(data.settings.preferredTimezone).toBe('America/Los_Angeles');
    expect(data.settings.timeFormat).toBe('12h');
  });
});
