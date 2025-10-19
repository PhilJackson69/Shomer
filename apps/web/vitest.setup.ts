// apps/web/vitest.setup.ts
import { vi } from "vitest";

// Default secrets to unblock tests
process.env.X_ACTION_SECRET ??= "test-secret";
process.env.RATE_LIMIT_DEGRADED ??= "0";
process.env.MFA_TEST_MODE ??= "true";
process.env.MFA_ENFORCE_ADMINS ??= "true";

// Mock Redis/ioredis if not available
vi.mock("ioredis", () => {
  const store = new Map<string, string>();
  return {
    default: class {
      get = async (k: string) => store.get(k) ?? null;
      set = async (k: string, v: string) => { store.set(k, v); return "OK"; };
      del = async (k: string) => { store.delete(k); return 1; };
    }
  };
});

// Mock WebAuthn for testing
beforeAll(() => {
  // Mock navigator.credentials for WebAuthn
  if (typeof window !== 'undefined') {
    (global as any).navigator = (global as any).navigator || {};
    (navigator as any).credentials = {
      create: vi.fn().mockResolvedValue({
        id: "test-cred-id",
        rawId: new ArrayBuffer(16),
        response: {
          clientDataJSON: new ArrayBuffer(64),
          attestationObject: new ArrayBuffer(64),
        },
        type: "public-key",
      }),
      get: vi.fn().mockResolvedValue({
        id: "test-cred-id",
        rawId: new ArrayBuffer(16),
        response: {
          clientDataJSON: new ArrayBuffer(64),
          authenticatorData: new ArrayBuffer(64),
          signature: new ArrayBuffer(64),
        },
        type: "public-key",
      }),
    };

    // Mock WebAuthn-specific APIs
    (global as any).PublicKeyCredential = class {
      static isUserVerifyingPlatformAuthenticatorAvailable = vi.fn().mockResolvedValue(true);
      static isConditionalMediationAvailable = vi.fn().mockResolvedValue(true);
    };
  }
});

// Make fetch available in node env tests (if any still need it)
if (!global.fetch) {
  global.fetch = (async (...args: any[]) =>
    new (await import("undici")).fetch(...args)) as any;
}

// Hard-fail on console.warn in tests
const warn = console.warn;
console.warn = (...args: any[]) => {
	warn.apply(console, args);
	throw new Error(`console.warn called in tests: ${args.join(' ')}`);
};
