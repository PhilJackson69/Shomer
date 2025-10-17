// apps/web/src/middleware/csrf.ts
import { NextRequest, NextResponse } from "next/server";
import { ensureCsrfCookie, requireCsrfOr403 } from "@/lib/security/csrf";

export async function csrfMiddleware(req: NextRequest): Promise<NextResponse | void> {
  // Allow GET requests to pass through for CSRF token priming
  if (req.method === "GET") {
    // Ensure CSRF cookie is set for priming
    ensureCsrfCookie();
    return; // Continue to next middleware
  }

  // For write methods, check CSRF token
  const csrfError = requireCsrfOr403(req);
  if (csrfError) {
    return csrfError;
  }

  // Add rotation header for successful requests
  const response = NextResponse.next();
  const token = ensureCsrfCookie();
  response.headers.set("x-csrf-rotate", token);
  return response;
}
