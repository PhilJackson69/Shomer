import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueSwapEvent } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  orgId: z.string().min(1),
  shiftId: z.string().min(1),
  requestedUserId: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);

    // verify shift is in org
    const shift = await prisma.onCall.findUnique({ where: { id: data.shiftId } });
    if (!shift || shift.orgId !== data.orgId) {
      return NextResponse.json({ ok: false, error: "shift_not_found" }, { status: 404 });
    }

    const swap = await prisma.shiftSwap.create({
      data: {
        orgId: data.orgId,
        shiftId: data.shiftId,
        requestedUserId: data.requestedUserId,
        reason: data.reason ?? null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shift: { 
          include: { 
            user: { select: { id: true, name: true, email: true } } 
          } 
        }
      }
    });

    // Enqueue notification event
    await enqueueSwapEvent(data.orgId, "SWAP_CREATED", {
      orgId: data.orgId,
      swapId: swap.id,
      shiftId: data.shiftId,
      requestedUserId: data.requestedUserId,
      requestedUser: swap.user,
      shift: {
        id: swap.shift.id,
        userId: swap.shift.userId,
        startsAt: swap.shift.startsAt,
        endsAt: swap.shift.endsAt,
        region: (swap.shift as any).region ?? null
      }
    });

    return NextResponse.json({ ok: true, swap });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "bad_request" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const status = (searchParams.get("status") ?? "PENDING").toUpperCase();
  if (!orgId) return NextResponse.json({ ok: false, error: "orgId_required" }, { status: 400 });

  const swaps = await prisma.shiftSwap.findMany({
    where: { orgId, status },
    orderBy: { createdAt: "desc" },
    include: {
      shift: { include: { user: { select: { id: true, name: true, email: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ ok: true, swaps });
}
