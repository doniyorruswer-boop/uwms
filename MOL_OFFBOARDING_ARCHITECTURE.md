# UWMS: Moddiy Javobgarlikni Boshqarish va Yakunlash Arxitekturasi (v2.0 Enterprise)
*(Asset Responsibility Handover, Multi-Role Approval & Clearance Architecture)*

> **Hujjat turi:** To‘liq Texnik Arxitektura va Bosqichma-bosqich Bajarish Rejasi (Deep Technical Architecture & Phased Implementation Plan)  
> **Muallif:** Lead Software Architect & Tech Lead  
> **Loyiha:** UWMS (Universitet Ombor va Inventar Boshqaruv Tizimi)  
> **Versiya:** 2.0 (Role-Separated Architecture)  
> **Holati:** Tasdiqlangan va Amalga Oshirishga Tayyor  

---

## 🧭 1. KONSEPTSIYA: OPERATSION TOPSHIRISH VA YURIDIK CHIQARISHNING AJRATILISHI
*(Separation of Concerns: Operational Handover vs HR/Legal Clearance)*

Dastlabki yondashuvdagi eng katta kamchilik — moddiy javobgarlikni topshirish jarayonini faqat `/users` (Xodimlar) sahifasiga qamab qo‘yish edi. Biroq RBAC xavfsizlik siyosatiga ko‘ra, **MOL (laborant, kafedra mudiri) va Bino Komendanti `/users` sahifasiga kirish huquqiga ega emas** va kirmasligi shart.

Shu sababli, tizim 2 ta mutlaqo mustaqil biznes qatlamga ajratiladi:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. OPERATSION QATLAM (Aktivlar Hayot Sikli — Kundalik Amaliyot)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Mas’ul shaxs:   MOL (Moddiy javobgar shaxs / Laborant / Xona mas’uli)     │
│ • Ish maydoni:    /assets ("Mening aktivlarim")                             │
│ • Amal:           [ Aktivlarni topshirish ]                                 │
│ • Maqsad:         Jihozlarni boshqa MOLga, omborga, ta’mirga berish         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. VIZALASH VA TASDIQLASH QATLAMI (Action Center — Imzolar Zanjiri)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Mas’ul shaxslar: Yangi MOL, Bino Komendanti, Moddiy Hisobchi, Prorektor   │
│ • Ish maydoni:    /inbox ("Mening Vazifalarim") yoki Smartfon QR-Pairing     │
│ • Amal:           [ Ko‘rib chiqish ] ──> [ Qabul qilish ] / [ Rad etish ]   │
│ • Yuridik hujjat: 4 tomonlama elektron OS-1 Dalolatnomasi                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MA’MURIY VA YURIDIK QATLAM (Kadrlar va Hisob-Kitobni Yopish)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Mas’ul shaxs:   SuperAdmin / Kadrlar Bo‘limi (HR)                         │
│ • Ish maydoni:    /users ("Foydalanuvchilar va Kirish Huquqlari")           │
│ • Amal:           [ Javobgarlik holati ] ──> [ Aylanma varaqa (Clearance) ] │
│ • Maqsad:         Xodimning barcha javobgarliklari 0 bo‘lgach, arxivlash    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺 2. SAHIFALAR VA ROLLAR MATRITSASI (RBAC MAPPING)

| Sahifa | Asosiy Rollar | Vazifasi va Konteksti | Amallar (Actions) |
| :--- | :--- | :--- | :--- |
| **`/assets`** | `MOL`, `HEAD_WAREHOUSE` | **Mening aktivlarim** — o‘ziga biriktirilgan mulklarni ko‘rish va topshirish arizasini boshlash. | `[ Aktivlarni topshirish ]`, filtrlar, inventar tekshiruvi |
| **`/inbox`** | `MOL`, `COMMENDANT`, `CHIEF_ACCOUNTANT`, `VICE_RECTOR_FINANCE` | **Harakatlar markazi (Action Center)** — o‘ziga kelgan arizalarni tekshirish va imzolash. | `[ Ko‘rib chiqish ]`, `[ Qabul qilish ]`, `[ Rad etish ]`, `[ QR bilan Imzolash ]` |
| **`/organization`** | `COMMENDANT`, `SUPER_ADMIN`, `HEAD_WAREHOUSE` | **Bino va xonalar** — xonaning jismoniy butunligi, unga biriktirilgan ashyolar va xona mas’uli. | `[ Xona mas’ulini almashtirish ]`, komendant ma’lumotlari |
| **`/movements`** | `SUPER_ADMIN`, `HEAD_WAREHOUSE`, `AUDITOR`, `CHIEF_ACCOUNTANT` | **Jurnallar va dalolatnomalar** — barcha rasmiy OS-1 topshirish hujjatlari arxivi va tarixi. | `[ OS-1 ko‘rish ]`, `[ PDF yuklash ]`, `[ QR tekshirish ]` |
| **`/users`** | `SUPER_ADMIN` | **Kadrlar va nazorat** — xodimlarning umumiy javobgarlik holatini tekshirish, aylanma varaqa va arxivlash. | `[ Javobgarlik holati ]`, `[ Aylanma varaqa ]`, `[ Xodimni arxivlash ]` |

