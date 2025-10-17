/* Data retention for Shomer.
 * Deletes old RawIngest / ThreatSignal / AlertEvent rows based on env.
 * Uses Prisma filters provider-agnostically.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function beforeDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const RAW_DAYS = envInt("RETENTION_RAW_DAYS", 90);
  const SIG_DAYS = envInt("RETENTION_SIGNAL_DAYS", 365);
  const ALERT_DAYS = envInt("RETENTION_ALERT_DAYS", 365);
  const DRY = (process.env.RETENTION_DRY_RUN || "false").toLowerCase() === "true";

  const rawCut = beforeDays(RAW_DAYS);
  const sigCut = beforeDays(SIG_DAYS);
  const alCut  = beforeDays(ALERT_DAYS);

  console.log(`[retention] DRY_RUN=${DRY} raw>${RAW_DAYS}d signal>${SIG_DAYS}d alert>${ALERT_DAYS}d`);

  const tasks: Array<{name:string; fn: () => Promise<number>; count: () => Promise<number>}> = [
    {
      name: "AlertEvent",
      fn: async () => {
        const res = await prisma.alertEvent.deleteMany({
          where: { deliveredAt: { lt: alCut } },
        });
        return res.count;
      },
      count: async () => prisma.alertEvent.count({ where: { deliveredAt: { lt: alCut } } }),
    },
    {
      name: "ThreatSignal",
      fn: async () => {
        const res = await prisma.threatSignal.deleteMany({
          where: { createdAt: { lt: sigCut } },
        });
        return res.count;
      },
      count: async () => prisma.threatSignal.count({ where: { createdAt: { lt: sigCut } } }),
    },
    {
      name: "RawIngest",
      fn: async () => {
        const res = await prisma.rawIngest.deleteMany({
          where: { createdAt: { lt: rawCut } },
        });
        return res.count;
      },
      count: async () => prisma.rawIngest.count({ where: { createdAt: { lt: rawCut } } }),
    },
  ];

  for (const t of tasks) {
    if (DRY) {
      const count = await t.count();
      console.log(`[retention] would delete ${count} from ${t.name}`);
    } else {
      const deleted = await t.fn();
      console.log(`[retention] deleted ${deleted} from ${t.name}`);
    }
  }

  // Maintenance audit log
  const meta = {
    rawCut: rawCut.toISOString(),
    sigCut: sigCut.toISOString(),
    alCut: alCut.toISOString(),
    dryRun: DRY,
  } as any;
  try {
    await prisma.maintenanceLog.create({
      data: { kind: "retention", meta: JSON.stringify(meta) },
    });
    console.log("[retention] audit row inserted");
  } catch (e) {
    console.warn("[retention] failed to insert audit row", e);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


