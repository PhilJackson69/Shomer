import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateParam, defaultWindowUtc } from "@/lib/dates";
import { findOrgByToken } from "@/lib/org-token";
import { getOrganizationSettings, getDisplayName } from "@/lib/org-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/oncall/summary?token=&from=&to=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Token is required
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "invalid_token" },
        { status: 404 }
      );
    }

    // Find organization by token
    const orgByToken = await findOrgByToken(token);
    if (!orgByToken) {
      return NextResponse.json(
        { ok: false, error: "invalid_token" },
        { status: 404 }
      );
    }

    // Parse date parameters
    const fromDate = parseDateParam(fromParam);
    const toDate = parseDateParam(toParam);

    // Use default window if no dates provided (14-day window around today)
    const { from: defaultFrom, to: defaultTo } = defaultWindowUtc();
    const from = fromDate || defaultFrom;
    const to = toDate || defaultTo;

    // Validate date range
    if (from >= to) {
      return NextResponse.json(
        { ok: false, error: "bad_window" },
        { status: 400 }
      );
    }

    // Get organization settings
    const orgSettings = await getOrganizationSettings(orgByToken.id);
    
    // Get current time in UTC
    const nowUtc = new Date();

    // Find current on-call shift
    const currentShift = await prisma.onCall.findFirst({
      where: {
        orgId: orgByToken.id,
        startsAt: { lte: nowUtc },
        endsAt: { gte: nowUtc },
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
        startsAt: 'desc',
      },
    });

    // Find upcoming shifts in the window
    const upcomingShifts = await prisma.onCall.findMany({
      where: {
        orgId: orgByToken.id,
        startsAt: { 
          gte: nowUtc,
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
        startsAt: 'asc',
      },
    });

    // Format response data
    const displayName = getDisplayName(orgByToken.name, orgSettings);
    const response = {
      ok: true,
      org: {
        id: orgByToken.id,
        name: displayName,
      },
      settings: orgSettings,
      window: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      now: currentShift ? {
        id: currentShift.id,
        user: {
          id: currentShift.user.id,
          name: currentShift.user.name || currentShift.user.email,
          email: currentShift.user.email,
        },
        startsAt: currentShift.startsAt.toISOString(),
        endsAt: currentShift.endsAt.toISOString(),
        region: currentShift.region,
      } : null,
      upcoming: upcomingShifts.map(shift => ({
        id: shift.id,
        user: {
          id: shift.user.id,
          name: shift.user.name || shift.user.email,
          email: shift.user.email,
        },
        startsAt: shift.startsAt.toISOString(),
        endsAt: shift.endsAt.toISOString(),
        region: shift.region,
      })),
    };

    return NextResponse.json(response);

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
