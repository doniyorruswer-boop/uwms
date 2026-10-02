import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
import path from 'path';

// Subtitle entry structure for SRT generator
const subtitles = [];
let recordingStartTime = 0;

function formatSrtTime(ms) {
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const remainingAfterHours = ms % 3600000;
  const minutes = String(Math.floor(remainingAfterHours / 60000)).padStart(2, '0');
  const remainingAfterMinutes = remainingAfterHours % 60000;
  const seconds = String(Math.floor(remainingAfterMinutes / 1000)).padStart(2, '0');
  const milliseconds = String(remainingAfterMinutes % 1000).padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

async function hideSubtitle(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById('uwms-tutorial-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transform = 'translate(-50%, 14px)';
    }
  });
  await page.waitForTimeout(300);
}

async function showStepSubtitle(page, { stepNum, totalSteps = 15, title, text, actionHint = '', durationMs = 5200 }) {
  await hideSubtitle(page);

  const startMs = Date.now() - recordingStartTime;
  const endMs = startMs + durationMs;

  const stepBadgeText = stepNum ? `${stepNum}-BOSQICH / ${totalSteps}` : 'KIRISH';

  subtitles.push({
    index: subtitles.length + 1,
    startMs,
    endMs,
    step: stepBadgeText,
    title,
    text: actionHint ? `${text} (Amal: ${actionHint})` : text,
  });

  await page.evaluate(({ stepBadgeText, title, text, actionHint }) => {
    let overlay = document.getElementById('uwms-tutorial-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'uwms-tutorial-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="uwms-sub-card">
        <div class="uwms-sub-topline">
          <div class="uwms-sub-badge">${stepBadgeText}</div>
          <div class="uwms-sub-app-tag">
            <span class="uwms-pulse-dot"></span>
            UWMS • BOSH HISOBCHI (MODDIY BUXGALTER) QO‘LLANMASI
          </div>
        </div>
        <div class="uwms-sub-title">${title}</div>
        <div class="uwms-sub-desc">${text}</div>
        ${actionHint ? `<div class="uwms-sub-action"><b>AMAL:</b> ${actionHint}</div>` : ''}
      </div>
    `;

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      overlay.style.transform = 'translate(-50%, 0)';
    });
  }, { stepBadgeText, title, text, actionHint });

  await page.waitForTimeout(durationMs);
}

// Mouse coordinates
let currentMouseX = 960;
let currentMouseY = 540;

// Smoothly move mouse and update virtual cursor DOM element directly
async function smoothMove(page, fromX, fromY, toX, toY, steps = 24) {
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(fromX + (toX - fromX) * (i / steps));
    const y = Math.round(fromY + (toY - fromY) * (i / steps));
    await page.mouse.move(x, y);
    await page.evaluate(({ cx, cy }) => {
      const cur = document.getElementById('uwms-virtual-cursor');
      if (cur) {
        cur.style.transform = `translate(${cx - 13}px, ${cy - 13}px)`;
        cur.style.display = 'block';
        cur.style.opacity = '1';
      }
    }, { cx: x, cy: y });
    await page.waitForTimeout(14);
  }
  currentMouseX = toX;
  currentMouseY = toY;
}

// Move to element and click with visible ripple
async function moveAndClick(page, selectorOrLocator) {
  const el = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (box) {
    const targetX = Math.round(box.x + box.width / 2);
    const targetY = Math.round(box.y + box.height / 2);
    await smoothMove(page, currentMouseX, currentMouseY, targetX, targetY, 24);
    await page.waitForTimeout(180);

    // Show expanding click ripple
    await page.evaluate(({ rx, ry }) => {
      const ripple = document.createElement('div');
      ripple.className = 'uwms-click-ripple';
      ripple.style.left = `${rx}px`;
      ripple.style.top = `${ry}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, { rx: targetX, ry: targetY });

    await page.mouse.click(targetX, targetY);
    await page.waitForTimeout(350);
  }
}

// Move to element and hover with generous pause
async function moveAndHover(page, selectorOrLocator, pauseMs = 800) {
  const el = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  if (await el.isVisible().catch(() => false)) {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const box = await el.boundingBox();
    if (box) {
      const targetX = Math.round(box.x + box.width / 2);
      const targetY = Math.round(box.y + box.height / 2);
      await smoothMove(page, currentMouseX, currentMouseY, targetX, targetY, 20);
      await page.waitForTimeout(pauseMs);
    }
  }
}

// Smooth typing helper
async function smoothType(page, selector, text) {
  await moveAndClick(page, selector);
  await page.waitForTimeout(150);
  await page.locator(selector).first().fill('');
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(30 + Math.random() * 20);
  }
}

