import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const signal = await prisma.threatSignal.update({
      where: { id },
      data: { snoozeUntil: until as any, updatedAt: new Date() },
    });

    await prisma.alertEvent.create({
      data: {
        signalId: id,
        channel: "internal:action",
        success: true,
        response: JSON.stringify({ action: "snooze_24h", until: until.toISOString() }),
      },
    });

    return NextResponse.json({ ok: true, signal });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 400 });
  }
}


