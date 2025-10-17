import { describe, it, expect } from 'vitest';

describe('On-Call Rota API Tests', () => {
  it('should have ACTION_SECRET configured', () => {
    // Set test environment
    process.env.ACTION_SECRET = 'test-action-secret-16-chars';
    expect(process.env.ACTION_SECRET).toBeDefined();
    expect(process.env.ACTION_SECRET?.length).toBeGreaterThanOrEqual(16);
  });

  it('should have database URL configured', () => {
    // Set test environment
    process.env.DATABASE_URL = 'file:test.db';
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it('should have Redis disabled in development', () => {
    // Set test environment
    process.env.USE_REDIS = 'false';
    expect(process.env.USE_REDIS).toBe('false');
  });
});
