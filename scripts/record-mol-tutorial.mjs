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
  await page.waitForTimeout(400);
}

async function showStepSubtitle(page, { stepNum, totalSteps = 9, title, text, actionHint = '', durationMs = 4500 }) {
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
            UWMS • MAS’UL XODIMLAR (MOL) QO‘LLANMASI
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

async function initVisualHelpers(page) {
  await page.evaluate(() => {
    if (!document.getElementById('uwms-tutorial-styles')) {
      const style = document.createElement('style');
      style.id = 'uwms-tutorial-styles';
      style.textContent = `
        /* Professional Enterprise Subtitle Dock (Full HD 1920x1080, Ochroq Slate-Navy, 0px border-radius) */
        #uwms-tutorial-overlay {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translate(-50%, 14px);
          z-index: 2147483647;
          pointer-events: none;
          transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          opacity: 0;
          width: 1100px;
          max-width: 94vw;
        }

        .uwms-sub-card {
          /* Sal ochroq, o'qishga juda qulay zamonaviy slate-navy fon */
          background: rgba(28, 40, 62, 0.96);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-left: 6px solid #165DFF;
          border-radius: 0px !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px rgba(22, 93, 255, 0.25);
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
          background: #165DFF;
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
          background: rgba(22, 93, 255, 0.22);
          border-left: 3px solid #38bdf8;
          border-radius: 0px !important;
          font-size: 14px;
          color: #38bdf8;
          width: fit-content;
        }

        /* Virtual Mouse Cursor */
        #uwms-virtual-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 28px;
          height: 28px;
          pointer-events: none;
          z-index: 2147483647;
          transform: translate(-100px, -100px);
          transition: transform 0.04s linear;
        }

        .uwms-cursor-pointer {
          width: 20px;
          height: 20px;
          background: #165DFF;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 14px rgba(22, 93, 255, 0.95), 0 0 4px rgba(0, 0, 0, 0.4);
        }

        .uwms-click-ripple {
          position: fixed;
          border-radius: 50%;
          border: 2.5px solid #165DFF;
          pointer-events: none;
          z-index: 2147483646;
          animation: uwmsRipple 0.6s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }

        @keyframes uwmsRipple {
          0% {
            width: 0px;
            height: 0px;
            opacity: 1;
            transform: translate(-50%, -50%);
          }
          100% {
            width: 70px;
            height: 70px;
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

      window.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      });

      window.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        ripple.className = 'uwms-click-ripple';
        ripple.style.left = `${e.clientX}px`;
        ripple.style.top = `${e.clientY}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      });
    }
  });
}

// Smoothly move mouse to target coordinates
async function smoothMove(page, fromX, fromY, toX, toY, steps = 22) {
  for (let i = 1; i <= steps; i++) {
    const x = fromX + (toX - fromX) * (i / steps);
    const y = fromY + (toY - fromY) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(14);
  }
}

let currentMouseX = 100;
let currentMouseY = 100;

async function moveAndClick(page, selectorOrLocator) {
  const el = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await el.waitFor({ state: 'visible', timeout: 8000 });
  const box = await el.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await smoothMove(page, currentMouseX, currentMouseY, targetX, targetY, 22);
    currentMouseX = targetX;
    currentMouseY = targetY;
    await page.waitForTimeout(200);
    await page.mouse.click(targetX, targetY);
    await page.waitForTimeout(300);
  }
}

async function smoothType(page, selector, text) {
  await moveAndClick(page, selector);
  await page.waitForTimeout(150);
  await page.locator(selector).first().fill('');
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(30 + Math.random() * 20);
  }
}

