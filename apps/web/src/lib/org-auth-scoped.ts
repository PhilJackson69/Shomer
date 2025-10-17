import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------- In-memory token bucket (process-local) ----------
type Bucket = { tokens: number; last: number; rpm: number };
const buckets = new Map<string, Bucket>();

function takeToken(bucketId: string, rpm: number): boolean {
  const now = Date.now();
  const refillPerMs = rpm / 60_000; // tokens per ms
  let b = buckets.get(bucketId);
  if (!b) {
    b = { tokens: rpm, last: now, rpm };
    buckets.set(bucketId, b);
  } else {
    const elapsed = now - b.last;
    b.tokens = Math.min(b.rpm, b.tokens + elapsed * refillPerMs);
    b.last = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

// ---------- Helpers ----------
export function parseScopes(csv?: string | null): Set<string> {
  if (!csv) return new Set();
  return new Set(csv.split(",").map(s => s.trim()).filter(Boolean));
}

export function hasAllScopes(keyScopes: Set<string>, required: string[]): boolean {
  if (required.length === 0) return true;
  return required.every(s => keyScopes.has(s));
}

function hashValue(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

// Accepts global secret or org key WITH scope & rate-limit
export async function requireOrgWriteAuthWithScope(
  req: NextRequest,
  orgId: string,
  requiredScopes: string[]
) {
  // Path A: global secret still bypasses scopes & rate limit
  const globalHeader = req.headers.get("x-action-secret") || req.headers.get("X-Action-Secret");
  const actionSecret = process.env.ACTION_SECRET;
  if (actionSecret && globalHeader === actionSecret) {
    return { ok: true as const, via: "global" as const };
  }

  // Path B: org key with scopes
  const plain = req.headers.get("x-org-api-key") || req.headers.get("X-Org-Api-Key");
  if (!plain) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const prefix = plain.slice(0, 16);
  const hash = hashValue(plain);

  const rec = await prisma.organizationApiKey.findFirst({
    where: {
      orgId,
      prefix,
      hash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, scopes: true, requestsPerMinute: true }
  });
  if (!rec) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Scope check
  const keyScopes = parseScopes(rec.scopes);
  if (!hasAllScopes(keyScopes, requiredScopes)) {
    return NextResponse.json({ ok: false, error: "forbidden_scope", required: requiredScopes }, { status: 403 });
  }

  // Rate limit (if configured)
  if (rec.requestsPerMinute && rec.requestsPerMinute > 0) {
    const bucketId = `${orgId}:${rec.id}`;
    if (!takeToken(bucketId, rec.requestsPerMinute)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
    }
  }

  // Touch lastUsedAt
  await prisma.organizationApiKey.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } });

  // Minimal auth log (do NOT log plaintext key)
  console.info("[org-auth] ok", { orgId, keyId: rec.id, via: "orgkey" });

  return { ok: true as const, via: "orgkey" as const, keyId: rec.id };
}
