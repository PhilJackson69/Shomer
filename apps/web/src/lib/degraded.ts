// apps/web/src/lib/degraded.ts
export const degraded = {
  get active() { 
    return process.env.RATE_LIMIT_DEGRADED === "1" || 
           (globalThis as any).__RATE_LIMIT_DEGRADED__ === true; 
  }
};
