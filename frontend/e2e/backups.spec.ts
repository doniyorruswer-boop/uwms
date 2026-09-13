import { test, expect } from '@playwright/test';

test.describe('Zaxira Nusxalari (Backup & Restore) E2E Testlari', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('/backups sahifasi yuklanishi va yangi zaxira yaratish', async ({ page }) => {
    // 2. /backups sahifasiga o‘tish
    await page.goto('/backups');
    await expect(page.locator('text=Ma’lumotlar Bazasi Zaxiralari')).toBeVisible({ timeout: 10000 });

    // 3. Statistika kartalari ko‘rinishi
    await expect(page.locator('text=Jami Zaxira Nusxalari')).toBeVisible();
    await expect(page.locator('text=Umumiy Egallagan Disk Hajmi')).toBeVisible();
    await expect(page.locator('text=Avtomatik Rejalashtiruvchi')).toBeVisible();

    // 4. "Yangi Zaxira Yaratish" modalini ochish
    await page.locator('button:has-text("Yangi Zaxira Yaratish")').click();
    await expect(page.locator('.arco-modal-title:has-text("Yangi Zaxira Nusxasi Yaratish")')).toBeVisible();

    // 5. Izoh kiritish va zaxirani boshlash
    await page.locator('textarea').fill('Playwright E2E Robot Test Zaxirasi');
    await page.locator('.arco-modal button:has-text("Zaxirani Boshlash")').click();

    // 6. Muvaffaqiyat xabari va jadvalda paydo bo‘lishi
    const successMsg = page.locator('.arco-message-success');
    await expect(successMsg).toBeVisible({ timeout: 20000 });

    // 7. Jadvalda .dump fayl qatori ko‘rinishi
    await expect(page.locator('.arco-table-cell:has-text(".dump")').first()).toBeVisible();
  });
});
