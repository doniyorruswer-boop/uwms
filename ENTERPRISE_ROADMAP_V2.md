# UWMS v2.0 — ENTERPRISE REFAKTORING VA RIVOJLANTIRISH YO‘L XARITASI (ROADMAP)

Ushbu hujjat **UWMS v1.0** loyihasi universitetga muvaffaqiyatli topshirilgandan so‘ng, tizimni **Fortune 500 / Yirik Korporativ (Enterprise / SaaS)** darajasiga ko‘tarish uchun amalga oshiriladigan texnik qarzlar (Technical Debt) va bosqichma-bosqich refaktoring rejasini o‘z ichiga oladi.

---

## 📊 Hozirgi Holat (v1.0 Baseline)

* **Arxitektura:** NestJS 10 + Prisma ORM + PostgreSQL + ByteDance Arco Design
* **Umumiy Baho:** **8.4 / 10** (Yuqori darajadagi ishlab turgan tizim)
* **Test qamrovi:** 33 ta test suite, 293 / 293 ta test yashil (100% pass)
* **Xavfsizlik:** Helmet, JWT, PBAC (Granular permissions), Audit Logging, RBAC
* **Tranzaksiyalar:** Barcha kritik yozuvlarda `prisma.$transaction` ta’minlangan

---

## 🎯 BOSQICHMA-BOSQICH REFAKTORING REJASI

```
v1.0 (Stabil Ishchi Versiya - Universitetga topshirish)
   │
   ├── [1-Faza] Tezkor Texnik Qarzlar & Clean Code (Quick Wins)
   │
   ├── [2-Faza] Event-Driven Architecture (Bog‘liqlikni uzish)
   │
   ├── [3-Faza] Background Jobs & Queue (BullMQ + Redis)
   │
   ├── [4-Faza] Qidiruv va DB Indekslarini Optimallashtirish (GIN / Full-Text)
   │
   ├── [5-Faza] "God Services" ni Use-Case larga ajratish (Clean Architecture)
   │
   └── [6-Faza] Enterprise Monitoring & Observability (Pino + Prometheus)
```

---

## 1-FAZA: Tezkor Texnik Qarzlar va Tozalash (Quick Wins)
> **Maqsad:** Kod bazasini kichik, ammo muhim code smell lardan tozalash.

- [ ] **1.1. `AssetsService` dagi dublikat injectionni to‘g‘rilash:**
  * Fayl: `backend/src/assets/assets.service.ts`
  * Hozirgi holat: Constructor ichida `codeGeneratorService` va `codeGen` bir xil klass ikki marta kiritilgan (19-20 qatorlar).
  * Yechim: `codeGen` olib tashlanadi va barcha chaqiruvlar yagona `codeGeneratorService` ga birlashtiriladi.

- [ ] **1.2. `where: any` larni to‘liq Typescript turlariga o‘tkazish:**
  * Fayl: `backend/src/assets/assets.service.ts` va boshqa servislardagi filterlar.
  * Hozirgi holat: `const where: any = {};`
  * Yechim: `const where: Prisma.AssetWhereInput = {};` ga almashtirilib, Type-Safety tiklanadi.

- [ ] **1.3. `@Optional()` aylanma bog‘liqliklarni (Circular Dependency) bartaraf etish:**
  * `AssetsService` dagi `@Optional() private transfersService?: TransfersService` to‘g‘rilanadi.
  * Yechim: 2-fazadagi Domain Eventlar orqali bu bog‘liqlik butunlay uziladi.

---

## 2-FAZA: Event-Driven Architecture (Voqealarga asoslangan arxitektura)
> **Maqsad:** Servislarning bir-biriga haddan tashqari qattiq bog‘lanib qolishini (Tight Coupling) yo‘qotish.

- [ ] **2.1. `@nestjs/event-emitter` modulini o‘rnatish va ulash:**
  * Asosiy operatsiyalar sinxron chaqiruvlardan chiqariladi.
- [ ] **2.2. Domain Eventlar paketini yaratish (`backend/src/events/domain/`):**
  * `AssetCreatedEvent` (yangi aktiv kiritilganda)
  * `AssetTransferredEvent` (xona yoki MOL o‘zgarganda)
  * `StockFulfilledEvent` (ombordan tovar berilganda)
  * `WriteOffApprovedEvent` (hisobdan chiqarish tasdiqlanganda)
- [ ] **2.3. Asinxron Listenerlarni ajratish:**
  * **AuditListener:** Voqea sodir bo‘lganda avtomatik `systemAuditService.log` chaqiradi.
  * **NotificationListener:** Foydalanuvchilarga xabarnoma jo‘natadi.
  * **SocketListener:** WebSocket orqali frontendga jonli signal beradi.
  * **StampArchiveListener:** Rasmiy hujjatlar muhrini arxivlaydi.
  * *Natija:* `AssetsService` yoki `RequestsService` faqat o‘z biznes logikasini bajaradi va 1 qator `this.eventEmitter.emit(...)` qiladi, boshqa servislarni boshqarishdan ozod bo‘ladi.

---

## 3-FAZA: Asinxron Navbatlar va Fon Jarayonlari (BullMQ + Redis)
> **Maqsad:** Og‘ir jarayonlar vaqtida Node.js Event Loop band bo‘lib qolishining oldini olish.

- [ ] **3.1. Redis va BullMQ infratuzilmasini sozlash (`docker-compose.yml`):**
  * Redis kesh va navbatlar serveri sifatida ulanadi.
