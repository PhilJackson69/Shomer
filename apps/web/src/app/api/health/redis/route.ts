import { NextResponse } from "next/server";
import { hasRedis } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasRedis()) {
    return NextResponse.json({ ok: true, redis: "disabled" });
  }
  
  try {
    const { getRedisPub } = await import("@/lib/redis");
    const redis = getRedisPub();
    if (redis) {
      await redis.ping();
      return NextResponse.json({ ok: true, redis: "up" });
    } else {
      return NextResponse.json({ ok: false, redis: "down" });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, redis: "down", error: error?.message ?? "Redis check failed" });
  }
}
