import { describe, it, expect } from "vitest";

// NOTE: This assumes your dev server is running at localhost:3000

describe("GET /api/alerts", () => {
  it("rejects invalid params", async () => {
    const res = await fetch("http://localhost:3000/api/alerts?limit=9999");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/alerts/list", () => {
  it("paginates with cursor", async () => {
    const a = await fetch("http://localhost:3000/api/alerts/list?limit=1").then(r=>r.json());
    expect([0,1]).toContain(a.alerts.length);
    if (a.nextCursor) {
      const b = await fetch(`http://localhost:3000/api/alerts/list?limit=1&cursor=${a.nextCursor}`).then(r=>r.json());
      expect([0,1]).toContain(b.alerts.length);
    }
  });
});


