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

const mockPrisma = vi.mocked(prisma);

describe('OnCall ICS Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ICS Export API', () => {
    it('should return 400 when orgId is missing', async () => {
      const request = new NextRequest('http://localhost/api/oncall/rota.ics');
      
      const response = await getRotaIcs(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('orgId_or_token_required');
    });

    it('should return 404 when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=nonexistent');
      
      const response = await getRotaIcs(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Organization not found');
    });

    it('should return ICS with correct content-type and structure', async () => {
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
        {
          id: 'shift2',
          orgId: 'test-org',
          userId: 'user2',
          startsAt: new Date('2024-01-02T09:00:00.000Z'),
          endsAt: new Date('2024-01-02T17:00:00.000Z'),
          region: null,
          user: {
            id: 'user2',
            name: 'Jane Smith',
            email: 'jane@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org&tz=America/Los_Angeles');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
      expect(response.headers.get('content-disposition')).toContain('attachment; filename="rota_test_organization_');

      // Check ICS structure
      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('END:VCALENDAR');
      expect(icsContent).toContain('BEGIN:VEVENT');
      expect(icsContent).toContain('END:VEVENT');
      
      // Check VCALENDAR properties
      expect(icsContent).toContain('VERSION:2.0');
      expect(icsContent).toContain('PRODID:-//Shomer//On-Call//EN');
      expect(icsContent).toContain('X-WR-CALNAME:Shomer On-Call — Test Organization');
      expect(icsContent).toContain('X-WR-TIMEZONE:America/Los_Angeles');
      expect(icsContent).toContain('CALSCALE:GREGORIAN');
      expect(icsContent).toContain('METHOD:PUBLISH');
    });

    it('should have UTC timestamps ending with Z', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

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
      
      // Extract DTSTART and DTEND lines
      const lines = icsContent.split('\r\n');
      const dtstartLine = lines.find(line => line.startsWith('DTSTART:'));
      const dtendLine = lines.find(line => line.startsWith('DTEND:'));
      
      expect(dtstartLine).toBeDefined();
      expect(dtendLine).toBeDefined();
      
      // Check UTC format (ends with Z)
      expect(dtstartLine).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(dtendLine).toMatch(/DTEND:\d{8}T\d{6}Z/);
      
      // Check specific timestamps
      expect(dtstartLine).toContain('20240101T090000Z');
      expect(dtendLine).toContain('20240101T170000Z');
    });

    it('should have correct UID and SUMMARY format', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

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
      
      const lines = icsContent.split('\r\n');
      
      // Check UID format
      const uidLine = lines.find(line => line.startsWith('UID:'));
      expect(uidLine).toBe('UID:shift_shift1@shomer');
      
      // Check SUMMARY format
      const summaryLine = lines.find(line => line.startsWith('SUMMARY:'));
      expect(summaryLine).toBe('SUMMARY:On-Call: John Doe (@Test Organization)');
      
      // Check DESCRIPTION content
      const descriptionLine = lines.find(line => line.startsWith('DESCRIPTION:'));
      expect(descriptionLine).toContain('User: John Doe (john@example.com)');
      expect(descriptionLine).toContain('Org: Test Organization');
      expect(descriptionLine).toContain('Region: US-East');
      expect(descriptionLine).toContain('Window: 2024-01-01T09:00:00.000Z – 2024-01-01T17:00:00.000Z (UTC)');
      expect(descriptionLine).toContain('Link: /oncall/rota');
      
      // Check LOCATION
      const locationLine = lines.find(line => line.startsWith('LOCATION:'));
      expect(locationLine).toBe('LOCATION:On-Call');
    });

    it('should handle user without email and null region', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([
        {
          id: 'shift1',
          orgId: 'test-org',
          userId: 'user1',
          startsAt: new Date('2024-01-01T09:00:00.000Z'),
          endsAt: new Date('2024-01-01T17:00:00.000Z'),
          region: null,
          user: {
            id: 'user1',
            name: 'John Doe',
            email: null,
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      
      const lines = icsContent.split('\r\n');
      
      // Check SUMMARY (should not include email)
      const summaryLine = lines.find(line => line.startsWith('SUMMARY:'));
      expect(summaryLine).toBe('SUMMARY:On-Call: John Doe (@Test Organization)');
      
      // Check DESCRIPTION (should handle null email and region)
      const descriptionLine = lines.find(line => line.startsWith('DESCRIPTION:'));
      expect(descriptionLine).toContain('User: John Doe');
      expect(descriptionLine).toContain('Region: —');
    });

    it('should handle date filtering correctly', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org&from=2024-01-01&to=2024-01-07');
      
      const response = await getRotaIcs(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.onCall.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'test-org',
          OR: expect.arrayContaining([
            expect.objectContaining({
              startsAt: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            }),
          ]),
        },
        include: expect.any(Object),
        orderBy: { startsAt: 'asc' },
      });
    });

    it('should only return data for the specified organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
      
      await getRotaIcs(request);

      expect(mockPrisma.onCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'test-org',
          }),
        })
      );
    });

    it('should use default timezone when tz parameter not provided', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      expect(icsContent).toContain('X-WR-TIMEZONE:UTC');
    });

    it('should handle special characters in organization name', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test & Demo Organization (Ltd.)',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.ics?orgId=test-org');
      
      const response = await getRotaIcs(request);
      const icsContent = await response.text();

      expect(response.status).toBe(200);
      expect(icsContent).toContain('X-WR-CALNAME:Shomer On-Call — Test & Demo Organization (Ltd.)');
    });
  });
});
