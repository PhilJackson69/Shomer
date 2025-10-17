import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/apiFetch";
import { prisma } from "@/lib/prisma";
import { signBody, nextBackoff } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 50;

export async function POST(_req: NextRequest) {
  const now = new Date();

  // Grab pending (due) items without exclusive locks (SQLite); tiny race is OK.
  const items = await prisma.eventOutbox.findMany({
    where: {
      deliveredAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: { createdAt: "asc" },
    take: MAX
  });

  let delivered = 0, failed = 0;

  for (const it of items) {
    const endpoints = await prisma.notificationEndpoint.findMany({ where: { orgId: it.orgId } });
    if (!endpoints.length) {
      // Nothing to send to; mark delivered to avoid infinite retries
      await prisma.eventOutbox.update({ where: { id: it.id }, data: { deliveredAt: new Date() }});
      delivered++;
      continue;
    }

    const body = it.payload;
    let allOk = true;

    for (const ep of endpoints) {
      try {
        const sig = "sha256=" + signBody(body, ep.secret);
        const res = await apiFetch(ep.url, { method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Shomer-Signature": sig,
            "Shomer-Event": it.type
          },
          body
        });
        if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      } catch (e: any) {
        allOk = false;
      }
    }

    if (allOk) {
      await prisma.eventOutbox.update({ where: { id: it.id }, data: { deliveredAt: new Date(), lastError: null }});
      delivered++;
    } else {
      const attempts = it.attempts + 1;
      const delay = nextBackoff(it.attempts);
      await prisma.eventOutbox.update({
        where: { id: it.id },
        data: {
          attempts,
          nextAttemptAt: new Date(Date.now() + delay),
          lastError: `Delivery failed at ${new Date().toISOString()} (attempt ${attempts})`
        }
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, delivered, failed, processed: items.length });
}
