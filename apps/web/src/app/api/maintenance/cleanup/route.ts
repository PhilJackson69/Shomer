import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || auth !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysDismissed = env.RETENTION_DAYS_DISMISSED;
  const daysVerified = env.RETENTION_DAYS_VERIFIED;

  const cutoffDismissed = new Date(Date.now() - daysDismissed * 86400000);
  const cutoffVerified = new Date(Date.now() - daysVerified * 86400000);

  const delDismissed = await prisma.alert.deleteMany({
    where: { dismissedAt: { not: null }, createdAt: { lt: cutoffDismissed } },
  });

  // Optional: archive verified (here: delete to keep simple; replace with move to cold storage if needed)
  const delVerified = await prisma.alert.deleteMany({
    where: { verified: true, createdAt: { lt: cutoffVerified } },
  });

  return NextResponse.json({ ok: true, deleted: { dismissed: delDismissed.count, verified: delVerified.count } });
}
