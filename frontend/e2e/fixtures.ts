import { test as base, expect, Page } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend<{
  adminPage: Page;
  superadminPage: Page;
}>({
  // Authenticated admin page
  adminPage: async ({ page }, use) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder(/username/i).fill('admin');
    await page.getByPlaceholder(/password/i).fill('admin123');
    await page.getByRole('button', { name: /accedi|login/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10000 });
    await use(page);
  },

  // Authenticated superadmin page
  superadminPage: async ({ page }, use) => {
    await page.goto('/superadmin/login');
    await page.getByPlaceholder(/username/i).fill('superadmin');
    await page.getByPlaceholder(/password/i).fill('superadmin123');
    await page.getByRole('button', { name: /accedi/i }).click();
    await page.waitForURL('/superadmin/dashboard', { timeout: 10000 });
    await use(page);
  },
});

export { expect };

// Helper functions
export async function waitForToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

export async function dismissToast(page: Page) {
  const toast = page.locator('[role="alert"], .toast, [class*="toast"]');
  if (await toast.isVisible()) {
    await toast.click();
  }
}

export function generateTestPhone(): string {
  return `340${Math.floor(1000000 + Math.random() * 9000000)}`;
}

export function generateTestEmail(): string {
  return `test${Date.now()}@example.com`;
}
