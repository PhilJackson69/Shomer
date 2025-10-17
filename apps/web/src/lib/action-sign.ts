import crypto from "node:crypto";
import { env } from "@/lib/env";

function toSortedQuery(obj: Record<string, string>) {
  const entries = Object.entries(obj).sort(([a],[b]) => a.localeCompare(b));
  const usp = new URLSearchParams(entries as any);
  return usp.toString();
}

export function signAction(path: string, params: Record<string,string>) {
  const exp = (Math.floor(Date.now()/1000) + env.ACTION_TTL_SECONDS).toString();
  const p = toSortedQuery({ ...params, exp });
  const data = `${path}?${p}`;
  const sig = crypto.createHmac("sha256", env.ACTION_SECRET).update(data).digest("hex");
  return `${data}&sig=${sig}`;
}

export function verifyAction(url: URL) {
  const sig = url.searchParams.get("sig") ?? "";
  url.searchParams.delete("sig");
  const exp = Number(url.searchParams.get("exp") ?? 0);
  if (!exp || Math.floor(Date.now()/1000) > exp) return false;
  const paramsObj: Record<string,string> = {};
  for (const [k,v] of url.searchParams.entries()) paramsObj[k] = v;
  const sorted = toSortedQuery(paramsObj);
  const data = `${url.pathname}?${sorted}`;
  const expect = crypto.createHmac("sha256", env.ACTION_SECRET).update(data).digest("hex");
  try {
    if (sig.length !== expect.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
  } catch {
    return false;
  }
}


