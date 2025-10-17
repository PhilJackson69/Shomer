/* Creates helpful indexes if missing. Works on Postgres & SQLite via raw SQL.
 * Idempotent: uses IF NOT EXISTS where available.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || "";
const isPg = url.startsWith("postgres");
const isSqlite = url.includes("sqlite");

async function main() {
  console.log("[index] provider:", isPg ? "postgres" : isSqlite ? "sqlite" : "unknown");

  const stmtsPg = [
    `CREATE INDEX IF NOT EXISTS idx_raw_source_created ON "RawIngest" ("sourceId","createdAt");`,
    `CREATE INDEX IF NOT EXISTS idx_raw_hash ON "RawIngest" ("hash");`,
    `CREATE INDEX IF NOT EXISTS idx_signal_status_sev_score ON "ThreatSignal" ("status","severity","score");`,
    `CREATE INDEX IF NOT EXISTS idx_signal_updated ON "ThreatSignal" ("updatedAt");`,
    `CREATE INDEX IF NOT EXISTS idx_alert_signal_time ON "AlertEvent" ("signalId","deliveredAt");`,
  ];

  const stmtsSqlite = [
    `CREATE INDEX IF NOT EXISTS idx_raw_source_created ON RawIngest (sourceId, createdAt);`,
    `CREATE INDEX IF NOT EXISTS idx_raw_hash ON RawIngest (hash);`,
    `CREATE INDEX IF NOT EXISTS idx_signal_status_sev_score ON ThreatSignal (status, severity, score);`,
    `CREATE INDEX IF NOT EXISTS idx_signal_updated ON ThreatSignal (updatedAt);`,
    `CREATE INDEX IF NOT EXISTS idx_alert_signal_time ON AlertEvent (signalId, deliveredAt);`,
  ];

  const stmts = isPg ? stmtsPg : isSqlite ? stmtsSqlite : [];
  for (const s of stmts) {
    await prisma.$executeRawUnsafe(s);
    console.log("[index] ensured:", s.split("ON")[0].trim());
  }

  console.log("[index] done");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


