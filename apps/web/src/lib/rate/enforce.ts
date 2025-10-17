import { NextResponse } from "next/server";
import { enforceLimit, RL_DEFAULTS } from "./limiter";

export async function rateLimitOr429(kind: "ack" | "close" | "note", orgId: string, userId: string) {
  // Two gates: per-org and per-user
  const org = await enforceLimit(`org:${kind}`, orgId, RL_DEFAULTS.write);
  if (org.limited) {
    return NextResponse.json(
      { error: "Too many requests (org)" }, 
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": RL_DEFAULTS.write.max.toString(),
          "X-RateLimit-Remaining": org.remaining.toString(),
          "Retry-After": Math.ceil(org.resetMs / 1000).toString(),
        }
      }
    );
  }
  
  const user = await enforceLimit(`user:${kind}`, userId, RL_DEFAULTS.burstyWrite);
  if (user.limited) {
    return NextResponse.json(
      { error: "Too many requests (user)" }, 
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": RL_DEFAULTS.burstyWrite.max.toString(),
          "X-RateLimit-Remaining": user.remaining.toString(),
          "Retry-After": Math.ceil(user.resetMs / 1000).toString(),
        }
      }
    );
  }
  
  return null;
}
