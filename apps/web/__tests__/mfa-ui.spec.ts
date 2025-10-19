import { test, expect } from '@playwright/test';

test.describe('MFA UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'adminpassword');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    
    // Navigate to security settings
    await page.click('a[href="/dashboard/settings/security"]');
    await page.waitForURL('/dashboard/settings/security');
  });

  test('should display MFA status correctly', async ({ page }) => {
    // Check that MFA status is displayed
    await expect(page.locator('text=Multi-Factor Authentication')).toBeVisible();
    await expect(page.locator('text=MFA Status:')).toBeVisible();
    await expect(page.locator('text=Disabled')).toBeVisible();
  });

  test('should show enable MFA button when disabled', async ({ page }) => {
    // Check that enable button is visible
    await expect(page.locator('button:has-text("Enable MFA")')).toBeVisible();
  });

  test('should open TOTP setup modal', async ({ page }) => {
    // Click enable TOTP button
    await page.click('button:has-text("Enable TOTP")');
    
    // Check that modal opens
    await expect(page.locator('text=Enable TOTP Authentication')).toBeVisible();
    await expect(page.locator('text=Set up two-factor authentication using an authenticator app')).toBeVisible();
  });

  test('should display TOTP setup steps', async ({ page }) => {
    // Open TOTP modal
    await page.click('button:has-text("Enable TOTP")');
    
    // Check setup instructions
    await expect(page.locator('text=TOTP (Time-based One-Time Password) adds an extra layer of security')).toBeVisible();
    await expect(page.locator('text=Click "Setup TOTP" to generate a QR code')).toBeVisible();
    
    // Click setup button
    await page.click('button:has-text("Setup TOTP")');
    
    // Check that verification step appears
    await expect(page.locator('text=Step 1: Add to Authenticator App')).toBeVisible();
    await expect(page.locator('text=Step 2: Verify Setup')).toBeVisible();
  });

  test('should show QR code placeholder', async ({ page }) => {
    // Open TOTP modal and setup
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check QR code placeholder
    await expect(page.locator('text=QR Code would appear here')).toBeVisible();
    
    // Check secret key display
    await expect(page.locator('input[readonly]')).toBeVisible();
  });

  test('should show recovery codes', async ({ page }) => {
    // Open TOTP modal and setup
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check recovery codes section
    await expect(page.locator('text=Important: Save Your Recovery Codes')).toBeVisible();
    await expect(page.locator('text=These codes can be used to access your account')).toBeVisible();
    
    // Check that codes are displayed in grid
    const codeElements = page.locator('.grid.grid-cols-2 .bg-white.p-2.rounded.border');
    await expect(codeElements).toHaveCount(10);
  });

  test('should allow copying recovery codes', async ({ page }) => {
    // Open TOTP modal and setup
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check copy button
    await expect(page.locator('button:has-text("Copy All Codes")')).toBeVisible();
    
    // Test copy functionality (mocked)
    await page.click('button:has-text("Copy All Codes")');
  });

  test('should validate TOTP code input', async ({ page }) => {
    // Open TOTP modal and setup
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check verification code input
    const codeInput = page.locator('input[placeholder="123456"]');
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toHaveAttribute('maxlength', '6');
    
    // Test invalid input
    await codeInput.fill('123');
    await expect(page.locator('button:has-text("Enable MFA")')).toBeDisabled();
    
    // Test valid input
    await codeInput.fill('123456');
    await expect(page.locator('button:has-text("Enable MFA")')).toBeEnabled();
  });

  test('should open WebAuthn setup modal', async ({ page }) => {
    // Click enable WebAuthn button
    await page.click('button:has-text("Enable WebAuthn")');
    
    // Check that modal opens
    await expect(page.locator('text=Enable WebAuthn Authentication')).toBeVisible();
    await expect(page.locator('text=Set up hardware security key authentication')).toBeVisible();
  });

  test('should display WebAuthn setup instructions', async ({ page }) => {
    // Open WebAuthn modal
    await page.click('button:has-text("Enable WebAuthn")');
    
    // Check setup instructions
    await expect(page.locator('text=WebAuthn allows you to use hardware security keys')).toBeVisible();
    await expect(page.locator('text=You\'ll need a compatible security key')).toBeVisible();
    
    // Check credential name input
    await expect(page.locator('input[placeholder="e.g., My YubiKey"]')).toBeVisible();
  });

  test('should validate WebAuthn credential name', async ({ page }) => {
    // Open WebAuthn modal
    await page.click('button:has-text("Enable WebAuthn")');
    
    // Check that setup button is disabled initially
    await expect(page.locator('button:has-text("Setup WebAuthn")')).toBeDisabled();
    
    // Enter credential name
    await page.fill('input[placeholder="e.g., My YubiKey"]', 'My Security Key');
    
    // Check that setup button is now enabled
    await expect(page.locator('button:has-text("Setup WebAuthn")')).toBeEnabled();
  });

  test('should show WebAuthn registration progress', async ({ page }) => {
    // Open WebAuthn modal and setup
    await page.click('button:has-text("Enable WebAuthn")');
    await page.fill('input[placeholder="e.g., My YubiKey"]', 'My Security Key');
    await page.click('button:has-text("Setup WebAuthn")');
    
    // Check loading state
    await expect(page.locator('text=Please interact with your security key')).toBeVisible();
    await expect(page.locator('text=You may need to touch your security key')).toBeVisible();
  });

  test('should display admin MFA enforcement warning', async ({ page }) => {
    // Check that admin enforcement warning is shown
    await expect(page.locator('text=Multi-factor authentication is required for admin accounts')).toBeVisible();
  });

  test('should handle MFA enable success', async ({ page }) => {
    // Mock successful MFA enable
    await page.route('/api/v1/mfa/totp/setup', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code_url: 'otpauth://totp/Shomer:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Shomer',
          backup_codes: ['code1', 'code2', 'code3', 'code4', 'code5', 'code6', 'code7', 'code8', 'code9', 'code10']
        })
      });
    });

    await page.route('/api/v1/mfa/totp/enable', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'MFA enabled successfully'
        })
      });
    });

    // Complete TOTP setup flow
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    await page.fill('input[placeholder="123456"]', '123456');
    await page.click('button:has-text("Enable MFA")');
    
    // Check success state
    await expect(page.locator('text=MFA Enabled Successfully')).toBeVisible();
    await expect(page.locator('text=Multi-factor authentication has been enabled')).toBeVisible();
  });

  test('should handle MFA setup errors', async ({ page }) => {
    // Mock error response
    await page.route('/api/v1/mfa/totp/setup', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'MFA setup failed'
        })
      });
    });

    // Try to setup TOTP
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check error message
    await expect(page.locator('text=MFA setup failed')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('/api/v1/mfa/totp/setup', route => {
      route.abort();
    });

    // Try to setup TOTP
    await page.click('button:has-text("Enable TOTP")');
    await page.click('button:has-text("Setup TOTP")');
    
    // Check error message
    await expect(page.locator('text=Error setting up TOTP')).toBeVisible();
  });

  test('should close modals correctly', async ({ page }) => {
    // Open TOTP modal
    await page.click('button:has-text("Enable TOTP")');
    await expect(page.locator('text=Enable TOTP Authentication')).toBeVisible();
    
    // Close modal with X button
    await page.click('button[aria-label="Close"]');
    await expect(page.locator('text=Enable TOTP Authentication')).not.toBeVisible();
    
    // Open WebAuthn modal
    await page.click('button:has-text("Enable WebAuthn")');
    await expect(page.locator('text=Enable WebAuthn Authentication')).toBeVisible();
    
    // Close modal with X button
    await page.click('button[aria-label="Close"]');
    await expect(page.locator('text=Enable WebAuthn Authentication')).not.toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that modals are still functional on mobile
    await page.click('button:has-text("Enable TOTP")');
    await expect(page.locator('text=Enable TOTP Authentication')).toBeVisible();
    
    // Check that content is scrollable on mobile
    await expect(page.locator('.max-h-\\[90vh\\].overflow-y-auto')).toBeVisible();
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Open TOTP modal
    await page.click('button:has-text("Enable TOTP")');
    
    // Check for proper ARIA labels and roles
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[aria-label]')).toBeVisible();
    
    // Check for proper focus management
    const firstInput = page.locator('input').first();
    await expect(firstInput).toBeFocused();
  });
});