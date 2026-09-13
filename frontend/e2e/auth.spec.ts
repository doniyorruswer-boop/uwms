import { test, expect } from '@playwright/test';

test.describe('Autentifikatsiya va RBAC E2E Testlari', () => {
  test('Noto‘g‘ri login kiritilganda xatolik xabari chiqishi', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/UWMS/i);

    // Form elementlarini to‘ldirish
    await page.locator('input[placeholder*="omborchi"]').fill('noto‘g‘ri_user');
    await page.locator('input[placeholder="Parol"]').fill('xato_parol');
    await page.locator('button:has-text("Tizimga Kirish")').click();

    // Xatolik xabari chiqishini kutish
    const errorMessage = page.locator('.arco-message');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('Super Admin muvaffaqiyatli kirishi va Dashboardga o‘tishi', async ({ page }) => {
    await page.goto('/login');

    // Admin login ma’lumotlarini kiritish
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();

    // Dashboardga o‘tishini tasdiqlash
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('text=UWMS Tizimi')).toBeVisible();

    // Admin roli yoki ismi ko‘rinishi
    await expect(page.locator('.uwms-header')).toBeVisible();
  });
});
