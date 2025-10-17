import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthToken } from "./lib/api-client";

const hits = new Map<string, { n: number; t: number }>();

/**
 * Authentication middleware
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Set CSP for document requests
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    // Minimal CSP: self + Mapbox + data URIs; upgrade as needed
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.mapbox.com https://api.mapbox.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.mapbox.com https://events.mapbox.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }

  // Rate limiting for specific endpoints
  if (req.nextUrl.pathname === "/api/scan") {
    const ip = (req.ip || req.headers.get("x-forwarded-for") || "local").toString();
    const now = Date.now();
    const h = hits.get(ip) ?? { n: 0, t: now };
    if (now - h.t > 10_000) { h.n = 0; h.t = now; }
    h.n++; hits.set(ip, h);
    if (h.n > 5) return new NextResponse("Too Many Requests", { status: 429 });
  }

  // Authentication checks for protected routes
  const { pathname } = req.nextUrl;

  // Protected dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = getAuthToken();
    
    if (!token) {
      // Redirect to login if no token
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // For API routes within dashboard, let them handle their own auth
    if (pathname.startsWith('/dashboard/api/')) {
      return NextResponse.next();
    }

    // For page routes, we could add additional checks here
    // For now, let the pages handle their own authentication
  }

  // API routes that require authentication
  const protectedApiRoutes = [
    '/api/alerts',
    '/api/incidents',
    '/api/tips',
    '/api/events'
  ];

  const isProtectedApiRoute = protectedApiRoutes.some(route => 
    pathname.startsWith(route)
  );

  if (isProtectedApiRoute) {
    const token = getAuthToken();
    
    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: "Authentication required" }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }

  return res;
}

export const config = { 
  matcher: [
    "/api/:path*",
    "/dashboard/:path*"
  ] 
};


