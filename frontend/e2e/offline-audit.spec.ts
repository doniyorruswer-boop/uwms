import { test, expect } from '@playwright/test';

test.describe('FAZA 4: PWA va Oflayn QR Skaner Keshi E2E Testlari', () => {
  test('PWA Manifest va Service Worker fayllari mavjudligi hamda to‘g‘riligi', async ({ request }) => {
    // 1. Manifest JSON tekshiruvi
    const manifestRes = await request.get('/manifest.json');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toContain('UWMS');
    expect(manifest.short_name).toBe('UWMS');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);

    // 2. Service Worker fayli mavjudligi (sw.js)
    const swRes = await request.get('/sw.js');
    expect(swRes.status()).toBe(200);
  });

  test('Oflayn rejimda QR skanerlash, IndexedDB navbatiga olish va tiklanganda tranzaksion sinxronlash', async ({ page }) => {
    // Tizimga kirish
    await page.goto('/login');
    await page.locator('input[placeholder*="omborchi"]').fill('admin');
    await page.locator('input[placeholder="Parol"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Skaner sahifasiga o‘tish
    await page.goto('/audit/scanner');
    const inputLocator = page.locator('input[placeholder*="QR kod yoki inventar"]');
    await expect(inputLocator).toBeVisible({ timeout: 10000 });
    // Xonalar yuklanishini kutish
    await expect(page.locator(':text("-xona")').first()).toBeVisible({ timeout: 10000 });

    // 1. Oflayn rejimga o‘tkazish (tarmoq uzilishi simulyatsiyasi)
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    await inputLocator.fill('UWMS:OFFLINE-TEST-001');
    await page.locator('button:has-text("O‘qish")').click();

    // IndexedDB oflayn navbat xabarnomasi yoki alerti chiqishi
    await expect(page.locator('text=Oflayn Navbat (IndexedDB)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=1 ta skan saqlangan')).toBeVisible();

    // Ikkinchi kodni kiritish
    await inputLocator.fill('UWMS:OFFLINE-TEST-002');
    await page.locator('button:has-text("O‘qish")').click();
    await expect(page.locator('text=2 ta skan saqlangan')).toBeVisible();

    // 3. Tarmoqni qayta ulash (onlayn rejimga qaytish)
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // 4. Sinxronizatsiya muvaffaqiyatli yakunlanishi xabari chiqishi (Auto-sync)
    await expect(page.locator('.arco-message:has-text("muvaffaqiyatli sinxronlandi")').first()).toBeVisible({ timeout: 15000 });

    // 5. Oflayn navbat tozalanishi va banner yashirilishini tasdiqlash
    await expect(page.locator('text=Oflayn Navbat (IndexedDB)')).not.toBeVisible({ timeout: 5000 });
  });
});
