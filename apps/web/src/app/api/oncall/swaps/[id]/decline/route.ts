import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";
import { enqueueSwapEvent } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const swap = await prisma.shiftSwap.findUnique({ 
    where: { id: params.id },
    include: { shift: true }
  });
  if (!swap) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (swap.status !== "PENDING") return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });

  const auth = await requireOrgWriteAuthWithScope(req, swap.orgId, ["swap.decline"]);
  if (auth instanceof NextResponse) return auth;

  const updated = await prisma.shiftSwap.update({
    where: { id: params.id },
    data: { status: "DECLINED", decidedAt: new Date(), decidedBy: "system" },
  });

  // Enqueue notification event
  await enqueueSwapEvent(swap.orgId, "SWAP_DECLINED", {
    orgId: swap.orgId,
    swapId: swap.id,
    shiftId: swap.shiftId
  });

  return NextResponse.json({ ok: true, swap: updated });
}
