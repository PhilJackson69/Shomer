import { NextResponse } from "next/server";
import { ensureCsrfCookie } from "@/lib/security/csrf";

export async function GET() {
  const token = ensureCsrfCookie();
  return NextResponse.json({ token });
}
