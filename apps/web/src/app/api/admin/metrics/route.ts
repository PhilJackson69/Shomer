import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export async function GET() {
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  const [sev7, sev30] = await Promise.all([
    prisma.threatSignal.groupBy({
      by: ["severity"],
      _count: { severity: true },
      where: { createdAt: { gte: since7 } },
    }),
    prisma.threatSignal.groupBy({
      by: ["severity"],
      _count: { severity: true },
      where: { createdAt: { gte: since30 } },
    }),
  ]);

  const [total7, fp7] = await Promise.all([
    prisma.threatSignal.count({ where: { createdAt: { gte: since7 } } }),
    prisma.threatSignal.count({ where: { status: "FALSE_POSITIVE", updatedAt: { gte: since7 } } }),
  ]);
  const fpRate7 = total7 ? fp7 / total7 : 0;

  const alerts = await prisma.alertEvent.findMany({
    where: { success: true, deliveredAt: { gte: since7 } },
    select: { deliveredAt: true, signalId: true },
    orderBy: { deliveredAt: "asc" },
  });
  const signalCreated = await prisma.threatSignal.findMany({
    where: { id: { in: [...new Set(alerts.map(a => a.signalId))] } },
    select: { id: true, createdAt: true },
  });
  const createdMap = new Map(signalCreated.map(s => [s.id, s.createdAt]));
  const firstBySignal = new Map<string, Date>();
  for (const a of alerts) if (!firstBySignal.has(a.signalId) && a.deliveredAt) firstBySignal.set(a.signalId, a.deliveredAt);
  const latenciesMs: number[] = [];
  for (const [sid, first] of firstBySignal.entries()) {
    const c = createdMap.get(sid);
    if (c && first) latenciesMs.push(first.getTime() - c.getTime());
  }
  const avgLatencySec7 = latenciesMs.length ? Math.round(latenciesMs.reduce((a,b)=>a+b,0) / latenciesMs.length / 1000) : 0;

  const maint = await prisma.maintenanceLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, createdAt: true, kind: true, meta: true },
  });

  const payload = {
    severity: {
      last7d: Object.fromEntries(sev7.map(s => [s.severity, s._count.severity])),
      last30d: Object.fromEntries(sev30.map(s => [s.severity, s._count.severity])),
    },
    falsePositiveRate7d: fpRate7,
    avgAlertLatencySec7d: avgLatencySec7,
    maintenanceRecent: maint.map(m => ({
      id: m.id,
      createdAt: m.createdAt,
      kind: m.kind,
      meta: typeof m.meta === "string" ? m.meta : JSON.stringify(m.meta ?? {}),
    })),
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "private, max-age=30");
  return res;
}


