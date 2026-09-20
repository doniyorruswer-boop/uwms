import { PrismaClient, RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- [UWMS] Seeding Essential System Foundation ---');

  const defaultPassword = process.env.SYSTEM_DEFAULT_PASSWORD || 'Admin123!@#';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Fakultetlar va Ma'muriy Bo'limlar
  console.log('1. Setting up core organizational structure...');

  const rectorate = await prisma.department.upsert({
    where: { code: 'REKTORAT' },
    update: { name: 'Universitet Rektorati va Rahbariyat' },
    create: {
      name: 'Universitet Rektorati va Rahbariyat',
      code: 'REKTORAT',
      type: 'RECTORATE',
    },
  });

  const accountingDept = await prisma.department.upsert({
    where: { code: 'BUXGALTERIYA' },
    update: { name: 'Buxgalteriya va Moliya-iqtisodiyot bo‘limi' },
    create: {
      name: 'Buxgalteriya va Moliya-iqtisodiyot bo‘limi',
      code: 'BUXGALTERIYA',
      type: 'DEPARTMENT',
    },
  });

  const itCenter = await prisma.department.upsert({
    where: { code: 'ATM_CENTER' },
    update: { name: 'Axborot Texnologiyalari Markazi (ATM)' },
    create: {
      name: 'Axborot Texnologiyalari Markazi (ATM)',
      code: 'ATM_CENTER',
      type: 'DIVISION',
    },
  });

  const facilitiesDept = await prisma.department.upsert({
    where: { code: 'XOJALIK' },
    update: { name: 'Xo‘jalik Bo‘limi va Komendantlik' },
    create: {
      name: 'Xo‘jalik Bo‘limi va Komendantlik',
      code: 'XOJALIK',
      type: 'DEPARTMENT',
    },
  });

  const itFaculty = await prisma.department.upsert({
    where: { code: 'IT_FACULTY' },
    update: { name: 'Kompyuter Injiniringi Fakulteti', type: 'FACULTY' },
    create: {
      name: 'Kompyuter Injiniringi Fakulteti',
      code: 'IT_FACULTY',
      type: 'FACULTY',
    },
  });

  const seChair = await prisma.department.upsert({
    where: { code: 'SE_CHAIR' },
    update: { name: 'Dasturiy Injiniring Kafedrasi', parentId: itFaculty.id },
    create: {
      name: 'Dasturiy Injiniring Kafedrasi',
      code: 'SE_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  // 2. Tizim Asosiy Omborxonalari
  console.log('2. Setting up central warehouses...');

  const mainWarehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'Markaziy Asosiy Omborxona',
      location: 'A-bino, 1-qavat',
      isMain: true,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Markaziy Asosiy Omborxona',
      location: 'A-bino, 1-qavat',
      isMain: true,
    },
  });

  const secondaryWarehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      name: '2-sonli Filial Sarf Omborxonasi',
      location: 'B-bino, yerto‘la',
      isMain: false,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: '2-sonli Filial Sarf Omborxonasi',
      location: 'B-bino, yerto‘la',
      isMain: false,
    },
  });

  // 3. Tizim Asosiy Kategoriyalari
  console.log('3. Setting up system categories...');

  await prisma.category.upsert({
    where: { name: 'Kompyuter va IT uskunalari' },
    update: {},
    create: {
      name: 'Kompyuter va IT uskunalari',
      description: 'Noutbuklar, monitorlar, serverlar, interaktiv doskalar',
    },
  });

  await prisma.category.upsert({
    where: { name: 'Nusxalash va bosma uskunalari' },
    update: {},
    create: {
      name: 'Nusxalash va bosma uskunalari',
      description: 'Lazerniy printerlar, MFUlar, skanerlar',
    },
  });

  await prisma.category.upsert({
    where: { name: 'Mebel va ofis jihozlari' },
    update: {},
    create: {
      name: 'Mebel va ofis jihozlari',
      description: 'Partalar, stullar, shkaflar va metall seyflar',
    },
  });

  await prisma.category.upsert({
    where: { name: 'Sarf materiallari va kanselyariya' },
    update: {},
    create: {
      name: 'Sarf materiallari va kanselyariya',
      description: 'A4 qog‘oz, kartrijlar, tonerlar, markerlar va papkalar',
    },
  });

  // 4. Standart Tizim Foydalanuvchilari (RBAC)
  console.log('4. Setting up baseline admin and system role accounts...');

  // 4.1 Super Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      role: RoleType.SUPER_ADMIN,
      departmentId: itCenter.id,
      isActive: true,
    },
    create: {
      fullName: 'Bosh Administrator',
      username: 'admin',
      email: 'admin@university.uz',
      password: passwordHash,
      phone: '+998 71 200 00 01',
      position: 'Axborot texnologiyalari markazi boshlig‘i',
      role: RoleType.SUPER_ADMIN,
      departmentId: itCenter.id,
      mustChangePassword: true,
    },
  });

  // 4.2 Bosh Ombor Mudiri
  const warehouseChief = await prisma.user.upsert({
    where: { username: 'omborchi' },
    update: {
      role: RoleType.HEAD_WAREHOUSE,
      departmentId: facilitiesDept.id,
      isActive: true,
    },
    create: {
      fullName: 'Toshmatov Omon',
      username: 'omborchi',
      email: 'ombor@university.uz',
      password: passwordHash,
      phone: '+998 90 123 45 67',
      position: 'Bosh ombor mudiri',
      role: RoleType.HEAD_WAREHOUSE,
      departmentId: facilitiesDept.id,
      mustChangePassword: true,
    },
  });

  // 4.3 Moddiy Javobgar Shaxs (MOL)
  await prisma.user.upsert({
    where: { username: 'kafedra_mudiri' },
    update: {
      role: RoleType.MOL,
      departmentId: seChair.id,
      isActive: true,
    },
    create: {
      fullName: 'Prof. Alimov Jasur',
      username: 'kafedra_mudiri',
      email: 'alimov@university.uz',
      password: passwordHash,
      phone: '+998 93 345 67 89',
      position: 'Dasturiy injiniring kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: seChair.id,
      mustChangePassword: true,
    },
  });

  // 4.4 Bosh Buxgalter
  await prisma.user.upsert({
    where: { username: 'bosh_hisobchi' },
    update: {
      role: RoleType.CHIEF_ACCOUNTANT,
      departmentId: accountingDept.id,
      isActive: true,
    },
    create: {
      fullName: 'Nazarova Munira',
      username: 'bosh_hisobchi',
      email: 'munira.hisobchi@university.uz',
      password: passwordHash,
      phone: '+998 93 888 99 00',
      position: 'Bosh hisobchi',
      role: RoleType.CHIEF_ACCOUNTANT,
      departmentId: accountingDept.id,
      mustChangePassword: true,
    },
  });

  // 4.5 Moliya-iqtisodiyot bo'yicha Prorektor
  await prisma.user.upsert({
    where: { username: 'prorektor_moliya' },
    update: {
      role: RoleType.VICE_RECTOR_FINANCE,
      departmentId: rectorate.id,
      isActive: true,
    },
    create: {
      fullName: 'Prof. Mahmudov Elyor',
      username: 'prorektor_moliya',
      email: 'elyor.prorektor@university.uz',
      password: passwordHash,
      phone: '+998 90 777 00 11',
      position: 'Moliya va iqtisodiy ishlar bo‘yicha prorektor',
      role: RoleType.VICE_RECTOR_FINANCE,
      departmentId: rectorate.id,
      mustChangePassword: true,
    },
  });

  // 4.6 Rektor
  await prisma.user.upsert({
    where: { username: 'rektor' },
    update: {
      role: RoleType.RECTOR,
      departmentId: rectorate.id,
      isActive: true,
    },
    create: {
      fullName: 'Akad. Karimov O‘ktam',
      username: 'rektor',
      email: 'rector@university.uz',
      password: passwordHash,
      phone: '+998 71 200 00 00',
      position: 'Universitet Rektori',
      role: RoleType.RECTOR,
      departmentId: rectorate.id,
      mustChangePassword: true,
    },
  });

  // 4.7 Bosh Komendant
  await prisma.user.upsert({
    where: { username: 'komendant' },
    update: {
      role: RoleType.COMMENDANT,
      departmentId: facilitiesDept.id,
      isActive: true,
    },
    create: {
      fullName: 'Sodiqov Anvar',
      username: 'komendant',
      email: 'anvar.komendant@university.uz',
      password: passwordHash,
      phone: '+998 94 999 11 22',
      position: 'Bosh bino komendanti',
      role: RoleType.COMMENDANT,
      departmentId: facilitiesDept.id,
      mustChangePassword: true,
    },
  });

  // 4.8 Ichki Auditor
  await prisma.user.upsert({
    where: { username: 'auditor' },
    update: {
      role: RoleType.AUDITOR,
      isActive: true,
    },
    create: {
      fullName: 'Narzullayev Farhod',
      username: 'auditor',
      email: 'audit@university.uz',
      password: passwordHash,
      phone: '+998 90 555 66 77',
      position: 'Ichki nazorat va audit inspektori',
      role: RoleType.AUDITOR,
      mustChangePassword: true,
    },
  });

  // 5. Birlamchi Xonalar
  console.log('5. Setting up initial facility rooms...');

  const roomBuxg = await prisma.room.findFirst({
    where: { number: '105', building: 'Bosh ma’muriy bino' },
  });
  if (!roomBuxg) {
    await prisma.room.create({
      data: {
        number: '105',
        name: 'Bosh hisobchi va buxgalteriya kabineti',
        floor: 1,
        building: 'Bosh ma’muriy bino',
        departmentId: accountingDept.id,
        responsibleUserId: admin.id,
      },
    });
  }

  const roomOmbor = await prisma.room.findFirst({
    where: { number: '110', building: 'Bosh ma’muriy bino' },
  });
  if (!roomOmbor) {
    await prisma.room.create({
      data: {
        number: '110',
        name: 'Xo‘jalik xizmati va omborxona',
        floor: 1,
        building: 'Bosh ma’muriy bino',
        departmentId: facilitiesDept.id,
        responsibleUserId: warehouseChief.id,
      },
    });
  }

  console.log('✅ System foundation seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Error during system seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
