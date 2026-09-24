import { test, expect } from '@playwright/test';

test.describe('Mobil QR Biometrik Imzolash (Mobile Signing Flow) E2E Testlari', () => {
  test.use({
    viewport: { width: 390, height: 844 }, // Mobile device viewport (iPhone 12/13/14)
    hasTouch: true,
    isMobile: true,
  });

  test('Noto‘g‘ri yoki muddati o‘tgan token ochilganda xatolik xabari chiqishi', async ({ page }) => {
    // 1. Avval tizimga kirish (chunki mobil sahifada auth-gate mavjud)
    await page.goto('/login');
    const loginInput = page.locator('input[placeholder*="omborchi"]');
    if (await loginInput.isVisible()) {
      await loginInput.fill('omborchi');
      await page.locator('input[placeholder="Parol"]').fill('admin123');
      await page.locator('button:has-text("Tizimga Kirish")').click();
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    }

    // 2. Noto'g'ri token bilan mobil imzolash sahifasiga o'tish
    await page.goto('/mobile/sign/invalid-token-test-404');
    await page.waitForURL('**/mobile/sign/invalid-token-test-404', { timeout: 10000 });

    // 3. Chiqish tugmasi mavjudligi
    const exitBtn = page.locator('button:has-text("Chiqish")');
    await expect(exitBtn).toBeVisible({ timeout: 10000 });

    // 4. Xatolik kartasi (Sessiya Topilmadi)
    await expect(
      page.locator(':text("Sessiya Topilmadi"), :text("topilmadi"), :text("bekor qilingan")').first(),
    ).toBeVisible({ timeout: 10000 });

    // 5. Bosh sahifaga o'tish tugmasi
    const homeBtn = page.locator('button:has-text("Bosh Sahifaga O‘tish")');
    await expect(homeBtn).toBeVisible();
    await homeBtn.click();
    await expect(page).toHaveURL(/(\/|\/dashboard)$/, { timeout: 10000 });
  });

  test('Autentifikatsiyasiz foydalanuvchiga mobil login oynasi chiqishi va kirish jarayoni', async ({ page }) => {
    // 1. Yangi toza kontekstda token bilan sahifani ochish
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/mobile/sign/sample-unauth-test-token');

    // 2. Agar tizimga kirmagan bo'lsa, "Tizimga Kirish Talab Qilinadi" chiqishi kerak
    const loginCardTitle = page.locator(':text("Tizimga Kirish Talab Qilinadi")').first();
    await expect(loginCardTitle).toBeVisible({ timeout: 10000 });

    const usernameInput = page.locator('input[placeholder*="omborchi"]');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill('omborchi');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button:has-text("Tizimga Kirish va Imzolash")').click();
    await page.waitForTimeout(1000);
  });

  test('Haqiqiy Dinamik QR Sessiya: Mobil ekranda hujjat rekvizitlari va Biometrik tasdiqlash', async ({ page, request }) => {
    // 1. Backend orqali omborchi (Bosh Omborchi) sifatida login qilib JWT olish
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        username: 'omborchi',
        password: 'admin123',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    expect(token).toBeDefined();

    // 2. Dinamik QR Imzolash Sessiyasi ochish
    const docNumber = `E2E-TEST-${Date.now()}`;
    const initRes = await request.post('http://localhost:4000/api/signing-sessions/init', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        docType: 'OS-1_DELIVERY',
        docNumber,
        title: 'Kompyuter Jamlanmasi Topshirish Daktisi',
        itemSummary: 'Lenovo ThinkCentre M70q (Core i5, 16GB RAM)',
        targetSignerRole: 'HEAD_WAREHOUSE',
        targetSignerName: 'Toshmatov Omon',
      },
    });

    expect(initRes.ok()).toBeTruthy();
    const sessionData = await initRes.json();
    const sessionToken = sessionData.sessionToken;
    expect(sessionToken).toBeDefined();

    // 3. Tizimga kirilgan holda mobil sahifaga o'tish va geolokatsiya/biometrika sozlash
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 41.2995, longitude: 69.2401 });

    // CDP orqali virtual biometrik authenticator (TouchID / FaceID) yoqish
    try {
      const cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send('WebAuthn.enable');
      await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
    } catch {
      // Non-chromium fallbacks
    }

    await page.goto('/login');
    const loginInput = page.locator('input[placeholder*="omborchi"]');
    if (await loginInput.isVisible()) {
      await loginInput.fill('omborchi');
      await page.locator('input[placeholder="Parol"]').fill('admin123');
      await page.locator('button:has-text("Tizimga Kirish")').click();
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    }

    // 4. Mobil imzolash sahifasini ochish
    await page.goto(`/mobile/sign/${sessionToken}`);
    await page.waitForURL(`**/mobile/sign/${sessionToken}`, { timeout: 10000 });

    // 5. Hujjat rekvizitlari ekranda ko'rinishini tekshirish
    await expect(page.locator(`text=${docNumber}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(':text("Lenovo ThinkCentre"), :text("Kompyuter Jamlanmasi")').first()).toBeVisible();

    // 6. Yuridik ogohlantirish va GPS/Xavfsizlik yozuvi mavjudligi
    await expect(page.locator(':text("Xavfsizlik va Yuridik Audit"), :text("GPS")').first()).toBeVisible();

    // 7. Biometrik Tasdiqlash tugmasini bosish
    const biometricBtn = page.locator('button:has-text("TouchID"), button:has-text("Tasdiqlash")').first();
    await expect(biometricBtn).toBeVisible({ timeout: 5000 });
    await biometricBtn.click();

    // 8. Hujjat muvaffaqiyatli imzolanganligi holati chiqishi (yoki public verify tugmasi)
    await expect(
      page.locator(':text("Dalolatnoma Imzolandi!"), :text("Hujjat Imzolandi"), :text("muvaffaqiyatli"), button:has-text("Ommaviy Reyestrdan Tekshirish")').first(),
    ).toBeVisible({ timeout: 15000 });

    // 9. Ommaviy Reyestrdan Tekshirish tugmasi ko'rinishi
    await expect(
      page.locator('button:has-text("Ommaviy Reyestrdan Tekshirish"), button:has-text("Tekshirish")').first(),
    ).toBeVisible();
  });
});
