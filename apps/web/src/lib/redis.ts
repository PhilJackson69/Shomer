import IORedis from "ioredis";

export function getRedis(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  return new IORedis(url);
}

import Redis from "ioredis";

let pub: Redis | null = null;
let sub: Redis | null = null;

// Feature flag to enable/disable Redis
const useRedis = process.env.USE_REDIS === 'true' && process.env.REDIS_URL;

export function getRedisPub() {
  if (!useRedis) return null;
  if (pub) return pub;
  if (!process.env.REDIS_URL) return null;
  pub = new Redis(process.env.REDIS_URL);
  return pub;
}

export function getRedisSub() {
  if (!useRedis) return null;
  if (sub) return sub;
  if (!process.env.REDIS_URL) return null;
  sub = new Redis(process.env.REDIS_URL);
  return sub;
}

export async function publishEvent(type: string, payload: unknown) {
  const r = getRedisPub();
  if (r) {
    await r.publish("shomer:events", JSON.stringify({ type, payload, ts: Date.now() }));
  }
  // No-op if Redis is disabled
}
