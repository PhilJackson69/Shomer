// apps/web/src/middleware/rate-limit.ts
import { NextRequest, NextResponse } from "next/server";
import { enforceLimit } from "@/lib/rate/limiter";
import { degraded } from "@/lib/degraded";

export async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | void> {
  // Skip rate limiting for GET requests
  if (req.method === "GET") {
    return; // Continue to next middleware
  }

  const ip = req.ip || req.headers.get("x-forwarded-for") || "unknown";
  
  try {
    const { limited, remaining, resetMs } = await enforceLimit("api", ip);
    
    if (limited) {
      const response = new NextResponse("Too Many Requests", { status: 429 });
      response.headers.set("X-RateLimit-Limit", "60");
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", Math.ceil(Date.now() / 1000 + resetMs / 1000).toString());
      
      // Add degraded mode header if active
      if (degraded.active) {
        response.headers.set("x-degraded-mode", "1");
      }
      
      return response;
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", "60");
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", Math.ceil(Date.now() / 1000 + resetMs / 1000).toString());
    
    // Add degraded mode header if active
    if (degraded.active) {
      response.headers.set("x-degraded-mode", "1");
    }
    
    return response;
  } catch (error) {
    // If rate limiting fails, continue but mark as degraded
    const response = NextResponse.next();
    response.headers.set("x-degraded-mode", "1");
    return response;
  }
}
