import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyIngest } from "@/src/lib/ingest-auth";

function mockReq(headers: Record<string,string>) {
  return { headers: { get: (k: string) => headers[k.toLowerCase()] } } as any as Request;
}

describe("verifyIngest", () => {
  it("rejects missing headers", () => {
    const r = mockReq({});
    expect(verifyIngest(r)).toBe(false);
  });

  it("accepts valid HMAC", () => {
    const apiKey = "test_key";
    const ts = String(Date.now());
    const secret = "0123456789abcdef0123456789abcdef";
    process.env.INGEST_HMAC_SECRET = secret;
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${apiKey}`).digest("hex");

    const r = mockReq({
      "authorization": `Bearer ${apiKey}`,
      "x-shomer-timestamp": ts,
      "x-shomer-signature": sig
    });
    expect(verifyIngest(r)).toBe(true);
  });
});


