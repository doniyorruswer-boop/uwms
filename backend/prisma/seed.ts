import { PrismaClient, RoleType, ItemType, AssetStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding comprehensive university inventory database...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const userPasswordHash = await bcrypt.hash('user123', 10);

  // 1. Departments (Tashkiliy tuzilma)
  const itFaculty = await prisma.department.upsert({
    where: { code: 'IT_FACULTY' },
    update: {},
    create: {
      name: 'Kompyuter Injiniringi Fakulteti',
      code: 'IT_FACULTY',
      type: 'FACULTY',
    },
  });

  const seChair = await prisma.department.upsert({
    where: { code: 'SE_CHAIR' },
    update: {},
    create: {
      name: 'Dasturiy Injiniring Kafedrasi',
      code: 'SE_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  const cyberChair = await prisma.department.upsert({
    where: { code: 'CYBER_CHAIR' },
    update: {},
    create: {
      name: 'Kiberxavfsizlik Kafedrasi',
      code: 'CYBER_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  // 1.1 Administrative & Service Departments (Rektorat, Buxgalteriya, Kadrlar, ATM, Xo'jalik, ARM)
  const rectorate = await prisma.department.upsert({
    where: { code: 'REKTORAT' },
    update: {},
    create: {
      name: 'Universitet Rektorati va Rahbariyat',
      code: 'REKTORAT',
      type: 'RECTORATE',
    },
  });

  const accountingDept = await prisma.department.upsert({
    where: { code: 'BUXGALTERIYA' },
    update: {},
    create: {
      name: 'Buxgalteriya va Moliya-iqtisodiyot bo‘limi',
      code: 'BUXGALTERIYA',
      type: 'DEPARTMENT',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'KADRLAR' },
    update: {},
    create: {
      name: 'Inson resurslari va Kadrlar bo‘limi',
      code: 'KADRLAR',
      type: 'DEPARTMENT',
    },
  });

  const itCenter = await prisma.department.upsert({
    where: { code: 'ATM_CENTER' },
    update: {},
    create: {
      name: 'Axborot texnologiyalari markazi (ATM)',
      code: 'ATM_CENTER',
      type: 'DIVISION',
    },
  });

  const chancelleryDept = await prisma.department.upsert({
    where: { code: 'DEVONXONA' },
    update: {},
    create: {
      name: 'Devonxona va Arxiv bo‘limi',
      code: 'DEVONXONA',
      type: 'DEPARTMENT',
    },
  });

  const facilitiesDept = await prisma.department.upsert({
    where: { code: 'XOJALIK' },
    update: {},
    create: {
      name: 'Xo‘jalik bo‘limi va Komendantlik',
      code: 'XOJALIK',
      type: 'DEPARTMENT',
    },
  });

  const libraryDept = await prisma.department.upsert({
    where: { code: 'ARM_LIBRARY' },
    update: {},
    create: {
      name: 'Axborot-resurs markazi (ARM / Kutubxona)',
      code: 'ARM_LIBRARY',
      type: 'LIBRARY',
    },
  });

  // 2. Users (Foydalanuvchilar)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: passwordHash, isActive: true },
    create: {
      fullName: 'Bosh Administrator',
      username: 'admin',
      email: 'admin@university.uz',
      password: passwordHash,
      position: 'Axborot texnologiyalari markazi boshlig‘i',
      role: RoleType.SUPER_ADMIN,
    },
  });

  const warehouseChief = await prisma.user.upsert({
    where: { username: 'omborchi' },
    update: { password: passwordHash, isActive: true },
    create: {
      fullName: 'Toshmatov Omon',
      username: 'omborchi',
      email: 'ombor@university.uz',
      password: passwordHash,
      position: 'Bosh ombor mudiri',
      role: RoleType.HEAD_WAREHOUSE,
    },
  });

  const molHead = await prisma.user.upsert({
    where: { username: 'kafedra_mudiri' },
    update: { password: passwordHash, isActive: true },
    create: {
      fullName: 'Prof. Alimov Jasur',
      username: 'kafedra_mudiri',
      email: 'alimov@university.uz',
      password: passwordHash,
      position: 'Kafedra mudiri (MOL)',
      role: RoleType.MOL,
      departmentId: seChair.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { username: 'oqituvchi1' },
    update: { password: passwordHash, isActive: true },
    create: {
      fullName: 'Karimov Rustam',
      username: 'oqituvchi1',
      email: 'karimov@university.uz',
      password: passwordHash,
      position: 'Katta o‘qituvchi',
      role: RoleType.EMPLOYEE,
      departmentId: seChair.id,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { username: 'auditor' },
    update: { password: passwordHash, isActive: true },
    create: {
      fullName: 'Narzullayev Farhod',
      username: 'auditor',
      email: 'audit@university.uz',
      password: passwordHash,
      position: 'Ichki nazorat va audit inspektori',
      role: RoleType.AUDITOR,
    },
  });

  // 3. Rooms (Xonalar)
  const room304 = await prisma.room.create({
    data: {
      number: '304',
      name: 'Dasturiy injiniring o‘quv laboratoriyasi',
      floor: 3,
      building: 'Bosh o‘quv binosi',
      departmentId: seChair.id,
      responsibleUserId: molHead.id,
    },
  });

  const room305 = await prisma.room.create({
    data: {
      number: '305',
      name: 'Kafedra mudiri kabineti',
      floor: 3,
      building: 'Bosh o‘quv binosi',
      departmentId: seChair.id,
      responsibleUserId: molHead.id,
    },
  });

  const room402 = await prisma.room.create({
    data: {
      number: '402',
      name: 'Kiberxavfsizlik maxsus laboratoriyasi',
      floor: 4,
      building: 'Bosh o‘quv binosi',
      departmentId: cyberChair.id,
      responsibleUserId: molHead.id,
    },
  });

  const room101 = await prisma.room.create({
    data: {
      number: '101',
      name: 'Rektorat qabulxonasi va devonxona',
      floor: 1,
      building: 'Bosh ma’muriy bino',
      departmentId: rectorate.id,
      responsibleUserId: admin.id,
    },
  });

  const room105 = await prisma.room.create({
    data: {
      number: '105',
      name: 'Bosh hisobchi va buxgalteriya kabineti',
      floor: 1,
      building: 'Bosh ma’muriy bino',
      departmentId: accountingDept.id,
      responsibleUserId: admin.id,
    },
  });

  const room108 = await prisma.room.create({
    data: {
      number: '108',
      name: 'Inson resurslari va kadrlar bo‘limi',
      floor: 1,
      building: 'Bosh ma’muriy bino',
      departmentId: hrDept.id,
      responsibleUserId: admin.id,
    },
  });

  const room301 = await prisma.room.create({
    data: {
      number: '301',
      name: 'ATM Server va tarmoq boshqaruv xonasi',
      floor: 3,
      building: 'IT Bino',
      departmentId: itCenter.id,
      responsibleUserId: admin.id,
    },
  });

  const room10 = await prisma.room.create({
    data: {
      number: '10',
      name: 'Xo‘jalik xizmati va komendantlik',
      floor: 1,
      building: 'Bosh ma’muriy bino',
      departmentId: facilitiesDept.id,
      responsibleUserId: warehouseChief.id,
    },
  });

  const roomARM = await prisma.room.create({
    data: {
      number: 'ARM-1',
      name: 'Elektron kutubxona va o‘quv zali',
      floor: 2,
      building: 'Kutubxona binosi',
      departmentId: libraryDept.id,
      responsibleUserId: molHead.id,
    },
  });

  // 4. Warehouse
  const mainWarehouse = await prisma.warehouse.create({
    data: {
      name: 'Markaziy Asosiy Omborxona',
      location: 'A-bino, 1-qavat',
      isMain: true,
    },
  });

  // 5. Suppliers & Invoices (Ta'minotchi va Fakturalar)
  const supplierTech = await prisma.supplier.create({
    data: {
      name: 'TechPro Distribution MCHJ',
      inn: '309876541',
      contractNumber: 'TR-2025-099',
      contractDate: new Date('2025-08-20'),
      contactPerson: 'Sultonov Bekzod',
      phone: '+998 90 123 45 67',
      email: 'sales@techpro.uz',
    },
  });

  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'FAK-2025-412',
      invoiceDate: new Date('2025-09-01'),
      totalAmount: 185000000,
      supplierId: supplierTech.id,
      notes: 'Davlat tenderi bo‘yicha universitet kompyuter sinflari uchun xarid',
    },
  });

  // 6. Categories & Items
  const catIT = await prisma.category.upsert({
    where: { name: 'Kompyuter va IT uskunalari' },
    update: {},
    create: { name: 'Kompyuter va IT uskunalari', description: 'Noutbuklar, monitorlar, proyektorlar' },
  });

  const catOffice = await prisma.category.upsert({
    where: { name: 'Mebel va ofis jihozlari' },
    update: {},
    create: { name: 'Mebel va ofis jihozlari', description: 'Stollar, stullar, shkaflar' },
  });

  const catConsumable = await prisma.category.upsert({
    where: { name: 'Kanselyariya va sarf materiallari' },
    update: {},
    create: { name: 'Kanselyariya va sarf materiallari', description: 'Qog‘oz, toner, fayllar' },
  });

  const itemLaptop = await prisma.item.create({
    data: {
      name: 'Lenovo ThinkPad E15 Noutbuki',
      model: 'ThinkPad E15 Gen 4 (Core i5, 16GB, 512GB SSD)',
      sku: 'IT-NB-001',
      itemType: ItemType.FIXED_ASSET,
      unit: 'DONA',
      categoryId: catIT.id,
    },
  });

  const itemProjector = await prisma.item.create({
    data: {
      name: 'Epson EB-E01 Proyektor',
      model: 'EB-E01 3LCD XGA 3300 Lumens',
      sku: 'IT-PRJ-002',
      itemType: ItemType.FIXED_ASSET,
      unit: 'DONA',
      categoryId: catIT.id,
    },
  });

  const itemPaper = await prisma.item.create({
    data: {
      name: 'A4 SvetoCopy Classic Qog‘ozi (500 varaq)',
      model: 'A4 80g/m2 oq',
      sku: 'CNS-A4-010',
      itemType: ItemType.CONSUMABLE,
      unit: 'PACHKA',
      minStockLimit: 25,
      categoryId: catConsumable.id,
    },
  });

  const itemToner = await prisma.item.create({
    data: {
      name: 'HP 85A (CE285A) Qora Toner Kartridj',
      model: 'LaserJet P1102 moslashuvchan',
      sku: 'CNS-TNR-085',
      itemType: ItemType.CONSUMABLE,
      unit: 'DONA',
      minStockLimit: 10,
      categoryId: catConsumable.id,
    },
  });

  // 7. Stock
  await prisma.stock.createMany({
    data: [
      {
        warehouseId: mainWarehouse.id,
        itemId: itemPaper.id,
        quantity: 140,
      },
      {
        warehouseId: mainWarehouse.id,
        itemId: itemToner.id,
        quantity: 4, // Low stock on purpose
      },
    ],
  });

  // 8. Item Instances with Histories
  const laptop1 = await prisma.itemInstance.create({
    data: {
      inventoryNumber: 'INV-2026-001',
      serialNumber: 'LNV-SN-88231',
      qrCode: 'UWMS:INV-2026-001:LNV-SN-88231',
      status: AssetStatus.IN_USE,
      purchaseDate: new Date('2025-09-15'),
      purchasePrice: 9500000,
      warrantyMonths: 24,
      depreciationRate: 20.0,
      itemId: itemLaptop.id,
      roomId: room304.id,
      responsibleUserId: molHead.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
    },
  });

  await prisma.assetHistory.createMany({
    data: [
      {
        assetId: laptop1.id,
        action: 'KIRIM',
        fromLocation: 'TechPro Distribution MCHJ',
        toLocation: 'Markaziy Ombor',
        referenceDoc: 'Faktura № FAK-2025-412',
        executedById: warehouseChief.id,
        note: 'Tender shartnomasi bo‘yicha to‘liq soz holatda qabul qilindi',
      },
      {
        assetId: laptop1.id,
        action: 'KO‘CHIRILDI',
        fromLocation: 'Markaziy Ombor',
        toLocation: '304-laboratoriya (Dasturiy injiniring)',
        fromUser: 'Toshmatov O.',
        toUser: 'Prof. Alimov Jasur',
        referenceDoc: 'Ichki siljish nakladnoyi № 089',
        executedById: warehouseChief.id,
        note: 'Dasturiy injiniring kafedrasi laboratoriyasiga biriktirildi',
      },
    ],
  });

  const laptop2 = await prisma.itemInstance.create({
    data: {
      inventoryNumber: 'INV-2026-002',
      serialNumber: 'LNV-SN-88232',
      qrCode: 'UWMS:INV-2026-002:LNV-SN-88232',
      status: AssetStatus.IN_USE,
      purchaseDate: new Date('2025-09-15'),
      purchasePrice: 9500000,
      warrantyMonths: 24,
      itemId: itemLaptop.id,
      roomId: room304.id,
      responsibleUserId: molHead.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
    },
  });

  const projector1 = await prisma.itemInstance.create({
    data: {
      inventoryNumber: 'INV-2026-003',
      serialNumber: 'EPS-PRJ-4412',
      qrCode: 'UWMS:INV-2026-003:EPS-PRJ-4412',
      status: AssetStatus.IN_USE,
      purchaseDate: new Date('2025-10-01'),
      purchasePrice: 6200000,
      itemId: itemProjector.id,
      roomId: room304.id,
      responsibleUserId: molHead.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
    },
  });

  // 9. Sample Request (Talabnoma)
  const req1 = await prisma.request.create({
    data: {
      requestNumber: 'REQ-2026-012',
      purpose: 'Oraliq nazorat imtihonlari va amaliy mashg‘ulotlar uchun A4 qog‘oz va toner zarur',
      status: 'APPROVED_BY_HEAD',
      requesterId: employee.id,
      departmentId: seChair.id,
      approvedById: molHead.id,
      approvalNote: 'Kafedra mudiri tasdiqladi. Ombordan berilsin.',
    },
  });

  await prisma.requestItem.createMany({
    data: [
      {
        requestId: req1.id,
        itemId: itemPaper.id,
        requestedQty: 10,
        approvedQty: 10,
      },
      {
        requestId: req1.id,
        itemId: itemToner.id,
        requestedQty: 2,
        approvedQty: 2,
      },
    ],
  });

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
