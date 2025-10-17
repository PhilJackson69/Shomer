import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildVCalendar } from "@/lib/ics";
import { parseDateParam, defaultWindowUtc } from "@/lib/dates";
import { findOrgByToken } from "@/lib/org-token";
import { getOrganizationSettings, getDisplayName } from "@/lib/org-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oncall/rota.ics?orgId=&from=&to=&tz= OR ?token=&from=&to=&tz=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const token = searchParams.get('token');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const tzParam = searchParams.get('tz');

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

    // Get organization settings to determine default timezone
    const orgSettings = await getOrganizationSettings(targetOrgId);
    const tz = tzParam || orgSettings.preferredTimezone;

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

    // Convert shifts to iCalendar events
    const now = new Date();
    const events = shifts.map(shift => {
      const userName = shift.user.name || shift.user.email || 'Unknown User';
      const userEmail = shift.user.email || '';
      const region = shift.region || '—';
      
      // Build description with multiple lines
      const displayName = getDisplayName(organization.name, orgSettings);
      const description = [
        `User: ${userName}${userEmail ? ` (${userEmail})` : ''}`,
        `Org: ${displayName}`,
        `Region: ${region}`,
        `Window: ${shift.startsAt.toISOString()} – ${shift.endsAt.toISOString()} (UTC)`,
        `Link: /oncall/rota`,
      ].join('\\n');

      return {
        uid: `shift_${shift.id}@shomer`,
        dtstamp: now,
        dtstart: shift.startsAt,
        dtend: shift.endsAt,
        summary: `On-Call: ${userName} (@${displayName})`,
        description,
        location: 'On-Call',
      };
    });

    // Build iCalendar content
    const displayName = getDisplayName(organization.name, orgSettings);
    const icsContent = buildVCalendar({
      orgName: displayName,
      tz,
      events,
    });

    // Generate filename
    const fromStr = from.toISOString().split('T')[0].replace(/-/g, '');
    const toStr = to.toISOString().split('T')[0].replace(/-/g, '');
    const orgSlug = organization.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `rota_${orgSlug}_${fromStr}-${toStr}.ics`;

    // Return ICS response
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate iCalendar" },
      { status: 500 }
    );
  }
}
