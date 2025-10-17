import { describe, it, expect } from "vitest";
import { signAction, verifyAction } from "@/src/lib/action-sign";

describe("signed actions", () => {
  it("round-trips signature", () => {
    process.env.ACTION_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.ACTION_TTL_SECONDS = "600";
    const signed = signAction("/api/alerts/abc/verify", {});
    const url = new URL("http://localhost:3000" + signed);
    expect(verifyAction(url)).toBe(true);
  });
});


