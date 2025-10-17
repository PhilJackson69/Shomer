import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { requireModerator } from "@/lib/rbac";

const Body = z.object({ add: z.array(z.string().min(10)).optional(), remove: z.array(z.string().min(10)).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mod = await requireModerator();
  if (!mod.ok) return NextResponse.json({ error: "Forbidden" }, { status: mod.status || 403 });

  const parsed = Body.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success || (!parsed.data.add && !parsed.data.remove)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (parsed.data.add?.length) {
    await prisma.alertIncident.createMany({ data: parsed.data.add.map(id => ({ alertId: id, incidentId: params.id })) });
  }
  if (parsed.data.remove?.length) {
    await prisma.alertIncident.deleteMany({ where: { incidentId: params.id, alertId: { in: parsed.data.remove } } });
  }
  await logAudit({ orgId: tenant.orgId, actorId: null, actorKind: "user", action: "incident.alerts.update", meta: { id: params.id, ...parsed.data }});
  return NextResponse.json({ ok: true });
}


