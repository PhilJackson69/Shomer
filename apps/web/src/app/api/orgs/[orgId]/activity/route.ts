import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string }}) {
  const activities = await prisma.activity.findMany({
    where: { orgId: params.orgId },
    orderBy: { ts: "desc" },
    take: 50
  });
  
  return NextResponse.json({ ok: true, items: activities });
}
