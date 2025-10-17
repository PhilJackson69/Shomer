import { prisma } from "@/lib/prisma";

export async function currentOnCall(orgId: string, region?: string | null) {
  const now = new Date();
  const match = await prisma.onCall.findFirst({
    where: { orgId, region: region ?? null, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "desc" },
    select: { userId: true }
  });
  return match?.userId ?? null;
}


