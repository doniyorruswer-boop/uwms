# ⚠️ FAQAT DEV UCHUN, PRODUCTIONDA ISHLATMANG!

Ushbu papkadagi skriptlar faqat lokal ishlab chiqish (Development) va avtomatlashtirilgan test muhiti uchun mo‘ljallangan.

---

### 🛑 XAVFSIZLIK OGOHLANTIRISHI (STRICT SECURITY RULE):
1. **Productionda ishlatish qat’iyan taqiqlanadi!**
   - Ushbu skriptlar barcha foydalanuvchilar parolini test qiymatiga (`admin123`) o‘zgartirib yuborishi mumkin.
   - Skript ichida `process.env.NODE_ENV === 'production'` himoyasi o‘rnatilgan bo‘lib, productionda avtomatik to‘xtaydi.
2. **Productionda parollar qanday boshqariladi?**
   - Yangi foydalanuvchi yaratilganda yoki admin parolni tiklaganda tizim avtomatik ravishda `mustChangePassword: true` bayrog‘ini o‘rnatadi.
   - Foydalanuvchi tizimga birinchi marta kirganda, xavfsizlik talablariga mos ravishda yangi kuchli parol o‘rnatish majburiy hisoblanadi (`POST /api/auth/change-password`).
   - Parol o‘rnatilgach, `mustChangePassword` avtomatik `false` ga o‘tadi va tizim audit jurnaliga yoziladi.
