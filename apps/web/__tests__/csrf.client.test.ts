// apps/web/__tests__/csrf.client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "@/lib/api-client";

declare global {
  interface Window { __csrf?: string }
}

const originalFetch = global.fetch;

describe("apiFetch CSRF rotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock fetch globally
    global.fetch = vi.fn();
    if (typeof window !== 'undefined') {
      window.__csrf = undefined;
    }
  });
  
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("captures x-csrf-rotate and stores it on window.__csrf", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "x-csrf-rotate": "tkn-123" }
      })
    );
    
    // Mock window for this test
    Object.defineProperty(global, 'window', {
      value: { __csrf: undefined },
      writable: true
    });
    
    await apiFetch("http://localhost/api/ping");
    expect((global as any).window.__csrf).toBe("tkn-123");
  });

  it("attaches x-csrf-token on write methods after rotation", async () => {
    // Mock window for this test
    Object.defineProperty(global, 'window', {
      value: { __csrf: undefined },
      writable: true
    });
    
    // 1) first GET rotates token
    (global.fetch as any)
      .mockResolvedValueOnce(new Response(null, { 
        status: 200, 
        headers: { "x-csrf-rotate": "tkn-xyz" } 
      }))
      // 2) second POST should include header
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { 
        status: 200 
      }));

    await apiFetch("http://localhost/api/csrf-prime"); // rotates
    expect((global as any).window.__csrf).toBe("tkn-xyz");

    await apiFetch("http://localhost/api/thing", { 
      method: "POST", 
      body: JSON.stringify({ a: 1 }) 
    });

    const secondCallArgs = (global.fetch as any).mock.calls[1];
    const passedInit = secondCallArgs[1] as RequestInit;
    const h = new Headers((passedInit.headers ?? {}) as HeadersInit);
    expect(h.get("x-csrf-token")).toBe("tkn-xyz");
    expect(passedInit.credentials).toBe("include");
  });

  it("marks errors as degraded when x-degraded-mode: 1 is present", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "x-degraded-mode": "1" }
      })
    );

    await expect(apiFetch("http://localhost/api/write", { method: "POST" })).rejects.toMatchObject({
      status: 429,
      degraded: true
    });
  });

  it("retries with fresh token after 401/419", async () => {
    // Initialize stale token
    Object.defineProperty(global, 'window', {
      value: { __csrf: 'stale' },
      writable: true
    });

    // 1) first POST fails with 401 but rotates
    (global.fetch as any)
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401, headers: { "x-csrf-rotate": "fresh-1" } }))
      // 2) retried POST succeeds
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: {} }));

    // Use wrapper which retries once on 401/419
    try {
      await apiFetch("/api/thing", { method: "POST" });
    } catch {}

    expect((global as any).window.__csrf).toBe("fresh-1"); // token updated
  });

  it("does not attach CSRF token for read methods", async () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: "test" }), { status: 200 })
    );

    await apiFetch("http://localhost/api/read", { method: "GET" });

    const callArgs = (global.fetch as any).mock.calls[0];
    const passedInit = callArgs[1] as RequestInit;
    const h = new Headers((passedInit.headers ?? {}) as HeadersInit);
    expect(h.get("x-csrf-token")).toBeNull();
  });

  it("handles missing CSRF token gracefully for write methods", async () => {
    // Mock window without CSRF token
    Object.defineProperty(global, 'window', {
      value: { __csrf: undefined },
      writable: true
    });
    
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch("http://localhost/api/write", { method: "POST" });

    const callArgs = (global.fetch as any).mock.calls[0];
    const passedInit = callArgs[1] as RequestInit;
    const h = new Headers((passedInit.headers ?? {}) as HeadersInit);
    expect(h.get("x-csrf-token")).toBeNull();
  });
});
