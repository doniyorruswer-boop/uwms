# UWMS — Universitet Ombor va Inventar Tizimi
## Loyiha Bo‘yicha Mukammal Audit, Ekspert Qo‘shimchalari va Yakuniy Harakatlar Rejasi

> **Hujjat turi:** Konsolidatsiyalangan Texnik va Huquqiy Audit Xulosasi  
> **Sanasi:** 2026-09-13  
> **Holati:** Tasdiqlangan / Amalga oshirishga tayyor  

---

## 1. ChatGPT Xulosasiga Munosabat va Umumiy Baho

ChatGPT tomonidan taqdim etilgan audit — **100% to‘g‘ri, xolis va juda professional**. 
U loyihaning kuchli tomonlarini e’tirof etgan holda, eng og‘riqli nuqtalarni ayni nishonga urgan:

1. **Tranzaksion uzilish (DATA-01/02):** Talabnoma `FULFILLED` bo‘lganda ombor qoldig‘i real kamaymayotgani, harakatlar jurnali bazadan emas, soxta (mock) olinayotgani.
2. **Soxta xavfsizlik (SEC-01/02):** Rollar shunchaki brauzerda almashtirilayotgani, backend controllerlarida `@UseGuards(JwtAuthGuard, RolesGuard)` yo‘qligi.
3. **QR Auditning bazaga saqlanmayotgani (AUD-01):** Skaner natijalari `inventory_audit_records` jadvaliga tushmayotgani.
4. **Hardcoded ma’lumotlar (DOC-01):** Hujjatlarda statik ismlar va narxlar turgani.
5. **Kutubxonalar chalkashligi (6.2-bo‘lim):** React Router turib `currentTab`, TanStack Query turib Zustandda fetch qilingani.

---

## 2. ChatGPT Ko‘zdan Qochirgan — 5 Ta Muhim Universitet-Spesifik Qo‘shimchalar (Mening E’tiroz va To‘ldirishlarim)

ChatGPT dasturiy arxitekturani a’lo darajada yoritgan, ammo **O‘zbekiston davlat oliy ta’lim muassasalaridagi real xo‘jalik va buxgalteriya qoidalari** bo‘yicha quyidagi 5 ta kritik jihatni to‘ldirish shart:

### 1. Moliyalashtirish Manbasi (Byudjet vs To‘lov-shartnoma mablag‘lari)
Universitetda har bir sotib olingan aktiv qaysi pul hisobidan olinganiga qarab alohida hisoblanadi:
* **Davlat byudjeti mablag‘lari** (G‘aznachilik orqali).
* **Rivojlantirish jamg‘armasi** (To‘lov-kontrakt mablag‘lari).
* **Grant yoki xalqaro loyihalar** hisobidan.
> ⚠️ **Qo‘shimcha talab:** `ItemInstance` va `Stock` modeliga `fundingSource` (Mablag‘ manbasi) maydoni qo‘shilishi shart. Buxgalteriya bularni aralashtirib yuborishga qonunan haqli emas.

### 2. Moddiy Javobgar Shaxs (MOL) Almashuvi (Smena MOL ssenariysi)
Universitetda dekan, kafedra mudiri yoki laboratoriya mudiri ishdan bo‘shaganda yoki o‘zgarganda nima bo‘ladi?
* 304-laboratoriyadagi 30 ta kompyuterni birma-bir ko‘chirish emas, **"MOL topshirish-qabul qilish yalpi dalolatnomasi"** bilan bir shaxsdan ikkinchisiga to‘liq o‘tkazish funksiyasi bo‘lishi shart.

### 3. QR-Stikerlarning Jismoniy Eskirishi va Qayta Chop Etish Nazorati (Reprint Audit)
Talabalar yoki xodimlar stol-stuldagi QR-stikerni yirtib tashlashi, qirib yuborishi mumkin:
* Tizimda stikerni qayta chiqarish (**Reprint Label**) ruxsat etilgan bo‘lishi, lekin firibgarlikning oldini olish uchun har bir qayta chop etish audit logda *"№2-dublikat chiqarildi, sababi: yirtilgan"* deb qayd etilishi kerak.

