# Universitet Ombor va Inventar Boshqaruv Tizimi (UWMS)
### University Warehouse & Asset Management System

UWMS — Universitetlar uchun maxsus ishlab chiqilgan, asosiy vositalarni (kompyuter, proyektor, mebellar) xonalar va kafedralar kesimida hisobga oluvchi, sarflanuvchi materiallar omborini yurituvchi, talabnomalar (zayavkalar) oqimini avtomatlashtiruvchi va mobil QR-kod orqali inventarizatsiya o‘tkazuvchi korporativ tizim.

> [!IMPORTANT]
> **DIQQAT: BARCHA AI AGENTLAR VA DASTURCHILAR UCHUN QAT'IY QOIDALAR!**  
> Loyihada kod yozish, o‘zgartirish yoki rejalashtirishdan oldin [AGENTS.md](file:///c:/Users/dRuswer/Documents/uwms/AGENTS.md) va [.agents/rules/00-strict-rules.md](file:///c:/Users/dRuswer/Documents/uwms/.agents/rules/00-strict-rules.md) fayllaridagi qat’iy qoidalar bilan tanishib chiqish **shart**.  
> **Asosiy cheklovlar:** Faqat `@arco-design/web-react` UI, faqat `react-router-dom` routing, faqat `@tanstack/react-query` server state, hech qanday mock yoki hardcoded ma’lumotlarga yo‘l qo‘yilmaydi, barcha harakatlar `prisma.$transaction` orqali bo‘lishi shart.

---

## 🏗 Texnologiyalar Steki

* **Frontend:** React 18, Vite, TypeScript, `@arco-design/web-react` (ByteDance UI Design System), `@arco-design/web-react/icon`, `@tanstack/react-query`, Zustand, HTML5 QR Scanner.
* **Backend:** Node.js, NestJS (Modular Architecture), TypeScript, Prisma ORM, Swagger OpenAPI, JWT & Passport.
* **Ma’lumotlar bazasi:** PostgreSQL (ACID tranzaksiyalari, to‘liq harakatlar tarixi va audit log).

---

## 📁 Loyiha Strukturasi

```text
uwms/
├── backend/                       # NestJS API Server
│   ├── prisma/
│   │   ├── schema.prisma          # To‘liq relyatsion ma’lumotlar bazasi modeli
│   │   └── seed.ts                # Dastlabki namunaviy ma’lumotlar
│   ├── src/
│   │   ├── prisma/                # Global Prisma ma’lumotlar bazasi servisi
│   │   ├── app.module.ts          # Asosiy NestJS moduli
│   │   └── main.ts                # Swagger va CORS sozlangan kirish nuqtasi
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                      # React + Arco Design SPA
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout/            # Sider, Header, Rol almashtirgich, Dark Mode
│   │   ├── pages/
│   │   │   ├── Dashboard/         # Statistikalar, kam qolgan tovarlar xabari
│   │   │   ├── Assets/            # Asosiy vositalar (QR kod, Stiker chop etish, Siljish)
│   │   │   ├── Warehouse/         # Sarf materiallari va to‘ldirish
│   │   │   ├── Movements/         # Kirim/Siljish/Spisanie audit reestri
│   │   │   ├── Requests/          # Zayavkalar va tasdiqlash oqimi
│   │   │   ├── Organization/      # Fakultet -> Kafedra -> Xonalar daraxti
│   │   │   └── Audit/             # Xona bo‘yicha QR-skaner mobil auditi
│   │   ├── store/                 # Zustand (Auth va Inventar holati)
│   │   └── types/                 # TypeScript modellar
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🚀 Ishga Tushirish

### 1. Frontend (Mijoz interfeysi):
```bash
cd frontend
npm install
npm run dev
```
Frontend brauzerda ochiladi: **`http://localhost:5173`**

### 2. Backend (API Server):
```bash
cd backend
npm install
npm run prisma:generate
npm run start:dev
```
Backend server: **`http://localhost:4000`**  
Swagger API hujjatlari: **`http://localhost:4000/api/docs`**

---

## 👥 Foydalanuvchi Rollari va Tizimga Kirish

Tizimda har bir rol uchun qat’iy server-side **RBAC (Role-Based Access Control)** va **JWT autentifikatsiya** o‘rnatilgan. Barcha foydalanuvchilar `/login` sahifasi orqali tizimga kiradi:

| № | Rol | Foydalanuvchi (Login) | Boshlang‘ich Parol | Mas’uliyati va Huquqlari |
|---|---|---|---|---|
| 1 | **Super Administrator** | `admin` | `admin123` | Tizim konfiguratsiyasi, foydalanuvchilar, audit jurnali, zaxira nusxalari. |
| 2 | **Bosh Omborchi** | `warehouse` | `admin123` | Tovarlar kirimi (OS-1), chiqimi (OS-2), qaytarish, ombor qoldiqlari. |
| 3 | **MOL / Kafedra Mudiri** | `mol` | `admin123` | Biriktirilgan mulklar nazorati, ko‘chirishni qabul qilish, zayavkalar. |
| 4 | **O‘qituvchi / Xodim** | `teacher` | `admin123` | Sarflanuvchi materiallar uchun zayavka (talabnoma) yuborish. |
| 5 | **Ichki Auditor** | `auditor` | `admin123` | Xonalar bo‘yicha QR-skaner auditi, kamomad tahlili, INV-19 akti. |

> 🔒 **Xavfsizlik eslatmasi:** Har bir foydalanuvchi birinchi marta tizimga kirganda, xavfsizlik siyosati (`mustChangePassword`) talabiga ko‘ra o‘zining shaxsiy murakkab parolini o‘rnatishi shart.

---

## 🔐 Production Xavfsizlik va Kriptografik Kalitlar

1. **Production JWT Secret Yaratish:**
   Production muhitida standart yoki zaif kalit ishlatish server startup vaqtidayoq bloklanadi. Kriptografik 512-bit (128 ta o‘n oltilik belgi) tasodifiy kalit yaratish:
   ```bash
   cd backend
   npm run generate:secret
   ```

2. **Muhit O‘zgaruvchilari Gigiyenasi:**
   - Hech qachon `.env` faylini Git repozitoriyasiga yoki ochiq arxivga yuklamang (`.gitignore` da qat’iy bloklangan).
   - Server sozlamalari uchun `backend/.env.example` andozasidan foydalaning.

3. **Toza Production Arxivini Yaratish:**
   Loyihani auditga yoki serverga deploy qilish uchun `node_modules/`, `dist/` va `.env` fayllaridan tozalangan ixcham ZIP arxiv yaratish:
   ```bash
   cd backend
   npm run package:clean
   ```
   *Yoki loyiha ildizidan:*
   ```bash
   node scripts/package-clean.js
   ```

