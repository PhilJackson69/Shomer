import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to require X-Action-Secret header for write operations
 */
export function requireActionSecret(request: NextRequest): { ok: true } | NextResponse {
  const actionSecret = request.headers.get('X-Action-Secret');
  const expectedSecret = process.env.ACTION_SECRET;
  
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Action secret not configured" },
      { status: 500 }
    );
  }
  
  if (!actionSecret || actionSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Invalid or missing X-Action-Secret header" },
      { status: 401 }
    );
  }
  
  return { ok: true };
}
