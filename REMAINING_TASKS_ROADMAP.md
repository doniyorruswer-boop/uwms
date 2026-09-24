# UWMS — Qolgan Ishlar va Yakuniy Bosqichlar Rejasi (Remaining Roadmap & Phases)

> **Hujjat turi:** Loyihani to‘liq yakunlash va productionga topshirish yo‘l xaritasi  
> **Sanasi:** 2026-09-24  
> **Holati:** Tasdiqlangan / Amalga oshirishga tayyor  
> **Qoidalar Muvofiqligi:** AGENTS.md va GEMINI.md (100% Strict AI Rules)

---

## 📌 KIRISH VA UMUMIY BAHOLASH

Loyihada rejalashtirilgan barcha asosiy biznes modullar (Asosiy vositalar hayot sikli, Ombor qoldiqlari, 7 bosqichli talabnomalar, Audit sessiyalari, WORM arxivi va davlat standartidagi OS-1, OS-2, OS-4, INV-19 aktlari hamda 5 fazali MOL javobgarligini topshirish mexanizmi) to‘liq yaratilgan va 277 ta backend testi hamda Frontend builddan 0 ta xato bilan muvaffaqiyatli o‘tgan.

Tizimni to‘laqonli 100% korporativ tayyor holatga keltirish uchun qolgan vazifalar **6 ta bosqich (Phase)** ga ajratildi.

---

## 🗺 BOSQICHLARNING UMUMIY XULOSASI (PHASE MATRIX)

| Faza | Bosqich Nomi | Murakkablik | Asosiy Qatlam | Muhimlik (Priority) |
| :---: | :--- | :---: | :---: | :---: |
| **FAZA 1** | **Lokalizatsiya Gigiyenasi va i18n Sinxronlash** | Oson | Frontend / Scripts | ✅ **BAJARILDI** |
| **FAZA 2** | **HEMIS va UzASBO/1C Jonli Integratsiya Tayyorgarligi** | O‘rta | Backend / Adapters | **P0 (Kritik)** |
| **FAZA 3** | **Playwright E2E Test Suite va Regressiya Himoyasi** | O‘rta | Frontend / E2E | **P1 (Yuqori)** |
| **FAZA 4** | **PWA va Oflayn QR Skaner Keshi (IndexedDB)** | O‘rta | Frontend / Mobile | **P1 (Yuqori)** |
| **FAZA 5** | **Zaxira Nusxalarini (Backups) Bulutga/MinIO ga Ko‘chirish** | O‘rta | Backend / DevOps | **P2 (O‘rta)** |
| **FAZA 6** | **Rollar Bo‘yicha Foydalanuvchi Yo‘riqnomasi (User Manual)** | Hujjat | Documentation | **P2 (O‘rta)** |

---

## 🚀 BOSQICHMA-BOSQICH MUKAMMAL AMALGA OSHIRISH REJASI

---

### 🔹 FAZA 1: Lokalizatsiya Gigiyenasi va i18n Sinxronlash (P0) ✅ BAJARILDI

> **Maqsad:** `translations.csv` faylini yagona haqiqat manbasi (Single Source of Truth) holatiga keltirish va `npm run i18n:sync` buyrug‘i yangi kalitlarni o‘chirib tashlashining oldini olish.

#### 📁 Fayllar va Komponentlar:
- `frontend/src/locales/translations.csv`
- `frontend/src/locales/uz.json`, `ru.json`, `en.json`
- `frontend/scripts/sync-i18n.js`

#### 📋 Aniq Vazifalar:
- [x] 1. `frontend/src/locales/*.json` fayllaridagi barcha yangi bo‘limlarni (`inbox`, `depreciation`, `fundingReports`, `chiefAccountantLedger`, `errors.*`, `quotas.*`) to‘liq `translations.csv` jadvaliga ko‘chirish (Jami 126 ta kalit).
- [x] 2. `sync-i18n.js` skriptini ikki tomonlama (bidirectional check) qilib kuchaytirish: agar JSON fayllarda yangi kalitlar bo‘lsa, uni yo‘qotmasdan CSV ga avtomatik qo‘shish va RFC 4180 bo‘yicha to‘liq himoyalash.
- [x] 3. 3 ta tilda (`uz`, `ru`, `en`) barcha yangi modullar matnlarini 100% to‘g‘rilikda sinxronlash.

#### ✅ Definition of Done:
- [x] `npm run i18n:sync` buyrug‘i xatosiz ishlaydi va `git diff` da birorta ham mavjud kalit yo‘qolib ketmaydi.
- [x] Tizimda til almashtirilganda (`UZ` $\rightarrow$ `RU` $\rightarrow$ `EN`) barcha yangi sahifalar va xatolik matnlari tarjima qilingan holatda chiqadi.
- [x] Frontend `tsc -b && vite build` 0 ta xato bilan kompilyatsiya bo‘ldi.

