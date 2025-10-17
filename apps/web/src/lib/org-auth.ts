import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function requireOrgWriteAuth(req: NextRequest, orgId: string) {
  // Global secret still allowed
  const globalHeader = req.headers.get("x-action-secret") || req.headers.get("X-Action-Secret");
  const actionSecret = process.env.ACTION_SECRET;
  if (actionSecret && globalHeader === actionSecret) {
    return { ok: true as const, via: "global" as const };
  }

  // Scoped API key
  const apikey = req.headers.get("x-org-api-key") || req.headers.get("X-Org-Api-Key");
  if (!apikey) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Parse: "org_<something>_<random...>" — we only store sha256 hash
  const prefix = apikey.slice(0, 16);
  const hash = crypto.createHash("sha256").update(apikey).digest("hex");

  const key = await prisma.organizationApiKey.findFirst({
    where: {
      orgId,
      prefix,
      hash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true }
  });

  if (!key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await prisma.organizationApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() }
  });

  return { ok: true as const, via: "orgkey" as const, keyId: key.id };
}

// Util to forge a displayable new key
export function generateOrgApiKey(orgId: string) {
  const rand = crypto.randomBytes(24).toString("base64url"); // URL-safe
  const prefix = `org_${orgId.slice(0,4)}_${rand.slice(0,6)}`;
  const value = `${prefix}.${crypto.randomBytes(24).toString("base64url")}`;
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  const keyId = crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  return { prefix, value, hash, keyId };
}
