import { test, expect } from '@playwright/test';

test.describe('Ommaviy Hujjat QR Validatsiyasi (Public Verification)', () => {
  test('Tokensusiz ommaviy tekshirish sahifasining ochilishi', async ({ page }) => {
    // Tokensusiz to‘g‘ridan-to‘g‘ri public sahifaga kirish
    await page.goto('/verify-doc/OS2-2026-TEST-999');

    // Sahifa sarlavhasi va qaytish tugmasi ko‘rinishi
    await expect(page.locator('text=UWMS Davlat Verifikatsiya Markazi')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Tizimga Qaytish")')).toBeVisible();
  });
});
