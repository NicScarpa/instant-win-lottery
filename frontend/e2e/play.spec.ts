import { test, expect } from '@playwright/test';

test.describe('Play Page', () => {
  test('should show error without token', async ({ page }) => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle');
    // Should show error about missing token
    await expect(page.getByText(/ops|errore|mancante/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error with invalid token', async ({ page }) => {
    await page.goto('/play?token=INVALID123');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/non valido|invalid|ops/i)).toBeVisible({ timeout: 10000 });
  });

  test('should load page with footer', async ({ page }) => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle');
    // Should have footer with legal links
    await expect(page.getByText(/regolamento/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Play Page with Token (requires seeded data)', () => {
  // These tests require a valid token in the database
  // Skip them in automated runs - enable for manual testing with real data

  test.skip('should show phone input with valid token', async ({ page }) => {
    const validToken = 'TEST_TOKEN_123';
    await page.goto(`/play?token=${validToken}`);
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 10000 });
  });

  test.skip('should proceed to registration after phone check', async ({ page }) => {
    const validToken = 'TEST_TOKEN_123';
    await page.goto(`/play?token=${validToken}`);
    await page.locator('input[type="tel"]').fill('3401234567');
    await page.getByRole('button', { name: /continua/i }).click();
    await expect(page.locator('input[placeholder*="NOME"]')).toBeVisible();
  });

  test.skip('should complete registration and show play button', async ({ page }) => {
    const validToken = 'TEST_TOKEN_123';
    await page.goto(`/play?token=${validToken}`);
    await page.locator('input[type="tel"]').fill('3401234567');
    await page.getByRole('button', { name: /continua/i }).click();
    await page.locator('input[placeholder*="NOME"]').fill('Test');
    await page.locator('input[placeholder*="COGNOME"]').fill('User');
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /partecipa/i }).click();
    await expect(page.getByRole('button', { name: /gioca/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Play Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Should show error or content, page should not be broken
    await expect(page.getByText(/regolamento|ops/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Language Selector', () => {
  test('should handle language selector if available', async ({ page }) => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle');

    // Language selector is optional - only shows if multiple languages configured
    const langSelector = page.locator('button[aria-label*="lingua"]');
    const isVisible = await langSelector.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await langSelector.click();
      await expect(page.getByText(/italiano|english/i)).toBeVisible({ timeout: 5000 });
    }
    // Test passes whether or not language selector is visible
  });
});