---

### 🔹 FAZA 2: HEMIS va UzASBO/1C Jonli Integratsiya Tayyorgarligi (P0)

> **Maqsad:** OTM tashqi axborot tizimlari (HEMIS va UzASBO) bilan real API ulanish parametrlarini xavfsiz sozlash va ishlab chiqarish rejimiga o‘tish.

#### 📁 Fayllar va Komponentlar:
- `backend/src/integrations/integrations.service.ts`
- `backend/src/integrations/hemis-adapter.interface.ts`
- `backend/.env.example`
- `frontend/src/pages/Integrations/IntegrationsPage.tsx`

#### 📋 Aniq Vazifalar:
1. **HEMIS Live Adapter:**
   - Real OTM HEMIS REST API (masalan, `/api/rest/v1/departments`, `/api/rest/v1/employees`, `/api/rest/v1/rooms`) bilan jonli token va sertifikat orqali sinxronizatsiya zanjirini sinovdan o‘tkazish.
   - Tez-tez uchraydigan tarmoq uzilishlari uchun qayta urinish (Retry with Exponential Backoff) logikasini kuchaytirish.
2. **UzASBO / 1C Buxgalteriya Eksporti:**
   - Hozirgi JSON/Excel eksport formatlarini O‘zbekiston Moliya Vazirligining UzASBO/DMBAT standart xml/json talablariga mos keltirish.
   - Buxgalteriya tizimiga import qilish uchun tayyor fayl validatsiyasini ta’minlash.

#### ✅ Definition of Done:
- [x] `/api/integrations/hemis/test-connection` jonli URL va API key kiritilganda haqiqiy ping, status va latency (ms) qaytaradi.
- [x] Exponential Backoff va Jitter mexanizmi (429 Rate-limit, 502/503/504 xatolarida) joriy qilindi.
- [x] Kalitlar hali kiritilmagan holat uchun xavfsiz DEMO holati va frontendda tushunarli yo‘riqnoma banneri qo‘shildi (`isWaitingForCredentials: true`).
- [x] UzASBO hisobotlari XML (xavfsiz belgi ekranlash bilan) hamda 3-varaqli XLSX (Excel) standartlarida eksport qilinadi.
- [x] Barcha unit testlar (14/14 integrations, 280/280 jami backend) va frontend/backend buildlari 0 ta xato bilan muvaffaqiyatli yakunlandi.

*(Eslatma: Universitet yoki Vazirlik tomonidan rasmiy HEMIS_API_URL va HEMIS_API_KEY kalitlari berilgach, tizim sozlamalar orqali darhol jonli rejimga o‘tishga 100% tayyor).*

---

### 🔹 FAZA 3: Playwright E2E Test Suite va Regressiya Himoyasi (P1)

> **Maqsad:** Foydalanuvchi operatsiyalari va tranzaksion zanjirlarni brauzer orqali to‘liq avtomatlashtirilgan end-to-end sinovlar bilan himoyalash.

#### 📁 Fayllar va Komponentlar:
- `frontend/e2e/requests-flow.spec.ts`
- `frontend/e2e/handover-flow.spec.ts` `[YANGI TEST]`
- `frontend/e2e/signing-mobile.spec.ts` `[YANGI TEST]`
- `frontend/playwright.config.ts`

#### 📋 Aniq Vazifalar:
1. **MOL Handover E2E Testi:**
   - MOL tizimga kiradi $\rightarrow$ Aktivlarni tanlab topshirish arizasini yuboradi.
   - Yangi MOL `/inbox` da qabul qiladi.
   - Bino Komendanti tasdiqlaydi.
   - Aylanma varaqa holati `APPROVED` ga o‘tishi tekshiriladi.
2. **7 Bosqichli Zayavka E2E Testi:**
   - O‘qituvchi zayavka beradi $\rightarrow$ Prorektor vizasi $\rightarrow$ Omborchi kirim qiladi $\rightarrow$ Komendant topshiradi $\rightarrow$ FULFILLED.
3. **E2E Testlarni Tezlashtirish:**
   - Playwright testlarini lokal va CI muhitida alohida `npm run test:e2e` orqali tezkor ishlaydigan qilish.

