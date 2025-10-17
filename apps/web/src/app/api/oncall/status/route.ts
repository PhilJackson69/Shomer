import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    
    // Get current on-call users
    const onCallUsers = await prisma.onCall.findMany({
      where: {
        startsAt: {
          lte: now,
        },
        endsAt: {
          gte: now,
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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    // Get upcoming on-call users (next 24 hours)
    const upcomingOnCall = await prisma.onCall.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // next 24 hours
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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      current: onCallUsers.map(oc => ({
        id: oc.id,
        userId: oc.userId,
        userName: oc.user.name,
        userEmail: oc.user.email,
        organizationId: oc.orgId,
        organizationName: oc.organization.name,
        region: oc.region,
        startsAt: oc.startsAt,
        endsAt: oc.endsAt,
      })),
      upcoming: upcomingOnCall.map(oc => ({
        id: oc.id,
        userId: oc.userId,
        userName: oc.user.name,
        userEmail: oc.user.email,
        organizationId: oc.orgId,
        organizationName: oc.organization.name,
        region: oc.region,
        startsAt: oc.startsAt,
        endsAt: oc.endsAt,
      })),
      timestamp: now.toISOString(),
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to fetch on-call status" },
      { status: 500 }
    );
  }
}