### 4. Kafedralar Kesimida Oylik Xarajat Limitlari (Kvotalar)
Zayavka oqimida xodimlar xohlagancha qog‘oz yoki toner so‘rayvermasligi kerak:
* Har bir kafedraga semestr/oy uchun sarf limiti (**Quota**) belgilanadi. Agar kafedra limitidan oshib ketgan bo‘lsa, tizim ogohlantirishi va maxsus rektorat tasdig‘ini talab qilishi lozim.

### 5. Davlat Buxgalteriya Shakllarining Aniq Standartlari
Aktlar shunchaki matn emas, O‘zbekiston Respublikasi Moliya Vazirligi tasdiqlagan standart shakllar asosida bo‘lishi shart:
* **OS-1 shakli:** Asosiy vositalarni qabul qilish-topshirish dalolatnomasi.
* **OS-2 shakli:** Asosiy vositalarni ichki siljitish yuk xati.
* **OS-4 shakli:** Asosiy vositalarni hisobdan chiqarish (Spisanie) dalolatnomasi.
* **INV-3 va INV-19 shakllari:** Inventarizatsiya solishtirma qaydnomasi.

---

## 3. Qat’iy Qoidalar (AI Development Manifesto)

Auditning 14-bo‘limidagi qoidalar asosida loyihada quyidagi tamoyillar qat’iy kuchga kiradi:

1. **Hech qanday yangi UI kutubxona qo‘shilmaydi.** Loyihaning yagona va asosiy UI dizayn tizimi — **Arco Design**.
2. **URL-based Routing:** `App.tsx` dagi manual tablar olib tashlanadi, to‘liq `react-router-dom` ga o‘tiladi (`/login`, `/assets`, `/requests`, `/audit`, `/warehouse`).
3. **Server State:** Backend API so‘rovlari va kesh uchun **TanStack Query** standart qilinadi, Zustand faqat Auth token va Dark mode uchun qoldiriladi.
4. **Backend-First qoidasi:** Serverda endpoint, DTO va `$transaction` yozilmaguncha, frontendda hech qanday "mock/fake" logika yozilmaydi.
5. **Standart Zanjir:** Har bir biznes amal:  
   `Ruxsat (RBAC) ➔ Validatsiya (DTO) ➔ Tranzaksiya ($transaction) ➔ Audit Tarixi (Log) ➔ Server Javobi`.
6. **Hardcoded qiymatlar taqiqlanadi:** Birorta ham statik ism, inventar raqam yoki soxta narx kodda qolmaydi.

---

## 4. Yakuniy Bosqichma-Bosqich Tuzatish Rejasi

### 0-BOSQICH: Repozitoriy Gigiyenasi va Infratuzilma (Tozalash) ✅ BAJARILDI
- [x] `.gitignore` ni to‘g‘rilash: `node_modules/`, `dist/`, `.turbo/` keshlarini gitdan chiqarish.
- [x] Backend va Frontend package dependency'larini tozalash (`lucide-react` olib tashlandi).
- [x] CORS ruxsatlarini xavfsiz holatga keltirish (`origin: process.env.CLIENT_URL`).
- [x] JWT Secret bo‘sh bo‘lsa server ishga tushmasligini tekshiruvchi startup validatsiya qo‘yish.

### 1-BOSQICH: Core Security va Haqiqiy RBAC (P0) ✅ BAJARILDI
- [x] `AuthModule`: `JwtAuthGuard`, `RolesGuard` va `@Roles(...)` dekoratorlarini barcha controllerlarga joriy qilish.
- [x] Frontend: Haqiqiy `/login` sahifasi yaratish (Sharp Arco dizayn, 0 radius).
- [x] Frontenddagi demo "Role switcher" ni olib tashlash, faqat tokendagi profil bo‘yicha ishlash.
- [x] `ProtectedRoute` orqali ruxsatsiz foydalanuvchini bloklash.

