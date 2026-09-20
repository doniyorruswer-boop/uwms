# UWMS — CLAUDE & AI AGENT STRICT INSTRUCTIONS

Barcha AI agentlar (Claude, Antigravity, ChatGPT, Cursor) uchun ushbu loyihada ishlashning **qat’iy va majburiy qoidalari**:

## 1. UI STANDARTI (QAT'IYAN CHEKLANGAN)
- Faqat **`@arco-design/web-react`** va **`@arco-design/web-react/icon`**.
- Boshqa hech qanday UI kutubxona (Tailwind, AntD, MUI, Bootstrap, Lucide) qo‘shilmaydi va ishlatilmaydi.
- Routing faqat **`react-router-dom`** orqali.
- Server holati faqat **`@tanstack/react-query`** orqali. `zustand` faqat lokal UI parametrlari uchun.

## 2. BACKEND VA MA'LUMOTLAR
- Hech qanday mock yoki hardcoded yozuvlar bo‘lmasligi shart.
- Avval Backend (Prisma -> DTO -> Service -> Controller), keyin Frontend integratsiyasi.
- Ombor qoldig‘i, buyurtma tasdiqlash va harakatlar faqat **`prisma.$transaction`** orqali amalga oshiriladi.
- Ombor qoldig‘i noldan pastga tushishi taqiqlanadi. Har bir harakat ortidan audit jurnali yozilishi shart.

## 3. XAVFSIZLIK VA RBAC
- Haqiqiy JWT token va `JwtAuthGuard` + `RolesGuard`. Demo role switcher productionda taqiqlanadi.
- Rollar (Prisma `RoleType` enum): `SUPER_ADMIN`, `RECTOR`, `VICE_RECTOR_FINANCE`, `HEAD_WAREHOUSE`, `CHIEF_ACCOUNTANT`, `COMMENDANT`, `MOL`, `AUDITOR`, `EMPLOYEE`.

## 4. UNIVERSITET SPETSIFIKASI
- Moliyalashtirish manbai: `BYUDJET`, `KONTRAKT_RIVOJLANTIRISH`, `GRANT`.
- Kafedralar oylik sarf-xarajat limiti.
- Rasmiy hujjatlar (OS-1, OS-2, OS-4, INV-19) faqat real bazaviy DTO orqali shakllantiriladi.
