import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const Query = z.object({ sinceHours: z.coerce.number().int().min(1).max(24 * 30).default(168) });

export async function GET(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { sinceHours } = parsed.data;

  const since = new Date(Date.now() - sinceHours * 3600 * 1000);

  const alerts = await prisma.alert.findMany({
    where: { orgId: tenant.orgId, dismissedAt: null, createdAt: { gte: since } },
    select: { region: true, risk: true },
  });

  const regions: Record<string, { LOW: number; MEDIUM: number; HIGH: number; total: number }> = {};
  for (const a of alerts) {
    const key = a.region ?? "unknown";
    regions[key] = regions[key] ?? { LOW: 0, MEDIUM: 0, HIGH: 0, total: 0 };
    const r = (a.risk as "LOW"|"MEDIUM"|"HIGH");
    regions[key][r]++;
    regions[key].total++;
  }

  return NextResponse.json({ regions, since: since.toISOString() });
}