async function closeAnyOpenModal(page) {
  for (let i = 0; i < 3; i++) {
    const visibleCount = await page.locator('.arco-modal:visible').count();
    if (visibleCount === 0) break;
    const closeBtn = page.locator('.arco-modal-wrapper:not([style*="display: none"]) .arco-modal-close-icon').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click().catch(() => {});
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
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

  const page = await context.newPage();
  recordingStartTime = Date.now();

  console.log('🎬 2. Login sahifasini ochish: http://localhost:5173/login');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);

  // KIRISH
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 9,
    title: 'UWMS — Mas’ul Xodimlar (Kafedra Mudirlari, Bo‘lim Boshliqlari, O‘qituvchilar, MOL)',
    text: 'Ushbu keng qamrovli video qo‘llanmada tizimning barcha asosiy sahifalari, modallari va headerdagi boshqaruv tugmalari to‘liq o‘rgatiladi.',
    actionHint: 'Tizim imkoniyatlari bilan tanishing',
    durationMs: 5000,
  });

  // 1-BOSQICH: Login
  console.log('🎬 3. 1-BOSQICH: Login');
  await showStepSubtitle(page, {
    stepNum: 1,
    totalSteps: 9,
    title: '1-BOSQICH: Tizimga kirish va avtorizatsiya',
    text: 'Xodim o‘z login (kafedra_mudiri) va maxfiy parolini kiritadi hamda "Tizimga Kirish" tugmasini bosadi.',
    actionHint: 'Login va parolni kiritib tizimga kiring',
    durationMs: 3500,
  });

  await smoothType(page, 'input[placeholder*="omborchi"]', 'kafedra_mudiri');
  await page.waitForTimeout(300);
  await smoothType(page, 'input[type="password"]', 'admin123');
  await page.waitForTimeout(400);

  await moveAndClick(page, 'button:has-text("Tizimga Kirish")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);

  // 2-BOSQICH: Headerdagi barcha rangli boshqaruv tugmalari
  console.log('🎬 4. 2-BOSQICH: Header boshqaruv tugmalari');

  // 2.1 Sidebar Collapse
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.1-BOSQICH: Yon panelni yig‘ish va kengaytirish (Sidebar)',
    text: 'Ushbu tugma yon menyuni yig‘ib, ekranda katta jadvallar va hisobotlar bilan ishlash maydonini kengaytiradi.',
    actionHint: 'Yuqori chapdagi menyu tugmasini bosing',
    durationMs: 3500,
  });

  const sidebarFoldBtn = page.locator('.uwms-header button').first();
  if (await sidebarFoldBtn.isVisible()) {
    await moveAndClick(page, '.uwms-header button');
    await page.waitForTimeout(1400);
    await moveAndClick(page, '.uwms-header button');
    await page.waitForTimeout(1000);
  }

  // 2.2 Global Search (Ctrl + K)
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.2-BOSQICH: Universal tezkor qidiruv (Ctrl + K)',
    text: 'Butun universitet bo‘yicha istalgan invertar raqami, xona, jihoz yoki xodimni bir zumda topish imkonini beradi.',
    actionHint: 'Qidiruv maydoniga bosing va universal modalni oching',
    durationMs: 4000,
  });

  await moveAndClick(page, '.uwms-header-search input');
  await page.waitForTimeout(1000);
  await initVisualHelpers(page);
  await page.waitForTimeout(2000);

  // Qidiruv modalini yopish
  await closeAnyOpenModal(page);

  // 2.3 + Yangi Tezkor Yaratish
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.3-BOSQICH: Tezkor yaratish menyusi (+ Yangi)',
    text: 'Istalgan sahifada turgan holda bir marta bosish orqali yangi talabnoma (zayavka) yaratish mumkin.',
    actionHint: 'Ko‘k rangli "+ Yangi" tugmasini bosing',
    durationMs: 3500,
  });

  const quickNewBtn = page.locator('.uwms-header-search button:has-text("Yangi")').first();
  if (await quickNewBtn.isVisible()) {
    await moveAndClick(page, '.uwms-header-search button:has-text("Yangi")');
    await page.waitForTimeout(2000);
    await page.mouse.click(currentMouseX - 100, currentMouseY);
    await page.waitForTimeout(500);
  }

  // 2.4 Tilni almashtirish (Language Switcher)
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.4-BOSQICH: Tizim tilini tanlash (O‘zbekcha, Ruscha, Inglizcha)',
    text: 'Tizim to‘liq ko‘p tilli bo‘lib, xodim o‘zi uchun qulay bo‘lgan tilni bir zumda tanlashi mumkin.',
    actionHint: 'Til tanlash menyusini bosing',
    durationMs: 3500,
  });

  const langBtn = page.locator('.uwms-header-actions .arco-dropdown-link, .uwms-header-actions button:has-text("UZ")').first();
  if (await langBtn.isVisible()) {
    await moveAndClick(page, '.uwms-header-actions .arco-dropdown-link, .uwms-header-actions button:has-text("UZ")');
    await page.waitForTimeout(1800);
    await page.mouse.click(currentMouseX - 100, currentMouseY);
    await page.waitForTimeout(500);
  }

  // 2.5 Tungi / Kunduzgi Rejim
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.5-BOSQICH: Tungi (Dark) va Kunduzgi (Light) rejim',
    text: 'Ko‘z charchashining oldini olish uchun yorug‘ yoki to‘q fon rejimiga bir tugma orqali o‘tish mumkin.',
    actionHint: 'Mavzu (Oy / Quyosh) tugmasini bosing',
    durationMs: 3500,
  });

  const themeBtn = page.locator('.uwms-header-actions button:has(.arco-icon-moon), .uwms-header-actions button:has(.arco-icon-sun)').first();
  if (await themeBtn.isVisible()) {
    await moveAndClick(page, '.uwms-header-actions button:has(.arco-icon-moon), .uwms-header-actions button:has(.arco-icon-sun)');
    await page.waitForTimeout(1400);
    await moveAndClick(page, '.uwms-header-actions button:has(.arco-icon-moon), .uwms-header-actions button:has(.arco-icon-sun)');
    await page.waitForTimeout(800);
  }

  // 2.6 Bildirishnomalar Markazi
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.6-BOSQICH: Jonli bildirishnomalar markazi (Qo‘ng‘iroqcha)',
    text: 'Talabnomalar holati, tasdiqlangan hujjatlar va eslatmalar real vaqtda shu yerda aks etadi.',
    actionHint: 'Qo‘ng‘iroqcha ikonkasi ustiga bosing',
    durationMs: 3500,
  });

  const notifyBtn = page.locator('.uwms-header-actions .arco-badge, .uwms-header-actions button:has(.arco-icon-notification)').first();
  if (await notifyBtn.isVisible()) {
    await moveAndClick(page, '.uwms-header-actions .arco-badge, .uwms-header-actions button:has(.arco-icon-notification)');
    await page.waitForTimeout(2000);
    await page.mouse.click(currentMouseX - 100, currentMouseY);
    await page.waitForTimeout(500);
  }

  // 2.7 Foydalanuvchi Profili va Chiqish
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2.7-BOSQICH: Mas’ul xodim profili va xavfsiz chiqish',
    text: 'Foydalanuvchining F.I.Sh., kafedrasi ko‘rsatiladi hamda qizil tugma orqali tizimdan xavfsiz chiqiladi.',
    actionHint: 'Profil ma’lumotlari va qizil chiqish tugmasi',
    durationMs: 3500,
  });

  const profileArea = page.locator('.uwms-header-actions .arco-avatar').first();
  if (await profileArea.isVisible()) {
    const box = await profileArea.boundingBox();
    if (box) {
      await smoothMove(page, currentMouseX, currentMouseY, box.x + box.width / 2, box.y + box.height / 2, 20);
      currentMouseX = box.x + box.width / 2; currentMouseY = box.y + box.height / 2;
      await page.waitForTimeout(1400);
    }
  }

  // 3-BOSQICH: Dashboard
  console.log('🎬 5. 3-BOSQICH: Dashboard');
  await showStepSubtitle(page, {
    stepNum: 3,
    totalSteps: 9,
    title: '3-BOSQICH: Asosiy boshqaruv paneli (Dashboard)',
    text: 'Kafedra yoki bo‘limga biriktirilgan jami aktivlar, xonalar soni va so‘nggi harakatlar tahlili.',
    actionHint: 'Kafedraning statistik ko‘rsatkichlarini ko‘zdan kechiring',
    durationMs: 4000,
  });

  await smoothMove(page, currentMouseX, currentMouseY, 400, 240, 22);
  currentMouseX = 400; currentMouseY = 240;
  await page.waitForTimeout(700);
  await smoothMove(page, currentMouseX, currentMouseY, 700, 240, 22);
  currentMouseX = 700; currentMouseY = 240;
  await page.waitForTimeout(700);
  await smoothMove(page, currentMouseX, currentMouseY, 1000, 240, 22);
  currentMouseX = 1000; currentMouseY = 240;
  await page.waitForTimeout(800);

  // 4-BOSQICH: Vazifalarim (Inbox)
  console.log('🎬 6. 4-BOSQICH: Vazifalarim');
  await showStepSubtitle(page, {
    stepNum: 4,
    totalSteps: 9,
    title: '4-BOSQICH: Vazifalarim (Inbox) — Mas’ul xodim topshiriqlari',
    text: 'Sizga topshirilayotgan aktivlarni qabul qilish dalolatnomalari va tasdiqlash vazifalari shu yerda jamlangan.',
    actionHint: 'Chap menyudan "Vazifalarim" sahifasiga o‘ting',
    durationMs: 4000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Vazifalarim")');
  await page.waitForURL('**/inbox', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(1200);

  // 4.1 Vazifalarim: Ko'rib chiqish va Qabul qilish tugmasi
  await showStepSubtitle(page, {
    stepNum: 4,
    totalSteps: 9,
    title: '4.1-BOSQICH: Ashyolarni tekshirish va Qabul qilish amali',
    text: 'Yashil/Ko‘k "Ko‘rib chiqish va Qabul qilish" tugmasi bosiladi. Ochilgan oynada vositalar ro‘yxati tekshirilib, dalolatnoma imzolanadi.',
    actionHint: '"Ko‘rib chiqish va Qabul qilish" tugmasini bosing',
    durationMs: 5000,
  });

  const inboxActionBtn = page.locator('.arco-card button.arco-btn-primary, button:has-text("Ko‘rib chiqish"), button:has-text("Qabul Qilish")').first();
  if (await inboxActionBtn.isVisible()) {
    await moveAndClick(page, '.arco-card button.arco-btn-primary, button:has-text("Ko‘rib chiqish"), button:has-text("Qabul Qilish")');
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(3000); // Foydalanuvchi modalni ko'rishi uchun

    // Modalni yopish
    await closeAnyOpenModal(page);
  }

  // 5-BOSQICH: Asosiy Vositalar (Assets) va Aktivlarni Topshirish
  console.log('🎬 7. 5-BOSQICH: Asosiy Vositalar');
  await showStepSubtitle(page, {
    stepNum: 5,
    totalSteps: 9,
    title: '5-BOSQICH: Asosiy vositalar reestri va QR-kod pasporti',
    text: 'Kafedra hisobidagi barcha kompyuter va texnikalar ro‘yxati. Har bir vositaning individual QR-kodi mavjud.',
    actionHint: 'Chap menyudan "Asosiy Vositalar" bandini tanlang',
    durationMs: 4000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Asosiy Vositalar")');
  await page.waitForURL('**/assets', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(1000);

  // Qidiruv va QR ko'rish
  const searchInput = page.locator('input[placeholder*="qidirish"]').first();
  if (await searchInput.isVisible()) {
    await smoothType(page, 'input[placeholder*="qidirish"]', 'Noutbuk');
    await page.waitForTimeout(1800);
    await searchInput.fill('');
    await page.waitForTimeout(800);
  }

  const qrIcon = page.locator('.arco-table-body .arco-icon-qrcode, .arco-table-body .arco-btn-text').first();
  if (await qrIcon.isVisible()) {
    await moveAndClick(page, '.arco-table-body .arco-icon-qrcode, .arco-table-body .arco-btn-text');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }

  // 5.1 Aktivlarni topshirish (Handover Wizard) tugmasi
  await showStepSubtitle(page, {
    stepNum: 5,
    totalSteps: 9,
    title: '5.1-BOSQICH: Aktivlarni boshqa shaxsga topshirish (MOL Almashinuvi)',
    text: 'Mas’ul xodim mehnat ta’tiliga chiqqanda yoki ashyoni boshqa o‘qituvchiga o‘tkazishda "Aktivlarni topshirish" tugmasi bosiladi va rasmiy dalolatnoma tuziladi.',
    actionHint: 'Yashil rangli "Aktivlarni topshirish" tugmasini bosing',
    durationMs: 5000,
  });

  const handoverBtn = page.locator('button:has-text("Aktivlarni topshirish")').first();
  if (await handoverBtn.isVisible()) {
    await moveAndClick(page, 'button:has-text("Aktivlarni topshirish")');
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(3500); // Wizard modalini ko'rish uchun pauza

    // Wizard modalini yopish
    await closeAnyOpenModal(page);
  }

  // 6-BOSQICH: Talabnomalar (Requests) — To'liq Yaratish va Batafsil
  console.log('🎬 8. 6-BOSQICH: Talabnomalar');
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 9,
    title: '6-BOSQICH: Yangi talabnomani to‘liq shakllantirish va yuborish',
    text: 'Kafedra ehtiyojlari uchun sarf materiallari (qog‘oz, toner) so‘rash va omborga rasman yuborish.',
    actionHint: '"Yangi Zayavka Yaratish" tugmasini bosing',
    durationMs: 4000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Talabnomalar")');
  await page.waitForURL('**/requests', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(1000);

  await moveAndClick(page, 'button:has-text("Yangi Zayavka Yaratish")');
  await page.waitForTimeout(1200);
  await initVisualHelpers(page);

  // Ehtiyoj asosini kiritish
  const purposeArea = page.locator('.arco-modal textarea').first();
  if (await purposeArea.isVisible()) {
    await smoothType(page, '.arco-modal textarea', '2026-o‘quv yili oraliq nazorat imtihonlari va kafedra o‘qituvchilari uchun zarur sarf materiallari');
    await page.waitForTimeout(1500);
  }

  // Mahsulot qo'shish (Yangi tovar rejimi)
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 9,
    title: '6.1-BOSQICH: Mahsulot nomini kiritish va ro‘yxatga qo‘shish',
    text: 'Mahsulot nomi (A4 SvetoCopy qog‘ozi) yozilib, miqdori belgilanadi va "+ Qo‘shish" tugmasi bosiladi.',
    actionHint: 'Mahsulotni savatchaga qo‘shing',
    durationMs: 4000,
  });

  // Yangi tovar radio tugmasini bosish
  const newRadio = page.locator('.arco-modal .arco-radio:has-text("Yangi tovar")').first();
  if (await newRadio.isVisible()) {
    await moveAndClick(page, '.arco-modal .arco-radio:has-text("Yangi tovar")');
    await page.waitForTimeout(500);

    const customNameInput = page.locator('.arco-modal input[placeholder*="Interaktiv doska"]').first();
    if (await customNameInput.isVisible()) {
      await smoothType(page, '.arco-modal input[placeholder*="Interaktiv doska"]', 'A4 SvetoCopy qog‘ozi (500 varaqli)');
      await page.waitForTimeout(500);
    }

    const addItemBtn = page.locator('.arco-modal button:has-text("Qo‘shish")').first();
    if (await addItemBtn.isVisible()) {
      await moveAndClick(page, '.arco-modal button:has-text("Qo‘shish")');
      await page.waitForTimeout(1000);
    }
  }

  // Talabnomani tasdiqlash va yuborish
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 9,
    title: '6.2-BOSQICH: Talabnomani rasman omborga yuborish',
    text: 'Pastdagi ko‘k rangli "Talabnomani Shakllantirish va Yuborish" tugmasi bosiladi va so‘rov zudlik bilan omborga yetkaziladi.',
    actionHint: '"Talabnomani Shakllantirish va Yuborish" tugmasini bosing',
    durationMs: 4500,
  });

  const submitRequestBtn = page.locator('.arco-modal button:has-text("Talabnomani Shakllantirish")').first();
  if (await submitRequestBtn.isVisible()) {
    await moveAndClick(page, '.arco-modal button:has-text("Talabnomani Shakllantirish")');
    await page.waitForTimeout(2000);
  }
  await closeAnyOpenModal(page);
  await page.waitForTimeout(1000);

  // 6.3 Batafsil tugmasi (7-Bosqichli Ta'minot Zanjiri)
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 9,
    title: '6.3-BOSQICH: "Batafsil" — 7-Bosqichli Jonli Xarid Zanjiri',
    text: 'Har bir talabnoma 7 bosqichli monitoring zanjiri (Yaratildi -> Tasdiqlandi -> Xarid -> Omborga qabul -> Mas’ulga tarqatildi) orqali to‘liq kuzatiladi.',
    actionHint: 'Talabnoma qatoridagi "Batafsil" tugmasini bosing',
    durationMs: 5500,
  });

  const batafsilBtn = page.locator('button:has-text("Batafsil")').first();
  await batafsilBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (await batafsilBtn.isVisible()) {
    await moveAndClick(page, batafsilBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(4000); // 7-bosqichli stepper ko'rinishi uchun to'liq pauza

    // Batafsil modalini yopish
    console.log('🎬 Batafsil modali yopilmoqda...');
    await closeAnyOpenModal(page);
  }

  // 7-BOSQICH: Ta’mirlash & Servis
  console.log('🎬 9. 7-BOSQICH: Ta’mirlash & Servis');
  await showStepSubtitle(page, {
    stepNum: 7,
    totalSteps: 9,
    title: '7-BOSQICH: Ta’mirlash & Servis jurnali',
    text: 'Kafedrada nosoz bo‘lib qolgan texnikalarni (kompyuter, printer) ta’mirlashga topshirish va injener servis xulosasini kuzatish.',
    actionHint: 'Chap menyudan "Ta’mirlash & Servis" sahifasiga o‘ting',
    durationMs: 4500,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Ta’mirlash")');
  await page.waitForURL('**/repairs', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(2000);

  // 8-BOSQICH: Spisanie (OS-4)
  console.log('🎬 10. 8-BOSQICH: Spisanie (OS-4)');
  await showStepSubtitle(page, {
    stepNum: 8,
    totalSteps: 9,
    title: '8-BOSQICH: Spisanie (OS-4) — Hisobdan chiqarish jurnali',
    text: 'Butunlay eskirgan va yaroqsiz ashyolarni universitet komissiyasi xulosasi bilan rasmiy balansdan chiqarish bo‘limi.',
    actionHint: 'Chap menyudan "Spisanie (OS-4)" sahifasiga o‘ting',
    durationMs: 4500,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Spisanie")');
  await page.waitForURL('**/write-offs', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(2000);

  // 9-BOSQICH: Tuzilma & Xonalar (Tree bosish bilan)
  console.log('🎬 11. 9-BOSQICH: Tuzilma & Xonalar');
  await showStepSubtitle(page, {
    stepNum: 9,
    totalSteps: 9,
    title: '9-BOSQICH: Tashkiliy tuzilma va Xonalar (Daraxtsimon Tree)',
    text: 'Chap tomondagi Daraxtsimon (Tree) tuzilma orqali barcha korpuslar, kafedralar va auditoriyalarni birma-bir ko‘rish mumkin.',
    actionHint: 'Chap tarafdagi daraxt (Tree) tugunini bosing',
    durationMs: 4500,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Tuzilma")');
  await page.waitForURL('**/organization', { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  await initVisualHelpers(page);
  await page.waitForTimeout(1500);

  // Daraxtsimon Tree ustiga bosish
  await showStepSubtitle(page, {
    stepNum: 9,
    totalSteps: 9,
    title: '9.1-BOSQICH: Bino va xonalar tarkibini ko‘rish',
    text: 'Bino yoki kafedra tanlanganda, o‘ng tomonda unga tegishli auditoriyalar, ularning mas’ul shaxsi (MOL) va undagi barcha ashyolar ko‘rinadi.',
    actionHint: 'Daraxtdan Bosh bino yoki kafedrani tanlang',
    durationMs: 4500,
  });

  const treeNode = page.locator('.arco-tree-node-title').nth(1);
  if (await treeNode.isVisible()) {
    await moveAndClick(page, treeNode);
    await page.waitForTimeout(2000);
  }
  const treeSubNode = page.locator('.arco-tree-node-title').nth(2);
  if (await treeSubNode.isVisible()) {
    await moveAndClick(page, treeSubNode);
    await page.waitForTimeout(2000);
  }

  // YAKUN
  console.log('🎬 12. Xulosa');
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 9,
    title: 'YAKUNIY BOSQICH: Qo‘llanma muvaffaqiyatli yakunlandi!',
    text: 'Kafedra mudirlari, bo‘lim boshliqlari, o‘qituvchilar va barcha mas’ul shaxslar UWMS orqali o‘z moddiy vositalarini to‘liq nazorat qilishlari mumkin.',
    actionHint: 'Omborchi, Buxgalter va Admin uchun alohida videolar taqdim etiladi',
    durationMs: 5000,
  });

  await hideSubtitle(page);

  console.log('🎬 13. Videoni saqlash...');
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

    const targetVideoPath = path.join(recordingsDir, 'video_qullanma_mol.webm');
    if (fs.existsSync(targetVideoPath)) {
      try { fs.unlinkSync(targetVideoPath); } catch (_) {}
    }
    fs.renameSync(path.join(recordingsDir, latestWebm), targetVideoPath);
    console.log(`✅ Video muvaffaqiyatli saqlandi: ${targetVideoPath}`);
  }

  // Generate .srt file
  const srtPath = path.join(recordingsDir, 'video_qullanma_mol.srt');
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
