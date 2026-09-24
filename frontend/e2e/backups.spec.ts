import { test, expect } from '@playwright/test';

test.describe('Zaxira Nusxalari (Backup & Restore) E2E Testlari - FAZA 5', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    const loginInput = page.locator('input[placeholder*="omborchi"]');
    if (await loginInput.isVisible()) {
      await loginInput.fill('admin');
      await page.locator('input[placeholder="Parol"]').fill('admin123');
      await page.locator('button:has-text("Tizimga Kirish")').click();
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    }
  });

  test('/backups sahifasi: Statistika, Saqlash Joyi (S3/MinIO) ustuni, va S3 zaxira yaratish', async ({ page }) => {
    // 2. /backups sahifasiga o‘tish
    await page.goto('/backups');
    await page.waitForLoadState('domcontentloaded');

    // 3. Statistika kartalari ko‘rinishi
    await expect(page.locator('text=Jami Zaxira Nusxalari').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Umumiy Egallagan Disk Hajmi').first()).toBeVisible();
    await expect(page.locator('text=Avtomatik Rejalashtiruvchi').first()).toBeVisible();

    // 4. Jadval yuklanishi va "Saqlash Joyi" ustunining mavjudligi
    await expect(page.locator('.arco-table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.arco-table-th:has-text("Saqlash Joyi")')).toBeVisible();

    // 5. "Yangi Zaxira Yaratish" modalini ochish va S3 saqlagich svitchini tekshirish
    const createBtn = page.locator('button:has-text("Yangi Zaxira Yaratish")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.locator('.arco-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=Universitet zaxira serveriga nusxalash')).toBeVisible();

    // 6. Izoh kiritish va zaxirani boshlash
    const notesInput = modal.locator('textarea');
    if (await notesInput.isVisible()) {
      await notesInput.fill('E2E Playwright Universitet Zaxira Test');
    }

    const startBtn = modal.locator('button:has-text("Zaxirani Boshlash")');
    await startBtn.click();

    // 7. Zaxira yakunlanishi va jadvalda paydo bo‘lishini kutish
    await expect(modal).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=E2E Playwright Universitet Zaxira Test').first()).toBeVisible({ timeout: 15000 });
    
    // 8. Saqlash joyi belgisi ko'rinishi (Asosiy + Universitet Serveri)
    await expect(page.locator('.arco-tag:has-text("Asosiy + Universitet Serveri")').first()).toBeVisible();
  });
});
