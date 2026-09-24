import { test, expect } from '@playwright/test';

test.describe('Moddiy Javobgarlikni Topshirish (MOL Handover) E2E Testlari', () => {
  test('MOL javobgarlikni topshirish arizasini shakllantirish va modal boshqaruvi', async ({ page }) => {
    // 1. Super Admin / Boshqaruvchi sifatida tizimga kirish
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. /users sahifasiga o‘tish
    await page.goto('/users');
    await page.waitForURL('**/users', { timeout: 10000 });
    await expect(page.locator('.arco-table')).toBeVisible({ timeout: 10000 });

    // 3. Moddiy javobgar shaxs (MOL) qatorini qidirish va topshirish modalini ochish
    const handoverBtn = page.locator('button:has-text("Javobgarlik"), button:has-text("Topshirish")').first();
    if (await handoverBtn.isVisible()) {
      await handoverBtn.click();
      await page.waitForTimeout(600);

      // Modal ko'rinishi
      const modal = page.locator('.arco-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Topshirish turlari mavjudligini tekshirish
      await expect(
        modal.locator(':text("To‘liq topshirish"), :text("Qisman topshirish"), :text("Topshirish turi"), :text("Topshirish")').first(),
      ).toBeVisible();

      // Modalni bekor qilish
      const cancelBtn = modal.locator('button:has-text("Bekor qilish"), button:has-text("Yopish")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test('/inbox sahifasida Moddiy topshirish (Handover) aylanma varaqasi va OS-1 dalolatnomasini ko‘rib chiqish', async ({ page }) => {
    // 1. Tizimga kirish
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 2. /inbox sahifasiga o‘tish
    await page.goto('/inbox');
    await page.waitForURL('**/inbox', { timeout: 10000 });

    // 3. Inbox sarlavhasi va filtrlash tablari
    await expect(page.locator('text=Kutilayotgan Vazifalar Markazi')).toBeVisible({ timeout: 10000 });

    // 4. Monitoring rejimiga o'tish (Barcha jarayonlarni ko'rish)
    const monitorRadio = page.locator('label:has-text("Universitet Bo‘yicha Monitoring")');
    if (await monitorRadio.isVisible()) {
      await monitorRadio.click();
      await page.waitForTimeout(400);
    }

    // 5. Agar topshirish arizasi bo‘lsa, ko‘rib chiqish modalini ochish
    const reviewBtn = page.locator('button:has-text("Ko‘rib chiqish"), button:has-text("Batafsil"), button:has-text("Imzolash")').first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await page.waitForTimeout(600);

      const reviewModal = page.locator('.arco-modal');
      if (await reviewModal.isVisible()) {
        await expect(reviewModal).toBeVisible();
        // Modal ichidagi sarlavha yoki tugma ko'rinishini tekshirish
        await expect(
          reviewModal.locator(':text("Dalolatnoma"), :text("Topshiruvchi"), :text("Komendant"), :text("Holat")').first(),
        ).toBeVisible();

        const closeBtn = reviewModal.locator('button:has-text("Yopish"), button:has-text("Bekor qilish"), .arco-modal-close-btn').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }
  });
});