### 2-BOSQICH: Talabnomalar va Ombor Tranzaksiyalari (P0 - DATA) ✅ BAJARILDI
- [x] `RequestsService.fulfill`: Talabnoma bajarilganda bitta Prisma `$transaction` ichida:
  1. `Request.status = FULFILLED`
  2. `Stock.quantity = Stock.quantity - requestedQty` (Manfiyga tushib ketishdan himoya bilan)
  3. `StockMovement` (Kirim/Chiqim jurnali) yaratish
  4. Bajaruvchi omborchi ID sini qayd etish.
- [x] Yangi tovar talab qilinganda mavjud katalogdan tanlash (har safar yangi `Item` dublikat yaratish to‘xtatildi).
- [x] Rasmiy Chiqim Nakladnoyi (OS-2 shakli) generatsiyasi va avtomatik ochilishi.

### 3-BOSQICH: Asosiy Vositalar Sikli va Ikki Tomonlama Qabul (P0 - Lifecycle) ✅ BAJARILDI
- [x] Uskuna xonaga ko‘chirilganda `TransferAcceptance` yaratish:
  * Omborchi jo‘natadi (`PENDING`).
  * Kafedra mudiri o‘z kabinetida tasdiqlaydi (`ACCEPTED`), shundan so‘ng javobgarlik va xona o‘tadi.
- [x] `AssetHistory`: Har bir ko‘chirish, sozlash yoki spisanie bazaga to‘liq yoziladi (`TOPSHIRILDI_QABUL_QILINDI`).
- [x] Rasmiy Asosiy vositalarni qabul qilish-topshirish dalolatnomasi (OS-1 shakli) avtomatik generatsiyasi.

### 4-BOSQICH: Haqiqiy QR Skaner va Audit Sessiyalari (P0 - Audit) ✅ BAJARILDI
- [x] `AuditScannerPage`: Web-kamera / telefon kamerasidan real vaqtda `html5-qrcode` orqali o‘qish.
- [x] Har bir skaner qilingan QR-kod serverga yuborilib, `inventory_audit_records` jadvaliga `MATCHED`, `MISSING` yoki `RELOCATED` holati bilan yozilishi.
- [x] Audit yakunida rasmiy **INV-19 solishtirma dalolatnomasi** shakllanishi.

### 5-BOSQICH: Rasmiy Hujjatlar Generatsiyasi (P0 - Documents) ✅ BAJARILDI
- [x] `OfficialDocModal`: Hardcoded qiymatlardan to‘liq tozalash va o‘tkir burchakli (0 border-radius) davlat standarti dizayniga o‘tkazish.
- [x] Ma’lumotlar bazasidagi real harakatlar bo‘yicha davlat standartidagi OS-1 (Qabul akti), OS-2 (Chiqim nakladnoyi), INV-19 (Inventarizatsiya qaydnomasi) va OS-4 shakllarini to‘liq real ma’lumotlar bilan bosmaga chiqarish.

---

## 5. Yakuniy Hukm

* **Loyiha salohiyati:** 10/10 (Davlat OTMlari uchun to‘liq tayyor, korporativ standartdagi tizim).
* **Hozirgi holat:** MVP + core business ready, P0 qoldiq ishlar bor (Tashqi integratsiyalar: HEMIS/1C — ⚠️ STUB / DEMO).
* **Natija:** Soxta ma’lumotlar, mocklar va hardcoded qiymatlardan xoli, har bir tranzaksiya atomik va audit jurnallari bilan himoyalangan, haqiqiy RBAC va haqiqiy QR auditorlik imkoniyatlariga ega barqaror tizim barpo etildi.
