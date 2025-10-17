import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guards";
import { NextResponse } from "next/server";

const Query = z.object({
  severity: z.union([z.string(), z.array(z.string())]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuth(async (user, reqCtx) => {
  const req = reqCtx as any; // Next.ts typing quirk
  const { searchParams } = new URL(req.request.url);
  const raw = Object.fromEntries(searchParams);
  const severityParams = searchParams.getAll("severity");
  if (severityParams.length) raw.severity = severityParams;
  const { severity, cursor, limit } = Query.parse(raw);

  const where = {
    orgId: user.orgId,
    incidentClosedAt: null,
    ...(severity ? { severity: { in: Array.isArray(severity) ? severity : [severity] } } : {}),
  };

  const rows = await prisma.threatSignal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { 
      id: true, 
      severity: true, 
      createdAt: true, 
      incidentAckedAt: true, 
      orgId: true,
      score: true,
      status: true,
      indicators: true,
      rationale: true,
      raw: {
        select: {
          title: true,
          content: true,
          url: true,
          author: true,
          source: {
            select: {
              name: true,
              type: true
            }
          }
        }
      }
    },
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const nextCursor = hasMore ? rows[rows.length - 1]?.id : null;

  return NextResponse.json({ items: rows, nextCursor });
}, "VIEWER");