const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const users = await prisma.user.findMany({
    select: { id: true, username: true, fullName: true, role: true },
  });
  console.log('Found users in database:', users);

  const updated = await prisma.user.updateMany({
    data: {
      password: hash,
      isActive: true,
    },
  });

  console.log(`Successfully updated ${updated.count} users with password 'admin123' and isActive: true.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
