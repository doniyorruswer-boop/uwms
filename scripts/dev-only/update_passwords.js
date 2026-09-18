/**
 * ⚠️ FAQAT DEV UCHUN, PRODUCTIONDA ISHLATMANG!
 * 
 * Ushbu skript faqat lokal test va ishlab chiqish muhitida parollarni
 * standart 'admin123' qiymatiga tiklash uchun ishlatiladi.
 */

if (process.env.NODE_ENV === 'production') {
  console.error('❌ XATOLIK: Ushbu skriptni PRODUCTION muhitida ishga tushirish qat’iyan taqiqlangan!');
  process.exit(1);
}

const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'));
const bcrypt = require(path.resolve(__dirname, '../../backend/node_modules/bcrypt'));

const prisma = new PrismaClient();

async function main() {
  console.log('⚠️ [DEV-ONLY] Barcha foydalanuvchilar parolini test paroli (admin123) ga tiklash...');
  const hash = await bcrypt.hash('admin123', 10);
  const result = await prisma.user.updateMany({
    data: {
      password: hash,
      mustChangePassword: true,
    },
  });
  console.log(`✅ [DEV-ONLY] ${result.count} ta foydalanuvchi paroli yangilandi (mustChangePassword: true).`);
}

main()
  .catch((e) => {
    console.error('Xatolik:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
