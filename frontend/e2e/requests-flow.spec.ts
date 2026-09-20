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

    // Tablar ko'rinishi
    await expect(page.locator('text=Barcha Zayavkalar')).toBeVisible();
    await expect(page.locator('text=Tasdiq Kutilmoqda')).toBeVisible();
    await expect(page.locator('text=Omborda Tarqatish')).toBeVisible();
    await expect(page.locator('text=Bajarilgan (Yopilgan)')).toBeVisible();

    // 3. Tablar bo'yicha filtrlash
    await page.locator('text=Tasdiq Kutilmoqda').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.arco-table')).toBeVisible();

    await page.locator('text=Barcha Zayavkalar').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.arco-table')).toBeVisible();

    // 4. "Yangi Zayavka Yaratish" modalini tekshirish
    const createBtn = page.locator('button:has-text("Yangi Zayavka Yaratish")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.locator('.arco-modal:has-text("Omborga Yangi Talabnoma")');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(page.locator('label:has-text("Ombordagi Mahsulotni Tanlang")')).toBeVisible();
    await expect(page.locator('label:has-text("Kerakli Miqdor")')).toBeVisible();
    await expect(page.locator('label:has-text("Nima maqsadda zarurligi")')).toBeVisible();

    // Modalni bekor qilish
    const cancelBtn = modal.locator('button:has-text("Bekor qilish")');
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();

    // 5. Qidiruv maydonini tekshirish
    const searchInput = page.locator('input[placeholder*="Zayavka raqami"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('REQ');
    await page.waitForTimeout(300);
    await searchInput.fill('');
    await page.waitForTimeout(200);
  });
});
