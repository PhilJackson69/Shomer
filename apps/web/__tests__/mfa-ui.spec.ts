import { test, expect } from '@playwright/test';

test.describe('MFA UI Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to security settings page
    await page.goto('/dashboard/settings/security');
  });

  test('should display MFA status correctly', async ({ page }) => {
    // Check if MFA status section is visible
    await expect(page.locator('h1')).toContainText('Security Settings');
    
    // Check if MFA card is present
    await expect(page.locator('[data-testid="mfa-status-card"]')).toBeVisible();
    
    // Check initial MFA status
    await expect(page.locator('[data-testid="mfa-status"]')).toContainText('Disabled');
  });

  test('should open TOTP setup modal', async ({ page }) => {
    // Click enable MFA button
    await page.click('[data-testid="enable-mfa-button"]');
    
    // Check if modal is open
    await expect(page.locator('[data-testid="totp-setup-modal"]')).toBeVisible();
    
    // Check modal content
    await expect(page.locator('h2')).toContainText('Enable TOTP Authentication');
  });

  test('should show recovery codes modal', async ({ page }) => {
    // Mock MFA enabled state
    await page.evaluate(() => {
      localStorage.setItem('mfa_enabled', 'true');
    });
    
    // Reload page to reflect MFA enabled state
    await page.reload();
    
    // Click view recovery codes button
    await page.click('[data-testid="view-recovery-codes-button"]');
    
    // Check if recovery codes modal is open
    await expect(page.locator('[data-testid="recovery-codes-modal"]')).toBeVisible();
  });

  test('should handle MFA setup workflow', async ({ page }) => {
    // Start MFA setup
    await page.click('[data-testid="enable-mfa-button"]');
    
    // Click setup TOTP button
    await page.click('[data-testid="setup-totp-button"]');
    
    // Verify we move to verification step
    await expect(page.locator('[data-testid="verification-step"]')).toBeVisible();
    
    // Check if QR code section is present
    await expect(page.locator('[data-testid="qr-code-section"]')).toBeVisible();
    
    // Check if recovery codes are displayed
    await expect(page.locator('[data-testid="recovery-codes-section"]')).toBeVisible();
  });

  test('should validate verification code input', async ({ page }) => {
    // Start MFA setup and go to verification step
    await page.click('[data-testid="enable-mfa-button"]');
    await page.click('[data-testid="setup-totp-button"]');
    
    // Try to submit without entering code
    await page.click('[data-testid="enable-mfa-button"]');
    
    // Check if error message appears
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Please enter the verification code');
    
    // Enter invalid code format
    await page.fill('[data-testid="verification-code-input"]', '123');
    
    // Check if button is still disabled
    await expect(page.locator('[data-testid="enable-mfa-button"]')).toBeDisabled();
    
    // Enter valid code format
    await page.fill('[data-testid="verification-code-input"]', '123456');
    
    // Check if button is now enabled
    await expect(page.locator('[data-testid="enable-mfa-button"]')).toBeEnabled();
  });

  test('should handle copy functionality', async ({ page }) => {
    // Start MFA setup and go to verification step
    await page.click('[data-testid="enable-mfa-button"]');
    await page.click('[data-testid="setup-totp-button"]');
    
    // Test copy secret key
    await page.click('[data-testid="copy-secret-button"]');
    
    // Check if success message appears
    await expect(page.locator('[data-testid="copy-success-message"]')).toBeVisible();
    
    // Test copy recovery codes
    await page.click('[data-testid="copy-all-codes-button"]');
    
    // Check if success message appears
    await expect(page.locator('[data-testid="copy-success-message"]')).toBeVisible();
  });

  test('should handle download functionality', async ({ page }) => {
    // Mock recovery codes modal
    await page.evaluate(() => {
      localStorage.setItem('mfa_enabled', 'true');
    });
    
    await page.reload();
    await page.click('[data-testid="view-recovery-codes-button"]');
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-codes-button"]');
    
    const download = await downloadPromise;
    expect(download)suggestedFilename()).toBe('shomer-recovery-codes.txt');
  });

  test('should display security information', async ({ page }) => {
    // Check if security information card is present
    await expect(page.locator('[data-testid="security-info-card"]')).toBeVisible();
    
    // Check if all security information sections are present
    await expect(page.locator('[data-testid="mfa-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="totp-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="webauthn-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="recovery-codes-info"]')).toBeVisible();
  });

  test('should handle admin enforcement warning', async ({ page }) => {
    // Mock admin user
    await page.evaluate(() => {
      localStorage.setItem('user_role', 'admin');
    });
    
    await page.reload();
    
    // Check if admin enforcement warning is displayed
    await expect(page.locator('[data-testid="admin-enforcement-warning"]')).toBeVisible();
  });

  test('should handle error states', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/mfa/status', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' })
      });
    });
    
    await page.reload();
    
    // Check if error message is displayed
    await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-alert"]')).toContainText('Internal server error');
  });

  test('should handle loading states', async ({ page }) => {
    // Mock slow API response
    await page.route('/api/v1/mfa/status', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: false,
            totp_enabled: false,
            webauthn_enabled: false,
            has_backup_codes: false
          })
        });
      }, 1000);
    });
    
    await page.reload();
    
    // Check if loading state is displayed
    await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
    
    // Wait for loading to complete
    await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible();
  });
});
