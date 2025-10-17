import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

/**
 * Find organization by share token
 */
export async function findOrgByToken(token: string): Promise<{ id: string; name: string; shareToken: string } | null> {
  const org = await prisma.organization.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      shareToken: true,
    },
  });

  return org;
}

/**
 * Ensure organization has a share token, creating one if missing
 */
export async function ensureOrgShareToken(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { shareToken: true },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  if (org.shareToken) {
    return org.shareToken;
  }

  // Generate new token
  const shareToken = randomUUID();
  
  await prisma.organization.update({
    where: { id: orgId },
    data: { shareToken },
  });

  return shareToken;
}

/**
 * Rotate organization share token (generates new token and invalidates old one)
 */
export async function rotateOrgShareToken(orgId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Generate new token
  const shareToken = randomUUID();
  
  await prisma.organization.update({
    where: { id: orgId },
    data: { shareToken },
  });

  return shareToken;
}
