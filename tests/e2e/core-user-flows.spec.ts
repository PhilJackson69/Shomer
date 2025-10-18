import { test, expect } from '@playwright/test';

// Core User Flow E2E Tests
// These tests mimic real users and validate critical paths

test.describe('Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to staging environment
    await page.goto(process.env.STAGING_URL || 'https://staging.shomer.example.com');
  });

  test('Complete User Journey: Sign-in → 2FA → Normal Use → Revoke-all → Forced Logout', async ({ page }) => {
    // 1. Sign-in flow
    await test.step('User Registration/Login', async () => {
      await page.click('text=Sign In');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      
      // Verify login success
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    // 2. Set up 2FA
    await test.step('2FA Setup', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Security Settings');
      await page.click('[data-testid="enable-2fa-button"]');
      
      // Verify 2FA setup
      await expect(page.locator('[data-testid="2fa-qr-code"]')).toBeVisible();
      
      // Complete 2FA setup (simulate with test token)
      await page.fill('[data-testid="2fa-token-input"]', '123456');
      await page.click('[data-testid="confirm-2fa-button"]');
      
      // Verify 2FA enabled
      await expect(page.locator('[data-testid="2fa-status"]')).toContainText('Enabled');
    });

    // 3. Normal use - submit a report
    await test.step('Normal Use - Report Submission', async () => {
      await page.click('[data-testid="submit-report-button"]');
      await page.fill('[data-testid="report-title"]', 'Test Security Report');
      await page.fill('[data-testid="report-description"]', 'This is a test report for E2E validation');
      
      // Upload a test file
      await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/test-document.pdf');
      
      await page.click('[data-testid="submit-report"]');
      
      // Verify report submission
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Report submitted successfully');
    });

    // 4. Revoke-all functionality
    await test.step('Revoke All Sessions', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Security Settings');
      await page.click('[data-testid="revoke-all-sessions-button"]');
      
      // Confirm revocation
      await page.click('[data-testid="confirm-revoke-button"]');
      
      // Verify revocation success
      await expect(page.locator('[data-testid="revocation-success"]')).toBeVisible();
    });

    // 5. Verify forced logout
    await test.step('Verify Forced Logout', async () => {
      // Try to access protected page
      await page.goto(`${process.env.STAGING_URL}/dashboard`);
      
      // Should be redirected to login
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test('Report Submission Flow with Upload Validation', async ({ page }) => {
    // Login first
    await page.click('text=Sign In');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');
    
    await test.step('Report Submission with File Upload', async () => {
      await page.click('[data-testid="submit-report-button"]');
      await page.fill('[data-testid="report-title"]', 'E2E Test Report');
      await page.fill('[data-testid="report-description"]', 'Testing file upload validation');
      
      // Test valid file upload
      await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/valid-document.pdf');
      await expect(page.locator('[data-testid="file-validation-success"]')).toBeVisible();
      
      // Test invalid file type
      await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/invalid-file.exe');
      await expect(page.locator('[data-testid="file-validation-error"]')).toContainText('Invalid file type');
      
      // Test file size limit
      await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/large-file.pdf');
      await expect(page.locator('[data-testid="file-size-error"]')).toContainText('File too large');
      
      // Submit with valid file
      await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/valid-document.pdf');
      await page.click('[data-testid="submit-report"]');
      
      // Verify successful submission
      await expect(page.locator('[data-testid="submission-success"]')).toBeVisible();
    });
  });

  test('Admin Metrics Page and Rate Limit View', async ({ page }) => {
    // Login as admin
    await page.click('text=Sign In');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');
    
    await test.step('Access Admin Metrics', async () => {
      await page.click('[data-testid="admin-menu"]');
      await page.click('text=Metrics Dashboard');
      
      // Verify metrics page loads
      await expect(page.locator('[data-testid="metrics-dashboard"]')).toBeVisible();
      
      // Check key metrics are displayed
      await expect(page.locator('[data-testid="total-reports"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
    });

    await test.step('Rate Limit Monitoring', async () => {
      await page.click('[data-testid="rate-limit-tab"]');
      
      // Verify rate limit data is displayed
      await expect(page.locator('[data-testid="rate-limit-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-limit-violations"]')).toBeVisible();
      
      // Test rate limit threshold alerts
      await expect(page.locator('[data-testid="rate-limit-status"]')).toContainText('Normal');
    });
  });

  test('Error Path Returns Proper Format', async ({ page }) => {
    await test.step('Test API Error Responses', async () => {
      // Test 404 error
      const response404 = await page.request.get('/api/v1/nonexistent-endpoint');
      expect(response404.status()).toBe(404);
      const error404 = await response404.json();
      expect(error404).toMatchObject({
        error: expect.any(String),
        code: 404,
        requestId: expect.any(String),
        ts: expect.any(String)
      });

      // Test 400 error
      const response400 = await page.request.post('/api/v1/auth/login', {
        data: { invalid: 'data' }
      });
      expect(response400.status()).toBe(400);
      const error400 = await response400.json();
      expect(error400).toMatchObject({
        error: expect.any(String),
        code: 400,
        requestId: expect.any(String),
        ts: expect.any(String)
      });

      // Test 500 error (if we can trigger one)
      const response500 = await page.request.post('/api/v1/auth/login', {
        data: { email: 'trigger-error@example.com', password: 'trigger-error' }
      });
      if (response500.status() === 500) {
        const error500 = await response500.json();
        expect(error500).toMatchObject({
          error: expect.any(String),
          code: 500,
          requestId: expect.any(String),
          ts: expect.any(String)
        });
      }
    });
  });

  test('Security Controls Validation', async ({ page }) => {
    await test.step('CSRF Protection', async () => {
      // Try to submit without CSRF token
      const response = await page.request.post('/api/v1/tips', {
        data: { title: 'Test', description: 'Test' }
      });
      expect(response.status()).toBe(403);
    });

    await test.step('Rate Limiting', async () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(page.request.post('/api/v1/auth/login', {
          data: { email: 'test@example.com', password: 'test' }
        }));
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status() === 429);
      expect(rateLimited).toBe(true);
    });

    await test.step('Session Security', async () => {
      // Login first
      await page.click('text=Sign In');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      
      // Check session cookie security
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      expect(sessionCookie?.httpOnly).toBe(true);
      expect(sessionCookie?.secure).toBe(true);
      expect(sessionCookie?.sameSite).toBe('Strict');
    });
  });

  test('JWKS and JWT Validation', async ({ page }) => {
    await test.step('JWKS Endpoint', async () => {
      const response = await page.request.get('/.well-known/jwks.json');
      expect(response.status()).toBe(200);
      
      const jwks = await response.json();
      expect(jwks).toHaveProperty('keys');
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);
      
      // Verify key structure
      const key = jwks.keys[0];
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('kty');
      expect(key).toHaveProperty('alg');
    });

    await test.step('JWT Token Validation', async () => {
      // Login to get a token
      await page.click('text=Sign In');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
      
      // Verify token is set
      const cookies = await page.context().cookies();
      const tokenCookie = cookies.find(c => c.name === 'access_token');
      expect(tokenCookie).toBeDefined();
      
      // Test protected endpoint
      const response = await page.request.get('/api/v1/auth/me');
      expect(response.status()).toBe(200);
    });
  });
});
