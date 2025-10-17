import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string }}) {
  const rows = await prisma.notificationEndpoint.findMany({
    where: { orgId: params.orgId },
    orderBy: { createdAt: "desc" }
  });
  // Never leak secret
  return NextResponse.json({ ok: true, endpoints: rows.map(r => ({ id: r.id, url: r.url, createdAt: r.createdAt })) });
}

const CreateSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16)
});

export async function POST(req: NextRequest, { params }: { params: { orgId: string }}) {
  const auth = await requireOrgWriteAuthWithScope(req, params.orgId, ["webhook.manage"]);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const data = CreateSchema.parse(body);
  const row = await prisma.notificationEndpoint.create({
    data: { orgId: params.orgId, url: data.url, secret: data.secret }
  });
  return NextResponse.json({ ok: true, id: row.id, url: row.url, createdAt: row.createdAt });
}

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string }}) {
  const auth = await requireOrgWriteAuthWithScope(req, params.orgId, ["webhook.manage"]);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok:false, error:"id_required" }, { status:400 });
  await prisma.notificationEndpoint.delete({ where: { id } });
  return NextResponse.json({ ok:true });
}
