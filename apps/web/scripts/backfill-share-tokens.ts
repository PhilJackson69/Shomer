import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function backfillShareTokens() {
  console.log('Backfilling share tokens for existing organizations...');
  
  const orgsWithoutTokens = await prisma.organization.findMany({
    where: {
      shareToken: null,
    },
  });

  console.log(`Found ${orgsWithoutTokens.length} organizations without share tokens`);

  for (const org of orgsWithoutTokens) {
    const shareToken = randomUUID();
    await prisma.organization.update({
      where: { id: org.id },
      data: { shareToken },
    });
    console.log(`Generated token for org: ${org.name} -> ${shareToken}`);
  }

  console.log('Backfill complete!');
}

backfillShareTokens()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
