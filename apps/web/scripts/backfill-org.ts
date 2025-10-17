import { prisma } from "../src/lib/prisma";

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    const created = await prisma.organization.create({ data: { name: "Default Org", slug: "default" }});
    console.log("Created default org:", created.id);
  }
  const target = org ?? (await prisma.organization.findFirst());
  if (!target) throw new Error("No org available");

  const s = await prisma.source.updateMany({ where: { orgId: null }, data: { orgId: target.id }});
  const a = await prisma.alert.updateMany({ where: { orgId: null }, data: { orgId: target.id }});
  console.log("Backfilled sources:", s.count, "alerts:", a.count);
}

main().finally(()=>process.exit(0));


