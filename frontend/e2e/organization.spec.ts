import { test, expect } from '@playwright/test';

test.describe('Tashkiliy Tuzilma va Xonalar E2E Testlari', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    const loginInput = page.locator('input[placeholder*="omborchi"]');
    if (await loginInput.isVisible()) {
      await loginInput.fill('admin');
      await page.locator('input[placeholder="Parol"]').fill('admin123');
      await page.locator('button:has-text("Tizimga Kirish")').click();
    }
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('/organization sahifasi, iyerarxiya daraxti, rejimlar va modal boshqaruvi', async ({ page }) => {
    // 2. /organization sahifasiga o‘tish
    await page.goto('/organization');
    await page.waitForURL('**/organization', { timeout: 10000 });

    // 3. Universitet Iyerarxiyasi kartasi va daraxti ko‘rinishi
    await expect(page.locator('text=Universitet Iyerarxiyasi').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.arco-tree')).toBeVisible({ timeout: 10000 });

    // 4. Bino va Bo'lim tugmalari mavjudligi
    await expect(page.locator('button:has-text("Yangi Xona Qo‘shish")')).toBeVisible();

    // 5. Daraxt tartibini o'zgartirish radiosi (Fakultet ➔ Kafedra)
    const deptFirstRadio = page.locator('label:has-text("Fakultet ➔ Kafedra")');
    if (await deptFirstRadio.isVisible()) {
      await deptFirstRadio.click();
      await page.waitForTimeout(400);
      await expect(page.locator('.arco-tree')).toBeVisible();
    }

    // 6. "Yangi Xona Qo‘shish" modalini ochish
    const addRoomBtn = page.locator('button:has-text("Yangi Xona Qo‘shish")');
    await addRoomBtn.click();

    const modal = page.locator('.arco-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(':text("Xona"), :text("Auditoriya"), :text("Qo‘shish")').first()).toBeVisible();

    // 7. Modalni yopish
    const cancelBtn = modal.locator('button:has-text("Bekor qilish"), button:has-text("Yopish"), .arco-modal-close-btn').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });
});