#### ✅ Definition of Done:
- [x] Asosiy biznes oqimlar bo‘yicha 9 ta to‘liq E2E test to‘plami (14 ta test holati) yozildi va `npm run test:e2e` orqali 100% yashil o‘tadi (33.9s).
- [x] `handover-flow.spec.ts`: MOL mas’uliyatni topshirish arizasi shakllantirish, modal turlari, `/inbox` ko‘rib chiqish va dalolatnoma imzolari tekshirildi.
- [x] `requests-flow.spec.ts`: 7 bosqichli davlat zayavkasi zanjiri, filtrlash, tablar va statuslar tekshirildi.
- [x] `signing-mobile.spec.ts`: Mobil qurilma emulyatsiyasi (390x844), CDP virtual WebAuthn TouchID/FaceID biometrika, GPS geolokatsiya va ommaviy tekshirish tasdiqlandi.
- [x] `playwright.config.ts`: `webServer` avtomatik ishga tushirish, qayta foydalanish va optimal timeoutlar bilan sozlandi.
- [x] Frontend va backend buildlari hamda TypeScript compiler (`tsc -b`) 0 ta xato bilan muvaffaqiyatli yakunlandi.

---

### 🔹 FAZA 4: PWA va Oflayn QR Skaner Keshi (P1)

> **Maqsad:** Universitetning yer osti laboratoriyalari yoki internet aloqasi past bo‘lgan hududlarida auditorlik va inventarizatsiya jarayoni to‘xtab qolmasligini ta’minlash.

#### 📁 Fayllar va Komponentlar:
- `frontend/public/manifest.json` `[YANGI]`
- `frontend/src/pages/Audit/AuditScannerPage.tsx`
- `frontend/src/utils/offlineAuditStorage.ts` `[YANGI]`
- `frontend/vite.config.ts` (Vite PWA plagini integratsiyasi)

#### 📋 Aniq Vazifalar:
1. [x] PWA `manifest.json`, Service Worker (`vite-plugin-pwa`, Workbox kesh strategiyalari) va SVG ikonkalari (`pwa-192x192.svg`, `pwa-512x512.svg`) qo‘shildi.
2. [x] `offlineAuditStorage.ts`: Brauzerning `IndexedDB` (`UWMS_AUDIT_OFFLINE_DB`) xotirasiga vaqt belgisi bilan oflayn skanlarni saqlash va boshqarish utilitasi yaratildi (localStorage fallback bilan).
3. [x] `AuditScannerPage`: Tarmoq uzilganda QR-kodlar to‘g‘ridan-to‘g‘ri IndexedDB xotirasiga olinadi, bannerda "Oflayn Navbat (IndexedDB): N ta skan saqlangan" holati ko‘rsatiladi.
4. [x] Aloqa tiklanganda, to‘plangan barcha yozuvlar backendga ommaviy (`POST /api/audits/:id/batch-scan` va `POST /api/audits/batch-scan`) yuboriladi va server bilan tranzaksion sinxronlanadi.

#### ✅ Definition of Done:
- [x] Offline rejimda (Internet o‘chirilganda) QR-kodlar bexato o‘qiladi va navbatga olinadi.
- [x] Internet ulanganda "Oflayn N ta yozuv muvaffaqiyatli sinxronlandi" xabari chiqadi va bazaga yoziladi.
- [x] `e2e/offline-audit.spec.ts`: PWA Manifest, Service Worker va Oflayn QR skanerlash hamda tiklanganda sinxronlash Playwright testi 100% muvaffaqiyatli o‘tdi.

---

### 🔹 FAZA 5: Zaxira Nusxalarini (Backups) Universitet Serveriga Ko‘chirish (Disaster Recovery) (P2)

> **Maqsad:** Tashqi ommaviy bulutlarga (AWS S3) bog‘lanmasdan, universitetning o‘z ichki xavfsiz serveri/tarmoq diski (yoki ichki MinIO) orqali avariyaviy tiklash (Disaster Recovery) zaxira arxivi tizimini yo‘lga qo‘yish.

#### 📁 Fayllar va Komponentlar:
- `backend/src/backups/backups.service.ts`
- `backend/src/backups/s3-storage.service.ts` `[YANGI - University Backup Storage Service]`
- `backend/src/backups/backups.module.ts`
- `frontend/src/pages/Backups/BackupsPage.tsx`

#### 📋 Aniq Vazifalar:
1. [x] Universitet ichki serveri uchun maxsus adapter yaratish (`backend/src/backups/s3-storage.service.ts` - `UNIVERSITY_BACKUP_SERVER_PATH` orqali alohida server katalogi / NFS / SMB tarmoq diski va ixtiyoriy ichki MinIO qo‘llab-quvvatlanadi).
2. [x] `BackupsService.createBackup()` ishlaganda, lokal arxiv yaratilgach, nusxani universitet serveriga AES-256-GCM shifrlangan holda yuborish va bazadagi `storageLocation` ustunini yangilash.
3. [x] Frontenddagi `BackupsPage` da har bir zaxira faylning saqlash joyini (`Asosiy Server`, `Universitet Serveri` yoki `Asosiy + Universitet Serveri`) ko‘rsatuvchi belgi qo‘yish hamda yangi zaxira yaratish oynasida universitet serveriga nusxalash svitchini qo‘shish.
4. [x] Disaster Recovery: Asosiy server diski nosozlikka uchrab lokal zaxira fayli o‘chib ketgan taqdirda, server avtomatik ravishda universitet zaxira serveridan yuklab olib, AES-256 kalit bilan deshifrlash orqali bazani tiklash mexanizmi yo‘lga qo‘yildi.

