import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRedis } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // DB ping (lightweight query)
    await prisma.$queryRaw`SELECT 1`;

    const redisStatus = hasRedis() ? "enabled" : "disabled";
    return NextResponse.json({ 
      ok: true, 
      db: true, 
      redis: redisStatus, 
      ts: Date.now(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev"
    }, { status: 200 });
  } catch (err: any) {
    // Optional: console.error("health error", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "health check failed" },
      { status: 500 }
    );
  }
}


