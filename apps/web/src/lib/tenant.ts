import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { getServerSession } from "@/lib/auth";

export async function getOrgFromSession() {
  const session = await getServerSession();
  const userId = (session as any)?.id as string | undefined;
  if (!userId) return null;
  const m = await prisma.membership.findFirst({ where: { userId }, select: { orgId: true, organization: { select: { name: true, slug: true }}}});
  return m ? { orgId: m.orgId, org: m.organization } : null;
}

export async function getOrgFromApiKey(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const key = authHeader.slice("Bearer ".length).trim();
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const k = await prisma.apiKey.findFirst({ where: { keyHash: hash, active: true }, select: { orgId: true, id: true }});
  if (!k) return null;
  await prisma.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() }});
  return { orgId: k.orgId };
}

export async function requireOrg(req: Request) {
  const viaKey = await getOrgFromApiKey(req.headers.get("authorization"));
  if (viaKey) return viaKey;
  const viaSession = await getOrgFromSession();
  if (viaSession) return viaSession;
  return null;
}


