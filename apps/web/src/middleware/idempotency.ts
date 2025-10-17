// apps/web/src/middleware/idempotency.ts
import { NextRequest, NextResponse } from "next/server";

export async function idempotencyMiddleware(req: NextRequest): Promise<NextResponse | void> {
  // Simple idempotency check - in a real implementation this would check against a store
  const idempotencyKey = req.headers.get("idempotency-key");
  
  if (req.method !== "GET" && !idempotencyKey) {
    // For write methods, recommend idempotency key (but don't block)
    const response = NextResponse.next();
    response.headers.set("x-idempotency-recommended", "true");
    return response;
  }

  return; // Continue to next middleware
}