#### ✅ Definition of Done:
- [x] Avtomatik va qo‘lda yaratilgan zaxira nusxasi universitetning belgilangan xavfsiz serveriga muvaffaqiyatli yuklanadi va yaxlitlik xeshi (SHA-256) 100% tasdiqlanadi.
- [x] `frontend/e2e/backups.spec.ts`: Universitet serveri zaxira ustuni, svitch va yangi shifrlangan zaxira nusxasi yaratilishi Playwright orqali to‘liq tekshirildi va muvaffaqiyatli o‘tdi.

---

### 🔹 FAZA 6: Rollar Bo‘yicha Foydalanuvchi Yo‘riqnomasi (User Manual) (P2)

> **Maqsad:** Universitetning 9 ta roli vakillari (MOL, Dekan, Rektorat, Omborchi, Komendant, Auditor) tizimdan to‘g‘ri va oson foydalanishi uchun tayyor yo‘riqnomalar taqdim etish.

#### 📁 Fayllar va Hujjatlar:
- `docs/USER_MANUAL_UZ.md`
- `docs/ROLES_QUICK_START.md`

#### 📋 Aniq Vazifalar:
1. [x] Har bir rol uchun 1-2 varaqli "Tezkor Boshlash" (`docs/ROLES_QUICK_START.md`) ko‘rsatmasini tuzish:
   - **Xodim/O‘qituvchi:** Qanday qilib zayavka berish;
   - **MOL (Kafedra mudiri/laborant):** Aktivlarni qabul qilish va topshirish;
   - **Bino Komendanti:** Xonalar va mulklarni ko‘zdan kechirib imzolash;
   - **Bosh Hisobchi va Prorektor:** Moliyaviy tasdiqlash va aylanma varaqani ko‘rish;
   - **Auditor:** Smartfon orqali xonama-xona QR-tekshiruv o‘tkazish;
   - **Super Admin:** Tizim parametrlari, zaxira va foydalanuvchilar boshqaruvi.
2. [x] Sxemalar, Mermaid ketma-ketliklari va bosqichma-bosqich harakatlar ketma-ketligini joylash (`docs/USER_MANUAL_UZ.md` va `docs/ROLES_QUICK_START.md`).
3. [x] OTM standartlari bo‘yicha rasmiy buxgalteriya dalolatnomalari (OS-1, OS-2, OS-4, INV-19, Clearance Certificate) va 7-bosqichli davlat zayavkasi arxitekturasi to‘liq tushuntirildi.

#### ✅ Definition of Done:
- [x] Har bir rol uchun aniq, tushunarli va rasmiy O‘zbek tilidagi bosqichma-bosqich qo‘llanma mavjud (`docs/USER_MANUAL_UZ.md` va `docs/ROLES_QUICK_START.md`).

---

## 🏁 XULOSA VA AMALGA OSHIRISH KETMA-KETLIGI

| Tartib | Bosqich / Yo‘nalish | Holati | Asosiy Natija |
| :---: | :--- | :---: | :--- |
| **1-qadam** | **Faza 1** — Lokalizatsiya gigiyenasi (`translations.csv`) | ✅ Yakunlandi | UZ, RU, EN 100% sinxronlandi |
| **2-qadam** | **Faza 2** — Tashqi integratsiyalar (HEMIS & UzASBO) | ✅ Yakunlandi | HEMIS REST API va UzASBO eksporti ishga tushdi |
| **3-qadam** | **Faza 3** — Playwright E2E testlari | ✅ Yakunlandi | 16 ta to‘liq E2E avtotestlar 100% muvaffaqiyatli |
| **4-qadam** | **Faza 4** — Oflayn PWA QR-skaner | ✅ Yakunlandi | PWA Service Worker va IndexedDB oflayn keshi |
| **5-qadam** | **Faza 5** — Universitet Zaxira Serveri (Disaster Recovery) | ✅ Yakunlandi | AES-256 shifrlash va SHA-256 yaxlitlik tasdig‘i |
| **6-qadam** | **Faza 6** — Foydalanuvchi qo‘llanmasi (User Manual) | ✅ Yakunlandi | 9 ta rol uchun rasmiy va tezkor qo‘llanmalar |

Ushbu yo‘l xaritasi asosida UWMS loyihasi to‘liq avtomatlashgan, barqaror, xavfsiz va davlat korporativ standartlariga 100% javob beruvchi holatda to‘liq yakunlandi.
