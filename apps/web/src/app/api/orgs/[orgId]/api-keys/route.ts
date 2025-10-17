import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgWriteAuth, generateOrgApiKey } from "@/lib/org-auth";
import { SCOPES, type Scope, isScope, validateScopes } from "@/lib/scopes";
import { securityLogger } from "@/lib/security-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { orgId: string }}) {
  const items = await prisma.organizationApiKey.findMany({
    where: { orgId: params.orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, prefix: true, createdAt: true, expiresAt: true, revokedAt: true, lastUsedAt: true, scopes: true, requestsPerMinute: true }
  });
  return NextResponse.json({ ok: true, items });
}

const CreateSchema = z.object({
  label: z.string().max(80).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(), // ISO string
  scopes: z.array(z.string()).refine(
    (scopes) => scopes.every(isScope),
    { message: "Invalid scope provided" }
  ).optional().default([]),
  requestsPerMinute: z.number().int().positive().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { orgId: string }}) {
  const auth = await requireOrgWriteAuth(req, params.orgId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const data = CreateSchema.parse(body);

  // Validate and normalize scopes
  const validScopes = validateScopes(data.scopes);
  const scopesToStore = validScopes.length > 0 ? validScopes : null; // null = full access

  const { prefix, value, hash, keyId } = generateOrgApiKey(params.orgId);
  const row = await prisma.organizationApiKey.create({
    data: {
      orgId: params.orgId,
      label: data.label ?? null,
      keyHash: hash,
      keyId,
      prefix,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      scopes: scopesToStore,
      requestsPerMinute: data.requestsPerMinute ?? null
    },
    select: { id: true, label: true, prefix: true, createdAt: true, expiresAt: true, scopes: true, requestsPerMinute: true }
  });

  // Log key creation
  securityLogger.apikeyCreated(params.orgId, keyId, data.label ?? undefined, validScopes);

  // Return plain value once
  return NextResponse.json({ ok: true, key: { ...row, value } });
}

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string }}) {
  const auth = await requireOrgWriteAuth(req, params.orgId);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const key = await prisma.organizationApiKey.findUnique({
    where: { id },
    select: { keyId: true }
  });

  if (!key) {
    return NextResponse.json({ ok: false, error: "key_not_found" }, { status: 404 });
  }

  await prisma.organizationApiKey.update({
    where: { id },
    data: { revokedAt: new Date() }
  });

  // Log key revocation
  securityLogger.apikeyRevoked(params.orgId, key.keyId, "User requested revocation");

  return NextResponse.json({ ok: true });
}
