import { test, expect } from '@playwright/test';

test.describe('Talabnomalar (Requests) E2E Testlari', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('/requests sahifasi yuklanishi va jadval ko‘rinishi', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.locator('.uwms-header:has-text("Talabnomalar")')).toBeVisible({ timeout: 10000 });

    // Jadval konteyneri mavjudligi
    await expect(page.locator('.arco-table')).toBeVisible();

    // Sider menyusidagi faol element
    await expect(page.locator('.arco-menu-item.arco-menu-selected:has-text("Talabnomalar")')).toBeVisible();
  });
});