---

## 🔄 3. STATUSLAR MOSHINASI VA TRANZAKSION ZANJIR (STATE MACHINE)

Arizani boshlash aktiv egasini birdaniga o‘zgartirib qo‘ymaydi! Mulk faqat **barcha tomonlar to‘liq imzolagandan keyingina** atomik tranzaksiya (`prisma.$transaction`) orqali o‘tadi:

```text
       MOL arizani yaratadi
               │
               ▼
           [ DRAFT ] ──(Topshirishga yuborish)──► [ SUBMITTED ]
                                                        │
         ┌──────────────────────────────────────────────┴──────────────────────────────┐
         ▼                                              ▼                              ▼
 [ RECEIVER_REVIEW ]                          [ COMMANDANT_REVIEW ]          [ ACCOUNTANT_REVIEW ]
 (Yangi MOL aktivlarni                         (Komendant xona va bino        (Hisobchi buxgalteriya
  qabul qiladi / rad etadi)                     butunligini tasdiqlaydi)       qoldiqlarini tekshiradi)
         │                                              │                              │
         └──────────────────────────────────────────────┬──────────────────────────────┘
                                                        ▼
                                             [ PENDING_APPROVAL ]
                                            (Prorektor / Bosh hisobchi)
                                                        │
                                                        ▼
                                                  [ COMPLETED ]
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
             prisma.$transaction bajariladi:                             OS-1 Dalolatnomasi muhrlanadi,
             • ItemInstance.responsibleUserId = targetUserId             Aylanma varaqa metriklari yangilanadi,
             • AssetHistory: "MOL rotatsiyasi rasmiylashtirildi"         Audit log yoziladi.
```

---

## 🚀 4. BOSQICHMA-BOSQICH MUKAMMAL AMALGA OSHIRISH REJASI (5 PHASES)

---

### 🔹 1-FAZA: `/assets` — MOL Operatsion Ish Joyi va "Aktivlarni Topshirish" Vizardi
> **Maqsad:** Moddiy javobgar shaxs uchun o‘z profilidagi ashyolarni qulay saralab, topshirish jarayonini boshlab beruvchi 2 bosqichli tezkor interfeys.

#### 📁 Fayllar va Komponentlar:
1. `frontend/src/pages/Assets/AssetsPage.tsx` `[O‘ZGARTIRILADI]`
   - MOL roli uchun sahifa ochilganda avtomatik ravishda **"Faqat mening aktivlarim"** filtri faollashadi (`responsibleUserId = currentUser.id`).
   - Jadval tepasiga yangi boshqaruv paneli qo‘shiladi:
     - Checkbox orqali 1 yoki bir nechta aktiv tanlanganda: `[ Tanlangan aktivlarni topshirish (N ta) ]` tugmasi faollashadi.
     - Jadval qatorida tezkor amal: `[ Topshirish ]` ikonkasi.
2. `frontend/src/components/Assets/AssetHandoverWizardModal.tsx` `[YANGI KOMPONENT]`
   - **1-Qadam: Aktivlar va Harakat (Destination):**
     - Tanlangan aktivlar jadvali (`INV-raqam`, `Nomi`, `Xonasi`, `Holati`).
     - Umumiy yo‘nalish tanlash:
       - `Boshqa MOLga o‘tkazish` $\rightarrow$ Yangi MOL selektori va xona selektori ochiladi;
       - `Omborga qaytarish` $\rightarrow$ Universitet omborxonasi selektori ochiladi;
       - `Ta’mirga yuborish` $\rightarrow$ Nosozlik tavsifi maydoni;
       - `Hisobdan chiqarish (Spisanie)` $\rightarrow$ Yaroqsizlik sababi;
       - `Kamomad (Tekshiruv)` $\rightarrow$ Yo‘qolganlik / topilmaganlik sababi.
   - **2-Qadam: Ishtirokchilar va Izoh:**
     - Tizim xona va bino bo‘yicha **Bino Komendanti**ni avtomatik aniqlaydi;
     - Moddiy hisobchi biriktiriladi;
     - `[ Topshirish arizasini yuborish ]` tugmasi bosilganda: Backendda `ResponsibilityHandover` hujjati `SUBMITTED` holatida yaratiladi.
