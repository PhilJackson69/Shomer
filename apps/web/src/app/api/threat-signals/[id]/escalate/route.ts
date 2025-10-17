import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const bump = body?.bump ?? true;

  const current = await prisma.threatSignal.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const order = ["LOW","MEDIUM","HIGH","CRITICAL"] as const;
  const idx = order.indexOf(current.severity as any);
  const next = bump ? order[Math.min(order.length - 1, Math.max(0, idx + 1))] : (current.severity as any);

  const signal = await prisma.threatSignal.update({
    where: { id },
    data: { status: "CONFIRMED", severity: next as any, updatedAt: new Date() },
  });

  await prisma.alertEvent.create({
    data: {
      signalId: id,
      channel: "internal:action",
      success: true,
      response: JSON.stringify({ action: "confirm_escalate", bumpedTo: next }),
    },
  });

  return NextResponse.json({ ok: true, signal });
}


