import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseDateParam, defaultWindowUtc } from "@/lib/dates";
import { findOrgByToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oncall/audit.csv?orgId=&from=&to= OR ?token=&from=&to=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const token = searchParams.get('token');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let targetOrgId: string;
    let organization: { id: string; name: string } | null = null;

    if (token) {
      // Token-based access
      const orgByToken = await findOrgByToken(token);
      if (!orgByToken) {
        return NextResponse.json(
          { ok: false, error: "invalid_token" },
          { status: 404 }
        );
      }
      targetOrgId = orgByToken.id;
      organization = { id: orgByToken.id, name: orgByToken.name };
    } else if (orgId) {
      // Internal orgId-based access
      targetOrgId = orgId;
    } else {
      return NextResponse.json(
        { ok: false, error: "orgId_or_token_required" },
        { status: 400 }
      );
    }

    // Parse date parameters
    const fromDate = parseDateParam(fromParam);
    const toDate = parseDateParam(toParam);

    // Use default window if no dates provided
    const { from: defaultFrom, to: defaultTo } = defaultWindowUtc();
    const from = fromDate || defaultFrom;
    const to = toDate || defaultTo;

    // Verify organization exists (if not already found via token)
    if (!organization) {
      organization = await prisma.organization.findUnique({
        where: { id: targetOrgId },
        select: { id: true, name: true },
      });

      if (!organization) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }
    }

    // Query OnCallAudit records scoped by orgId and date range
    const audits = await prisma.onCallAudit.findMany({
      where: {
        orgId: targetOrgId,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Prepare CSV headers
    const headers = [
      'audit_id',
      'action',
      'org_id',
      'shift_id',
      'actor_user_id',
      'actor_user_name',
      'created_at_utc',
      'before_json',
      'after_json',
    ];

    // Prepare CSV rows
    const rows = audits.map(audit => {
      // Parse and compact JSON fields (remove spaces)
      const beforeJson = audit.oldData ? JSON.stringify(JSON.parse(audit.oldData)) : '';
      const afterJson = audit.newData ? JSON.stringify(JSON.parse(audit.newData)) : '';

      return [
        audit.id,
        audit.action,
        audit.orgId,
        audit.shiftId,
        audit.userId,
        audit.user?.name || audit.user?.email || 'system',
        audit.createdAt.toISOString(),
        beforeJson,
        afterJson,
      ];
    });

    // Generate CSV content
    const csvContent = toCsv(headers, rows);

    // Generate filename
    const fromStr = from.toISOString().split('T')[0].replace(/-/g, '');
    const toStr = to.toISOString().split('T')[0].replace(/-/g, '');
    const orgSlug = organization.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `audit_${orgSlug}_${fromStr}-${toStr}.csv`;

    // Return CSV response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate CSV" },
      { status: 500 }
    );
  }
}
