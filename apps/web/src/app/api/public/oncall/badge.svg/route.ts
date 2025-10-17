import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrgByToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/oncall/badge.svg?token=<shareToken>&theme=light|dark
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const theme = searchParams.get('theme') || 'light';

    // Token is required
    if (!token) {
      return new NextResponse('Invalid token', { status: 404 });
    }

    // Find organization by token
    const orgByToken = await findOrgByToken(token);
    if (!orgByToken) {
      return new NextResponse('Invalid token', { status: 404 });
    }

    // Get current time in UTC
    const nowUtc = new Date();

    // Find current on-call shift
    const currentShift = await prisma.onCall.findFirst({
      where: {
        orgId: orgByToken.id,
        startsAt: { lte: nowUtc },
        endsAt: { gte: nowUtc },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        startsAt: 'desc',
      },
    });

    // Prepare badge data
    const label = "ON-CALL";
    const value = currentShift ? (currentShift.user.name || currentShift.user.email || "Unknown") : "—";

    // Theme colors
    const colors = theme === 'dark' ? {
      background: '#111827',
      labelBackground: '#4B5563',
      labelForeground: '#E5E7EB',
      valueForeground: '#F9FAFB',
      border: '#1F2937',
    } : {
      background: '#F3F4F6',
      labelBackground: '#374151',
      labelForeground: '#FFFFFF',
      valueForeground: '#111827',
      border: '#E5E7EB',
    };

    // Calculate dimensions
    const charWidth = 7;
    const padding = 8;
    const labelWidth = Math.max(70, padding * 2 + label.length * charWidth);
    const valueWidth = padding * 2 + value.length * charWidth;
    const totalWidth = labelWidth + valueWidth;
    const height = 28;

    // Build SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
  <defs>
    <clipPath id="r">
      <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
    </clipPath>
  </defs>
  <g clip-path="url(#r)">
    <!-- Background -->
    <rect width="${totalWidth}" height="${height}" fill="${colors.background}"/>
    
    <!-- Label background -->
    <rect width="${labelWidth}" height="${height}" fill="${colors.labelBackground}"/>
    
    <!-- Border -->
    <rect width="${totalWidth}" height="${height}" fill="none" stroke="${colors.border}" stroke-width="1"/>
    
    <!-- Label text -->
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" text-anchor="middle" 
          fill="${colors.labelForeground}" 
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif"
          font-size="11" font-weight="600">
      ${label}
    </text>
    
    <!-- Value text -->
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" text-anchor="middle"
          fill="${colors.valueForeground}"
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif"
          font-size="11" font-weight="500">
      ${value}
    </text>
  </g>
</svg>`;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (err: any) {
    return new NextResponse('Internal error', { status: 500 });
  }
}
