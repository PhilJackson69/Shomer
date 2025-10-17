import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: { id: string }}) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inc = await prisma.incident.findFirst({
    where: { id: params.id, orgId: tenant.orgId },
    include: {
      alerts: { include: { alert: { select: { id: true, title: true, risk: true, score: true, verified: true, region: true, contentUrl: true, topic: true } } } },
      notes: { include: { author: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
      assignedTo: { select: { id: true, email: true, name: true } },
    }
  });
  if (!inc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ incident: inc });
}


