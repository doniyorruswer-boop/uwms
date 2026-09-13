import { test, expect } from '@playwright/test';

test.describe('Foydalanuvchilar va Xodimlar Reestri E2E Testlari', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('/users sahifasi yuklanishi, statistika va yangi xodim qo‘shish', async ({ page }) => {
    // 2. /users sahifasiga o‘tish
    await page.goto('/users');
    await expect(page.locator('text=Foydalanuvchilar va Xodimlar Reestri')).toBeVisible({ timeout: 10000 });

    // 3. Statistika kartalari
    await expect(page.locator('.arco-statistic-title:has-text("Jami Ro‘yxatdagi Xodimlar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("Faol Foydalanuvchilar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("Moddiy Javobgarlar")')).toBeVisible();
    await expect(page.locator('.arco-statistic-title:has-text("Tizim Administratorlari")')).toBeVisible();

    // 4. Jadval yuklanishi
    await expect(page.locator('.arco-table')).toBeVisible();
    await expect(page.locator('.arco-table-th:has-text("F.I.Sh. & Login")')).toBeVisible();

    // 5. "Yangi Xodim Qo‘shish" modalini ochish
    await page.locator('button:has-text("Yangi Xodim Qo‘shish")').click();
    await expect(page.locator('.arco-modal-title:has-text("Yangi Xodim Qo‘shish")')).toBeVisible();

    // 6. Formani to‘ldirish (unikal vaqt bilan)
    const testSuffix = Date.now().toString().slice(-4);
    const testUsername = `user_test_${testSuffix}`;
    const testFullName = `Sinov Xodimi ${testSuffix}`;

    await page.locator('input[placeholder*="Abdullayev"]').fill(testFullName);
    await page.locator('input[placeholder*="j_abdullayev"]').fill(testUsername);
    await page.locator('input[type="password"]').fill('SecretPass123!');
    await page.locator('input[placeholder="masalan@univ.uz"]').fill(`test_${testSuffix}@univ.uz`);
    await page.locator('input[placeholder="+998 90 123 45 67"]').fill('+998 90 999 88 77');

    // 7. Saqlash
    await page.locator('.arco-modal button:has-text("Saqlash")').click();

    // 8. Muvaffaqiyat xabari
    await expect(page.locator('.arco-message-success')).toBeVisible({ timeout: 15000 });

    // 9. Yangi foydalanuvchi jadvalda ko‘rinishi
    await expect(page.locator(`.arco-table-cell:has-text("${testFullName}")`)).toBeVisible({ timeout: 10000 });
  });
});
