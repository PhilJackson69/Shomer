import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getOrgFromSession } from "@/lib/tenant";
import { getServerSession } from "@/lib/auth";

function requireMod(role?: string) {
  return role === "admin" || role === "moderator";
}

export async function GET() {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const keys = await prisma.apiKey.findMany({ where: { orgId: tenant.orgId }, select: { id: true, name: true, active: true, lastUsedAt: true, createdAt: true }});
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "API Key") as string;

  const raw = `shk_${crypto.randomBytes(24).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");

  await prisma.apiKey.create({ data: { name, keyHash, orgId: tenant.orgId }});
  return NextResponse.json({ key: raw }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  const role = (session as any)?.role as string | undefined;
  const tenant = await getOrgFromSession();
  if (!tenant || !requireMod(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.apiKey.update({ where: { id }, data: { active: false }});
  return NextResponse.json({ ok: true });
}


