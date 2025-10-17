import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type OutboxType = "SWAP_CREATED" | "SWAP_APPROVED" | "SWAP_DECLINED";

export async function enqueueSwapEvent(orgId: string, type: OutboxType, payload: Record<string, any>) {
  const item = await prisma.eventOutbox.create({
    data: {
      orgId,
      type,
      payload: JSON.stringify(payload),
      nextAttemptAt: new Date(0), // deliver asap
    }
  });
  // Activity
  await prisma.activity.create({
    data: {
      orgId,
      kind: type,
      summary: makeSummary(type, payload),
      details: JSON.stringify(payload)
    }
  });
  return item;
}

function makeSummary(type: OutboxType, p: any): string {
  switch (type) {
    case "SWAP_CREATED":  return `Swap requested for shift ${p.shiftId}: → ${p.requestedUser?.name ?? p.requestedUserId}`;
    case "SWAP_APPROVED": return `Swap approved for shift ${p.shiftId}: ${p.oldUser?.name ?? p.oldUserId} → ${p.newUser?.name ?? p.newUserId}`;
    case "SWAP_DECLINED": return `Swap declined for shift ${p.shiftId}`;
  }
}

export function signBody(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function nextBackoff(attempts: number): number {
  if (attempts <= 0) return 60_000;     // 1m
  if (attempts === 1) return 5 * 60_000; // 5m
  if (attempts === 2) return 15 * 60_000; // 15m
  return 60 * 60_000; // 60m
}