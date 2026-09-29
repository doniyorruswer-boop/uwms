import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, RoleType, FundingSource } from '@prisma/client';
import { CodeGeneratorService } from '../common/code-generator.service';
import { ImportExcelAssetRowDto, ReturnAssetDto, MassMolHandoffDto, BatchTransferAssetDto } from './dto/asset.dto';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { TransfersService } from '../transfers/transfers.service';

import { NotificationsService } from '../notifications/notifications.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { NotificationType } from '@prisma/client';
import { SYSTEM_AUDIT_ACTIONS } from '../common/constants';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private codeGeneratorService: CodeGeneratorService,
    private codeGen: CodeGeneratorService,
    private notificationsService: NotificationsService,
    private systemAuditService: SystemAuditService,
    private documentStampsService: DocumentStampsService,
    @Optional() private transfersService?: TransfersService,
  ) {}

  async getAllAssets(query?: {
    search?: string;
    status?: string;
    roomId?: string;
    fundingSource?: string;
    responsibleUserId?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as AssetStatus;
    }

    if (query?.roomId && query.roomId !== 'ALL') {
      where.roomId = query.roomId;
    }

    if (query?.fundingSource && query.fundingSource !== 'ALL') {
      where.fundingSource = query.fundingSource as FundingSource;
    }

    if (query?.responsibleUserId && query.responsibleUserId !== 'ALL') {
      where.responsibleUserId = query.responsibleUserId;
    }

    if (query?.search) {
      const isWarehouseSearch = /ombor/i.test(query.search);
      where.OR = [
        { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { item: { name: { contains: query.search, mode: 'insensitive' } } },
        { item: { model: { contains: query.search, mode: 'insensitive' } } },
        { item: { category: { name: { contains: query.search, mode: 'insensitive' } } } },
        { room: { name: { contains: query.search, mode: 'insensitive' } } },
        { room: { number: { contains: query.search, mode: 'insensitive' } } },
        { room: { department: { name: { contains: query.search, mode: 'insensitive' } } } },
        { room: { department: { parent: { name: { contains: query.search, mode: 'insensitive' } } } } },
        { responsibleUser: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { responsibleUser: { department: { name: { contains: query.search, mode: 'insensitive' } } } },
      ];
      if (isWarehouseSearch) {
        where.OR.push({ roomId: null });
      }
    }

    const isPaginated = query?.page !== undefined || query?.limit !== undefined;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 25));
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'inventoryNumber', 'purchasePrice', 'purchaseDate'];
    const sortField = query && (query as any).sortBy && allowedSortFields.includes((query as any).sortBy)
      ? (query as any).sortBy
      : 'createdAt';
    const sortOrder = query && (query as any).sortOrder === 'asc' ? 'asc' : 'desc';

    const assetInclude = {
      item: { include: { category: true } },
      room: {
        include: {
          department: {
            include: { parent: true },
          },
        },
      },
      responsibleUser: {
        select: {
          id: true,
          fullName: true,
          department: {
            include: { parent: true },
          },
        },
      },
      supplier: true,
    };

    const [instances, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.itemInstance.findMany({
            where,
            include: assetInclude,
            orderBy: { [sortField]: sortOrder },
            skip,
            take: limit,
          }),
          this.prisma.itemInstance.count({ where }),
        ])
      : [
          await this.prisma.itemInstance.findMany({
            where,
            include: assetInclude,
            orderBy: { [sortField]: sortOrder },
          }),
          0,
        ];

    const mapped = instances.map((inst) => {
      const dep = this.codeGen.calculateDepreciation(
        inst.purchasePrice ? Number(inst.purchasePrice) : 0,
        inst.purchaseDate || inst.createdAt,
        inst.item.category.name,
      );

      return {
        id: inst.id,
        inventoryNumber: inst.inventoryNumber,
        serialNumber: inst.serialNumber,
        qrCode: inst.qrCode,
        status: inst.status,
        purchaseDate: inst.purchaseDate?.toISOString().substring(0, 10),
        purchasePrice: inst.purchasePrice ? Number(inst.purchasePrice) : 0,
        fundingSource: inst.fundingSource,
        warrantyMonths: inst.warrantyMonths,
        depreciationRate: inst.depreciationRate || dep.annualRate,
        accumulatedDepreciation:
          inst.accumulatedDepreciation !== null && inst.accumulatedDepreciation !== undefined
            ? Number(inst.accumulatedDepreciation)
            : dep.accumulatedDepreciation,
        currentBookValue:
          inst.currentBookValue !== null && inst.currentBookValue !== undefined
            ? Number(inst.currentBookValue)
            : dep.currentBookValue,
        lastDepreciatedAt: inst.lastDepreciatedAt?.toISOString(),
        ageYears: dep.ageYears,
        itemId: inst.itemId,
        itemName: inst.item.name,
        itemModel: inst.item.model,
        categoryName: inst.item.category.name,
        roomId: inst.roomId,
        roomName: inst.room ? `${inst.room.number}-xona: ${inst.room.name}` : 'Markaziy omborxona',
        roomNumber: inst.room?.number || 'OMB',
        responsibleUserId: inst.responsibleUserId,
        responsibleUserName: inst.responsibleUser?.fullName || 'Bosh omborchi',
        departmentName: inst.room?.department?.name || inst.responsibleUser?.department?.name || (inst.roomId ? undefined : 'Markaziy omborda'),
        facultyName: inst.room?.department?.parent?.name || inst.responsibleUser?.department?.parent?.name,
        supplierName: inst.supplier?.name,
        reprintCount: inst.reprintCount || 0,
        lastReprintReason: inst.lastReprintReason,
        lastReprintedAt: inst.lastReprintedAt?.toISOString(),
      };
    });

    if (isPaginated) {
      return {
        data: mapped,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return mapped;
  }

  async getAssetById(id: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { id },
      include: {
        item: { include: { category: true } },
        room: { include: { department: true } },
        responsibleUser: true,
        supplier: true,
        invoice: true,
        histories: {
          include: { executedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        reprintLogs: {
          include: { printedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

    const dep = this.codeGen.calculateDepreciation(
      asset.purchasePrice ? Number(asset.purchasePrice) : 0,
      asset.purchaseDate || asset.createdAt,
      asset.item.category.name,
    );

    const initialPrice = asset.purchasePrice ? Number(asset.purchasePrice) : 0;
    const currentBookValue =
      asset.currentBookValue !== null && asset.currentBookValue !== undefined
        ? Number(asset.currentBookValue)
        : dep.currentBookValue;
    const accumulatedDepreciation =
      asset.accumulatedDepreciation !== null && asset.accumulatedDepreciation !== undefined
        ? Number(asset.accumulatedDepreciation)
        : dep.accumulatedDepreciation;

    return {
      ...asset,
      purchasePrice: initialPrice,
      currentBookValue,
      accumulatedDepreciation,
      depreciation: {
        annualRate: asset.depreciationRate || dep.annualRate,
        ageYears: dep.ageYears,
        accumulatedDepreciation,
        currentBookValue,
      },
    };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createAsset(dto: {
    itemName: string;
    model?: string;
    categoryName?: string;
    inventoryNumber: string;
    serialNumber?: string;
    purchasePrice?: number;
    roomId?: string;
    supplierId?: string;
    warrantyMonths?: number;
    fundingSource?: FundingSource;
    executedById?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Get or create category
      const cat = await tx.category.upsert({
        where: { name: dto.categoryName || 'Kompyuter va IT uskunalari' },
        update: {},
        create: { name: dto.categoryName || 'Kompyuter va IT uskunalari' },
      });

      // 2. Create item definition
      const item = await tx.item.create({
        data: {
          name: dto.itemName,
          model: dto.model,
          categoryId: cat.id,
        },
      });

      const qrCode = `UWMS:${dto.inventoryNumber}:${dto.serialNumber || 'NA'}`;

      // 3. Resolve room & responsible user
      let responsibleUserId: string | null = null;
      let roomName = 'Markaziy Omborxona';

      if (dto.roomId) {
        const room = await tx.room.findUnique({ where: { id: dto.roomId } });
        if (room) {
          responsibleUserId = room.responsibleUserId;
          roomName = `${room.number}-xona: ${room.name}`;
        }
      }

      const purchasePrice = dto.purchasePrice || 0;
      const instance = await tx.itemInstance.create({
        data: {
          inventoryNumber: dto.inventoryNumber,
          serialNumber: dto.serialNumber,
          qrCode,
          purchasePrice,
          currentBookValue: purchasePrice,
          accumulatedDepreciation: 0,
          purchaseDate: new Date(),
          warrantyMonths: dto.warrantyMonths || 24,
          fundingSource: dto.fundingSource || FundingSource.BYUDJET,
          itemId: item.id,
          roomId: dto.roomId,
          responsibleUserId,
          supplierId: dto.supplierId,
        },
      });


      // 5. Create audit history log
      await tx.assetHistory.create({
        data: {
          assetId: instance.id,
          action: 'KIRIM',
          fromLocation: 'Ta’minotchi / Shartnoma',
          toLocation: roomName,
          note: 'Yangi vosita qabul qilindi va ro‘yxatga olindi',
          executedById: dto.executedById,
        },
      });

      return instance;
    });
  }

  async getTransfers(query?: { status?: string; receiverId?: string; assetId?: string }) {
    if (this.transfersService) {
      return this.transfersService.getTransfers(query);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async transferAsset(
    assetId: string,
    dto: { toRoomId: string; note?: string; executedById?: string },
  ) {
    if (this.transfersService) {
      return this.transfersService.transferAsset(assetId, dto);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async respondTransfer(
    transferId: string,
    dto: { status: 'ACCEPTED' | 'REJECTED'; note?: string; responderId?: string },
  ) {
    if (this.transfersService) {
      return this.transfersService.respondTransfer(transferId, dto);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async transferBatch(dto: {
    assetIds: string[];
    toRoomId: string;
    note?: string;
    executedById?: string;
  }) {
    if (this.transfersService) {
      return this.transfersService.transferBatch(dto);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async writeOffAsset(
    assetId: string,
    dto: { reason: string; executedById?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.itemInstance.findUnique({ where: { id: assetId } });
      if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

      const updated = await tx.itemInstance.update({
        where: { id: assetId },
        data: { status: AssetStatus.WRITTEN_OFF },
      });

      await tx.assetHistory.create({
        data: {
          assetId,
          action: 'SPISANIE',
          note: dto.reason || 'Komissiya xulosasi asosida hisobdan chiqarildi',
          executedById: dto.executedById,
        },
      });

      return updated;
    });
  }

  async generateImportTemplate() {
    const [buildings, departments, rooms, categories, users] = await Promise.all([
      this.prisma.building
        ? this.prisma.building.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
          })
        : [],
      this.prisma.department
        ? this.prisma.department.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
          })
        : [],
      this.prisma.room.findMany({
        where: { deletedAt: null },
        include: { buildingRelation: true, department: true },
        orderBy: [{ building: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.category?.findMany
        ? this.prisma.category.findMany({
            orderBy: { name: 'asc' },
          })
        : [],
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, username: true, fullName: true, role: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'UWMS - Universitet Ombor va Inventar Tizimi';
    wb.lastModifiedBy = 'UWMS Avtomatik Shablon Generatori';
    wb.created = new Date();
    wb.modified = new Date();

    const buildingList =
      buildings.length > 0
        ? buildings.map((b) => b.name.trim())
        : ['Bosh bino', 'Bosh o‘quv binosi', 'IT Bino'];

    const deptList =
      departments.length > 0
        ? departments.map((d) => d.name.trim())
        : ['Dasturiy Injiniring Kafedrasi', 'Axborot Texnologiyalari Markazi'];

    const roomList =
      rooms.length > 0
        ? rooms.map(
            (r) =>
              `${r.number} | ${r.name} (${r.buildingRelation?.name || r.building || 'Bino ko‘rsatilmagan'})`,
          )
        : ['101 | Rektorat qabulxonasi (Bosh bino)', '304 | O‘quv laboratoriyasi (IT Bino)'];

    const catList =
      categories.length > 0
        ? categories.map((c) => c.name.trim())
        : ['Kompyuter va IT uskunalari', 'Orgtexnika va printerlar', 'Mebel va ofis jihozlari'];

    const userList =
      users.length > 0
        ? users.map((u) => `${u.username} (${u.fullName})`)
        : ['omborchi (Toshmatov Omon)', 'kafedra_mudiri (Prof. Alimov Jasur)'];

    const fundingList = ['BYUDJET', 'KONTRAKT_RIVOJLANTIRISH', 'GRANT'];

    // 1. Sheet 1: Aktivlar Shablon (Main Data Entry Sheet - Displayed First)
    const wsMain = wb.addWorksheet('Aktivlar Shablon', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsMain.columns = [
      { header: 'Inventar raqami', key: 'inventoryNumber', width: 22 },
      { header: 'Aktiv nomi (*majburiy)', key: 'itemName', width: 35 },
      { header: 'Modeli', key: 'model', width: 20 },
      { header: 'Kategoriya nomi', key: 'categoryName', width: 28 },
      { header: 'Zavod seriya raqami', key: 'serialNumber', width: 24 },
      { header: 'Bino nomi', key: 'buildingName', width: 26 },
      { header: 'Fakultet / Kafedra / Bo‘lim', key: 'departmentName', width: 36 },
      { header: 'Xona raqami va nomi', key: 'roomNumber', width: 45 },
      { header: 'Mas’ul xodim (MOL logini)', key: 'responsibleUsername', width: 32 },
      { header: 'Boshlang‘ich xarid narxi (so‘m)', key: 'purchasePrice', width: 26 },
      { header: 'Moliyalashtirish manbasi', key: 'fundingSource', width: 26 },
      { header: 'Kafolat muddati (oy)', key: 'warrantyMonths', width: 18 },
    ];

    const mainHeaderRow = wsMain.getRow(1);
    mainHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    mainHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF165DFF' }, // Arco brand blue
    };
    mainHeaderRow.height = 28;
    mainHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 2. Sheet 2: Malumotnoma (Reference Lists for Data Validation)
    const wsRef = wb.addWorksheet('Malumotnoma');
    wsRef.columns = [
      { header: 'Bino nomi', key: 'building', width: 28 },
      { header: 'Fakultet / Kafedra / Bo‘lim', key: 'department', width: 42 },
      { header: 'Xona (Kodi va Nomi)', key: 'room', width: 55 },
      { header: 'Kategoriya', key: 'category', width: 32 },
      { header: 'Mas’ul xodim (Login va F.I.O)', key: 'user', width: 36 },
      { header: 'Moliyalashtirish manbasi', key: 'funding', width: 28 },
    ];

    const refHeaderRow = wsRef.getRow(1);
    refHeaderRow.font = { bold: true, color: { argb: 'FF1D2129' }, size: 11 };
    refHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F3F5' },
    };
    refHeaderRow.height = 24;
    refHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const maxRefRows = Math.max(
      buildingList.length,
      deptList.length,
      roomList.length,
      catList.length,
      userList.length,
      fundingList.length,
    );

    for (let i = 0; i < maxRefRows; i++) {
      wsRef.addRow({
        building: buildingList[i] || '',
        department: deptList[i] || '',
        room: roomList[i] || '',
        category: catList[i] || '',
        user: userList[i] || '',
        funding: fundingList[i] || '',
      });
    }

    // 3 Realistic sample rows
    wsMain.addRow({
      inventoryNumber: 'INV-2026-00050',
      itemName: 'Lenovo ThinkCentre M70q',
      model: 'M70q Gen 3',
      categoryName: catList[0] || 'Kompyuter va IT uskunalari',
      serialNumber: 'SN-LN-88310',
      buildingName: buildingList[0] || 'Bosh ma’muriy bino',
      departmentName: deptList[0] || 'Dasturiy Injiniring Kafedrasi',
      roomNumber: roomList[0] || '101 | Rektorat qabulxonasi (Bosh ma’muriy bino)',
      responsibleUsername: userList[0] || 'kafedra_mudiri (Prof. Alimov Jasur)',
      purchasePrice: 8500000,
      fundingSource: 'BYUDJET',
      warrantyMonths: 24,
    });
    wsMain.addRow({
      inventoryNumber: '',
      itemName: 'HP LaserJet Pro M404dn',
      model: 'M404dn',
      categoryName: catList[1] || catList[0] || 'Orgtexnika va printerlar',
      serialNumber: 'SN-HP-3391',
      buildingName: buildingList[1] || buildingList[0] || 'IT Bino',
      departmentName: deptList[1] || deptList[0] || 'Axborot Texnologiyalari Markazi (ATM)',
      roomNumber: roomList[1] || roomList[0] || '304 | O‘quv laboratoriyasi (IT Bino)',
      responsibleUsername: userList[1] || userList[0] || 'omborchi (Toshmatov Omon)',
      purchasePrice: 3800000,
      fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
      warrantyMonths: 12,
    });
    wsMain.addRow({
      inventoryNumber: '',
      itemName: 'Cisco Catalyst 2960 Switch',
      model: 'WS-C2960-24TC-L',
      categoryName: catList[2] || catList[0] || 'Tarmoq uskunalari',
      serialNumber: 'SN-CS-55421',
      buildingName: buildingList[0] || 'Bosh ma’muriy bino',
      departmentName: deptList[0] || 'Axborot Texnologiyalari Markazi (ATM)',
      roomNumber: roomList[2] || roomList[0] || '301 | ATM Server xonasi (IT Bino)',
      responsibleUsername: '',
      purchasePrice: 12000000,
      fundingSource: 'GRANT',
      warrantyMonths: 36,
    });

    // Add Data Validation dropdown lists to rows 2 through 500
    const catRef = `Malumotnoma!$D$2:$D$${catList.length + 1}`;
    const buildingRef = `Malumotnoma!$A$2:$A$${buildingList.length + 1}`;
    const deptRef = `Malumotnoma!$B$2:$B$${deptList.length + 1}`;
    const roomRef = `Malumotnoma!$C$2:$C$${roomList.length + 1}`;
    const userRef = `Malumotnoma!$E$2:$E$${userList.length + 1}`;
    const fundingRef = `Malumotnoma!$F$2:$F$${fundingList.length + 1}`;

    for (let r = 2; r <= 500; r++) {
      // D: Category
      wsMain.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [catRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri kategoriya',
        error: 'Iltimos, universitet kategoriyalar ro‘yxatidan tanlang!',
      };
      // F: Building
      wsMain.getCell(`F${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [buildingRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri bino',
        error: 'Iltimos, universitet binolar ro‘yxatidan tanlang!',
      };
      // G: Department
      wsMain.getCell(`G${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [deptRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri kafedra / bo‘lim',
        error: 'Iltimos, universitet kafedra va bo‘limlar ro‘yxatidan tanlang!',
      };
      // H: Room
      wsMain.getCell(`H${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [roomRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri xona',
        error: 'Iltimos, universitet xonalari ro‘yxatidan tanlang!',
      };
      // I: User (MOL)
      wsMain.getCell(`I${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [userRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri mas’ul xodim',
        error: 'Iltimos, ro‘yxatdagi mas’ul xodimlardan birini tanlang!',
      };
      // K: Funding Source
      wsMain.getCell(`K${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [fundingRef],
        showErrorMessage: true,
        errorTitle: 'Noto‘g‘ri moliyalashtirish manbasi',
        error: 'Faqat BYUDJET, KONTRAKT_RIVOJLANTIRISH yoki GRANT bo‘lishi mumkin!',
      };
    }

    // 3. Sheet 3: Qoidalar va Yo‘riqnoma
    const wsHelp = wb.addWorksheet('Qoidalar va Yo‘riqnoma');
    wsHelp.columns = [
      { header: 'Maydon nomi', key: 'field', width: 28 },
      { header: 'Majburiyligi', key: 'required', width: 16 },
      { header: 'Tanlash turi', key: 'type', width: 24 },
      { header: 'Qoida, Cheklov va Yo‘riqnoma', key: 'desc', width: 85 },
    ];

    const helpHeaderRow = wsHelp.getRow(1);
    helpHeaderRow.font = { bold: true, color: { argb: 'FF1D2129' }, size: 11 };
    helpHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F3F5' },
    };
    helpHeaderRow.height = 24;
    helpHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const instructions = [
      {
        field: 'Inventar raqami',
        required: 'Ixtiyoriy',
        type: 'Matn (Erkin)',
        desc: 'Bo‘sh qoldirilsa, tizim avtomatik navbatdagi unikal INV-... raqamini generatsiya qiladi. Agar kiritilsa, tizimda va fayl ichida takrorlanmas bo‘lishi shart.',
      },
      {
        field: 'Aktiv nomi',
        required: 'MAJBURIY',
        type: 'Matn (Erkin)',
        desc: 'Asosiy vositaning to‘liq rasmiy nomi (kamida 2 ta belgi). Masalan: Dell OptiPlex 7000.',
      },
      {
        field: 'Modeli',
        required: 'Ixtiyoriy',
        type: 'Matn (Erkin)',
        desc: 'Uskunaning texnik modeli yoki modifikatsiyasi.',
      },
      {
        field: 'Kategoriya nomi',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Universitet aktivlari kategoriyasi. Shablon ichidagi tanlov ro‘yxatidan (Select) tanlanadi. Agar ro‘yxatda bo‘lmasa, yangi kategoriya nomi yozilsa tizim uni avtomatik kiritadi.',
      },
      {
        field: 'Zavod seriya raqami',
        required: 'Ixtiyoriy',
        type: 'Matn (Erkin)',
        desc: 'Ishlab chiqaruvchi zavod seriya raqami (S/N).',
      },
      {
        field: 'Bino nomi',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Universitet korpusi yoki binosi. Dropdown ro‘yxatidan tanlanadi. Yangi bino kiritilganda andoza qayta yuklansa avtomatik yangilanadi.',
      },
      {
        field: 'Fakultet / Kafedra / Bo‘lim',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Uskuna tegishli bo‘lgan kafedra yoki tarkibiy bo‘linma. Dropdown orqali tanlanadi.',
      },
      {
        field: 'Xona raqami va nomi',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Aktiv joylashtiriladigan xona. Dropdown orqali aniq xona (raqami, nomi va binosi) tanlanadi. Tanlansa status "FOYDALANISHDA" bo‘ladi, bo‘sh qoldirilsa "YANGI" bo‘lib Markaziy Omborga tushadi.',
      },
      {
        field: 'Mas’ul xodim (MOL logini)',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Moddiy javobgar shaxs (MOL). Dropdown ro‘yxatidan tanlanadi.',
      },
      {
        field: 'Boshlang‘ich xarid narxi',
        required: 'Ixtiyoriy',
        type: 'Raqam (So‘mda)',
        desc: 'Musbat son, milliy valyutada (so‘m). Masalan: 8500000.',
      },
      {
        field: 'Moliyalashtirish manbasi',
        required: 'Ixtiyoriy',
        type: 'Tanlov (Dropdown)',
        desc: 'Faqat: BYUDJET, KONTRAKT_RIVOJLANTIRISH yoki GRANT. Dropdowndan tanlanadi. Bo‘sh bo‘lsa "BYUDJET" o‘rnatiladi.',
      },
      {
        field: 'Kafolat muddati',
        required: 'Ixtiyoriy',
        type: 'Raqam (Oylarda)',
        desc: 'Oylarda kiritiladi (masalan: 12, 24, 36). Standart qiymat: 12 oy.',
      },
    ];

    for (const inst of instructions) {
      wsHelp.addRow(inst);
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: 'UWMS_Aktivlar_Import_Shablon.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async previewImportExcelAssets(dto: { rows: ImportExcelAssetRowDto[] }) {
    if (!dto.rows || !Array.isArray(dto.rows) || dto.rows.length === 0) {
      throw new BadRequestException('Import qilish uchun ma’lumotlar yuborilmadi!');
    }

    // 1. Preload reference data (soft-deleted excluded)
    const [rooms, users] = await Promise.all([
      this.prisma.room.findMany({
        where: { deletedAt: null },
        include: { buildingRelation: true, department: true, responsibleUser: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, username: true, fullName: true, role: true },
      }),
    ]);

    // Helper to resolve room from number, ID, or composite dropdown string
    const resolveRoom = (
      rawRoom?: string,
      rawBuilding?: string,
      rawDepartment?: string,
    ): (typeof rooms)[0] | null => {
      if (!rawRoom || !String(rawRoom).trim()) return null;
      const cleanRoom = String(rawRoom).trim();
      const lowerRoom = cleanRoom.toLowerCase();

      // 1. Direct ID match
      const byId = rooms.find((r) => r.id.toLowerCase() === lowerRoom);
      if (byId) return byId;

      // 2. Direct exact formatted string match
      const byFormatted = rooms.find((r) => {
        const bName = r.buildingRelation?.name || r.building || '';
        const opt1 = `${r.number} | ${r.name} (${bName})`.toLowerCase();
        const opt2 = `${r.number} - ${r.name}`.toLowerCase();
        const opt3 = `${r.number} (${bName})`.toLowerCase();
        return lowerRoom === opt1 || lowerRoom === opt2 || lowerRoom === opt3;
      });
      if (byFormatted) return byFormatted;

      // 3. Extract room number prefix: e.g. "101 | ..." or "101 - ..." or "101 [..."
      const extractedNumberMatch = cleanRoom.match(/^([a-zA-Z0-9\-_]+)/);
      const roomNum = extractedNumberMatch ? extractedNumberMatch[1].toLowerCase() : lowerRoom;

      // Extract building name from parentheses if present, e.g. "... (IT Bino)" or "[IT Bino]"
      let targetBuilding = rawBuilding ? String(rawBuilding).trim().toLowerCase() : '';
      if (!targetBuilding) {
        const parenMatch = cleanRoom.match(/[\(\[]([^\)\]]+)[\)\]]/);
        if (parenMatch) {
          targetBuilding = parenMatch[1].trim().toLowerCase();
        }
      }

      // 4. If building is specified, find room with roomNum in that building
      if (targetBuilding) {
        const byRoomAndBuilding = rooms.find((r) => {
          const rNum = r.number.trim().toLowerCase();
          const bName = (r.buildingRelation?.name || r.building || '').toLowerCase();
          return rNum === roomNum && bName.includes(targetBuilding);
        });
        if (byRoomAndBuilding) return byRoomAndBuilding;
      }

      // 5. Match by room number alone
      const byNumberMatches = rooms.filter((r) => r.number.trim().toLowerCase() === roomNum);
      if (byNumberMatches.length === 1) {
        return byNumberMatches[0];
      }
      if (byNumberMatches.length > 1) {
        if (rawDepartment) {
          const lowerDept = String(rawDepartment).trim().toLowerCase();
          const byDept = byNumberMatches.find(
            (r) => r.department && r.department.name.toLowerCase().includes(lowerDept),
          );
          if (byDept) return byDept;
        }
        return byNumberMatches[0];
      }

      return null;
    };

    // Helper to resolve user from username, fullName, ID, or composite dropdown string
    const resolveUser = (rawUser?: string): (typeof users)[0] | null => {
      if (!rawUser || !String(rawUser).trim()) return null;
      const cleanUser = String(rawUser).trim();
      const lowerUser = cleanUser.toLowerCase();

      // 1. Direct ID match
      const byId = users.find((u) => u.id.toLowerCase() === lowerUser);
      if (byId) return byId;

      // 2. Direct username match
      const byUsername = users.find((u) => u.username.toLowerCase() === lowerUser);
      if (byUsername) return byUsername;

      // 3. Formatted dropdown match: e.g. "kafedra_mudiri (Prof. Alimov Jasur)"
      const byFormatted = users.find((u) => {
        const formatted = `${u.username} (${u.fullName})`.toLowerCase();
        return lowerUser === formatted || lowerUser === u.fullName.toLowerCase();
      });
      if (byFormatted) return byFormatted;

      // 4. Extract username from prefix: e.g. "kafedra_mudiri (..."
      const usernameMatch = cleanUser.match(/^([a-zA-Z0-9_\.\-]+)/);
      if (usernameMatch) {
        const uName = usernameMatch[1].toLowerCase();
        const byExtracted = users.find((u) => u.username.toLowerCase() === uName);
        if (byExtracted) return byExtracted;
      }

      return null;
    };

    // 2. Collect inventory numbers to check intra-file and cross-DB duplicates
    const invFreqMap = new Map<string, number>();
    const invNumbersToCheck: string[] = [];

    for (const row of dto.rows) {
      const inv = row.inventoryNumber?.trim();
      if (inv) {
        const lower = inv.toLowerCase();
        invFreqMap.set(lower, (invFreqMap.get(lower) || 0) + 1);
        invNumbersToCheck.push(inv);
      }
    }

    const existingInstances =
      invNumbersToCheck.length > 0
        ? await this.prisma.itemInstance.findMany({
            where: { inventoryNumber: { in: invNumbersToCheck } },
            select: { inventoryNumber: true },
          })
        : [];

    const existingInvSet = new Set<string>(
      existingInstances.map((item) => item.inventoryNumber.trim().toLowerCase()),
    );

    const VALID_FUNDING_SOURCES = new Set([
      'BYUDJET',
      'KONTRAKT_RIVOJLANTIRISH',
      'GRANT',
    ]);

    // 3. Row-by-row dry-run validation (WITHOUT WRITING TO DB)
    const previewData = dto.rows.map((row, index) => {
      const rowNum = index + 1;
      const rowErrors: Array<{ field: string; message: string }> = [];

      // Validation a: itemName
      const cleanName = row.itemName?.trim();
      if (!cleanName) {
        rowErrors.push({
          field: 'itemName',
          message: 'Aktiv nomi kiritilishi shart!',
        });
      }

      // Validation b: inventoryNumber
      const inv = row.inventoryNumber?.trim();
      if (inv) {
        const lower = inv.toLowerCase();
        if ((invFreqMap.get(lower) || 0) > 1) {
          rowErrors.push({
            field: 'inventoryNumber',
            message: `Fayl ichida takrorlangan (dublikat) inventar raqam: "${inv}"`,
          });
        }
        if (existingInvSet.has(lower)) {
          rowErrors.push({
            field: 'inventoryNumber',
            message: `Bu inventar raqam bazada allaqachon mavjud: "${inv}"`,
          });
        }
      }

      // Validation c: fundingSource
      if (row.fundingSource) {
        const fsUpper = String(row.fundingSource).trim().toUpperCase();
        if (!VALID_FUNDING_SOURCES.has(fsUpper)) {
          rowErrors.push({
            field: 'fundingSource',
            message: `Moliyalashtirish manbasi noto‘g‘ri! Faqat BYUDJET, KONTRAKT_RIVOJLANTIRISH yoki GRANT bo‘lishi kerak (Kiritilgan: "${row.fundingSource}")`,
          });
        }
      }

      // Validation d: roomNumber
      let matchedRoom: (typeof rooms)[0] | null = null;
      if (row.roomNumber && String(row.roomNumber).trim()) {
        matchedRoom = resolveRoom(row.roomNumber, row.buildingName, row.departmentName);
        if (!matchedRoom) {
          rowErrors.push({
            field: 'roomNumber',
            message: `"${row.roomNumber}" raqamli xona universitet tizimida topilmadi! Iltimos, andozadagi tanlov ro‘yxatidan foydalaning.`,
          });
        }
      }

      // Validation e: responsibleUsername
      let matchedUser: (typeof users)[0] | null = null;
      if (row.responsibleUsername && String(row.responsibleUsername).trim()) {
        matchedUser = resolveUser(row.responsibleUsername);
        if (!matchedUser) {
          rowErrors.push({
            field: 'responsibleUsername',
            message: `"${row.responsibleUsername}" loginli mas’ul xodim tizimda topilmadi! Iltimos, andozadagi tanlov ro‘yxatidan foydalaning.`,
          });
        }
      }

      // Validation f: purchasePrice
      if (
        row.purchasePrice !== undefined &&
        row.purchasePrice !== null &&
        String(row.purchasePrice).trim() !== ''
      ) {
        const priceNum = Number(row.purchasePrice);
        if (isNaN(priceNum) || priceNum < 0) {
          rowErrors.push({
            field: 'purchasePrice',
            message: 'Boshlang‘ich xarid narxi 0 dan kam bo‘lmagan musbat son bo‘lishi shart!',
          });
        }
      }

      // Validation g: warrantyMonths
      if (
        row.warrantyMonths !== undefined &&
        row.warrantyMonths !== null &&
        String(row.warrantyMonths).trim() !== ''
      ) {
        const wMonths = Number(row.warrantyMonths);
        if (isNaN(wMonths) || wMonths < 0) {
          rowErrors.push({
            field: 'warrantyMonths',
            message: 'Kafolat muddati 0 dan kam bo‘lmagan son bo‘lishi shart!',
          });
        }
      }

      return {
        row: rowNum,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
        data: {
          ...row,
          itemName: cleanName || row.itemName,
          purchasePrice:
            row.purchasePrice !== undefined && row.purchasePrice !== null
              ? Number(row.purchasePrice)
              : 0,
          warrantyMonths:
            row.warrantyMonths !== undefined && row.warrantyMonths !== null
              ? Number(row.warrantyMonths)
              : 12,
          fundingSource: (row.fundingSource
            ? String(row.fundingSource).trim().toUpperCase()
            : 'BYUDJET') as any,
        },
        resolvedRoom: matchedRoom
          ? { id: matchedRoom.id, number: matchedRoom.number, name: matchedRoom.name }
          : null,
        resolvedUser: matchedUser
          ? {
              id: matchedUser.id,
              fullName: matchedUser.fullName,
              username: matchedUser.username,
            }
          : null,
      };
    });

    const flatErrors = previewData.flatMap((r) =>
      r.errors.map((e) => ({
        row: r.row,
        field: e.field,
        message: e.message,
      })),
    );

    const validRows = previewData.filter((r) => r.isValid);

    return {
      totalRows: dto.rows.length,
      validCount: validRows.length,
      errorCount: previewData.length - validRows.length,
      valid: validRows.map((r) => r.data),
      errors: flatErrors,
      previewData,
    };
  }

  async importExcelAssets(
    dto: { rows: ImportExcelAssetRowDto[] },
    executedById?: string,
  ) {
    // 1. Dry-run validation
    const preview = await this.previewImportExcelAssets(dto);

    const validRowsToImport = preview.previewData.filter((r) => r.isValid);

    if (validRowsToImport.length === 0) {
      throw new BadRequestException(
        'Import qilish uchun birorta ham to‘g‘ri qator topilmadi! Iltimos, xatoliklarni to‘g‘rilang.',
      );
    }

    // 2. Atomic $transaction for verified rows only
    const results = await this.prisma.$transaction(async (tx) => {
      let currentAssetCount = await tx.itemInstance.count();
      const imported = [];

      for (const itemRow of validRowsToImport) {
        const row = itemRow.data;

        // Category upsert
        const categoryName = row.categoryName?.trim() || 'Boshqa uskunalar';
        const cat = await tx.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });

        // Item find or create
        const modelName = row.model?.trim() || null;
        let item = await tx.item.findFirst({
          where: { name: row.itemName.trim(), model: modelName },
        });
        if (!item) {
          item = await tx.item.create({
            data: {
              name: row.itemName.trim(),
              model: modelName,
              categoryId: cat.id,
            },
          });
        }

        // Room & responsible resolution
        let roomId: string | null = null;
        let responsibleUserId: string | null = null;
        let roomName = 'Markaziy Omborxona';

        if (itemRow.resolvedRoom) {
          roomId = itemRow.resolvedRoom.id;
          roomName = `${itemRow.resolvedRoom.number}-xona: ${itemRow.resolvedRoom.name}`;
          // Default responsible from room if exists
          const fullRoom = await tx.room.findUnique({ where: { id: roomId } });
          if (fullRoom?.responsibleUserId) {
            responsibleUserId = fullRoom.responsibleUserId;
          }
        }

        if (itemRow.resolvedUser) {
          responsibleUserId = itemRow.resolvedUser.id;
        }

        // Sequential or verified inventory number
        let invNumber = row.inventoryNumber?.trim();
        if (!invNumber) {
          currentAssetCount++;
          invNumber = this.codeGeneratorService.generateInventoryNumber(currentAssetCount);
        }

        const qrCode = `UWMS:${invNumber}:${row.serialNumber?.trim() || 'NA'}`;

        const instance = await tx.itemInstance.create({
          data: {
            inventoryNumber: invNumber,
            serialNumber: row.serialNumber?.trim() || null,
            qrCode,
            purchasePrice: row.purchasePrice || 0,
            purchaseDate: new Date(),
            warrantyMonths: row.warrantyMonths || 12,
            fundingSource: (row.fundingSource as any) || FundingSource.BYUDJET,
            status: roomId ? AssetStatus.IN_USE : AssetStatus.NEW,
            itemId: item.id,
            roomId,
            responsibleUserId,
          },
        });

        await tx.assetHistory.create({
          data: {
            assetId: instance.id,
            action: 'EXCEL_IMPORT',
            fromLocation: 'Excel Ommaviy Import',
            toLocation: roomName,
            referenceDoc: 'Universal Excel Import',
            note: 'Universitet aktivlari bazasiga ommaviy yuklandi',
            executedById,
          },
        });

        imported.push(instance);
      }

      return imported;
    });

    // 3. System audit log
    await this.systemAuditService.log({
      action: 'EXCEL_IMPORT',
      entity: 'ItemInstance',
      userId: executedById,
      details: {
        totalRows: dto.rows.length,
        importedCount: results.length,
        failedCount: preview.errorCount,
      },
    });

    return {
      success: true,
      totalProcessed: dto.rows.length,
      importedCount: results.length,
      failedCount: preview.errorCount,
      items: results.map((r) => ({
        id: r.id,
        inventoryNumber: r.inventoryNumber,
        fundingSource: r.fundingSource,
      })),
      errors: preview.errors,
    };
  }

  async returnAsset(dto: ReturnAssetDto, senderId: string) {
    if (this.transfersService) {
      return this.transfersService.returnAsset(dto, senderId);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async massMolHandoff(dto: MassMolHandoffDto, executedById: string) {
    if (this.transfersService) {
      return this.transfersService.massMolHandoff(dto, executedById);
    }
    throw new BadRequestException('TransfersService mavjud emas');
  }

  async reprintQr(id: string, reason: string, userId?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('QR-stikerni qayta chop etish sababi kiritilishi shart!');
    }

    const asset = await this.prisma.itemInstance.findUnique({
      where: { id },
      include: { item: true, room: true, responsibleUser: true },
    });

    if (!asset) {
      throw new NotFoundException('Asosiy vosita topilmadi!');
    }

    const loc = asset.room ? `${asset.room.number}-xona (${asset.room.name})` : 'Omborxona';

    return this.prisma.$transaction(async (tx) => {
      const nextReprintNumber = (asset.reprintCount || 0) + 1;

      // 1. Update ItemInstance reprint tracking fields
      const updatedAsset = await tx.itemInstance.update({
        where: { id: asset.id },
        data: {
          reprintCount: nextReprintNumber,
          lastReprintReason: reason.trim(),
          lastReprintedAt: new Date(),
        },
      });

      // 2. Create dedicated LabelReprintLog entry
      const reprintLog = await tx.labelReprintLog.create({
        data: {
          assetId: asset.id,
          reason: reason.trim(),
          reprintNumber: nextReprintNumber,
          printedById: userId || null,
        },
      });

      // 3. AssetHistory entry
      const history = await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'QR_REPRINT',
          fromLocation: loc,
          toLocation: loc,
          fromUser: asset.responsibleUser?.fullName,
          toUser: asset.responsibleUser?.fullName,
          note: `QR-stiker dublikati chop etildi (${nextReprintNumber}-marta). Sababi: ${reason.trim()}`,
          executedById: userId,
        },
      });

      // 4. SystemAuditLog entry
      await this.systemAuditService.log({
        action: SYSTEM_AUDIT_ACTIONS.REPRINT_LABEL,
        entity: 'ItemInstance',
        entityId: asset.id,
        details: {
          action: 'QR_REPRINT',
          inventoryNumber: asset.inventoryNumber,
          serialNumber: asset.serialNumber,
          qrCode: asset.qrCode,
          reprintNumber: nextReprintNumber,
          reason: reason.trim(),
        },
        userId,
      });

      return {
        success: true,
        message: 'QR-stikerni qayta chop etish auditi muvaffaqiyatli qayd etildi.',
        asset: {
          id: updatedAsset.id,
          inventoryNumber: updatedAsset.inventoryNumber,
          qrCode: updatedAsset.qrCode,
          reprintCount: updatedAsset.reprintCount,
          lastReprintReason: updatedAsset.lastReprintReason,
          lastReprintedAt: updatedAsset.lastReprintedAt,
        },
        reprintLogId: reprintLog.id,
        historyId: history.id,
      };
    });
  }
}

