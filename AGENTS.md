# UWMS — AGENT VA AI UCHUN QAT’IY QOIDALAR (STRICT AI RULES)

Ushbu qoidalar loyihada ishlayotgan barcha AI assistentlar, dasturchilar va agentlar uchun **majburiy** hisoblanadi. Har bir vazifani bajarishdan oldin ushbu qoidalar birinchi bo‘lib o‘qilishi va ularga so‘zsiz rioya qilinishi shart!

---

## 🛑 1. ARXITEKTURA VA KUTUBXONALAR CHEKLOVI

1. **Yangi UI kutubxona qo‘shish qat’iyan taqiqlanadi:**
   - Loyihaning yagona va rasmiy UI tizimi: **`@arco-design/web-react`** (ByteDance Design System).
   - Yangi ortiqcha UI paketlar (MUI, AntD, Chakra, Tailwind, Bootstrap va h.k.) qo‘shilmaydi.
2. **Ikonkalar standarti:**
   - Faqat `@arco-design/web-react/icon` ishlatiladi. `lucide-react` yoki boshqa tashqi icon paketlar koddan chiqariladi.
3. **Routing standarti:**
   - Hech qanday qo‘lda boshqariladigan `currentTab` yoki switch-case bo‘lmaydi. Faqat **`react-router-dom`** orqali to‘liq URL-based routing (`/login`, `/assets`, `/requests`, `/warehouse`, `/audit`, `/organization`).
4. **Server State va Kesh standarti:**
   - Backend API so‘rovlari, kesh va mutatsiyalar uchun faqat **`@tanstack/react-query`** ishlatiladi.
   - **`zustand`** faqat lokal UI parametrlari (Dark mode, sessiya tokeni) uchun xizmat qiladi.

---

## ⚙️ 2. BACKEND-FIRST VA MA’LUMOTLAR BUTUNLIGI (DATA INTEGRITY)

1. **Backend endpoint yozilmasdan turib Frontendda fake/mock logika yozish taqiqlanadi:**
   - Har bir yangi funksiya avval **Backend**da (Prisma schema $\rightarrow$ Migration $\rightarrow$ DTO $\rightarrow$ Service $\rightarrow$ Controller) to‘liq yoziladi, Swagger orqali tekshiriladi, shundan so‘nggina Frontend unga ulanadi.
2. **Production kodida Mock / Fallback bo‘lishi qat’iyan taqiqlanadi:**
   - `catch` bloklarida soxta ma’lumot qaytarish yoki "backend ishlamasa local xotirada saqlash" amaliyoti to‘xtatiladi. Xato bo‘lsa, aniq xatolik xabari chiqishi shart.
3. **Majburiy Tranzaksion Zanjir (Transaction Policy):**
   - Har bir yozish amali quyidagi qat’iy zanjir asosida bo‘lishi shart:
     $$\text{Ruxsat (RBAC)} \longrightarrow \text{Validatsiya (DTO)} \longrightarrow \text{Tranzaksiya (\$transaction)} \longrightarrow \text{Audit Log} \longrightarrow \text{Javob}$$
4. **Ombor va Qoldiq Qonuni:**
   - Talabnoma `FULFILLED` bo‘lganda, ombor qoldig‘i (`Stock.quantity`) avtomatik va bir vaqtning o‘zida (`prisma.$transaction`) kamayishi, manfiyga tushib ketishdan himoyalanishi va `StockMovement` jurnali yaratilishi shart.
   - Birorta ham tovar yoki kompyuter audit jurnalisiz (`AssetHistory`, `StockMovement`) o‘z-o‘zidan harakatlana olmaydi.

---

## 🔒 3. XAVFSIZLIK VA RBAC (SECURITY RULES)

1. **Frontend Role Switcher real auth emas:**
   - Brauzerdagi rolni almashtirish tugmasi faqat dasturchining test rejimi bo‘lib, productionda umuman bo‘lmasligi kerak.
   - Foydalanuvchi huquqi faqat serverdan keladigan haqiqiy **JWT Access Token** va uning claims/profile ma’lumotlari orqali belgilanadi.
2. **Endpointlar himoyasi:**
   - Backenddagi barcha o‘zgartiruvchi va maxfiy endpointlar `@UseGuards(JwtAuthGuard, RolesGuard)` va `@Roles(...)` dekoratorlari bilan qattiq himoyalangan bo‘lishi shart.
3. **CORS va Konfiguratsiya:**
   - `origin: '*'` va `credentials: true` kabi xavfli sozlamalar taqiqlanadi. Faqat ruxsat etilgan frontend domeni orqali ulanadi.
   - Maxfiy kalitlar (JWT Secret) bo‘sh bo‘lsa, backend startup vaqtidayoq serverni to‘xtatishi shart.

---

