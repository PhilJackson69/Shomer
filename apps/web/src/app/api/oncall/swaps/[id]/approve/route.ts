import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";
import { hasOverlapForUser } from "@/lib/swaps";
import { enqueueSwapEvent } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const swap = await prisma.shiftSwap.findUnique({
    where: { id: params.id },
    include: { 
      shift: { include: { user: { select: { id: true, name: true, email: true } } } },
      user: { select: { id: true, name: true, email: true } }
    },
  });
  if (!swap) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (swap.status !== "PENDING") return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

  const { orgId, shift, requestedUserId } = swap;

  const auth = await requireOrgWriteAuthWithScope(req, orgId, ["swap.approve"]);
  if (auth instanceof NextResponse) return auth;
  // overlap check
  const overlap = await hasOverlapForUser(orgId, requestedUserId, shift.startsAt, shift.endsAt);
  if (overlap) return NextResponse.json({ ok: false, error: "overlap", code: "TARGET_CONFLICT" }, { status: 409 });

  // capture before
  const before = { userId: shift.userId, startsAt: shift.startsAt, endsAt: shift.endsAt, region: (shift as any).region ?? null };

  // reassign
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.onCall.update({
      where: { id: shift.id },
      data: { userId: requestedUserId },
    });

    await tx.onCallAudit.create({
      data: {
        action: "UPDATE",
        shiftId: s.id,
        userId: "system", // TODO: get actual user ID from auth
        orgId: orgId,
        oldData: JSON.stringify(before),
        newData: JSON.stringify({ userId: s.userId, startsAt: s.startsAt, endsAt: s.endsAt, region: (s as any).region ?? null }),
      },
    });

    await tx.shiftSwap.update({
      where: { id: swap.id },
      data: { status: "APPROVED", decidedAt: new Date(), decidedBy: "system" },
    });

    return s;
  });

  // Enqueue notification event
  await enqueueSwapEvent(orgId, "SWAP_APPROVED", {
    orgId,
    swapId: swap.id,
    shiftId: shift.id,
    oldUserId: shift.userId,
    newUserId: requestedUserId,
    oldUser: swap.shift.user,
    newUser: swap.user,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt
  });

  return NextResponse.json({ ok: true, shift: updated });
}