// Navigate using the left sidebar menu items
async function navigateSidebar(page, menuText) {
  const menuItem = page.locator(`.arco-menu-item:has-text("${menuText}")`).first();
  await menuItem.waitFor({ state: 'attached', timeout: 6000 });
  await menuItem.scrollIntoViewIfNeeded().catch(() => {});
  await moveAndClick(page, menuItem);
  await page.waitForTimeout(1000);
  await page.waitForLoadState('networkidle').catch(() => {});
}

// Close any open modal dialogs
async function closeAnyOpenModal(page) {
  for (let i = 0; i < 3; i++) {
    const visibleCount = await page.locator('.arco-modal:visible').count();
    if (visibleCount === 0) break;
    const closeBtn = page.locator('.arco-modal-wrapper:not([style*="display: none"]) .arco-modal-close-icon').first();
    if (await closeBtn.isVisible()) {
      await moveAndClick(page, closeBtn);
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

async function run() {
  const recordingsDir = path.resolve('recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  // Clear previous temporary videos
  const initialFiles = fs.readdirSync(recordingsDir);
  for (const file of initialFiles) {
    if (file.startsWith('page@') && file.endsWith('.webm')) {
      try { fs.unlinkSync(path.join(recordingsDir, file)); } catch (_) {}
    }
  }

  console.log('🎬 1. Brauzer ochilmoqda (Full HD 1920x1080)...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1920, height: 1080 },
    },
  });

  // Inject High-Visibility Neon Amber Virtual Mouse & Subtitle Styles into EVERY page
  await context.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      if (!document.getElementById('uwms-tutorial-styles')) {
        const style = document.createElement('style');
        style.id = 'uwms-tutorial-styles';
        style.textContent = `
          /* Enterprise Subtitle Dock (Full HD 1920x1080, Slate-Navy, 0px border-radius) */
          #uwms-tutorial-overlay {
            position: fixed;
            bottom: 28px;
            left: 50%;
            transform: translate(-50%, 14px);
            z-index: 2147483647;
            pointer-events: none;
            transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            width: 1120px;
            max-width: 95vw;
          }

          .uwms-sub-card {
            background: rgba(28, 40, 62, 0.96);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border: 1px solid rgba(148, 163, 184, 0.35);
            border-left: 6px solid #FF7D00;
            border-radius: 0px !important;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(255, 125, 0, 0.25);
            padding: 20px 28px;
            display: flex;
            flex-direction: column;
            gap: 7px;
          }

          .uwms-sub-topline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2px;
          }

          .uwms-sub-badge {
            background: #FF7D00;
            color: #ffffff;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            padding: 4px 12px;
            border-radius: 0px !important;
          }

          .uwms-sub-app-tag {
            color: #cbd5e1;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.6px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .uwms-pulse-dot {
            width: 8px;
            height: 8px;
            background: #00B42A;
            border-radius: 0px !important;
            box-shadow: 0 0 8px #00B42A;
          }

          .uwms-sub-title {
            color: #ffffff;
            font-size: 21px;
            font-weight: 800;
            line-height: 1.25;
            letter-spacing: -0.2px;
          }

          .uwms-sub-desc {
            color: #e2e8f0;
            font-size: 15.5px;
            line-height: 1.5;
            font-weight: 400;
          }

          .uwms-sub-action {
            margin-top: 4px;
            padding: 6px 14px;
            background: rgba(255, 125, 0, 0.20);
            border-left: 3px solid #FF7D00;
            border-radius: 0px !important;
            font-size: 14px;
            color: #ffaa55;
            width: fit-content;
          }

          /* Ultra-Visible Neon Amber Virtual Cursor */
          #uwms-virtual-cursor {
            position: fixed;
            top: 0;
            left: 0;
            width: 32px;
            height: 32px;
            pointer-events: none;
            z-index: 2147483647;
            transform: translate(960px, 540px);
            transition: transform 0.03s linear;
            display: block !important;
          }

          .uwms-cursor-pointer {
            width: 26px;
            height: 26px;
            background: #FF7D00;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 18px rgba(255, 125, 0, 1), 0 0 6px rgba(0, 0, 0, 0.8);
            position: relative;
          }

          .uwms-cursor-pointer::after {
            content: '';
            position: absolute;
            top: 7px;
            left: 7px;
            width: 6px;
            height: 6px;
            background: #ffffff;
            border-radius: 50%;
          }

          .uwms-click-ripple {
            position: fixed;
            border-radius: 50%;
            border: 3px solid #FF7D00;
            box-shadow: 0 0 14px rgba(255, 125, 0, 0.9);
            pointer-events: none;
            z-index: 2147483646;
            animation: uwmsRipple 0.65s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
          }

          @keyframes uwmsRipple {
            0% {
              width: 0px;
              height: 0px;
              opacity: 1;
              transform: translate(-50%, -50%);
            }
            100% {
              width: 85px;
              height: 85px;
              opacity: 0;
              transform: translate(-50%, -50%);
            }
          }
        `;
        document.head.appendChild(style);
      }

      if (!document.getElementById('uwms-virtual-cursor')) {
        const cursor = document.createElement('div');
        cursor.id = 'uwms-virtual-cursor';
        cursor.innerHTML = '<div class="uwms-cursor-pointer"></div>';
        document.body.appendChild(cursor);
      }
    });
  });

  const page = await context.newPage();
  recordingStartTime = Date.now();

  console.log('🎬 2. Login sahifasini ochish: http://localhost:5173/login');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Position mouse at center
  await smoothMove(page, 960, 540, 960, 480, 20);

  // ==========================================
  // KIRISH
  // ==========================================
  console.log('🎬 KIRISH');
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 14,
    title: 'UWMS — Bosh Hisobchi (Moddiy Buxgalter) Qo‘llanmasi',
    text: 'Ushbu qo‘llanmada har bir sahifa, barcha rangli boshqaruv tugmalari, moliya vizalari, OS-1 kirim, OS-2 chiqim, amortizatsiya va UzASBO davlat integratsiyasi to‘liq tushuntiriladi.',
    actionHint: 'Sichqoncha ko‘rsatkichini kuzating',
    durationMs: 5500,
  });

  // ==========================================
  // 1-BOSQICH: Login
  // ==========================================
  console.log('🎬 1-BOSQICH: Tizimga kirish (bosh_hisobchi)');
  await showStepSubtitle(page, {
    stepNum: 1,
    totalSteps: 14,
    title: '1-BOSQICH: Tizimga kirish va avtorizatsiya',
    text: 'Bosh hisobchi o‘z logini (bosh_hisobchi) va maxfiy parolini kiritadi hamda ko‘k rangli "Tizimga Kirish" tugmasini bosadi.',
    actionHint: 'Login va parolni kiritib tizimga kiring',
    durationMs: 4000,
  });

  await smoothType(page, 'input[placeholder*="omborchi"]', 'bosh_hisobchi');
  await page.waitForTimeout(200);
  await smoothType(page, 'input[type="password"]', 'admin123');
  await page.waitForTimeout(300);

  // Click blue button "Tizimga Kirish"
  await moveAndClick(page, 'button:has-text("Tizimga Kirish")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // ==========================================
  // 2-BOSQICH: Boshqaruv Paneli (Dashboard) & Header Asboblari
  // ==========================================
  console.log('🎬 2-BOSQICH: Dashboard va Yuqori Paneldagi Rangli Tugmalar');
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 14,
    title: '2-BOSQICH: Boshqaruv Paneli va Yuqori Rangli Asboblar',
    text: 'Yuqori paneldagi tezkor qidiruv (Ctrl+K), til tanlash, tungi rejim, bildirishnomalar hamda ko‘k rangli "+ Yangi Zayavka" va "Video Qo‘llanma" tugmalari.',
    actionHint: 'Yuqori boshqaruv tugmalarini ko‘zdan kechiring',
    durationMs: 5500,
  });

  // Hover over Header controls
  await moveAndHover(page, 'input[placeholder*="Qidirish"]', 700);
  await moveAndHover(page, 'button:has-text("+ Yangi Zayavka"), button:has-text("Yangi")', 700);
  await moveAndHover(page, 'button:has-text("Video Qo‘llanma")', 800);
  await moveAndHover(page, '.arco-btn:has(.arco-icon-moon), .arco-btn:has(.arco-icon-sun)', 600);

  // Hover over Financial KPI Hero Cards
  const kpiCards = page.locator('.arco-card, .uwms-stat-card');
  if (await kpiCards.count() > 0) {
    await moveAndHover(page, kpiCards.nth(0), 700);
    if (await kpiCards.count() > 1) {
      await moveAndHover(page, kpiCards.nth(1), 700);
    }
  }

  // Smooth scroll down to view charts
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollBy({ top: -380, behavior: 'smooth' }));
  await page.waitForTimeout(600);

  // ==========================================
  // 3-BOSQICH: Vazifalarim (Inbox) — Sidebar 2-menyu bosiladi!
  // ==========================================
  console.log('🎬 3-BOSQICH: Vazifalarim (Inbox)');
  await showStepSubtitle(page, {
    stepNum: 3,
    totalSteps: 14,
    title: '3-BOSQICH: Vazifalarim — Moliya Vizasi va Yangi Kirim Tasdig‘i',
    text: 'Sidebar orqali "Vazifalarim"ga o‘tiladi. Bu yerda buxgalter tasdiqlashi lozim bo‘lgan arizalar va ko‘k rangli "Ko‘rib chiqish" tugmasi joylashgan.',
    actionHint: 'Chap menyudan «Vazifalarim»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Vazifalarim');

  // Click on the action button in the first task row
  const inboxActionBtn = page.locator('button:has-text("Ko‘rib chiqish"), button:has-text("Tekshirish"), button:has-text("Tasdiqlash"), .arco-table-row .arco-btn-primary').first();
  if (await inboxActionBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, inboxActionBtn);
    await page.waitForTimeout(1800);

    // Hover over modal approval buttons
    const approveBtn = page.locator('.arco-modal button:has-text("Tasdiqlash"), .arco-modal button:has-text("Qabul qilish"), .arco-modal .arco-btn-primary').first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await moveAndHover(page, approveBtn, 900);
    }
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 4-BOSQICH: Asosiy Vositalar (QR) — Sidebar 3-menyu bosiladi!
  // ==========================================
  console.log('🎬 4-BOSQICH: Asosiy Vositalar (QR)');
  await showStepSubtitle(page, {
    stepNum: 4,
    totalSteps: 14,
    title: '4-BOSQICH: Asosiy Vositalar Reestri va Davlat Hisobi',
    text: 'Universitetning barcha aktivlari, ko‘k rangli "Aktivlarni Topshirish (OS-1)" vizardi, manbalar filtri va har bir ashyoning "QR Pasport" tugmasi.',
    actionHint: 'Chap menyudan «Asosiy Vositalar»ni bosing',
    durationMs: 5400,
  });

  await navigateSidebar(page, 'Asosiy Vositalar');

  // Click blue button "Aktivlarni Topshirish (OS-1)"
  const handoverBtn = page.locator('button:has-text("Aktivlarni Topshirish"), button:has-text("Topshirish")').first();
  if (await handoverBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, handoverBtn);
    await page.waitForTimeout(1800);
    await closeAnyOpenModal(page);
  }

  // Click blue button "QR Pasport" on first row
  const qrPassportBtn = page.locator('button:has-text("QR Pasport"), button:has-text("Pasport"), .arco-table-row .arco-btn:has(.arco-icon-scan)').first();
  if (await qrPassportBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, qrPassportBtn);
    await page.waitForTimeout(1600);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 5-BOSQICH: Ta’minot & Shartnomalar — Sidebar 4-menyu bosiladi!
  // ==========================================
  console.log('🎬 5-BOSQICH: Ta’minot & Shartnomalar');
  await showStepSubtitle(page, {
    stepNum: 5,
    totalSteps: 14,
    title: '5-BOSQICH: Ta’minot & Shartnomalar — Kontragentlar Reestri',
    text: 'G‘aznachilik shartnomalari, ta’minotchi korxonalar reestri va ko‘k rangli "+ Yangi Ta’minotchi" tugmasi orqali yangi kontragent kiritish oynasi.',
    actionHint: 'Chap menyudan «Ta’minot & Shartnomalar»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Ta’minot');

  // Click blue button "+ Yangi Ta’minotchi"
  const newSupplierBtn = page.locator('button:has-text("Yangi Ta’minotchi"), button:has-text("Qo‘shish")').first();
  if (await newSupplierBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, newSupplierBtn);
    await page.waitForTimeout(1600);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 6-BOSQICH: Talabnomalar (Zayavka) — Sidebar 5-menyu bosiladi!
  // ==========================================
  console.log('🎬 6-BOSQICH: Talabnomalar (Zayavka)');
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 14,
    title: '6-BOSQICH: Talabnomalar — Xarid Zanjiri va Moliya Bosqichlari',
    text: 'Kafedralar ehtiyoj arizalari, "+ Yangi Talabnoma" tugmasi hamda har bir talabnomaning ko‘k rangli "Batafsil" xarid monitoringi tugmasi.',
    actionHint: 'Chap menyudan «Talabnomalar»ni bosing',
    durationMs: 5400,
  });

  await navigateSidebar(page, 'Talabnomalar');

  // Click blue button "+ Yangi Talabnoma"
  const newRequestBtn = page.locator('button:has-text("Yangi Talabnoma")').first();
  if (await newRequestBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, newRequestBtn);
    await page.waitForTimeout(1600);
    await closeAnyOpenModal(page);
  }

  // Click blue button "Batafsil" on the first request
  const requestDetailsBtn = page.locator('button:has-text("Batafsil")').first();
  if (await requestDetailsBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, requestDetailsBtn);
    await page.waitForTimeout(2000);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 7-BOSQICH: Spisanie (OS-4) — Sidebar 6-menyu bosiladi!
  // ==========================================
  console.log('🎬 7-BOSQICH: Spisanie (OS-4)');
  await showStepSubtitle(page, {
    stepNum: 7,
    totalSteps: 14,
    title: '7-BOSQICH: Spisanie (OS-4) — Hisobdan Chiqarish Komissiyasi',
    text: 'Yaroqsiz vositalarni balansdan chiqarish. Bosh hisobchi komissiya a’zosi sifatida qoldiq qiymatni tekshiradi va ko‘k "Batafsil & Ovoz berish" orqali ovoz beradi.',
    actionHint: 'Chap menyudan «Spisanie (OS-4)»ni bosing',
    durationMs: 5400,
  });

  await navigateSidebar(page, 'Spisanie');

  // Click on the action button in the first write-off row
  const writeOffActionBtn = page.locator('button:has-text("Batafsil"), button:has-text("Ovoz berish"), button:has-text("Ko‘rish"), .arco-table-row .arco-btn-primary').first();
  if (await writeOffActionBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, writeOffActionBtn);
    await page.waitForTimeout(2000);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 8-BOSQICH: Amortizatsiya — Sidebar 7-menyu bosiladi!
  // ==========================================
  console.log('🎬 8-BOSQICH: Amortizatsiya');
  await showStepSubtitle(page, {
    stepNum: 8,
    totalSteps: 14,
    title: '8-BOSQICH: Amortizatsiya & Qoldiq Qiymat Dvigateli',
    text: 'Asosiy vositalarning oylik chiziqli eskirish hisob-kitobi. "Davriy Eskirishni Hisoblash" ko‘k kartasi hamda sub-hisoblar normasi jurnali (013 — 15%, 01 — 10%).',
    actionHint: 'Chap menyudan «Amortizatsiya»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Amortizatsiya');

  // Hover over the periodic calculation trigger card
  const depCardBtn = page.locator('button:has-text("Hisoblash"), button:has-text("Eskirish"), .arco-card .arco-btn-primary').first();
  if (await depCardBtn.isVisible().catch(() => false)) {
    await moveAndHover(page, depCardBtn, 1000);
  }

  // ==========================================
  // 9-BOSQICH: Bosh Hisobchi Daftari — Sidebar 8-menyu bosiladi!
  // ==========================================
  console.log('🎬 9-BOSQICH: Bosh Hisobchi Daftari (OS-1, OS-2, Eksport)');
  await showStepSubtitle(page, {
    stepNum: 9,
    totalSteps: 14,
    title: '9-BOSQICH: Bosh Hisobchi Daftari — Kirim Reestri (OS-1)',
    text: 'Sub-hisoblar (013, 071, 01) bo‘yicha davlat OS-1 kirim aktlari. Ko‘k rangli "OS-1 Hujjatini Ko‘rish" tugmasi bosilib, rasmiy davlat shakli tekshiriladi.',
    actionHint: 'Chap menyudan «Bosh Hisobchi Daftari»ni bosing',
    durationMs: 5500,
  });

  await navigateSidebar(page, 'Bosh Hisobchi Daftari');

  // Click on "OS-1 Hujjatini Ko‘rish" button in table
  const viewDocBtn = page.locator('button:has-text("OS-1"), button:has-text("Ko‘rish"), .arco-table-row .arco-btn-primary, .arco-table-row .arco-btn:has(.arco-icon-eye)').first();
  if (await viewDocBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, viewDocBtn);
    await page.waitForTimeout(2200);
    await closeAnyOpenModal(page);
  }

  // Click Tab 2: "MOL Qoldiqlari va Chiqim (OS-2)"
  const molTab = page.locator('div[role="tab"]:has-text("MOL"), div[role="tab"]:has-text("OS-2")').first();
  if (await molTab.isVisible().catch(() => false)) {
    await moveAndClick(page, molTab);
    await page.waitForTimeout(1400);

    // Click blue "Tafsilotlar" button on first MOL row
    const molDetailsBtn = page.locator('button:has-text("Tafsilotlar"), button:has-text("Ko‘rish"), .arco-table-row .arco-btn-primary').first();
    if (await molDetailsBtn.isVisible().catch(() => false)) {
      await moveAndClick(page, molDetailsBtn);
      await page.waitForTimeout(1800);
      await closeAnyOpenModal(page);
    }
  }

  // Click Tab 3: "Davlat Buxgalteriya Eksporti"
  const exportCenterTab = page.locator('div[role="tab"]:has-text("Eksport"), div[role="tab"]:has-text("UzASBO")').first();
  if (await exportCenterTab.isVisible().catch(() => false)) {
    await moveAndClick(page, exportCenterTab);
    await page.waitForTimeout(1400);

    // Hover over UzASBO / 1C cards
    const exportCard = page.locator('.arco-card').first();
    if (await exportCard.isVisible().catch(() => false)) {
      await moveAndHover(page, exportCard, 800);
    }
  }

  // ==========================================
  // 10-BOSQICH: Manbalar Hisoboti — Sidebar 9-menyu bosiladi!
  // ==========================================
  console.log('🎬 10-BOSQICH: Manbalar Hisoboti');
  await showStepSubtitle(page, {
    stepNum: 10,
    totalSteps: 14,
    title: '10-BOSQICH: Manbalar Hisoboti — Byudjet, Kontrakt va Grant',
    text: 'Moliyalashtirish manbalari (Davlat Byudjeti, To‘lov-Kontrakt maxsus hisobi, Rivojlantirish jamg‘armasi) kesimidagi xarajatlar tahlili va Excel yuklab olish tugmasi.',
    actionHint: 'Chap menyudan «Manbalar Hisoboti»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Manbalar Hisoboti');

  // Hover over funding stat cards & download button
  const excelDownloadBtn = page.locator('button:has-text("Excel"), button:has-text("Yuklab olish"), button:has-text("Export")').first();
  if (await excelDownloadBtn.isVisible().catch(() => false)) {
    await moveAndHover(page, excelDownloadBtn, 900);
  }

  // ==========================================
  // 11-BOSQICH: Tuzilma & Xonalar — Sidebar 10-menyu bosiladi!
  // ==========================================
  console.log('🎬 11-BOSQICH: Tuzilma & Xonalar');
  await showStepSubtitle(page, {
    stepNum: 11,
    totalSteps: 14,
    title: '11-BOSQICH: Tuzilma & Xonalar — Daraxtsimon Menyuni Boshqarish',
    text: 'Universitet binolari, fakultet va kafedralar iyerarxik daraxti (Tree). Daraxt tugmasi bosilib, kafedra va xonalarning moddiy mas’ullari ko‘rsatiladi.',
    actionHint: 'Chap menyudan «Tuzilma & Xonalar»ni bosing',
    durationMs: 5400,
  });

  await navigateSidebar(page, 'Tuzilma & Xonalar');

  // Click tree node on left panel to expand
  const treeNode = page.locator('.arco-tree-node-title, .arco-tree-node, .arco-collapse-item-header').first();
  if (await treeNode.isVisible().catch(() => false)) {
    await moveAndClick(page, treeNode);
    await page.waitForTimeout(1200);
  }

  // ==========================================
  // 12-BOSQICH: Kafedralar va Bo‘limlar Kvotasi — Sidebar 11-menyu bosiladi!
  // ==========================================
  console.log('🎬 12-BOSQICH: Kafedralar Kvotasi');
  await showStepSubtitle(page, {
    stepNum: 12,
    totalSteps: 14,
    title: '12-BOSQICH: Kafedralar Kvotasi — Oylik Sarf Limitlari Nazorati',
    text: 'Kafedralar oylik sarf-xarajat kvotalari, sarflangan summa, qoldiq limit va rangli progress barlar. Buxgalteriya smetadan ortiqcha xarajatlarga chek qo‘yadi.',
    actionHint: 'Chap menyudan «Kafedralar va Bo‘limlar Kvotasi»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Kafedralar');

  const quotaProgress = page.locator('.arco-progress, .arco-table-row').first();
  if (await quotaProgress.isVisible().catch(() => false)) {
    await moveAndHover(page, quotaProgress, 900);
  }

  // ==========================================
  // 13-BOSQICH: Integratsiyalar — HEMIS va UzASBO / 1C — Sidebar 12-menyu bosiladi!
  // User explicitly requested: "batafsil bulsin asbo joylashgan qismgacha kurastib qilib ber"
  // ==========================================
  console.log('🎬 13-BOSQICH: Integratsiyalar — HEMIS va UzASBO / 1C');
  await showStepSubtitle(page, {
    stepNum: 13,
    totalSteps: 14,
    title: '13-BOSQICH: Integratsiyalar — HEMIS va UzASBO / 1C Shlyuzi',
    text: 'Universitet aktivlari va 010/013 sub-hisoblarni Davlat G‘aznachiligi (DMBAT / UzASBO) va 1C:Korxona tizimiga eksport qilish markazi.',
    actionHint: 'Chap menyudan «Integratsiyalar»ni bosing',
    durationMs: 5400,
  });

  await navigateSidebar(page, 'Integratsiyalar');

  // Show Tab 1 (HEMIS status)
  const hemisTab = page.locator('div[role="tab"]:has-text("HEMIS")').first();
  if (await hemisTab.isVisible().catch(() => false)) {
    await moveAndClick(page, hemisTab);
    await page.waitForTimeout(1000);
  }

  // Switch to Tab 2: "1C / UzASBO Buxgalteriya Eksporti"
  const uzasboTab = page.locator('div[role="tab"]:has-text("UzASBO"), div[role="tab"]:has-text("1C")').first();
  if (await uzasboTab.isVisible().catch(() => false)) {
    await moveAndClick(page, uzasboTab);
    await page.waitForTimeout(1200);
  }

  // 13.1-BOSQICH: UzASBO XML shakllantirish tugmasini bosish
  await showStepSubtitle(page, {
    stepNum: '13.1',
    totalSteps: 14,
    title: '13.1-BOSQICH: UzASBO XML va Excel Hisobotini Shakllantirish',
    text: 'Hisobot davri (2026-10), Asosiy vositalar reestri (010/013) va Davlat standarti XML formati tanlanib, ko‘k rangli "Hisobotni Shakllantirish" tugmasi bosiladi.',
    actionHint: '«Hisobotni Shakllantirish» ko‘k tugmasini bosing',
    durationMs: 5500,
  });

  // Click blue button "Hisobotni Shakllantirish"
  const generateBtn = page.locator('button:has-text("Hisobotni Shakllantirish")').first();
  if (await generateBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, generateBtn);
    await page.waitForTimeout(2000);
  }

  // 13.2-BOSQICH: Davlat UzASBO XML natijasi va yuklab olish
  await showStepSubtitle(page, {
    stepNum: '13.2',
    totalSteps: 14,
    title: '13.2-BOSQICH: Davlat UzASBO XML Natijasi va Yuklab Olish',
    text: 'Generatsiya qilingan XML kod DMBAT UzASBO dasturiga to‘g‘ridan-to‘g‘ri import qilinadi. Buxgalter ko‘k "Faylni Yuklab Olish (.xml)" va "Nusxa Olish" tugmalaridan foydalanadi.',
    actionHint: 'XML kodini ko‘zdan kechiring va yuklab oling',
    durationMs: 5500,
  });

  // Scroll down to display the generated XML code block and download buttons
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await page.waitForTimeout(1200);

  const downloadFileBtn = page.locator('button:has-text("Yuklab Olish")').first();
  if (await downloadFileBtn.isVisible().catch(() => false)) {
    await moveAndHover(page, downloadFileBtn, 900);
  }

  const copyResultBtn = page.locator('button:has-text("Nusxa Olish")').first();
  if (await copyResultBtn.isVisible().catch(() => false)) {
    await moveAndHover(page, copyResultBtn, 700);
  }

  await page.evaluate(() => window.scrollBy({ top: -380, behavior: 'smooth' }));
  await page.waitForTimeout(600);

  // ==========================================
  // 14-BOSQICH: Audit Rejalari — Sidebar 13-menyu bosiladi!
  // ==========================================
  console.log('🎬 14-BOSQICH: Audit Rejalari');
  await showStepSubtitle(page, {
    stepNum: 14,
    totalSteps: 14,
    title: '14-BOSQICH: Audit Rejalari — INV-19 Solishtirma Qaydnoma',
    text: 'Yillik inventarizatsiya rejalari, komissiya a’zolari tarkibi va INV-19 solishtirma dalolatnomalari orqali haqiqiy qoldiqlar solishtiriladi.',
    actionHint: 'Chap menyudan «Audit Rejalari»ni bosing',
    durationMs: 5200,
  });

  await navigateSidebar(page, 'Audit Rejalari');

  const campaignRow = page.locator('.arco-table-row').first();
  if (await campaignRow.isVisible().catch(() => false)) {
    await moveAndHover(page, campaignRow, 900);
  }

  // ==========================================
  // BOSHQARUV PANELIGA QAYTISH & VIDEO QO‘LLANMA MODALI
  // ==========================================
  console.log('🎬 15. Boshqaruv Paneliga Qaytish & Video Qo‘llanma Modali');
  await navigateSidebar(page, 'Boshqaruv Paneli');
  await page.waitForTimeout(800);

  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 14,
    title: 'Boshqaruv Panelida "Video Qo‘llanma" Markazi',
    text: 'Dashboarddagi ko‘k rangli [▶ Video Qo‘llanma] tugmasi bosilib, Bosh Hisobchi darsligi, boblar bo‘yicha tezkor sakrash va boshqa rollarga o‘tish tushuntiriladi.',
    actionHint: '«Video Qo‘llanma» tugmasini bosing',
    durationMs: 5200,
  });

  const videoQollanmaBtn = page.locator('button:has-text("Video Qo‘llanma")').first();
  if (await videoQollanmaBtn.isVisible().catch(() => false)) {
    await moveAndClick(page, videoQollanmaBtn);
    await page.waitForTimeout(1600);

    // Hover over chapters in the video modal
    const modalChapter = page.locator('.arco-modal div:has-text("UzASBO va 1C Davlat Integratsiyasi")').last();
    if (await modalChapter.isVisible().catch(() => false)) {
      await moveAndHover(page, modalChapter, 1000);
    }
    await page.waitForTimeout(1500);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // YAKUN
  // ==========================================
  console.log('🎬 16. YAKUN: Xulosa');
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 14,
    title: 'YAKUN: Bosh Hisobchi Uchun Yakuniy Qoidalar',
    text: '1. Har bir kirim qonuniy faktura va shartnoma bilan; 2. Sub-hisoblar va eskirishni oylik uzluksiz yuritish; 3. UzASBO davlat tizimiga hisobotlarni o‘z vaqtida jo‘natish.',
    actionHint: 'E’tiboringiz uchun rahmat! (UWMS Tizimi)',
    durationMs: 5500,
  });

  await hideSubtitle(page);

  console.log('🎬 17. Videoni saqlash...');
  await page.close();
  await context.close();
  await browser.close();

  // Find the generated video file
  const files = fs.readdirSync(recordingsDir);
  const webmFiles = files.filter(f => f.endsWith('.webm') && f.startsWith('page@'));
  if (webmFiles.length > 0) {
    const latestWebm = webmFiles.sort((a, b) => {
      return fs.statSync(path.join(recordingsDir, b)).mtimeMs - fs.statSync(path.join(recordingsDir, a)).mtimeMs;
    })[0];

    const targetVideoPath = path.join(recordingsDir, 'video_qullanma_buhgalter.webm');
    if (fs.existsSync(targetVideoPath)) {
      try { fs.unlinkSync(targetVideoPath); } catch (_) {}
    }
    fs.renameSync(path.join(recordingsDir, latestWebm), targetVideoPath);
    console.log(`✅ Video muvaffaqiyatli saqlandi: ${targetVideoPath}`);
  }

  // Generate .srt file
  const srtPath = path.join(recordingsDir, 'video_qullanma_buhgalter.srt');
  let srtContent = '';
  subtitles.forEach((s) => {
    srtContent += `${s.index}\n`;
    srtContent += `${formatSrtTime(s.startMs)} --> ${formatSrtTime(s.endMs)}\n`;
    srtContent += `${s.step}: ${s.title}\n`;
    srtContent += `${s.text}\n\n`;
  });

  fs.writeFileSync(srtPath, srtContent, 'utf-8');
  console.log(`✅ Subtitr fayli saqlandi: ${srtPath}`);
}

run().catch((err) => {
  console.error('❌ Xatolik yuz berdi:', err);
  process.exit(1);
});
