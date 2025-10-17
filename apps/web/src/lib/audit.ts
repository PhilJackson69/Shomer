import { prisma } from "@/lib/prisma";

export async function logAudit(args: {
  orgId: string;
  actorId?: string | null;
  actorKind: "user" | "signed-link" | "api-key";
  action: string;
  alertId?: string;
  meta?: Record<string, any>;
}) {
  return prisma.auditLog.create({ data: { ...args, meta: args.meta ?? {} }});
}


