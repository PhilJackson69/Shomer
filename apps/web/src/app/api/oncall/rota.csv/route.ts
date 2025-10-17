import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseDateParam, defaultWindowUtc } from "@/lib/dates";
import { findOrgByToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oncall/rota.csv?orgId=&from=&to= OR ?token=&from=&to=
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

    // Query OnCall shifts with overlap on [startsAt, endsAt]
    const shifts = await prisma.onCall.findMany({
      where: {
        orgId: targetOrgId,
        OR: [
          // Shift starts within range
          {
            startsAt: { gte: from, lte: to },
          },
          // Shift ends within range
          {
            endsAt: { gte: from, lte: to },
          },
          // Shift completely contains range
          {
            startsAt: { lte: from },
            endsAt: { gte: to },
          },
        ],
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
        startsAt: 'asc',
      },
    });

    // Prepare CSV headers
    const headers = [
      'shift_id',
      'org_id',
      'user_id',
      'user_name',
      'starts_at_utc',
      'ends_at_utc',
      'duration_hours',
      'region',
    ];

    // Prepare CSV rows
    const rows = shifts.map(shift => {
      const durationMs = shift.endsAt.getTime() - shift.startsAt.getTime();
      const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);

      return [
        shift.id,
        shift.orgId,
        shift.userId,
        shift.user.name || shift.user.email,
        shift.startsAt.toISOString(),
        shift.endsAt.toISOString(),
        durationHours,
        shift.region || '',
      ];
    });

    // Generate CSV content
    const csvContent = toCsv(headers, rows);

    // Generate filename
    const fromStr = from.toISOString().split('T')[0].replace(/-/g, '');
    const toStr = to.toISOString().split('T')[0].replace(/-/g, '');
    const orgSlug = organization.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `rota_${orgSlug}_${fromStr}-${toStr}.csv`;

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
