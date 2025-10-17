import { prisma } from "@/lib/prisma";

export async function hasOverlapForUser(orgId: string, userId: string, from: Date, to: Date) {
  const exists = await prisma.onCall.findFirst({
    where: {
      orgId,
      userId,
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { id: true },
  });
  return !!exists;
}
