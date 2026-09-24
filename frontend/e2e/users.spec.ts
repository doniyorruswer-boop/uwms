import { test, expect } from '@playwright/test';

test.describe('Foydalanuvchilar va Xodimlar Reestri E2E Testlari', () => {
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

  test('/users sahifasi yuklanishi, tablar, jadval va xodim qo‘shish modali', async ({ page }) => {
    // 2. /users sahifasiga o‘tish
    await page.goto('/users');
    await page.waitForURL('**/users', { timeout: 10000 });

    // 3. Tablar mavjudligi
    await expect(page.locator('text=Barcha Xodimlar').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Moddiy Javobgarlar (MOL)').first()).toBeVisible();

    // 4. Jadval yuklanishi
    await expect(page.locator('.arco-table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.arco-table-th:has-text("F.I.Sh.")')).toBeVisible();

    // 5. Qidiruv maydoni mavjudligi
    const searchInput = page.locator('input[placeholder*="F.I.Sh"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Omon');
    await page.waitForTimeout(500);

    // 6. "Yangi Xodim Qo‘shish" modalini ochish
    const addBtn = page.locator('button:has-text("Yangi Xodim Qo‘shish")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const modal = page.locator('.arco-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator(':text("F.I.Sh"), :text("Xodim"), :text("Yangi")').first()).toBeVisible();

    // 7. Modalni yopish
    const cancelBtn = modal.locator('button:has-text("Bekor qilish"), button:has-text("Yopish"), .arco-modal-close-btn').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });
});
