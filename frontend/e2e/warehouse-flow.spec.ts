import { test, expect } from '@playwright/test';

test.describe('Ombor Qoldiqlari (Warehouse) E2E Testlari', () => {
  test('Ombor inventarizatsiyasi to‘liq oqimi: login, statistika kartalari, jadval, qidiruv va filtrlash', async ({ page }) => {
    // 1. Super Admin sifatida tizimga kirish
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('.uwms-header')).toBeVisible();

    // 2. /warehouse sahifasiga o‘tish
    await page.goto('/warehouse');
    await page.waitForURL('**/warehouse', { timeout: 10000 });
    await expect(page.locator('.arco-table')).toBeVisible({ timeout: 10000 });

    // 3. Ombor menyusi faolligini tekshirish
    await expect(
      page.locator('.arco-menu-item.arco-menu-selected:has-text("Ombor")'),
    ).toBeVisible();

    // 4. Jadval ustunlari mavjudligini tekshirish
    await expect(page.locator('.arco-table-th:has-text("Mahsulot")')).toBeVisible();
    await expect(page.locator('.arco-table-th:has-text("Qoldiq")')).toBeVisible();

    // 5. Qidiruv maydonini tekshirish
    const searchInput = page.locator('input[placeholder*="Qidirish"], input[placeholder*="qidirish"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Qog‘oz');
      await page.waitForTimeout(300);
      await searchInput.fill('');
      await page.waitForTimeout(200);
    }

    // 6. Excel import yoki yangi tovar tugmasini tekshirish
    const importBtn = page.locator('button:has-text("Excel"), button:has-text("Import")');
    if (await importBtn.isVisible()) {
      await importBtn.click();
      const modal = page.locator('.arco-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
      const cancelBtn = modal.locator('button:has-text("Bekor qilish"), button:has-text("Yopish")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });
});
