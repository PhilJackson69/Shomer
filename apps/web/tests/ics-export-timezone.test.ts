import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRotaIcs } from '@/app/api/oncall/rota.ics/route';
import { prisma } from '@/lib/prisma';

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    onCall: {
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

// Mock the ics module
vi.mock('@/lib/ics', () => ({
  buildVCalendar: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const { findOrgByToken } = await import('@/lib/org-token');
const { getOrganizationSettings, getDisplayName } = await import('@/lib/org-settings');
const { buildVCalendar } = await import('@/lib/ics');

const mockFindOrgByToken = vi.mocked(findOrgByToken);
const mockGetOrganizationSettings = vi.mocked(getOrganizationSettings);
const mockGetDisplayName = vi.mocked(getDisplayName);
const mockBuildVCalendar = vi.mocked(buildVCalendar);

describe('ICS Export Timezone Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should use organization preferred timezone when tz parameter is not provided', async () => {
    // Mock organization found by orgId
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
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

    // Mock ICS builder
    mockBuildVCalendar.mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
    const response = await getRotaIcs(request);
    const icsContent = await response.text();

    expect(response.status).toBe(200);
    expect(icsContent).toBe('BEGIN:VCALENDAR\nEND:VCALENDAR');

    // Verify that organization settings were fetched
    expect(mockGetOrganizationSettings).toHaveBeenCalledWith('test-org');

    // Verify that buildVCalendar was called with organization timezone
    expect(mockBuildVCalendar).toHaveBeenCalledWith({
      orgName: 'Test Org Display Name',
      tz: 'America/Los_Angeles', // Should use org's preferred timezone
      events: expect.any(Array),
    });
  });

  it('should use provided tz parameter when present', async () => {
    // Mock organization found by orgId
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    // Mock organization settings (should be ignored when tz param is provided)
    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'America/Los_Angeles',
      displayName: 'Test Org Display Name',
      showRegion: true,
      timeFormat: '12h',
    });

    mockGetDisplayName.mockReturnValue('Test Org Display Name');
    mockPrisma.onCall.findMany.mockResolvedValue([]);
    mockBuildVCalendar.mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org&tz=Europe/London');
    const response = await getRotaIcs(request);

    expect(response.status).toBe(200);

    // Verify that buildVCalendar was called with provided timezone
    expect(mockBuildVCalendar).toHaveBeenCalledWith({
      orgName: 'Test Org Display Name',
      tz: 'Europe/London', // Should use provided timezone, not org's preferred
      events: expect.any(Array),
    });
  });

  it('should use organization timezone for token-based access', async () => {
    // Mock organization found by token
    mockFindOrgByToken.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
      shareToken: 'test-token',
    } as any);

    // Mock organization settings
    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'Asia/Tokyo',
      displayName: null,
      showRegion: true,
      timeFormat: '24h',
    });

    mockGetDisplayName.mockReturnValue('Test Organization');
    mockPrisma.onCall.findMany.mockResolvedValue([]);
    mockBuildVCalendar.mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    const request = new NextRequest('http://localhost/api/oncall/rota.ics?token=test-token');
    const response = await getRotaIcs(request);

    expect(response.status).toBe(200);

    // Verify that buildVCalendar was called with organization timezone
    expect(mockBuildVCalendar).toHaveBeenCalledWith({
      orgName: 'Test Organization',
      tz: 'Asia/Tokyo', // Should use org's preferred timezone
      events: expect.any(Array),
    });
  });

  it('should use display name in ICS calendar name', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'UTC',
      displayName: 'Custom Display Name',
      showRegion: true,
      timeFormat: '24h',
    });

    mockGetDisplayName.mockReturnValue('Custom Display Name');
    mockPrisma.onCall.findMany.mockResolvedValue([]);
    mockBuildVCalendar.mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
    const response = await getRotaIcs(request);

    expect(response.status).toBe(200);

    // Verify that buildVCalendar was called with display name
    expect(mockBuildVCalendar).toHaveBeenCalledWith({
      orgName: 'Custom Display Name', // Should use display name, not org name
      tz: 'UTC',
      events: expect.any(Array),
    });
  });

  it('should preserve UTC timestamps in DTSTART/DTEND', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'test-org',
      name: 'Test Organization',
    } as any);

    mockGetOrganizationSettings.mockResolvedValue({
      preferredTimezone: 'America/Los_Angeles',
      displayName: null,
      showRegion: true,
      timeFormat: '12h',
    });

    mockGetDisplayName.mockReturnValue('Test Organization');

    // Mock on-call data with UTC times
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

    mockBuildVCalendar.mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR');

    const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
    const response = await getRotaIcs(request);

    expect(response.status).toBe(200);

    // Verify that events are passed with UTC timestamps
    expect(mockBuildVCalendar).toHaveBeenCalledWith({
      orgName: 'Test Organization',
      tz: 'America/Los_Angeles',
      events: [
        expect.objectContaining({
          dtstart: new Date('2024-01-01T09:00:00.000Z'), // UTC timestamp preserved
          dtend: new Date('2024-01-01T17:00:00.000Z'),   // UTC timestamp preserved
        }),
      ],
    });
  });
});
