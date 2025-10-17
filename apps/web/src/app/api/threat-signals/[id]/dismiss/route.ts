import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const signal = await prisma.threatSignal.update({
    where: { id },
    data: { status: "FALSE_POSITIVE", updatedAt: new Date() },
  });

  await prisma.alertEvent.create({
    data: {
      signalId: id,
      channel: "internal:action",
      success: true,
      response: JSON.stringify({ action: "dismiss_false_positive" }),
    },
  });

  return NextResponse.json({ ok: true, signal });
}


