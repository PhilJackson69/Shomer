/**
 * Role-Based Access Control utilities for Next.js API routes
 */

import { NextRequest } from "next/server";
import { getAuthToken } from "./auth";
import { apiFetch } from '@/lib/apiFetch';


export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "viewer" | "moderator" | "admin";
  is_active: boolean;
}

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}

/**
 * Get current user from API using stored token
 */
async function getCurrentUser(): Promise<User | null> {
  try {
    const token = getAuthToken();
    if (!token) return null;

    const response = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

/**
 * Check if user has required role or higher
 */
function hasRole(user: User, requiredRole: "viewer" | "moderator" | "admin"): boolean {
  const roleHierarchy = {
    viewer: 0,
    moderator: 1,
    admin: 2,
  };

  const userLevel = roleHierarchy[user.role] || -1;
  const requiredLevel = roleHierarchy[requiredRole] || 999;

  return userLevel >= requiredLevel;
}

/**
 * Require authentication and return user
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getCurrentUser();
  
  if (!user) {
    return { ok: false, error: "Authentication required" };
  }

  if (!user.is_active) {
    return { ok: false, error: "Account is inactive" };
  }

  return { ok: true, user };
}

/**
 * Require moderator role or higher
 */
export async function requireModerator(): Promise<AuthResult & { status?: number }> {
  const auth = await requireAuth();
  if (!auth.ok || !auth.user) {
    return { ...auth, status: 401 } as any;
  }
  if (!hasRole(auth.user, "moderator")) {
    return { ok: false, error: "Moderator role required", status: 403 } as any;
  }
  return { ...auth, status: 200 } as any;
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  
  if (!auth.ok || !auth.user) {
    return auth;
  }

  if (!hasRole(auth.user, "admin")) {
    return { ok: false, error: "Admin role required" };
  }

  return auth;
}

/**
 * Middleware wrapper for API routes that require authentication
 */
export function withAuth(requiredRole: "viewer" | "moderator" | "admin" = "viewer") {
  return async function authMiddleware(handler: (req: NextRequest, user: User, ...args: any[]) => Promise<Response>) {
    return async function(request: NextRequest, ...args: any[]): Promise<Response> {
      let auth: AuthResult;
      
      switch (requiredRole) {
        case "admin":
          auth = await requireAdmin();
          break;
        case "moderator":
          auth = await requireModerator();
          break;
        default:
          auth = await requireAuth();
      }

      if (!auth.ok || !auth.user) {
        return new Response(
          JSON.stringify({ error: auth.error || "Authentication failed" }),
          { 
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return handler(request, auth.user, ...args);
    };
  };
}

/**
 * Server-side authentication check for pages
 */
export async function getServerSession(): Promise<User | null> {
  return await getCurrentUser();
}
