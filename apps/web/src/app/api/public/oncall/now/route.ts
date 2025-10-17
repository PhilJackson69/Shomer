import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrgByToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/oncall/now?token=<shareToken>
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

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

    // Format response data
    const response = {
      ok: true,
      org: {
        id: orgByToken.id,
        name: orgByToken.name,
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
      ts: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
