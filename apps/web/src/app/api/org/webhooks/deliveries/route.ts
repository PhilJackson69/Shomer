import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgFromSession } from "@/lib/tenant";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { deliverWebhook } from "@/lib/webhooks";

function requireMod(role?: string) { return role === "ADMIN" || role === "MODERATOR"; }

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.webhookDelivery.findMany({
    where: { orgId: tenant.orgId, dead: true },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id:true, webhookId:true, event:true, payload:true, attempt:true, status:true, error:true, createdAt:true }
  });
  return NextResponse.json({ items });
}

const Retry = z.object({ id: z.string().min(10) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = Retry.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const d = await prisma.webhookDelivery.findFirst({ where: { id: parsed.data.id, orgId: tenant.orgId }});
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deliverWebhook(tenant.orgId, d.event, d.payload);
  return NextResponse.json({ ok: true });
}


