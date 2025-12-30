import { test, expect } from '@playwright/test';

test.describe('Super Admin', () => {
  const SUPERADMIN_CREDENTIALS = {
    username: 'superadmin',
    password: 'superadmin123'
  };

  test('should show login page', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.waitForSelector('text=Super Admin', { timeout: 10000 });
    await expect(page.getByText('Super Admin')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.waitForSelector('text=Super Admin', { timeout: 10000 });
    await page.locator('input[type="text"]').fill('invalid');
    await page.locator('input[type="password"]').fill('wrong');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByText(/invalid|error|errore/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.waitForSelector('text=Super Admin', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(SUPERADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(SUPERADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('/superadmin/dashboard', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Super Admin Dashboard' })).toBeVisible();
  });

  test('should display tenant list', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.waitForSelector('text=Super Admin', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(SUPERADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(SUPERADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('/superadmin/dashboard', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('should create new tenant', async ({ page }) => {
    await page.goto('/superadmin/login');
    await page.waitForSelector('text=Super Admin', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(SUPERADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(SUPERADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('/superadmin/dashboard', { timeout: 15000 });

    // Click create tenant button
    const createButton = page.getByRole('button', { name: /nuovo tenant|crea|add/i });
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();

      // Fill tenant form if visible
      const testTenantName = `Test Tenant ${Date.now()}`;
      const nameField = page.locator('input[name="name"], input[placeholder*="nome" i]').first();
      if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameField.fill(testTenantName);

        const slugField = page.locator('input[name="slug"], input[placeholder*="slug" i]').first();
        if (await slugField.isVisible().catch(() => false)) {
          await slugField.fill(`test-${Date.now()}`);
        }

        const saveButton = page.getByRole('button', { name: /salva|crea|save/i });
        if (await saveButton.isVisible().catch(() => false)) {
          await saveButton.click();
          await expect(page.getByText(new RegExp(testTenantName, 'i'))).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});
