import { getRedisPub, getRedisSub } from "./redis";

/**
 * Centralized Redis cache helpers that gracefully handle Redis being disabled
 */

export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedisPub();
  if (!redis) return null;
  return redis.get(key);
}

export async function cacheSet(key: string, val: string, ttlSec?: number) {
  const redis = getRedisPub();
  if (!redis) return;
  if (ttlSec) {
    await redis.set(key, val, "EX", ttlSec);
  } else {
    await redis.set(key, val);
  }
}

export async function cacheDel(key: string) {
  const redis = getRedisPub();
  if (!redis) return;
  await redis.del(key);
}

export async function cachePub(channel: string, message: string) {
  const redis = getRedisPub();
  if (!redis) return;
  await redis.publish(channel, message);
}

export async function cacheSub(channel: string, callback: (message: string) => void) {
  const redis = getRedisSub();
  if (!redis) return;
  await redis.subscribe(channel);
  redis.on("message", (receivedChannel, message) => {
    if (receivedChannel === channel) {
      callback(message);
    }
  });
}

export function hasRedis() {
  return !!getRedisPub();
}

/**
 * Publish event using the existing publishEvent function
 */
export async function publishEvent(type: string, payload: unknown) {
  const redis = getRedisPub();
  if (redis) {
    await redis.publish("shomer:events", JSON.stringify({ type, payload, ts: Date.now() }));
  }
  // No-op if Redis is disabled
}
