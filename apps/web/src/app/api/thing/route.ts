import { NextRequest, NextResponse } from "next/server";
import { requireCsrfOr403 } from "@/lib/security/csrf";

export async function POST(req: NextRequest) {
  // Check CSRF token
  const csrfError = requireCsrfOr403(req);
  if (csrfError) {
    return csrfError;
  }

  // Process the request
  const body = await req.json().catch(() => ({}));
  
  return NextResponse.json({ 
    success: true, 
    received: body,
    message: "Request processed successfully" 
  });
}
