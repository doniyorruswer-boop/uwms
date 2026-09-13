import { test, expect } from '@playwright/test';

test.describe('Tashkiliy Tuzilma va Xonalar E2E Testlari', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('/organization sahifasi, statistikalar, tablar va yangi auditoriya qo‘shish', async ({ page }) => {
    // 2. /organization sahifasiga o‘tish
    await page.goto('/organization');
    await expect(page.locator('text=Tashkiliy Tuzilma va Xonalar Reestri')).toBeVisible({ timeout: 10000 });

    // 3. Statistika kartalari
    await expect(page.locator('.arco-statistic-title:has-text("Jami Fakultetlar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("Kafedralar & Bo‘limlar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("Jami Auditoriyalar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("MOL Biriktirilgan Xonalar")')).toBeVisible();

    // 4. Tablar mavjudligi
    await expect(page.locator('.arco-tabs-header-title:has-text("Iyerarxiya")')).toBeVisible();
    await expect(page.locator('.arco-tabs-header-title:has-text("Fakultet va Kafedralar")')).toBeVisible();
    await expect(page.locator('.arco-tabs-header-title:has-text("Auditoriyalar va Xonalar")')).toBeVisible();

    // 5. "Yangi Xona Qo‘shish" modalini ochish
    await page.locator('button:has-text("Yangi Xona Qo‘shish")').click();
    await expect(page.locator('.arco-modal-title:has-text("Yangi Auditoriya / Xona Qo‘shish")')).toBeVisible();

    // 6. Xona ma’lumotlarini kiritish (unikal raqam)
    const testRoomNum = `R-${Date.now().toString().slice(-4)}`;
    const testRoomName = `Test Auditoriya ${testRoomNum}`;

    await page.locator('input[placeholder*="304, 102-A"]').fill(testRoomNum);
    await page.locator('input[placeholder*="Dasturlash Laboratoriyasi"]').fill(testRoomName);

    // 7. Saqlash
    await page.locator('.arco-modal button:has-text("Saqlash")').click();
    await expect(page.locator('.arco-message-success')).toBeVisible({ timeout: 15000 });

    // 8. "Auditoriyalar va Xonalar Reestri" tabiga o‘tish va qidirish
    await page.locator('.arco-tabs-header-title:has-text("Auditoriyalar")').click();
    await page.locator('input[placeholder*="Xona raqami, nomi"]').fill(testRoomNum);

    // 9. Yangi xona jadvalda ko‘rinishi
    await expect(page.locator(`.arco-table-cell:has-text("${testRoomNum}")`).first()).toBeVisible({ timeout: 10000 });
  });
});
