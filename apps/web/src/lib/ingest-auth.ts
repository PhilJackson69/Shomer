import crypto from "node:crypto";

export function verifyIngest(req: Request) {
  const ts = req.headers.get("x-shomer-timestamp");
  const sig = req.headers.get("x-shomer-signature"); // sha256=...
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const secret = process.env.INGEST_HMAC_SECRET;

  if (!key || !secret || !ts || !sig) return false;
  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(Number(ts)) || age > 5 * 60 * 1000) return false; // 5m

  const raw = `${ts}.${key}`;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}


