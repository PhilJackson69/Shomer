import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { getServerSession } from "@/lib/rbac";

const Create = z.object({
  name: z.string().min(2).max(64),
  kind: z.enum(["alerts","incidents"]).default("alerts"),
  query: z.any()
});

export async function GET(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.savedSearch.findMany({
    where: { orgId: tenant.orgId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id:true, name:true, kind:true, query:true, updatedAt:true }
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getServerSession();
  const ownerId = (session as any)?.id as string | undefined;

  const parsed = Create.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const item = await prisma.savedSearch.create({
    data: { orgId: tenant.orgId, ownerId, ...parsed.data },
    select: { id:true }
  });
  return NextResponse.json({ id: item.id }, { status: 201 });
}


