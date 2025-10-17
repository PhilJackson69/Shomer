import { prisma } from "../src/lib/prisma";

async function main() {
  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
      shareToken: "default-token",
    },
  });
  console.log("Seeded default organization:", org.name);

  // Create admin user
  const user = await prisma.user.upsert({
    where: { email: "admin@shomer.local" },
    update: { role: "ADMIN" },
    create: { email: "admin@shomer.local", name: "Admin", role: "ADMIN" },
  });
  console.log("Seeded admin user.");

  // Create membership
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: { role: "ADMIN" },
    create: {
      userId: user.id,
      orgId: org.id,
      role: "ADMIN",
    },
  });
  console.log("Seeded admin membership.");
}

main().finally(() => process.exit(0));


