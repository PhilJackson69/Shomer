// Run with: pnpm assert:replay
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const hits = await prisma.threatSignal.count({
    where: {
      createdAt: { gte: since },
      OR: [{ severity: "HIGH" }, { severity: "CRITICAL" }],
    },
  });

  if (hits < 1) {
    console.error("❌ Replay check failed: no HIGH/CRITICAL signals in last 15 minutes.");
    process.exit(1);
  } else {
    console.log(`✅ Replay check passed: ${hits} HIGH/CRITICAL signals detected.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


