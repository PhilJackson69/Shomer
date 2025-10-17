import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "@/lib/rbac";
import { publishEvent } from "@/lib/cache";
import { requireOrg } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

const Body = z.object({ ids: z.array(z.string().min(10)).min(1), reporterId: z.string().optional() });

export async function POST(req: Request) {
  const tenant = await requireOrg(req);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { ids, reporterId } = parsed.data;
  const res = await prisma.alert.updateMany({
    where: { id: { in: ids }, orgId: tenant.orgId, dismissedAt: null },
    data: { verified: true, ...(reporterId ? { reporterId } : {}) },
  });
  await publishEvent("alerts_verified_bulk", { ids });
  await logAudit({
    orgId: tenant.orgId,
    actorId: null,
    actorKind: "user",
    action: "alerts.verify.bulk",
    meta: { ids, count: res.count },
  });
  return NextResponse.json({ ok: true, count: res.count });
}
