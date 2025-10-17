import { getRedis } from "@/lib/redis";

export async function beat(worker: string) {
  const r = getRedis();
  try {
    const key = `shomer:hb:${worker}`;
    await r.set(key, Date.now().toString(), "EX", 180);
  } finally {
    r.disconnect();
  }
}

export async function checkHeartbeats(workers: string[]) {
  const r = getRedis();
  try {
    const now = Date.now();
    const out: Record<string, "ok" | "stale" | "missing"> = {};
    for (const w of workers) {
      const key = `shomer:hb:${w}`;
      const v = await r.get(key);
      if (!v) { out[w] = "missing"; continue; }
      out[w] = now - Number(v) <= 90000 ? "ok" : "stale";
    }
    return out;
  } finally {
    r.disconnect();
  }
}


