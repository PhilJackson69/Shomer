import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oncall/audit?limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const tenant = await requireOrg(request);
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const auditLogs = await prisma.onCallAudit.findMany({
      where: {
        orgId: tenant.orgId,
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
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.onCallAudit.count({
      where: {
        orgId: tenant.orgId,
      },
    });

    return NextResponse.json({
      ok: true,
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        shiftId: log.shiftId,
        userId: log.userId,
        userName: log.user.name,
        userEmail: log.user.email,
        createdAt: log.createdAt,
        oldData: log.oldData ? JSON.parse(log.oldData) : null,
        newData: log.newData ? JSON.parse(log.newData) : null,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
