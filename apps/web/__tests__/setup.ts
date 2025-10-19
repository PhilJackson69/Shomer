// Frontend test setup for WebAuthn and MFA testing
import { beforeAll } from 'vitest';

beforeAll(() => {
  // Mock WebAuthn APIs for testing
  if (typeof window !== 'undefined') {
    (global as any).navigator = (global as any).navigator || {};
    (navigator as any).credentials = {
      create: jest.fn().mockResolvedValue({ 
        id: "test-cred", 
        rawId: new ArrayBuffer(16) 
      }),
      get: jest.fn().mockResolvedValue({ 
        id: "test-cred", 
        rawId: new ArrayBuffer(16) 
      }),
    };

    // Mock WebAuthn-specific APIs
    (global as any).PublicKeyCredential = class {
      static isUserVerifyingPlatformAuthenticatorAvailable = jest.fn().mockResolvedValue(true);
      static isConditionalMediationAvailable = jest.fn().mockResolvedValue(true);
    };

    // Mock crypto APIs that might be needed
    (global as any).crypto = {
      subtle: {
        importKey: jest.fn(),
        exportKey: jest.fn(),
        generateKey: jest.fn(),
        sign: jest.fn(),
        verify: jest.fn(),
      },
      getRandomValues: jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    };
  }

  // Set test environment variables
  process.env.MFA_TEST_MODE = 'true';
  process.env.MFA_ENFORCE_ADMINS = 'true';
  process.env.CI = 'true';
});
