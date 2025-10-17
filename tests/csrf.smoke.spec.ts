import { test, expect } from "@playwright/test";

test("rotates token and accepts a write", async ({ request }) => {
  const prime = await request.get("/api/csrf");
  expect(prime.ok()).toBeTruthy();
  const token = prime.headers()["x-csrf-rotate"];
  expect(token).toBeTruthy();

  const write = await request.post("/api/thing", {
    headers: { "x-csrf-token": String(token) },
    data: { hello: "world" },
  });
  expect(write.ok()).toBeTruthy();
});

test("degraded-mode header is surfaced when backend toggled", async ({ request }) => {
  // if you gate via env, run the server with RATE_LIMIT_DEGRADED=1 in CI for this test
  const res = await request.post("/api/thing", { data: { heavy: "load" } });
  // tolerate either response but ensure header presence when degraded
  const hdr = res.headers()["x-degraded-mode"];
  if (process.env.RATE_LIMIT_DEGRADED === "1") expect(hdr).toBe("1");
});
