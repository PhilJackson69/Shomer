import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

const CSRF_COOKIE = "csrf_token";

export function ensureCsrfCookie() {
  const c = cookies();
  const existing = c.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  c.set(CSRF_COOKIE, token, {
    httpOnly: false,         // must be readable by client to echo in header
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return token;
}

export function requireCsrfOr403(request: Request) {
  // Allow non-POST by default; only enforce for mutating methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;

  const cookieToken = cookies().get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: "Forbidden (CSRF)" }, { status: 403 });
  }
  return null;
}
