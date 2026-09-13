# UWMS — AGENT VA AI UCHUN QAT’IY VA MUQADDAS QOIDALAR (STRICT AI RULES)

Ushbu qoidalar UWMS (Universitet Ombor va Inventar Boshqaruv Tizimi) loyihasida ishlaydigan **BARCHA AI AGENTLAR (Antigravity, Claude, ChatGPT, Cursor, Copilot)** va dasturchilar uchun **BIRINCHI VA ENG YUQORI DARAJADAGI QONUN** hisoblanadi.

Har qanday vazifani (kod yozish, refaktoring, modul qo‘shish) boshlashdan oldin ushbu qoidalar o‘qilishi va ularga so‘zsiz 100% rioya qilinishi SHART!

---

## 🛑 1. ARXITEKTURA VA KUTUBXONALAR (ZERO TOLERANCE)

1. **Yagona UI tizimi — faqat `@arco-design/web-react`:**
   - Hech qanday boshqa UI framework qo‘shilmaydi (TailwindCSS, Ant Design, Material-UI, Chakra UI, Bootstrap va b. taqiqlangan).
   - Barcha stillar va komponentlar faqat Arco Design imkoniyatlari (Grid, Typography, Table, Modal, Drawer, Steps, Tag, Statistic, Card, Space, Form va h.k.) orqali amalga oshiriladi.
2. **Ikonkalar:**
   - Faqat `@arco-design/web-react/icon` dan foydalaniladi. `lucide-react`, `react-icons`, `@heroicons` va boshqa paketlar mutlaqo taqiqlanadi.
3. **Routing (Yo‘naltirish):**
   - Hech qanday qo‘lda boshqariladigan `currentTab` yoki switch-case sahifa almashtirish bo‘lmasligi shart.
   - Faqat rasmiy **`react-router-dom`** ishlatiladi:
     - `/login` — Kirish
     - `/dashboard` — Asosiy analitika
     - `/assets` — Asosiy vositalar (filiallar, xonalar, pasport, tarix)
     - `/warehouse` — Sarflanuvchi ombor qoldiqlari
     - `/requests` — Talabnomalar va tasdiqlash zanjiri
     - `/audits` — QR inventarizatsiya va nomutanosibliklar
     - `/organization` — Universitet tashkiliy tuzilmasi (Fakultet, kafedra, bino, xonalar)
     - `/documents` — Rasmiy birlamchi aktlar (OS-1, OS-2, OS-4, INV-19)
4. **Server State va Kesh:**
   - Server ma’lumotlarini olish, keshlashtirish va yangilash uchun faqat **`@tanstack/react-query`** ishlatiladi.
   - **`zustand`** faqat lokal UI parametrlari (Dark/Light mode, sessiya tokeni, drawer/sidebar holati) uchun xizmat qiladi.

---

## ⚙️ 2. BACKEND-FIRST VA MA’LUMOTLAR BUTUNLIGI (DATA INTEGRITY)

1. **Backend endpoint yozilmasdan Frontendda kod/soxta ma’lumot yozish qat’iyan taqiqlanadi:**
   - Zanjir: `Prisma Schema` $\rightarrow$ `Migration` $\rightarrow$ `DTO & Validation` $\rightarrow$ `Service & $transaction` $\rightarrow$ `Controller` $\rightarrow$ `Swagger Docs` $\rightarrow$ `Frontend React Query Hook`.
2. **Zero Mock Policy (Soxta ma’lumotlarga cheklov):**
   - `catch` bloklarida soxta ma’lumotlar qaytarish yoki "backend javob bermasa localStorage'dan ol" kabi ko‘zbo‘yamachiliklar man etiladi.
   - Xato yuz bersa, foydalanuvchiga Arco `Message.error` orqali aniq xabar ko‘rsatilishi shart.
3. **Hardcoded qiymatlar qat’iyan taqiqlanadi:**
   - Hujjatlar, modallar yoki jadvallarda `INV-2026-001`, `9.5 mln so‘m`, `Toshmatov Omon` kabi statik qotirilgan yozuvlar bo‘lishi taqiqlanadi. Hamma ma’lumot (nom, narx, sana, xona, mas’ul shaxs) **faqat va faqat** bazadan dinamik kelishi shart.
