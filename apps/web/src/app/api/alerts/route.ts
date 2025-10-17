import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
  risk: z.enum(["LOW","MEDIUM","HIGH"]).optional(),
  region: z.string().optional(),
  verified: z.enum(["true","false"]).optional(),
});

export async function GET(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { limit, risk, region, verified } = parsed.data;

  const where: any = { orgId: tenant.orgId, dismissedAt: null };
  if (risk) where.risk = risk;
  if (region) where.region = region;
  if (verified) where.verified = verified === "true";

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      title: true,
      summary: true,
      risk: true,
      score: true,
      region: true,
      topic: true,
      contentUrl: true,
      verified: true,
      lat: true,
      lng: true,
    },
  });

  return NextResponse.json({ alerts });
}


