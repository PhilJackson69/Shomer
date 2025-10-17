/* ts-node compatible */
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Starting orgId backfill...");
  
  // For ThreatSignal, we'll need to determine orgId based on existing data
  // Since ThreatSignal doesn't have a direct user relation, we'll use a default org
  // or create a mapping based on your business logic
  
  // Get the first organization as default (adjust this logic as needed)
  const defaultOrg = await prisma.organization.findFirst({
    select: { id: true, name: true }
  });
  
  if (!defaultOrg) {
    console.error("No organization found. Please create an organization first.");
    process.exit(1);
  }
  
  console.log(`Using default org: ${defaultOrg.name} (${defaultOrg.id})`);

  // Backfill ThreatSignal records
  const signalsWithoutOrg = await prisma.threatSignal.findMany({
    where: { orgId: null },
    select: { id: true },
    take: 1000,
  });

  console.log(`Found ${signalsWithoutOrg.length} ThreatSignal records without orgId`);

  for (const signal of signalsWithoutOrg) {
    await prisma.threatSignal.update({
      where: { id: signal.id },
      data: { orgId: defaultOrg.id }
    });
  }

  // Backfill SignalNote records
  const notesWithoutOrg = await prisma.signalNote.findMany({
    where: { orgId: null },
    select: { id: true, signalId: true },
    take: 2000,
  });

  console.log(`Found ${notesWithoutOrg.length} SignalNote records without orgId`);

  for (const note of notesWithoutOrg) {
    // Get orgId from the parent signal
    const signal = await prisma.threatSignal.findUnique({
      where: { id: note.signalId },
      select: { orgId: true }
    });
    
    if (signal?.orgId) {
      await prisma.signalNote.update({
        where: { id: note.id },
        data: { orgId: signal.orgId }
      });
    } else {
      // Fallback to default org
      await prisma.signalNote.update({
        where: { id: note.id },
        data: { orgId: defaultOrg.id }
      });
    }
  }

  // Backfill IncidentEvent records
  const eventsWithoutOrg = await prisma.incidentEvent.findMany({
    where: { orgId: null },
    select: { id: true, signalId: true },
    take: 2000,
  });

  console.log(`Found ${eventsWithoutOrg.length} IncidentEvent records without orgId`);

  for (const event of eventsWithoutOrg) {
    // Get orgId from the parent signal
    const signal = await prisma.threatSignal.findUnique({
      where: { id: event.signalId },
      select: { orgId: true }
    });
    
    if (signal?.orgId) {
      await prisma.incidentEvent.update({
        where: { id: event.id },
        data: { orgId: signal.orgId }
      });
    } else {
      // Fallback to default org
      await prisma.incidentEvent.update({
        where: { id: event.id },
        data: { orgId: defaultOrg.id }
      });
    }
  }

  console.log("Backfill completed successfully!");
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