3. `frontend/src/hooks/useHandoverQuery.ts` `[KENGAYTIRILADI]`
   - `useCreateHandoverMutation()` orqali yangi arizani serverga yuborish va keshni yangilash.

---

### 🔹 2-FAZA: `/inbox` — Yagona Amallar Markazi (Ko‘rib Chiqish va QR E-Imzo)
> **Maqsad:** Qabul qiluvchi MOL, Bino Komendanti va Moddiy Hisobchi hech qanday begona sahifalarga kirmasdan, o‘z ish stolida turib arizani ko‘rib chiqishi, qabul qilishi yoki rad etishi.

#### 📁 Fayllar va Komponentlar:
1. `backend/src/inbox/inbox.service.ts` `[O‘ZGARTIRILADI]`
   - Har bir rol uchun uning vakolatidagi kutilayotgan topshirish arizalarini ro‘yxatga olish:
     - Yangi MOL uchun: `targetUserId === currentUser.id && status === 'SUBMITTED'`;
     - Komendant uchun: `commandantUserId === currentUser.id && status in ['SUBMITTED', 'RECEIVER_REVIEW']`;
     - Buxgalter uchun: `accountantUserId === currentUser.id && status in ['COMMANDANT_REVIEW', 'SUBMITTED']`.
2. `frontend/src/pages/Inbox/InboxPage.tsx` `[O‘ZGARTIRILADI]`
   - Yangi tab / karta: **"Moddiy javobgarlik arizalari (Handover Requests)"**.
   - Har bir karta:
     - Dalolatnoma raqami: `AKT-2026-0014`;
     - Topshiruvchi: `Aliyev Anvar (IT Kafedrasi)`;
     - Xona: `3-bino, 204-auditoriya (12 ta ashyo)`;
     - Holati: `Sizning tasdig‘ingiz kutilmoqda`;
     - Tugmalar: `[ Ko‘rib chiqish va Qabul qilish ]` / `[ Rad etish ]`.
3. `frontend/src/components/Inbox/HandoverReviewModal.tsx` `[YANGI KOMPONENT]`
   - Ashyolarning to‘liq ro‘yxati (seriya raqami, inv-raqami, texnik holati);
   - Agar qabul qiluvchi bo‘lsa: har bir ashyoni ko‘zdan kechirib, "Barchasini qabul qilaman" tugmasi;
   - Agar komendant bo‘lsa: xona kalitlari va butunligini tasdiqlash;
   - **Imzolash:** Tizimning rasmiy `QRPairingModal`i ochiladi $\rightarrow$ smartfon orqali biometrik E-imzo qo‘yiladi.

---

### 🔹 3-FAZA: `/organization` — Bino Komendanti va Xonalar Javobgarligi (Facility Transfer)
> **Maqsad:** Butun boshli auditoriya yoki laboratoriya boshqa o‘qituvchiga/kafedraga o‘tganda, komendant yoki dekanat bir tugma bilan xonaning barcha jihozlarini yangi shaxsga topshirishi.

#### 📁 Fayllar va Komponentlar:
1. `frontend/src/pages/Organization/OrganizationPage.tsx` `[O‘ZGARTIRILADI]`
   - Binolar va xonalar daraxtida (`Tree` / `Card`):
     - Har bir xona kartasida uning joriy mas’uli (`MOL`) va ichidagi aktivlar soni ko‘rsatiladi;
     - Xona amallari menyusida yangi tugma: `[ Xona javobgarligini topshirish ]`.
2. `frontend/src/pages/Organization/TransferRoomModal.tsx` `[O‘ZGARTIRILADI / ULANADI]`
   - Tanlangan xonadagi barcha asosiy vositalar avtomatik yuklanadi;
   - Yangi mas’ul shaxs (yangi MOL) tanlanadi;
   - Komendant ma’lumotlari avtomatik to‘ldiriladi;
   - `ROOM_TRANSFER` tipidagi ariza yaratilib, `/inbox` zanjiriga yo‘naltiriladi.

