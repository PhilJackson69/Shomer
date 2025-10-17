import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orgs
export async function GET(request: NextRequest) {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      orgs: orgs.map(org => ({
        id: org.id,
        name: org.name,
      })),
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