## 📝 4. HARDCODED MA’LUMOTLAR VA AD-HOC UI ELEMENTLARNING TAQIQLANISHI

1. **Hech qanday statik / hardcoded qiymat bo‘lmasligi shart:**
   - Hujjatlar, modallar yoki jadvallarda `INV-2026-001`, `9.5 mln so‘m`, `Toshmatov Omon` kabi oldindan yozib qo‘yilgan statik qiymatlar bo‘lishi taqiqlanadi.
   - Hamma ma’lumot (nom, narx, sana, xona, mas’ul shaxs) **faqat va faqat** ma’lumotlar bazasidan dinamik kelishi shart.
2. **Alohida sahifada hardcode qilib UI yozish qat’iyan taqiqlanadi (Faqat umumiy komponentlardan foydalanish qoidasi):**
   - Hech bir sahifada (`pages/*`) o‘zboshimchalik bilan alohida hardcode qilingan UI bloklari, inline stillar bilan o‘ralgan maxsus `<div>`lar yoki ad-hoc render yordamchi funksiyalari (masalan, sahifa ichidagi bir martalik `renderCustomCard`, maxsus divli jadval elementlari) yozilishi mumkin emas!
   - Barcha sahifalar faqat va faqat rasmiy **Arco Design standart komponentlari** (`<Card>`, `<Table>`, `<Form>`, `<Button>`, `<Tabs>`, `<Modal>`, `<Drawer>`, `<Typography>`, `<Statistic>`, `<Badge>`, `<Progress>`) va `src/components/Common/` papkasidagi umumiy, standartlashtirilgan qayta ishlatiluvchi komponentlar (`<StatHeroCard />`, `<CategoryThumbnail />`, `<PageTabs />`, va h.k.) orqali qurilishi shart.
   - Yangi ko‘rinish yoki vidjet kerak bo‘lsa: U avval `src/components/Common/` ichida to‘liq parametrlangan, tipizatsiyalangan umumiy komponent sifatida yaratiladi, keyin esa sahifalarga ulanadi. Sahifa ichida alohida bir martalik hardcode blok yozish qat’iyan man etiladi.
3. **Hujjatlar standarti:**
   - Rasmiy dalolatnomalar (Kirim akti OS-1, Nakladnoy OS-2, Spisanie OS-4, Audit INV-19) O‘zbekiston davlat oliy ta’lim muassasalari standartlari bo‘yicha to‘liq bazaviy DTO asosida shakllanadi.

---

## 🏛 5. UNIVERSITET SPESIFIK BIZNES QOIDALARI

1. **Moliyalashtirish Manbasi (Funding Source):**
   - Har bir aktiv va sarf materiali qaysi hisobdan olinganligi (`BYUDJET` yoki `KONTRAKT_RIVOJLANTIRISH` yoki `GRANT`) bazada qat’iy saqlanishi kerak.
2. **MOL Almashinuvi (MOL Transfer):**
   - Mas’ul xodim o‘zgarganda ashyolar birma-bir emas, yalpi dalolatnoma orqali yangi shaxsga qonuniy o‘tkaziladi.
3. **QR-Stikerni Qayta Chop Etish:**
   - Har bir stiker dublikati chiqarilganda tizim audit jurnalida qayta chop etish sababini qayd etishi shart.
4. **Kafedralar Kvotasi (Quota Limit):**
   - Sarflanuvchi materiallar kafedralarga oylik limit asosida beriladi, limitdan ortiqcha talabnomalar alohida rektorat ruxsatini talab qiladi.

---

## ✅ 6. HAR BIR MODUL UCHUN "DEFINITION OF DONE" (TUGALLANGANLIK STANDARTI)

Biror vazifa yoki sahifa quyidagi 7 ta talab bajarilmaguncha "tayyor" deb hisoblanmaydi:
* [ ] 1. Backendda tegishli DTO, Service, Controller, Validatsiya va Prisma `$transaction` yozilgan.
* [ ] 2. Ruxsatlar (RBAC) serverda tekshiriladi.
* [ ] 3. Har bir sahifada 5 ta asosiy UX holati mavjud: `Loading`, `Empty (Bo‘sh)`, `Error`, `Search/Filter`, `Permission Denied`.
* [ ] 4. Barcha ma’lumotlar real bazadan olinadi va real bazaga saqlanadi.
* [ ] 5. Hardcoded soxta qiymatlar va sahifa ichida alohida hardcode qilingan ad-hoc UI bloklari umuman yo‘q.
* [ ] 6. Barcha UI elementlar rasmiy Arco Design yoki `src/components/Common/` umumiy qayta ishlatiluvchi komponentlari orqali qurilgan.
* [ ] 7. TypeScript compiler (`tsc -b`) va build 0 ta xato bilan yakunlanadi.
