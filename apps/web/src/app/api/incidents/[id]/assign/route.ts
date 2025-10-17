import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { requireModerator } from "@/lib/rbac";

const Body = z.object({ assigneeId: z.string().min(6) });

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mod = await requireModerator();
  if (!mod.ok) return NextResponse.json({ error: "Forbidden" }, { status: mod.status || 403 });
  const userId = (mod.user as any)?.id as string | undefined;

  const parsed = Body.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const inc = await prisma.incident.update({
    where: { id: params.id },
    data: { assignedToId: parsed.data.assigneeId },
    select: { id: true, title: true, assignedToId: true }
  });

  await prisma.incidentAssignment.create({ data: { orgId: tenant.orgId, incidentId: inc.id, assigneeId: parsed.data.assigneeId }});
  await logAudit({ orgId: tenant.orgId, actorId: userId ?? null, actorKind: "user", action: "incident.assign", meta: { id: inc.id, assigneeId: inc.assignedToId }});

  return NextResponse.json({ ok: true, incident: inc });
}