- [ ] **3.2. Og‘ir jarayonlarni Queue Processorlarga o‘tkazish:**
  * **PDFGeneratorProcessor:** Rasmiy OS-1, OS-2, OS-4, INV-19 davlat aktlarini fonda render qilish.
  * **BulkQRGeneratorProcessor:** 1000+ ta aktiv uchun QR stikerlarini ZIP arxiv qilib generatsiya qilish.
  * **ExcelImportProcessor:** 5000+ qatorlik katta Excel fayllarni xatoliklarsiz, qismlarga bo‘lib (chunking) bazaga import qilish.
  * **EmailNotificationProcessor:** Tashqi SMTP server orqali bildirishnomalarni jo‘natish.

---

## 4-FAZA: Qidiruv va Ma’lumotlar Bazasi Unumdorligi (DB & Search)
> **Maqsad:** 100,000+ ta aktiv va millionlab harakatlar yozuvida ham qidiruvni <50ms tezlikda ushlab turish.

- [ ] **4.1. PostgreSQL Trigram va GIN Indekslarini kiritish:**
  * `backend/prisma/schema.prisma` ga PostgreSQL `pg_trgm` kengaytmasini ulash:
    ```prisma
    @@index([inventoryNumber, serialNumber])
    ```
  * `item.name`, `item.model` va `inventoryNumber` ustida `GIN (trigram)` indeks yaratish. Bu `ILIKE '%...%'` qidiruvlarining tezligini 10–20 barobarga oshiradi.
- [ ] **4.2. Redis Caching Qatlami:**
  * Bosh panel statistikasi (`/api/dashboard/summary`) uchun 60 soniyalik kesh.
  * Ruxsatlar katalogi (`/api/users/permissions/catalog`) uchun 1 soatlik kesh.
  * Tashkiliy tuzilma daraxti (`/api/organization/tree`) uchun o‘zgarishgacha bo‘lgan kesh.

---

## 5-FAZA: "God Services" ni Use-Case larga Ajratish (Clean Architecture)
> **Maqsad:** 960+ qatorli servislarni o‘qish, tushunish va testlash oson bo‘lgan kichik Use-Case klasslariga bo‘lish.

- [ ] **5.1. `AssetsService` ni alohida Use-Case larga taqsimlash (`backend/src/assets/use-cases/`):**
  * `CreateAssetUseCase.ts` (~120 qator)
  * `UpdateAssetUseCase.ts` (~80 qator)
  * `TransferAssetUseCase.ts` (~150 qator)
  * `ImportAssetsExcelUseCase.ts` (~200 qator)
  * `ExportAssetsExcelUseCase.ts` (~100 qator)
  * `GenerateAssetQrUseCase.ts` (~90 qator)
  * *Natija:* `AssetsService` faqat Facade vazifasini o‘taydi, har bir Use-Case o‘zining mustaqil unit testiga ega bo‘ladi.
- [ ] **5.2. `WarehouseService` ni Use-Case larga ajratish:**
  * `StockInflowUseCase.ts` (Kirim)
  * `StockOutflowUseCase.ts` (Chiqim / Tarqatish)
  * `StockAdjustmentUseCase.ts` (Qoldiqni to‘g‘rilash)

---

## 6-FAZA: Enterprise Monitoring, Logging va Xavfsizlik (Observability)
> **Maqsad:** Tizim holatini real vaqtda kuzatish va nosozliklarni darhol aniqlash.

- [ ] **6.1. Strukturaviy Loglash (Pino Logger):**
  * `nestjs-pino` orqali barcha loglarni JSON formatda yig‘ish.
  * Har bir HTTP so‘rovga `X-Correlation-ID` biriktirish (Frontend $\rightarrow$ Backend $\rightarrow$ Database zanjirini to‘liq kuzatish).
- [ ] **6.2. Prometheus Metriklari va Grafana:**
  * Endpointlarning javob berish vaqti (Latency p95, p99).
  * PostgreSQL connection pool holati.
  * Xotira (RAM) va Event Loop kechikishi (Lag).
- [ ] **6.3. Dinamik RBAC jadvallari (Kelajakdagi SaaS talabi uchun):**
  * Agar loyiha boshqa tashkilotlarga sotilsa yoki foydalanuvchilar o‘zlari interfeysdan yangi rol ochishi kerak bo‘lsa:
  * `RoleType` enum o‘rniga `Role`, `Permission`, `RolePermission`, `UserRole` alohida jadvallariga migratsiya qilish.

---

## 📋 REFAKTORING METRIKALARI VA KUTILAYOTGAN NATIJALAR

| Mezon | Hozirgi holat (v1.0) | v2.0 Refaktoringdan so‘ng |
| :--- | :---: | :---: |
| **Arxitektura Bahosi** | 8.4 / 10 | **9.6 / 10** |
| **AssetsService hajmi** | 962 qator (God Service) | Har bir Use-Case < 150 qator |
| **Bog‘liqlik (Coupling)** | Servislar ichida sinxron | Event-Driven (to‘liq ajratilgan) |
| **Og‘ir hisobotlar (PDF/Excel)** | Asosiy Node.js oqimida | BullMQ Redis Queue (Fonda) |
| **Katta qidiruv tezligi (50k aktiv)** | 1.5 – 3.0 soniya (Seq Scan) | **< 40 ms** (GIN Trigram Index) |
| **Loglash standarti** | Standart matnli konsol | JSON Structured + Correlation ID |
| **Dashboard DB yuklamasi** | Har bir refreshda DB ga so‘rov | Redis kesh (DB yuki 70% kamroq) |

---

*Hujjat tuzilgan sana: 25-Sentyabr, 2026-yil*  
*Status: Tasdiqlangan / v1.0 topshirilgandan so‘ng amalga oshirishga tavsiya etiladi*
