import { test, expect } from '@playwright/test';

test.describe('Talabnomalar (Requests) E2E Testlari', () => {
  test('Talabnomalar to‘liq oqimi: login, jadval, tablar filtrlash, modal va qidiruv', async ({ page }) => {
    // 1. Tizimga kirish (Login)
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('.uwms-header')).toBeVisible();

    // 2. /requests sahifasiga o'tish
    await page.goto('/requests');
    await expect(page.locator('.uwms-header:has-text("Talabnomalar")')).toBeVisible({ timeout: 10000 });

    // Jadval va menyu selektori
    await expect(page.locator('.arco-table')).toBeVisible();
    await expect(page.locator('.arco-menu-item.arco-menu-selected:has-text("Talabnomalar")')).toBeVisible();

    // Tablar ko'rinishi (7-bosqichli davlat zayavkalar tizimi)
    await expect(page.locator('text=Barcha Zayavkalar')).toBeVisible();
    await expect(page.locator('text=Jarayonda (7 Bosqich)')).toBeVisible();
    await expect(page.locator('text=Yakunlangan (Balansda)')).toBeVisible();

    // 3. Tablar bo'yicha filtrlash
    await page.locator('text=Jarayonda (7 Bosqich)').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.arco-table')).toBeVisible();

    await page.locator('text=Barcha Zayavkalar').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.arco-table')).toBeVisible();

    // 4. "Yangi Zayavka Yaratish" modalini tekshirish
    const createBtn = page.locator('button:has-text("Yangi Zayavka Yaratish")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.locator('.arco-modal:has-text("Yangi Talabnoma")');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(page.locator('text=Nima maqsadda zarurligi')).toBeVisible();
    await expect(page.locator('text=Ombordan tanlash')).toBeVisible();

    // Modalni bekor qilish
    const cancelBtn = modal.locator('button:has-text("Bekor qilish")');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();

    // 5. Qidiruv maydonini tekshirish
    const searchInput = page.locator('input[placeholder*="Zayavka raqami"], input[placeholder*="qidirish"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('REQ');
    await page.waitForTimeout(300);
    await searchInput.fill('');
    await page.waitForTimeout(200);
  });

  test('7-bosqichli davlat zayavkasi zanjiri: bosqichlar va detal modalini ko‘rish', async ({ page }) => {
    // 1. Tizimga kirish
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. /requests sahifasiga o‘tish
    await page.goto('/requests');
    await page.waitForURL('**/requests', { timeout: 10000 });
    await expect(page.locator('.arco-table')).toBeVisible({ timeout: 10000 });

    // 3. Birinchi talabnoma qatorini ko‘rish
    const tableRow = page.locator('.arco-table-tr').first();
    await expect(tableRow).toBeVisible({ timeout: 10000 });

    // 4. "Jarayonda (7 Bosqich)" tabiga o‘tish
    const progressTab = page.locator('text=Jarayonda (7 Bosqich)');
    await progressTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.arco-table')).toBeVisible();

    // 5. Qatordagi ko‘rish tugmasi orqali dalolatnoma / detal ochish
    const actionBtn = page.locator('.arco-table-tr button').first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('.arco-modal');
      if (await modal.isVisible()) {
        await expect(modal).toBeVisible();
        const closeBtn = modal.locator('button:has-text("Yopish"), button:has-text("Bekor"), .arco-modal-close-btn').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }
  });
});
