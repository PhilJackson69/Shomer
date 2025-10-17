// Simple sliding-window limiter: key = `${scope}:${id}`
// Prefers Redis; falls back to in-memory (ephemeral) for dev/tests.

type WindowCfg = { windowMs: number; max: number };
const DEFAULTS = {
  write: { windowMs: 60_000, max: 60 },     // 60 write ops / minute / org
  burstyWrite: { windowMs: 10_000, max: 20 } // extra guard: 20 / 10s / org
} as const;

let redis: { incr(key: string): Promise<number>; pttl(key: string): Promise<number>; expire(key: string, s: number): Promise<void> } | null = null;

async function getRedis() {
  if (redis) return redis;
  if (process.env.REDIS_URL) {
    // Example with ioredis:
    // const Redis = (await import("ioredis")).default;
    // const client = new Redis(process.env.REDIS_URL);
    // redis = {
    //   incr: (k) => client.incr(k),
    //   pttl: (k) => client.pttl(k),
    //   expire: (k, s) => client.expire(k, s),
    // };
  }
  return redis;
}

// in-memory fallback
const mem = new Map<string, { count: number; resetAt: number }>();
function memHit(key: string, windowMs: number) {
  const now = Date.now();
  const r = mem.get(key);
  if (!r || r.resetAt <= now) {
    mem.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, resetMs: windowMs };
  }
  r.count += 1;
  return { count: r.count, resetMs: r.resetAt - now };
}

async function bump(key: string, windowMs: number) {
  const r = await getRedis();
  if (r) {
    const ttlKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
    const count = await r.incr(ttlKey);
    if (count === 1) await r.expire(ttlKey, Math.ceil(windowMs / 1000));
    // Approx reset based on remainder of window
    const resetMs = windowMs - (Date.now() % windowMs);
    return { count, resetMs };
  }
  return memHit(key, windowMs);
}

export async function enforceLimit(scope: string, id: string, cfg: WindowCfg = DEFAULTS.write) {
  const key = `${scope}:${id}:${cfg.windowMs}`;
  const { count, resetMs } = await bump(key, cfg.windowMs);
  const remaining = Math.max(0, cfg.max - count);
  const limited = count > cfg.max;
  return { limited, remaining, resetMs };
}

export const RL_DEFAULTS = DEFAULTS;
