import { prisma } from "../src/lib/prisma";
async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No org found. Run seed-oncall first.");
  await prisma.webhook.create({
    data: {
      orgId: org.id,
      url: "https://127.0.0.1:9/nowhere",
      secret: "test-secret",
      events: "alert.created,incident.created",
      active: true,
    },
  });
  console.log("Added failing webhook");
}
main().finally(() => process.exit(0));
