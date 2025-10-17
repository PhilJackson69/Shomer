/**
 * Playwright smoke tests for CSRF rotation and degraded mode
 */

import { test, expect } from '@playwright/test';

test.describe('CSRF Rotation and Degraded Mode', () => {
  test('should handle CSRF rotation on write operations', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'x-csrf-rotate': 'test-csrf-token-123'
        },
        body: JSON.stringify({ token: 'test-csrf-token-123' })
      });
    });

    await page.route('**/api/test-write', async (route) => {
      const request = route.request();
      const csrfToken = request.headers()['x-csrf-token'];
      
      if (csrfToken === 'test-csrf-token-123') {
        await route.fulfill({
          status: 200,
          headers: {
            'x-csrf-rotate': 'new-csrf-token-456'
          },
          body: JSON.stringify({ success: true })
        });
      } else {
        await route.fulfill({
          status: 401,
          headers: {
            'x-csrf-rotate': 'new-csrf-token-456'
          },
          body: JSON.stringify({ error: 'Invalid CSRF token' })
        });
      }
    });

    // Navigate to a page that uses apiFetch
    await page.goto('http://localhost:3000/dashboard');

    // Execute a write operation via JavaScript
    const result = await page.evaluate(async () => {
      const { apiFetch } = await import('/src/lib/apiFetch.ts');
      try {
        const response = await apiFetch('/api/test-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
  });

  test('should emit degraded mode event when x-degraded-mode header is present', async ({ page }) => {
    let degradedEventFired = false;

    // Listen for degraded mode event
    await page.addInitScript(() => {
      window.addEventListener('degraded-mode', () => {
        window.__degradedEventFired = true;
      });
    });

    // Mock API response with degraded mode header
    await page.route('**/api/test', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'x-degraded-mode': '1'
        },
        body: JSON.stringify({ message: 'degraded mode active' })
      });
    });

    await page.goto('/dashboard');

    // Execute an API call
    await page.evaluate(async () => {
      const { apiFetch } = await import('/src/lib/apiFetch.ts');
      await apiFetch('/api/test');
    });

    // Check if degraded mode event was fired
    const eventFired = await page.evaluate(() => window.__degradedEventFired);
    expect(eventFired).toBe(true);

    // Check if degraded mode flag is set
    const isDegraded = await page.evaluate(() => window.__degraded);
    expect(isDegraded).toBe(true);
  });

  test('should retry on 401 with CSRF token rotation', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/csrf', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'x-csrf-rotate': 'fresh-csrf-token'
        },
        body: JSON.stringify({ token: 'fresh-csrf-token' })
      });
    });

    await page.route('**/api/protected', async (route) => {
      callCount++;
      
      if (callCount === 1) {
        // First call fails with 401
        await route.fulfill({
          status: 401,
          headers: {
            'x-csrf-rotate': 'fresh-csrf-token'
          },
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      } else {
        // Second call succeeds
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        });
      }
    });

    await page.goto('/dashboard');

    const result = await page.evaluate(async () => {
      const { apiFetch } = await import('/src/lib/apiFetch.ts');
      try {
        const response = await apiFetch('/api/protected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: 'test' })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(2); // Should have retried once
  });

  test('should add idempotency key for write operations', async ({ page }) => {
    let capturedHeaders: Record<string, string> = {};

    await page.route('**/api/test-write', async (route) => {
      const request = route.request();
      capturedHeaders = request.headers();
      
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/dashboard');

    await page.evaluate(async () => {
      const { apiFetch } = await import('/src/lib/apiFetch.ts');
      await apiFetch('/api/test-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });
    });

    expect(capturedHeaders['idempotency-key']).toMatch(/^idem-[a-z0-9]+-\d+$/);
  });

  test('should not add idempotency key for GET operations', async ({ page }) => {
    let capturedHeaders: Record<string, string> = {};

    await page.route('**/api/test-read', async (route) => {
      const request = route.request();
      capturedHeaders = request.headers();
      
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ data: 'test' })
      });
    });

    await page.goto('/dashboard');

    await page.evaluate(async () => {
      const { apiFetch } = await import('/src/lib/apiFetch.ts');
      await apiFetch('/api/test-read', { method: 'GET' });
    });

    expect(capturedHeaders['idempotency-key']).toBeUndefined();
  });
});
