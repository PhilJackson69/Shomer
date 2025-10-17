import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyIncidentThread } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || auth !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const minutes = env.INCIDENT_SLA_MINUTES ?? 60;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const incidents = await prisma.incident.findMany({
    where: { status: { in: ["OPEN","IN_PROGRESS"] as any }, updatedAt: { lt: cutoff } },
    select: { id:true, title:true, orgId:true, slackThreadTs:true }
  });

  for (const i of incidents) {
    await notifyIncidentThread({
      text: `⏰ Escalation: Incident "${i.title}" has been inactive for ${minutes} minutes.`,
      threadTs: i.slackThreadTs ?? undefined,
    });
    await logAudit({ orgId: i.orgId, actorKind: "user", actorId: null, action: "incident.escalate", meta: { id: i.id, minutes }});
    await prisma.incident.update({ where: { id: i.id }, data: { status: "IN_PROGRESS" as any }});
  }

  return NextResponse.json({ ok: true, escalated: incidents.length });
}


