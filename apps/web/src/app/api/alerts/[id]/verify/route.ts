import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyAction } from "@/lib/action-sign";
import { requireModerator } from "@/lib/rbac";
import { publishEvent } from "@/lib/cache";
import { requireOrg } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

const Params = z.object({ id: z.string().min(10) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const tenant = await requireOrg(req);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const signedOk = verifyAction(url);
  const auth = signedOk ? { ok: true } as const : await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error || "Forbidden" }, { status: 403 });

  const parsed = Params.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let reporterId: string | undefined = undefined;
  try {
    const body = await req.json();
    if (body?.reporterId && typeof body.reporterId === "string") reporterId = body.reporterId;
  } catch {}

  try {
    const alert = await prisma.alert.update({
      where: { id: parsed.data.id, orgId: tenant.orgId } as any,
      data: { verified: true, ...(reporterId ? { reporterId } : {}) },
      select: { id: true, verified: true },
    });
    await publishEvent("alert_verified", { id: alert.id });
    await logAudit({
      orgId: tenant.orgId,
      actorId: (auth.ok && (auth as any).user?.id) || null,
      actorKind: signedOk ? "signed-link" : "user",
      action: "alert.verify",
      alertId: alert.id,
    });
    return NextResponse.json({ ok: true, ...alert });
  } catch (error) {
    console.error("Failed to verify alert:", error);
    return NextResponse.json({ error: "Failed to verify alert" }, { status: 500 });
  }
}


