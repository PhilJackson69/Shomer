import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRotaCsv } from '@/app/api/oncall/rota.csv/route';
import { GET as getAuditCsv } from '@/app/api/oncall/audit.csv/route';
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
    onCallAudit: {
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = vi.mocked(prisma);

describe('OnCall CSV Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rota CSV Export', () => {
    it('should return 400 when orgId is missing', async () => {
      const request = new NextRequest('http://localhost/api/oncall/rota.csv');
      
      const response = await getRotaCsv(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('orgId_or_token_required');
    });

    it('should return 404 when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=nonexistent');
      
      const response = await getRotaCsv(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Organization not found');
    });

    it('should return CSV with correct headers and content-type', async () => {
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

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=test-org');
      
      const response = await getRotaCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('content-disposition')).toContain('attachment; filename="rota_test_organization_');

      // Check CSV headers
      const lines = csvContent.split('\n');
      expect(lines[0]).toBe('shift_id,org_id,user_id,user_name,starts_at_utc,ends_at_utc,duration_hours,region');
      
      // Check at least one data row
      expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows + empty line
      
      // Check first data row
      const firstDataRow = lines[1].split(',');
      expect(firstDataRow[0]).toBe('shift1');
      expect(firstDataRow[1]).toBe('test-org');
      expect(firstDataRow[2]).toBe('user1');
      expect(firstDataRow[3]).toBe('John Doe');
      expect(firstDataRow[4]).toBe('2024-01-01T09:00:00.000Z');
      expect(firstDataRow[5]).toBe('2024-01-01T17:00:00.000Z');
      expect(firstDataRow[6]).toBe('8.00');
      expect(firstDataRow[7]).toBe('US-East');
    });

    it('should handle date filtering correctly', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=test-org&from=2024-01-01&to=2024-01-07');
      
      const response = await getRotaCsv(request);

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
  });

  describe('Audit CSV Export', () => {
    it('should return 400 when orgId is missing', async () => {
      const request = new NextRequest('http://localhost/api/oncall/audit.csv');
      
      const response = await getAuditCsv(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('orgId_or_token_required');
    });

    it('should return 404 when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/oncall/audit.csv?orgId=nonexistent');
      
      const response = await getAuditCsv(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Organization not found');
    });

    it('should return CSV with correct headers and compact JSON', async () => {
      // Mock organization exists
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      // Mock audit data
      mockPrisma.onCallAudit.findMany.mockResolvedValue([
        {
          id: 'audit1',
          action: 'CREATE',
          orgId: 'test-org',
          shiftId: 'shift1',
          userId: 'user1',
          createdAt: new Date('2024-01-01T10:00:00.000Z'),
          oldData: null,
          newData: '{"userId":"user1","startsAt":"2024-01-01T09:00:00.000Z","endsAt":"2024-01-01T17:00:00.000Z","region":"US-East"}',
          user: {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        {
          id: 'audit2',
          action: 'UPDATE',
          orgId: 'test-org',
          shiftId: 'shift1',
          userId: 'user2',
          createdAt: new Date('2024-01-01T11:00:00.000Z'),
          oldData: '{"userId":"user1","startsAt":"2024-01-01T09:00:00.000Z","endsAt":"2024-01-01T17:00:00.000Z","region":"US-East"}',
          newData: '{"userId":"user2","startsAt":"2024-01-01T09:00:00.000Z","endsAt":"2024-01-01T17:00:00.000Z","region":"US-East"}',
          user: {
            id: 'user2',
            name: 'Jane Smith',
            email: 'jane@example.com',
          },
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/audit.csv?orgId=test-org');
      
      const response = await getAuditCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('content-disposition')).toContain('attachment; filename="audit_test_organization_');

      // Check CSV headers
      const lines = csvContent.split('\n');
      expect(lines[0]).toBe('audit_id,action,org_id,shift_id,actor_user_id,actor_user_name,created_at_utc,before_json,after_json');
      
      // Check at least one data row
      expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows + empty line
      
      // Check first data row (CREATE action) - need to handle CSV parsing properly
      const firstDataRow = lines[1];
      
      // Simple CSV parsing that handles quoted fields
      const parseCsvRow = (row: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          const nextChar = row[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote
              current += '"';
              i++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            // Field separator
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        
        // Add the last field
        result.push(current);
        return result;
      };
      
      const parsedRow = parseCsvRow(firstDataRow);
      expect(parsedRow[0]).toBe('audit1');
      expect(parsedRow[1]).toBe('CREATE');
      expect(parsedRow[2]).toBe('test-org');
      expect(parsedRow[3]).toBe('shift1');
      expect(parsedRow[4]).toBe('user1');
      expect(parsedRow[5]).toBe('John Doe');
      expect(parsedRow[6]).toBe('2024-01-01T10:00:00.000Z');
      expect(parsedRow[7]).toBe(''); // before_json should be empty for CREATE
      
      // Check that after_json is compact (no spaces)
      const afterJson = parsedRow[8];
      expect(afterJson).not.toContain(' ');
      expect(afterJson).toContain('"userId":"user1"');
      
      // Verify JSON is parsable
      const parsedJson = JSON.parse(afterJson);
      expect(parsedJson.userId).toBe('user1');
      expect(parsedJson.region).toBe('US-East');
    });

    it('should handle date filtering correctly', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCallAudit.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/audit.csv?orgId=test-org&from=2024-01-01&to=2024-01-07');
      
      const response = await getAuditCsv(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.onCallAudit.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'test-org',
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle system user correctly', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCallAudit.findMany.mockResolvedValue([
        {
          id: 'audit1',
          action: 'CREATE',
          orgId: 'test-org',
          shiftId: 'shift1',
          userId: 'system',
          createdAt: new Date('2024-01-01T10:00:00.000Z'),
          oldData: null,
          newData: '{"userId":"user1"}',
          user: null, // System user has no user record
        },
      ] as any);

      const request = new NextRequest('http://localhost/api/oncall/audit.csv?orgId=test-org');
      
      const response = await getAuditCsv(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      
      const lines = csvContent.split('\n');
      const firstDataRow = lines[1].split(',');
      expect(firstDataRow[4]).toBe('system');
      expect(firstDataRow[5]).toBe('system'); // Should fallback to 'system' when no user record
    });
  });

  describe('Org Scoping and Date Filters', () => {
    it('should only return data for the specified organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=test-org');
      
      await getRotaCsv(request);

      expect(mockPrisma.onCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'test-org',
          }),
        })
      );
    });

    it('should use default date window when no dates provided', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
      } as any);

      mockPrisma.onCall.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/oncall/rota.csv?orgId=test-org');
      
      await getRotaCsv(request);

      // Should use default 14-day window around today
      const callArgs = mockPrisma.onCall.findMany.mock.calls[0][0];
      const whereClause = callArgs.where;
      
      // Check that OR conditions are present (indicating date range filtering)
      expect(whereClause.OR).toBeDefined();
      expect(Array.isArray(whereClause.OR)).toBe(true);
    });
  });
});
