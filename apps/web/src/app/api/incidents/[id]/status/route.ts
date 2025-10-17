import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { deliverWebhook } from "@/lib/webhooks";
import { logAudit } from "@/lib/audit";
import { requireModerator } from "@/lib/rbac";
import { notifyIncidentThread } from "@/lib/notify";

const Body = z.object({ status: z.enum(["OPEN","IN_PROGRESS","RESOLVED","DISMISSED"]) });

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
    data: { status: parsed.data.status as any },
    select: { id: true, title: true, status: true }
  });

  await logAudit({ orgId: tenant.orgId, actorId: userId ?? null, actorKind: "user", action: "incident.status", meta: { id: inc.id, status: inc.status }});
  await deliverWebhook(tenant.orgId, "incident.status", { id: inc.id, status: inc.status });
  await notifyIncidentThread({ text: `Status changed to ${inc.status}`, threadTs: (await prisma.incident.findUnique({ where: { id: inc.id }, select: { slackThreadTs: true }}))?.slackThreadTs ?? undefined });

  return NextResponse.json({ ok: true, incident: inc });
}


