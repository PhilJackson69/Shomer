import { withAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate/enforce";
import { requireCsrfOr403 } from "@/lib/security/csrf";

export const POST = withAuth(async (user, { params, request }: { params: { id: string }, request: Request }) => {
  // CSRF first
  const csrfErr = requireCsrfOr403(request);
  if (csrfErr) return csrfErr;

  // Rate limit
  const rl = await rateLimitOr429("close", user.orgId, user.id);
  if (rl) return rl;

  const id = params.id;
  const sig = await prisma.threatSignal.findUnique({ 
    where: { id }, 
    select: { id: true, orgId: true, incidentClosedAt: true } 
  });
  if (!sig || sig.orgId !== user.orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // idempotent update
  if (!sig.incidentClosedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.threatSignal.update({
        where: { id },
        data: { incidentClosedAt: new Date(), closedByUserId: user.id },
      });
      await tx.incidentEvent.create({
        data: {
          signalId: id,
          actorUserId: user.id,
          orgId: user.orgId,
          type: "CLOSE",
          payload: "{}",
        },
      });
    });
  }

  const current = await prisma.threatSignal.findUnique({
    where: { id },
    select: { id: true, incidentClosedAt: true, closedByUserId: true },
  });
  return NextResponse.json({ ok: true, incident: current });
}, "ANALYST");