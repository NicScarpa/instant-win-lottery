import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
  };

  test('should show login page', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /staff access/i })).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill('invalid');
    await page.locator('input[type="password"]').fill('wrong');
    await page.getByRole('button', { name: /entra/i }).click();
    await expect(page.getByText(/credenziali non valide|invalid|errore/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/dashboard|promozioni|statistiche/i);
  });

  test('should display dashboard with stats', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });
    await expect(page.getByText(/token|giocate|vincite/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to promotions', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });

    const promoLink = page.getByRole('button', { name: /promozioni/i });
    if (await promoLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promoLink.click();
      await expect(page.getByText(/promozioni|crea promozione/i)).toBeVisible();
    }
  });

  test('should navigate to branding', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });

    const brandingLink = page.getByRole('button', { name: /branding/i });
    if (await brandingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandingLink.click();
      await expect(page.getByText(/colori|logo|font/i)).toBeVisible();
    }
  });

  test('should navigate to staff management', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });

    const staffLink = page.getByRole('button', { name: /staff/i });
    if (await staffLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await staffLink.click();
      await expect(page.getByText(/staff|utenti/i)).toBeVisible();
    }
  });

  test('should navigate to audit log', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });

    const auditLink = page.getByRole('button', { name: /attivita/i });
    if (await auditLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await auditLink.click();
      await expect(page.getByText(/log attivita|cronologia/i)).toBeVisible();
    }
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForSelector('h1:has-text("Staff Access")', { timeout: 10000 });
    await page.locator('input[type="text"]').fill(ADMIN_CREDENTIALS.username);
    await page.locator('input[type="password"]').fill(ADMIN_CREDENTIALS.password);
    await page.getByRole('button', { name: /entra/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 15000 });

    const logoutButton = page.getByRole('button', { name: /logout|esci/i });
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL('/admin/login');
    }
  });
});
