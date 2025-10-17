import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  risk: z.enum(["LOW","MEDIUM","HIGH"]).optional(),
  region: z.string().optional(),
  verified: z.enum(["true","false"]).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { limit, cursor, risk, region, verified } = parsed.data;
  const where: any = { dismissedAt: null };
  if (risk) where.risk = risk;
  if (region) where.region = region;
  if (verified) where.verified = verified === "true";

  const alerts = await prisma.alert.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, title: true, risk: true, score: true, region: true, topic: true, verified: true, contentUrl: true },
  });

  let nextCursor: string | null = null;
  if (alerts.length > limit) {
    const next = alerts.pop();
    nextCursor = next!.id;
  }

  return NextResponse.json({ alerts, nextCursor });
}


