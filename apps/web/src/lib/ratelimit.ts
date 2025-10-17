/**
 * Improved rate limiter with monotonic time and proper token bucket
 */

type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();

// Throttle lastUsedAt updates to avoid hot writes
const lastTouch = new Map<string, number>();

/**
 * Take a token from the rate limiter bucket
 * Uses monotonic time for accurate rate limiting
 */
export function takeToken(key: string, rpm: number): boolean {
  const capacity = Math.max(1, rpm);
  const now = performance.now(); // Monotonic time
  const refillPerMs = capacity / 60_000; // tokens per millisecond

  const b = buckets.get(key) ?? { tokens: capacity, last: now };
  const elapsed = Math.max(0, now - b.last);
  
  // Refill tokens based on elapsed time
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerMs);
  b.last = now;
  
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

/**
 * Throttled lastUsedAt update to avoid database hot writes
 * Only updates at most once per minute per key
 */
export async function touchLastUsedAt(
  db: any, // Prisma client
  keyId: string
): Promise<void> {
  const now = Date.now();
  const prev = lastTouch.get(keyId) ?? 0;
  
  // Only update if more than 60 seconds have passed
  if (now - prev < 60_000) return;
  
  lastTouch.set(keyId, now);
  
  try {
    await db.organizationApiKey.update({
      where: { keyId },
      data: { lastUsedAt: new Date(now) },
    });
  } catch (error) {
    // Silently fail - this is not critical
    console.warn('[ratelimit] Failed to update lastUsedAt:', error);
  }
}

/**
 * Get current bucket state for debugging
 */
export function getBucketState(key: string): Bucket | null {
  return buckets.get(key) ?? null;
}

/**
 * Reset a bucket (for testing)
 */
export function resetBucket(key: string): void {
  buckets.delete(key);
  lastTouch.delete(key);
}

/**
 * Clear all buckets (for testing)
 */
export function clearAllBuckets(): void {
  buckets.clear();
  lastTouch.clear();
}