---

### 🔹 4-FAZA: `/users` — SuperAdmin va HR Nazorati: "Javobgarlik Holati va Aylanma Varaqa"
> **Maqsad:** Kadrlar bo‘limi va SuperAdmin uchun xodimning tizimdagi moddiy majburiyatlarini to‘liq monitoring qilish, rasmiy elektron aylanma varaqa shakllantirish va xavfsiz arxivlash.

#### 📁 Fayllar va Komponentlar:
1. `frontend/src/pages/Users/UsersPage.tsx` `[O‘ZGARTIRILADI]`
   - Xodimlar jadvalidagi amallar ustuni:
     - Eski `Zimmasini topshirish` tugmasi o‘rniga $\rightarrow$ **`[ Javobgarlik Holati (Audit) ]`** tugmasi;
     - Agar xodimning aktivlari 0 ta bo‘lsa va majburiyatlari bo‘lmasa: Yashil **"Ozod qilingan"** belgisi va **`[ Aylanma Varaqa (Clearance) ]`** tugmasi;
     - Agar xodimda aktivlar yoki kutilayotgan imzolar bo‘lsa: `O‘chirish / Arxivlash` tugmasi qulflanadi (`disabled`).
2. `frontend/src/pages/Users/ClearanceCertificateModal.tsx` `[ULANADI]`
   - Rasmiy "Aylanma Varaqa" ma’lumotnomasi:
     - *"Ushbu ma’lumotnoma berildiki, xodim (F.I.Sh) universitet oldidagi barcha moddiy javobgarliklarini topshirdi. Qarzdorligi mavjud emas."*
     - QR-kod va raqamli tekshiruv shtampi;
     - PDF formatda yuklab olish va chop etish.

---

### 🔹 5-FAZA: `/movements` — Topshirish Dalolatnomalari (OS-1) Yagona Reyestri va Audit Arxivi
> **Maqsad:** Universitet rahbariyati, ichki audit va buxgalteriya barcha o‘tgan va kutilayotgan topshirish dalolatnomalarini bitta markazlashgan jurnaldan nazorat qilishi.

#### 📁 Fayllar va Komponentlar:
1. `frontend/src/pages/Movements/MovementsPage.tsx` `[O‘ZGARTIRILADI]`
   - Yangi bo‘lim / yorliq: **"Topshirish Dalolatnomalari (OS-1 Hujjatlari)"**.
   - Jadval ustunlari:
     - Dalolatnoma raqami (`ACT-2026-0042`);
     - Sana va vaqt;
     - Topshirish turi (`To‘liq`, `Qisman`, `Xona topshirish`, `Omborga qaytarish`);
     - Topshiruvchi va Qabul qiluvchi shaxslar;
     - Bino va xona;
     - Imzolar holati (Topshiruvchi ✓, Qabul qiluvchi ✓, Komendant ✓, Buxgalter ⌛);
     - Status (`Kutilmoqda`, `Tasdiqlangan`, `Rad etilgan`).
   - Amallar:
     - `[ Ko‘rish ]`: Tayyor shakllangan OS-1 elektron hujjatini ochish;
     - `[ PDF ]`: Chop etish;
     - `[ Audit Log ]`: Dalolatnomaning barcha o‘zgarishlar tarixi.

---

## 🛡 5. TUGALLANGANLIK STANDARTI (DEFINITION OF DONE)

Har bir faza quyidagi mezonlar asosida qabul qilinadi:
1. **RBAC Integrity:** Komendant va MOL `/users` ga kirmasdan o‘z vazifasini 100% bajara oladi.
2. **State Protection:** Imzolar to‘liq yig‘ilmaguncha aktivning yangi egasi o‘zgarmaydi.
3. **Auditability:** Har bir topshirish bo‘yicha `AssetHistory` va `StockMovement` da to‘liq tranzaksiya izi qoladi.
4. **No Fake Data:** Barcha imzolar, xodimlar, binolar va aktivlar real PostgreSQL bazasidan olinadi va saqlanadi.
5. **Code Standard:** Loyiha faqat `@arco-design/web-react` va mavjud umumiy komponentlar asosida quriladi, `tsc -b` va Vite build 0 ta xatolik bilan yakunlanadi.
