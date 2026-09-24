import { test, expect } from '@playwright/test';

test.describe('Ommaviy Hujjat QR Validatsiyasi (Public Verification)', () => {
  test('Tokensusiz ommaviy tekshirish sahifasining ochilishi', async ({ page }) => {
    // Tokensusiz to‘g‘ridan-to‘g‘ri public sahifaga kirish
    await page.goto('/verify-doc/OS2-2026-TEST-999');

    // Sahifa sarlavhasi va chiqish tugmasi ko‘rinishi
    await expect(page.locator('text=Elektron Hujjat Reyestri')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Chiqish")')).toBeVisible();
    await expect(page.locator('text=Ichki Elektron Hujjat Verifikatsiyasi')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Toshmatov Omon').first()).toBeVisible();
  });
});
