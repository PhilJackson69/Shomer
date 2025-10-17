/**
 * Route wrapper utilities for enforcing scope checks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgWriteAuthWithScope } from "./org-auth-scoped-v2";
import { type Scope } from "./scopes";
import { prisma } from "./prisma";

type Handler = (
  req: NextRequest,
  context: { orgId: string; keyId?: string; bypass: boolean }
) => Promise<NextResponse>;

type RouteParams = { params: { orgId: string } };

/**
 * Extract organization ID from request
 */
function getOrgId(req: NextRequest, params?: RouteParams): string {
  // Try URL params first (for /api/orgs/[orgId]/... routes)
  if (params?.params?.orgId) {
    return params.params.orgId;
  }
  
  // Try query parameter
  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId');
  if (orgId) {
    return orgId;
  }
  
  // Try request body (for POST requests)
  // Note: This would require reading the body, which might not be ideal
  // Consider passing orgId explicitly in most cases
  
  throw new Error('Organization ID not found in request');
}

/**
 * Higher-order function to enforce scope checks on API routes
 */
export const withScope = (scope: Scope, handler: Handler) => 
  async (req: NextRequest, context?: RouteParams): Promise<NextResponse> => {
    try {
      const orgId = getOrgId(req, context);
      const auth = await requireOrgWriteAuthWithScope(req, orgId, scope, prisma);
      
      if (!auth.ok) {
        return auth.res;
      }
      
      return handler(req, { 
        orgId, 
        keyId: auth.keyId, 
        bypass: auth.bypass 
      });
    } catch (error) {
      console.error('[route-wrapper] Error in withScope:', error);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };

/**
 * Higher-order function for routes that need multiple scopes (any one of them)
 */
export const withAnyScope = (scopes: Scope[], handler: Handler) => 
  async (req: NextRequest, context?: RouteParams): Promise<NextResponse> => {
    try {
      const orgId = getOrgId(req, context);
      
      // Try each scope until one succeeds
      for (const scope of scopes) {
        const auth = await requireOrgWriteAuthWithScope(req, orgId, scope, prisma);
        if (auth.ok) {
          return handler(req, { 
            orgId, 
            keyId: auth.keyId, 
            bypass: auth.bypass 
          });
        }
      }
      
      // None of the scopes worked, return the last error
      const lastAuth = await requireOrgWriteAuthWithScope(req, orgId, scopes[0], prisma);
      return lastAuth.res;
    } catch (error) {
      console.error('[route-wrapper] Error in withAnyScope:', error);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };

/**
 * Higher-order function for routes that need all specified scopes
 */
export const withAllScopes = (scopes: Scope[], handler: Handler) => 
  async (req: NextRequest, context?: RouteParams): Promise<NextResponse> => {
    try {
      const orgId = getOrgId(req, context);
      
      // Check all scopes
      for (const scope of scopes) {
        const auth = await requireOrgWriteAuthWithScope(req, orgId, scope, prisma);
        if (!auth.ok) {
          return auth.res;
        }
      }
      
      // All scopes passed, use the first one for context
      const auth = await requireOrgWriteAuthWithScope(req, orgId, scopes[0], prisma);
      return handler(req, { 
        orgId, 
        keyId: auth.keyId, 
        bypass: auth.bypass 
      });
    } catch (error) {
      console.error('[route-wrapper] Error in withAllScopes:', error);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };

/**
 * Example usage in API routes:
 * 
 * // Single scope required
 * export const POST = withScope("copy.week", async (req, { orgId, keyId, bypass }) => {
 *   // Your route handler logic here
 *   return NextResponse.json({ success: true });
 * });
 * 
 * // Multiple scopes (any one of them)
 * export const POST = withAnyScope(["rota.write", "copy.week"], async (req, { orgId, keyId, bypass }) => {
 *   // Your route handler logic here
 *   return NextResponse.json({ success: true });
 * });
 * 
 * // Multiple scopes (all required)
 * export const POST = withAllScopes(["rota.write", "settings.write"], async (req, { orgId, keyId, bypass }) => {
 *   // Your route handler logic here
 *   return NextResponse.json({ success: true });
 * });
 */
