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

## 👥 Foydalanuvchi Rollari (Test qilish uchun)

Frontend interfeysining yuqori o‘ng burchagidagi **"Rolni o‘zgartirish"** tugmasi orqali istalgan rolga bir klikda o‘tish mumkin:
1. **Bosh Omborchi** (Toshmatov Omon) — Kirim, chiqim, siljish va qoldiqlarni boshqarish.
2. **MOL / Kafedra Mudiri** (Prof. Alimov Jasur) — Kafedraga biriktirilgan mulklar nazorati va talabnomalarni tasdiqlash.
3. **O‘qituvchi / Xodim** (Karimov Rustam) — Talabnomalar yuborish.
4. **Ichki Auditor** (Narzullayev Farhod) — Inventarizatsiya va kamomadlarni tekshirish.
5. **Super Administrator** — Tizim to‘liq boshqaruvi.
