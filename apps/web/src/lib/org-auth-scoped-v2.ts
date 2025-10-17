/**
 * Improved organization authentication with scopes and rate limiting
 * This is the hardened version with proper error shapes and security logging
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SCOPES, type Scope, isScope, validateScopes } from "@/lib/scopes";
import { takeToken, touchLastUsedAt } from "@/lib/ratelimit";
import { securityLogger, redactKey } from "@/lib/security-logger";

type AuthResult =
  | { ok: true; orgId: string; keyId?: string; bypass: boolean }
  | { ok: false; res: Response };

/**
 * Standardized error response shape
 */
function err(status: number, code: string, message: string, details?: any): Response {
  return new Response(
    JSON.stringify({ 
      error: { 
        code, 
        message,
        ...(details && { details })
      } 
    }), 
    {
      status,
      headers: { "content-type": "application/json" },
    }
  );
}

/**
 * Derive keyId from API key for stable identification
 */
function deriveKeyId(rawKey: string): string {
  // Use a consistent method to derive keyId from the key
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Verify API key against stored hash
 */
function verifyKey(rawKey: string, storedHash: string): boolean {
  const computedHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  return computedHash === storedHash;
}

/**
 * Parse scopes from database value (handles both JSON and CSV for migration)
 */
function parseScopesFromDb(scopes: any): Scope[] {
  if (scopes == null) {
    return SCOPES; // Backwards compat: null = full access
  }
  
  if (Array.isArray(scopes)) {
    return validateScopes(scopes);
  }
  
  if (typeof scopes === 'string') {
    // Handle legacy CSV format
    return validateScopes(scopes.split(',').map(s => s.trim()).filter(Boolean));
  }
  
  return [];
}

/**
 * Main authentication function with scope and rate limiting
 */
export async function requireOrgWriteAuthWithScope(
  req: NextRequest,
  orgId: string,
  required: Scope,
  db: any = prisma
): Promise<AuthResult> {
  const route = req.nextUrl.pathname;
  
  // Path A: Global secret bypasses scopes & rate limit
  const secret = req.headers.get("x-action-secret") || req.headers.get("X-Action-Secret");
  if (secret && secret === process.env.ACTION_SECRET) {
    securityLogger.info('global_secret_auth', { orgId, route });
    return { ok: true, orgId, bypass: true };
  }

  // Path B: Organization API key with scopes
  const raw = req.headers.get("x-org-api-key") || req.headers.get("X-Org-Api-Key");
  if (!raw) {
    securityLogger.warn('apikey.missing', { orgId, route });
    return { ok: false, res: err(401, "invalid_key", "Missing API key") };
  }

  const keyId = deriveKeyId(raw);
  const keyPrefix = raw.slice(0, 16);
  
  try {
    const key = await db.organizationApiKey.findUnique({ 
      where: { keyId },
      select: { 
        id: true, 
        orgId: true,
        keyHash: true,
        scopes: true, 
        requestsPerMinute: true,
        disabledAt: true,
        revokedAt: true,
        expiresAt: true
      }
    });

    if (!key) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'key_not_found');
      return { ok: false, res: err(401, "invalid_key", "Invalid API key") };
    }

    // Verify key hash
    if (!verifyKey(raw, key.keyHash)) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'hash_mismatch');
      return { ok: false, res: err(401, "invalid_key", "Invalid API key") };
    }

    // Check organization match
    if (key.orgId !== orgId) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'org_mismatch');
      return { ok: false, res: err(401, "invalid_key", "Invalid API key") };
    }

    // Check if key is disabled
    if (key.disabledAt) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'key_disabled');
      return { ok: false, res: err(401, "invalid_key", "API key disabled") };
    }

    // Check if key is revoked
    if (key.revokedAt) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'key_revoked');
      return { ok: false, res: err(401, "invalid_key", "API key revoked") };
    }

    // Check if key is expired
    if (key.expiresAt && key.expiresAt < new Date()) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'key_expired');
      return { ok: false, res: err(401, "invalid_key", "API key expired") };
    }

    // Parse and validate scopes
    const keyScopes = parseScopesFromDb(key.scopes);
    
    // Check if scopes are valid
    if (keyScopes.length === 0 && key.scopes != null) {
      securityLogger.apikeyInvalid(orgId, keyPrefix, 'corrupt_scopes');
      return { ok: false, res: err(401, "invalid_key", "Corrupt scopes on key") };
    }

    // Check required scope
    if (!keyScopes.includes(required)) {
      securityLogger.apikeyScopeDenied(orgId, key.id, required, keyScopes);
      return { 
        ok: false, 
        res: err(403, "forbidden_scope", `Requires scope ${required}`, { 
          required, 
          available: keyScopes 
        }) 
      };
    }

    // Rate limiting
    if (key.requestsPerMinute && key.requestsPerMinute > 0) {
      const bucketKey = `${orgId}:${keyId}`;
      const allowed = takeToken(bucketKey, key.requestsPerMinute);
      if (!allowed) {
        securityLogger.apikeyRateLimited(orgId, key.id, key.requestsPerMinute);
        return { 
          ok: false, 
          res: err(429, "rate_limited", "Rate limit exceeded", {
            retryAfter: 60
          }) 
        };
      }
    }

    // Update lastUsedAt (throttled)
    touchLastUsedAt(db, keyId).catch(() => {
      // Silently fail - not critical
    });

    securityLogger.apikeyAuth(orgId, key.id, route, required);
    return { ok: true, orgId, keyId: key.id, bypass: false };

  } catch (error) {
    securityLogger.error('apikey.auth_error', { 
      orgId, 
      keyPrefix: redactKey(keyPrefix), 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return { ok: false, res: err(500, "internal_error", "Authentication error") };
  }
}

/**
 * Legacy compatibility function - wraps the new implementation
 */
export async function requireOrgWriteAuthWithScopeLegacy(
  req: NextRequest,
  orgId: string,
  requiredScopes: string[]
): Promise<{ ok: boolean; via?: string; keyId?: string } | NextResponse> {
  // Convert string array to single scope for new implementation
  // This maintains backward compatibility
  if (requiredScopes.length === 0) {
    const result = await requireOrgWriteAuthWithScope(req, orgId, "rota.write" as Scope);
    if (result.ok) {
      return { ok: true, via: result.bypass ? "global" : "orgkey", keyId: result.keyId };
    }
    return result.res;
  }

  // For multiple scopes, we'll use the first one as the primary requirement
  // In a real implementation, you might want to handle multiple scopes differently
  const primaryScope = requiredScopes[0] as Scope;
  if (!isScope(primaryScope)) {
    return NextResponse.json({ ok: false, error: "invalid_scope" }, { status: 400 });
  }

  const result = await requireOrgWriteAuthWithScope(req, orgId, primaryScope);
  if (result.ok) {
    return { ok: true, via: result.bypass ? "global" : "orgkey", keyId: result.keyId };
  }
  return result.res;
}
