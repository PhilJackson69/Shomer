import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const Q = z.object({
  risk: z.enum(["LOW","MEDIUM","HIGH"]).optional(),
  region: z.string().optional(),
  verified: z.enum(["true","false"]).optional(),
  sinceHours: z.coerce.number().int().min(1).max(24*180).default(168),
  limit: z.coerce.number().int().min(1).max(50000).default(5000),
});

export async function GET(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return new Response("Unauthorized", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Q.safeParse(params);
  if (!parsed.success) return new Response("Invalid query", { status: 400 });

  const { risk, region, verified, sinceHours, limit } = parsed.data;
  const since = new Date(Date.now() - sinceHours * 3600 * 1000);
  const where: any = { orgId: tenant.orgId, createdAt: { gte: since } };
  where.dismissedAt = null;
  if (risk) where.risk = risk;
  if (region) where.region = region;
  if (verified) where.verified = verified === "true";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const header = ["id","createdAt","title","risk","score","region","topic","verified","lat","lng","contentUrl"].join(",") + "\n";
      controller.enqueue(encoder.encode(header));
      let cursor: string | undefined = undefined;
      let count = 0;

      while (count < limit) {
        const page = await prisma.alert.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: Math.min(500, limit - count),
          select: { id:true, createdAt:true, title:true, risk:true, score:true, region:true, topic:true, verified:true, lat:true, lng:true, contentUrl:true },
        });
        if (page.length === 0) break;
        for (const a of page) {
          const row = [
            a.id,
            a.createdAt.toISOString(),
            (a.title ?? "").replace(/"/g, '""'),
            a.risk,
            a.score,
            a.region ?? "",
            a.topic ?? "",
            a.verified ? "true" : "false",
            a.lat ?? "",
            a.lng ?? "",
            a.contentUrl ?? "",
          ].map(v => `"${String(v)}"`).join(",") + "\n";
          controller.enqueue(encoder.encode(row));
        }
        count += page.length;
        cursor = page[page.length - 1].id;
        if (page.length < 500) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alerts_${Date.now()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