4. **Majburiy Tranzaksion Zanjir (Atomic Transactions):**
   - Ombor qoldig‘ini o‘zgartiruvchi, talabnomani tasdiqlovchi yoki aktivni boshqa shaxsga o‘tkazuvchi har bir operatsiya **`prisma.$transaction`** ichida bajarilishi shart.
   - Ombor qoldig‘i hech qachon noldan pastga (`quantity < 0`) tushishi mumkin emas (agar qoldiq yetmasa, tranzaksiya darhol `BadRequestException` qaytaradi).
   - Har bir harakat ortidan `StockMovement` yoki `AssetHistory` audit jurnali avtomatik yozilishi shart.

---

## 🔒 3. XAVFSIZLIK VA RBAC (SECURITY RULES)

1. **Haqiqiy JWT va Role Guard:**
   - Frontenddagi demo role switcher o‘chirilishi, o‘rniga haqiqiy server autentifikatsiyasi (JWT Access Token) joriy qilinishi shart.
   - Backenddagi barcha o‘zgartiruvchi endpointlar `@UseGuards(JwtAuthGuard, RolesGuard)` va `@Roles(...)` bilan qattiq himoyalangan bo‘lishi shart.
2. **Universitet Rollari (aniq ruxsatlar bo‘yicha):**
   - `SUPER_ADMIN` — To‘liq tizim sozlamalari va foydalanuvchilar boshqaruvi.
   - `PRORECTOR` — Moliyaviy va yirik talabnomalarni yakuniy tasdiqlovchi.
   - `WAREHOUSE_HEAD` — Bosh omborchi (kirim qilish, qoldiqlar, rasmiy tarqatish).
   - `ACCOUNTANT` — Buxgalteriya hisobi, eskirish (amortizatsiya), hisobdan chiqarish (spisanie).
   - `DEPARTMENT_HEAD` — Kafedra mudiri / dekan (talabnoma shakllantirish, o‘z kafedrasi ashyolari nazorati).
   - `MOL` — Moddiy javobgar shaxs (xona va jihozlarga shaxsan javobgar).
   - `AUDITOR` — Faqat tekshirish, QR audit va nomutanosiblik hisobotlarini ko‘rish.

---

## 🏛 4. UNIVERSITET SPESIFIK BIZNES QOIDALARI

1. **Moliyalashtirish Manbasi (Funding Source):**
   - Har bir kirim qilingan jihoz va sarf materiali qaysi manbadan olingani ko‘rsatilishi shart:
     - `BYUDJET` (Davlat byudjeti mablag‘lari)
     - `KONTRAKT_RIVOJLANTIRISH` (To‘lov-shartnoma rivojlantirish fondi)
     - `GRANT` (Ilmiy yoki xalqaro grantlar)
2. **MOL Almashinuvi (MOL Transfer Act):**
   - Mas’ul xodim ishdan bo‘shaganda yoki o‘zgarganda unga biriktirilgan ashyolar yangi mas’ul shaxsga yalpi rasmiy topshirish-qabul qilish dalolatnomasi bilan o‘tkaziladi.
3. **QR Audit va Stikerlar:**
   - Har bir inventar stikeri qayta chop etilganda (duplicate), sababi ko‘rsatilib audit jurnaliga yoziladi.
   - Audit tekshiruvi real kamera (`html5-qrcode`) orqali skaner qilinib, ma’lumotlar bazasida `InventoryAuditRecord` ga saqlanadi.

---

## 📋 5. KOD YOZISH VA TOPSHIRISH STANDARTI (DEFINITION OF DONE)

Har qanday vazifa quyidagi 6 ta mezon bajarilgandagina "tayyor" hisoblanadi:
* [ ] 1. **Backend:** Tegishli Prisma Schema yangilangan, DTO validatsiyasi va `prisma.$transaction` yozilgan.
* [ ] 2. **Security:** Endpointlar `JwtAuthGuard` va `RolesGuard` bilan himoyalangan.
* [ ] 3. **Frontend UX:** Har bir ro‘yxat/sahifada 5 ta holat mavjud: `Loading`, `Empty (Bo‘sh)`, `Error`, `Search/Filter`, `Permission Denied`.
* [ ] 4. **Real Data:** Barcha ma’lumotlar bazadan keladi, mock/hardcoded qiymatlar yo‘q.
* [ ] 5. **Type Safety:** TypeScript (`tsc -b` va backend `npm run build`) 0 ta xato bilan muvaffaqiyatli yakunlanadi.
* [ ] 6. **Clean Code:** Keraksiz `console.log`, sinov kodlari yoki foydalanilmagan importlar qoldirilmaydi.
