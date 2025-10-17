import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { requireModerator } from "@/lib/rbac";

const Body = z.object({ intoId: z.string().min(10) });

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mod = await requireModerator();
  if (!mod.ok) return NextResponse.json({ error: "Forbidden" }, { status: mod.status || 403 });
  const parsed = Body.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const srcId = params.id, dstId = parsed.data.intoId;
  await prisma.$transaction(async (tx) => {
    const links = await tx.alertIncident.findMany({ where: { incidentId: srcId }});
    if (links.length) {
      await tx.alertIncident.createMany({ data: links.map(l => ({ alertId: l.alertId, incidentId: dstId })), skipDuplicates: true });
      await tx.alertIncident.deleteMany({ where: { incidentId: srcId }});
    }
    await tx.incident.update({ where: { id: srcId }, data: { parentId: dstId, status: "DISMISSED" as any }});
  });

  await logAudit({ orgId: tenant.orgId, actorId: null, actorKind: "user", action: "incident.merge", meta: { from: srcId, into: dstId }});
  return NextResponse.json({ ok: true });
}


