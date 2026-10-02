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
  await page.waitForTimeout(350);
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
            UWMS • BOSH OMBOR MUDIRI (OMBORCHI) QO‘LLANMASI
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

// Smooth mouse move helper
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

  // ==========================================
  // KIRISH
  // ==========================================
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 9,
    title: 'UWMS — Bosh Ombor Mudiri (Omborchi) Uchun To‘liq Video Qo‘llanma',
    text: 'Ushbu qo‘llanmada ombor zaxiralarini boshqarish, tovar kirimi (OS-1), kafedralar talabnomalarini ijro etish, tovarlarni tarqatish va audit jarayonlari to‘liq o‘rgatiladi.',
    actionHint: 'Bosh ombor mudiri imkoniyatlari bilan tanishing',
    durationMs: 5500,
  });

  // ==========================================
  // 1-BOSQICH: Login
  // ==========================================
  console.log('🎬 3. 1-BOSQICH: Login');
  await showStepSubtitle(page, {
    stepNum: 1,
    totalSteps: 9,
    title: '1-BOSQICH: Tizimga kirish va avtorizatsiya',
    text: 'Bosh ombor mudiri o‘z logini (omborchi) va maxfiy parolini kiritadi hamda "Tizimga Kirish" tugmasini bosadi.',
    actionHint: 'Login va parolni kiritib tizimga kiring',
    durationMs: 4000,
  });

  await smoothType(page, 'input[placeholder*="omborchi"]', 'omborchi');
  await page.waitForTimeout(300);
  await smoothType(page, 'input[type="password"]', 'admin123');
  await page.waitForTimeout(400);

  await moveAndClick(page, 'button:has-text("Tizimga Kirish")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await initVisualHelpers(page);

  // ==========================================
  // 2-BOSQICH: Boshqaruv paneli (Dashboard)
  // ==========================================
  console.log('🎬 4. 2-BOSQICH: Boshqaruv Paneli');
  await showStepSubtitle(page, {
    stepNum: 2,
    totalSteps: 9,
    title: '2-BOSQICH: Boshqaruv Paneli — Ombor operativ ko‘rsatkichlari',
    text: 'Universitet bo‘yicha jami sarf zaxirasi (448 ta), kam qolgan tovarlar (Low Stock ogohlantirishlari) va ijrodagi talabnomalar real vaqtda aks etadi.',
    actionHint: 'Omborning operativ ko‘rsatkichlarini ko‘zdan kechiring',
    durationMs: 5000,
  });

  // Mouse hover over dashboard cards
  const statCard = page.locator('.arco-card').nth(3);
  if (await statCard.isVisible()) {
    const box = await statCard.boundingBox();
    if (box) await smoothMove(page, currentMouseX, currentMouseY, box.x + box.width / 2, box.y + box.height / 2, 20);
    await page.waitForTimeout(1200);
  }

  // ==========================================
  // 3-BOSQICH: Sarf Tovarlari & Qoldiq (/warehouse)
  // ==========================================
  console.log('🎬 5. 3-BOSQICH: Sarf Tovarlari & Qoldiq');
  await showStepSubtitle(page, {
    stepNum: 3,
    totalSteps: 9,
    title: '3-BOSQICH: Sarf Tovarlari & Qoldiq — Asosiy Ombor Reestri',
    text: 'Universitet omborlaridagi barcha materiallar (qog‘oz, toner, kanselyariya) ro‘yxati, minimal qoldiq chegaralari va joriy zaxira miqdori.',
    actionHint: 'Chap menyudan "Sarf Tovarlari & Qoldiq" bo‘limiga o‘ting',
    durationMs: 5000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Sarf Tovarlari & Qoldiq")');
  await page.waitForURL('**/warehouse', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await initVisualHelpers(page);

  // Filter tabs click: "Kam Qolganlar"
  const lowStockTab = page.locator('button:has-text("Kam Qolganlar")').first();
  if (await lowStockTab.isVisible()) {
    await moveAndClick(page, lowStockTab);
    await page.waitForTimeout(1500);
  }
  // Back to "Barchasi"
  const allStockTab = page.locator('button:has-text("Barchasi")').first();
  if (await allStockTab.isVisible()) {
    await moveAndClick(page, allStockTab);
    await page.waitForTimeout(1200);
  }

  // ==========================================
  // 3.1-BOSQICH: Ta’minotchidan Kirim (OS-1) Modali
  // ==========================================
  console.log('🎬 6. 3.1-BOSQICH: Ta’minotchidan Kirim');
  await showStepSubtitle(page, {
    stepNum: 3,
    totalSteps: 9,
    title: '3.1-BOSQICH: Ta’minotchidan Yangi Tovar Kirimi (OS-1 Kirim Hujjati)',
    text: 'Yangi xarid qilingan tovarlarni qabul qilish oynasi. Ombor, ta’minotchi, schyot-faktura raqami va mahsulotlar kiritiladi. Saqlangach, qoldiq avtomatik oshadi.',
    actionHint: '"Ta’minotchidan Kirim (OS-1)" tugmasini bosing',
    durationMs: 5500,
  });

  const kirimBtn = page.locator('button:has-text("Ta’minotchidan Kirim")').first();
  if (await kirimBtn.isVisible()) {
    await moveAndClick(page, kirimBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(2500);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 3.2-BOSQICH: Omborlararo Ko‘chirish
  // ==========================================
  console.log('🎬 7. 3.2-BOSQICH: Omborlararo Ko‘chirish');
  await showStepSubtitle(page, {
    stepNum: 3,
    totalSteps: 9,
    title: '3.2-BOSQICH: Omborlararo Ko‘chirish (Inter-Warehouse Transfer)',
    text: 'Markaziy omborxona va filial sarf omborlari o‘rtasida tovarlarni siljitish. Tranzaksiya orqali balans va audit tarixi buzilmasdan saqlanadi.',
    actionHint: '"Omborlararo Ko‘chirish" tugmasini bosing',
    durationMs: 5000,
  });

  const transferBtn = page.locator('button:has-text("Omborlararo Ko‘chirish")').first();
  if (await transferBtn.isVisible()) {
    await moveAndClick(page, transferBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(2500);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 4-BOSQICH: Talabnomalar (Requests)
  // ==========================================
  console.log('🎬 8. 4-BOSQICH: Talabnomalar');
  await showStepSubtitle(page, {
    stepNum: 4,
    totalSteps: 9,
    title: '4-BOSQICH: Kafedralar Talabnomalari (Zayavkalar)',
    text: 'Fakultet va kafedralardan sarf materiallari olish uchun kelib tushgan so‘rovlar. Bosh hisobchi tasdiqlagach, omborchiga ijro uchun yetib keladi.',
    actionHint: 'Chap menyudan "Talabnomalar (Zayavka)" bo‘limiga o‘ting',
    durationMs: 5000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Talabnomalar")');
  await page.waitForURL('**/requests', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await initVisualHelpers(page);

  // ==========================================
  // 4.1-BOSQICH: Talabnoma Tafsilotlari va 7-Bosqichli Ijro Zanjiri
  // ==========================================
  console.log('🎬 9. 4.1-BOSQICH: Talabnoma Ijrosi va Zanjir');
  await showStepSubtitle(page, {
    stepNum: 4,
    totalSteps: 9,
    title: '4.1-BOSQICH: Talabnomani Ijro Etish va 7-Bosqichli Monitoring',
    text: 'Omborchi arizani ko‘rib chiqib, ombordan kerakli miqdorda tovar ajratadi (FULFILL). Qoldiq avtomatik kamayadi va tarqatish nakladnoyi shakllanadi.',
    actionHint: 'Talabnoma qatoridagi "Batafsil" tugmasini bosing',
    durationMs: 5500,
  });

  const detailBtn = page.locator('button:has-text("Batafsil")').first();
  if (await detailBtn.isVisible()) {
    await moveAndClick(page, detailBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(2800);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 5-BOSQICH: Kirim / Siljish Tarixi (/movements)
  // ==========================================
  console.log('🎬 10. 5-BOSQICH: Kirim / Siljish Tarixi');
  await showStepSubtitle(page, {
    stepNum: 5,
    totalSteps: 9,
    title: '5-BOSQICH: Kirim / Siljish Tarixi (Audit Log)',
    text: 'Universitetda sodir bo‘lgan barcha ombor harakatlari: Kirim, Kafedraga berish, Spisanie va Ko‘chirish operatsiyalarining rasmiy jurnali.',
    actionHint: 'Chap menyudan "Kirim / Siljish Tarixi" bo‘limiga o‘ting',
    durationMs: 5000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Kirim / Siljish Tarixi")');
  await page.waitForURL('**/movements', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await initVisualHelpers(page);

  // Move mouse over movements list
  const movementRow = page.locator('table tbody tr').first();
  if (await movementRow.isVisible()) {
    const box = await movementRow.boundingBox();
    if (box) await smoothMove(page, currentMouseX, currentMouseY, box.x + 300, box.y + 20, 20);
    await page.waitForTimeout(1500);
  }

  // ==========================================
  // 6-BOSQICH: Ta’minot & Shartnomalar (/suppliers)
  // ==========================================
  console.log('🎬 11. 6-BOSQICH: Ta’minot & Shartnomalar');
  await showStepSubtitle(page, {
    stepNum: 6,
    totalSteps: 9,
    title: '6-BOSQICH: Ta’minot & Shartnomalar (Kontragentlar)',
    text: 'Universitetga mahsulot yetkazib beruvchi korxonalar reestri, shartnoma raqamlari, hisobvaraq-fakturalar va yetkazilgan tovarlar hajmi.',
    actionHint: 'Chap menyudan "Ta’minot & Shartnomalar" sahifasiga o‘ting',
    durationMs: 4800,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Ta’minot & Shartnomalar")');
  await page.waitForURL('**/suppliers', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await initVisualHelpers(page);

  // ==========================================
  // 7-BOSQICH: Asosiy Vositalar (QR) (/assets)
  // ==========================================
  console.log('🎬 12. 7-BOSQICH: Asosiy Vositalar & QR');
  await showStepSubtitle(page, {
    stepNum: 7,
    totalSteps: 9,
    title: '7-BOSQICH: Asosiy Vositalar Reestri va QR-Stikerlar',
    text: 'Omborga yangi kelgan kompyuter va texnikalarga universitet inventar raqami beriladi hamda rasmiy QR-kodli yorliq (stiker) chop etiladi.',
    actionHint: 'Chap menyudan "Asosiy Vositalar" sahifasiga o‘ting',
    durationMs: 5000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Asosiy Vositalar")');
  await page.waitForURL('**/assets', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await initVisualHelpers(page);

  // Click QR button on the first row to show QR sticker modal
  const qrBtn = page.locator('table button:has-text("QR")').first();
  if (await qrBtn.isVisible()) {
    await moveAndClick(page, qrBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(2500);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // 8-BOSQICH: QR Inventarizatsiya (/audit)
  // ==========================================
  console.log('🎬 13. 8-BOSQICH: QR Inventarizatsiya');
  await showStepSubtitle(page, {
    stepNum: 8,
    totalSteps: 9,
    title: '8-BOSQICH: QR Inventarizatsiya — Tezkor Ombor Sanog‘i',
    text: 'Shtrix-kod yoki QR skaner yordamida ombordagi mahsulotlarni bir soniyada solishtirish va faktik qoldiqni tasdiqlash moduli.',
    actionHint: 'Chap menyudan "QR Inventarizatsiya" bo‘limiga o‘ting',
    durationMs: 4800,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("QR Inventarizatsiya")');
  await page.waitForURL('**/audit', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);
  await initVisualHelpers(page);

  // ==========================================
  // 9-BOSQICH: Dashboard Headeri va «Video Qo‘llanma» Tugmasi
  // ==========================================
  console.log('🎬 14. 9-BOSQICH: Header va Video Qollanma');
  await showStepSubtitle(page, {
    stepNum: 9,
    totalSteps: 9,
    title: '9-BOSQICH: Tezkor Boshqaruv va «Video Qo‘llanma» Tugmasi',
    text: 'Boshqaruv panelida tezkor harakatlar va istalgan vaqtda tizim bo‘yicha qo‘llanmani ochish uchun maxsus "Video Qo‘llanma" tugmasi mavjud.',
    actionHint: 'Boshqaruv panelidagi "Video Qo‘llanma" tugmasini bosing',
    durationMs: 5000,
  });

  await moveAndClick(page, '.arco-menu-item:has-text("Boshqaruv Paneli")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await initVisualHelpers(page);

  // Click the new "Video Qo‘llanma" button!
  const videoQollanmaBtn = page.locator('button:has-text("Video Qo‘llanma")').first();
  if (await videoQollanmaBtn.isVisible()) {
    await moveAndClick(page, videoQollanmaBtn);
    await page.waitForTimeout(1500);
    await initVisualHelpers(page);
    await page.waitForTimeout(2800);
    await closeAnyOpenModal(page);
  }

  // ==========================================
  // YAKUN
  // ==========================================
  console.log('🎬 15. YAKUN: Xulosa');
  await showStepSubtitle(page, {
    stepNum: null,
    totalSteps: 9,
    title: 'YAKUN: Bosh Ombor Mudiri Uchun Yakuniy Qoidalar',
    text: '1. Tovarlarni faqat tasdiqlangan talabnoma bilan bering; 2. Har bir kirimni vaqtida rasmiylashtiring; 3. Minimal qoldiqni doimo nazorat qiling.',
    actionHint: 'E’tiboringiz uchun rahmat! (UWMS Tizimi)',
    durationMs: 5500,
  });

  await hideSubtitle(page);

  console.log('🎬 16. Videoni saqlash...');
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

    const targetVideoPath = path.join(recordingsDir, 'video_qullanma_omborchi.webm');
    if (fs.existsSync(targetVideoPath)) {
      try { fs.unlinkSync(targetVideoPath); } catch (_) {}
    }
    fs.renameSync(path.join(recordingsDir, latestWebm), targetVideoPath);
    console.log(`✅ Video muvaffaqiyatli saqlandi: ${targetVideoPath}`);
  }

  // Generate .srt file
  const srtPath = path.join(recordingsDir, 'video_qullanma_omborchi.srt');
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
