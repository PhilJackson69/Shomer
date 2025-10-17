import { describe, it, expect } from "vitest";
import { hasRedis } from "@/lib/cache";
import { publishEvent } from "@/lib/cache";

describe("Dev without Redis", () => {
  it("does not initialize Redis when USE_REDIS=false", () => {
    expect(process.env.USE_REDIS).toBe("false");
    expect(hasRedis()).toBe(false);
  });

  it("publishEvent works without Redis (no-op)", async () => {
    // This should not throw or crash
    await expect(publishEvent("test_event", { test: "data" })).resolves.toBeUndefined();
  });

  it("cache operations work without Redis (no-op)", async () => {
    const { cacheGet, cacheSet, cacheDel } = await import("@/lib/cache");
    
    // These should not throw or crash
    await expect(cacheSet("test_key", "test_value")).resolves.toBeUndefined();
    await expect(cacheGet("test_key")).resolves.toBeNull();
    await expect(cacheDel("test_key")).resolves.toBeUndefined();
  });
});
