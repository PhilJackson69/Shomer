import { prisma } from "../src/lib/prisma";

async function main() {
  // Ensure one org + one user exist; create if needed
  let org = await prisma.organization.findFirst();
  if (!org) org = await prisma.organization.create({ data: { name: "Default Org", slug: "default" }});

  let user = await prisma.user.findFirst();
  if (!user) user = await prisma.user.create({ data: { email: "admin@local", role: "ADMIN" as any }});

  const now = new Date();
  const ends = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.onCall.create({ data: { orgId: org.id, userId: user.id, region: null, startsAt: now, endsAt: ends }});

  // Give the user membership if your code expects it
  const m = await prisma.membership.findFirst({ where: { orgId: org.id, userId: user.id }});
  if (!m) await prisma.membership.create({ data: { orgId: org.id, userId: user.id, role: "ADMIN" as any }});

  console.log("Seeded on-call + membership:", { org: org.id, user: user.id });
}
main().finally(() => process.exit(0));
