import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgFromSession } from "@/lib/tenant";
import { getServerSession } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({
  url: z.string().url(),
  events: z.string().min(3),
  secret: z.string().min(16),
});

function requireMod(role?: string) { return role === "admin" || role === "moderator"; }

export async function GET() {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const hooks = await prisma.webhook.findMany({ where: { orgId: tenant.orgId }, select: { id:true, url:true, events:true, createdAt:true, active:true }});
  return NextResponse.json({ webhooks: hooks });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { url, events, secret } = parsed.data;
  const hook = await prisma.webhook.create({ data: { url, events, secret, orgId: tenant.orgId }});
  return NextResponse.json({ id: hook.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.webhook.update({ where: { id }, data: { active: false }});
  return NextResponse.json({ ok: true });
}


