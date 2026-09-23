import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, RoleType, FundingSource } from '@prisma/client';
import { CodeGeneratorService } from '../common/code-generator.service';
import { ImportExcelAssetRowDto, ReturnAssetDto, MassMolHandoffDto, BatchTransferAssetDto } from './dto/asset.dto';
import * as XLSX from 'xlsx';
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
    const wb = XLSX.utils.book_new();

    // Sheet 1: Template data with headers and 3 example rows
    const templateData = [
      {
        'Inventar raqami': 'INV-2026-00050',
        'Aktiv nomi (*majburiy)': 'Lenovo ThinkCentre M70q',
        'Modeli': 'M70q Gen 3',
        'Kategoriya nomi': 'Kompyuter va IT uskunalari',
        'Zavod seriya raqami': 'SN-LN-88310',
        'Xona raqami': '101',
        'Mas’ul xodim (MOL logini)': 'mol_user',
        'Boshlang‘ich xarid narxi (so‘m)': 8500000,
        'Moliyalashtirish manbasi': 'BYUDJET',
        'Kafolat muddati (oy)': 24,
      },
      {
        'Inventar raqami': '', // bo'sh qoldirilsa avtomatik generatsiya qilinadi
        'Aktiv nomi (*majburiy)': 'HP LaserJet Pro M404dn',
        'Modeli': 'M404dn',
        'Kategoriya nomi': 'Orgtexnika va printerlar',
        'Zavod seriya raqami': 'SN-HP-3391',
        'Xona raqami': '102',
        'Mas’ul xodim (MOL logini)': '',
        'Boshlang‘ich xarid narxi (so‘m)': 3800000,
        'Moliyalashtirish manbasi': 'KONTRAKT_RIVOJLANTIRISH',
        'Kafolat muddati (oy)': 12,
      },
      {
        'Inventar raqami': '',
        'Aktiv nomi (*majburiy)': 'Cisco Catalyst 2960 Switch',
        'Modeli': 'WS-C2960-24TC-L',
        'Kategoriya nomi': 'Tarmoq uskunalari',
        'Zavod seriya raqami': 'SN-CS-55421',
        'Xona raqami': '204',
        'Mas’ul xodim (MOL logini)': '',
        'Boshlang‘ich xarid narxi (so‘m)': 12000000,
        'Moliyalashtirish manbasi': 'GRANT',
        'Kafolat muddati (oy)': 36,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 22 },
      { wch: 30 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 14 },
      { wch: 24 },
      { wch: 26 },
      { wch: 26 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Aktivlar Shablon');

    // Sheet 2: Guidelines / rules
    const instructions = [
      {
        'Maydon nomi': 'Inventar raqami',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh':
          'Agar bo‘sh qoldirilsa, tizim avtomatik navbatdagi unikal inventar raqamini yaratadi (masalan: INV-2026-00010). Agar kiritilsa, tizimda va fayl ichida takrorlanmagan bo‘lishi shart.',
      },
      {
        'Maydon nomi': 'Aktiv nomi',
        Majburiyligi: 'MAJBURIY',
        'Qoida va Izoh': 'Asosiy vositaning to‘liq rasmiy nomi (kamida 2 ta belgi).',
      },
      {
        'Maydon nomi': 'Modeli',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh': 'Uskunaning texnik modeli yoki modifikatsiyasi.',
      },
      {
        'Maydon nomi': 'Kategoriya nomi',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh':
          'Masalan: "Kompyuter va IT uskunalari", "Mebel", "Orgtexnika". Tizimda yo‘q bo‘lsa yangi kategoriya ochiladi.',
      },
      {
        'Maydon nomi': 'Zavod seriya raqami',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh': 'Ishlab chiqaruvchi seriya raqami (S/N).',
      },
      {
        'Maydon nomi': 'Xona raqami',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh':
          'Universitetda mavjud xona raqami (masalan: 101, 304). Agar kiritilsa, uskunaning holati "FOYDALANISHDA" deb o‘rnatiladi, bo‘sh bo‘lsa "YANGI" bo‘lib markaziy omborga tushadi.',
      },
      {
        'Maydon nomi': 'Mas’ul xodim (MOL logini)',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh':
          'Xona javobgari yoki moddiy javobgar shaxsning tizimdagi foydalanuvchi logini (username).',
      },
      {
        'Maydon nomi': 'Boshlang‘ich xarid narxi',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh': 'Musbat son, milliy valyutada (so‘m).',
      },
      {
        'Maydon nomi': 'Moliyalashtirish manbasi',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh':
          'Faqat quyidagi 3 tadan biri: BYUDJET, KONTRAKT_RIVOJLANTIRISH yoki GRANT. Bo‘sh bo‘lsa "BYUDJET" qo‘yiladi.',
      },
      {
        'Maydon nomi': 'Kafolat muddati',
        Majburiyligi: 'Ixtiyoriy',
        'Qoida va Izoh': 'Oylarda kiritiladi (masalan: 12, 24, 36). Standart: 12 oy.',
      },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Qoidalar va Yo‘riqnoma');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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
        include: { responsibleUser: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, username: true, fullName: true, role: true },
      }),
    ]);

    const roomMap = new Map<string, (typeof rooms)[0]>();
    for (const r of rooms) {
      roomMap.set(r.number.trim().toLowerCase(), r);
      roomMap.set(r.id, r);
    }

    const userMap = new Map<string, (typeof users)[0]>();
    for (const u of users) {
      userMap.set(u.username.trim().toLowerCase(), u);
      userMap.set(u.id, u);
    }

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
        const roomKey = String(row.roomNumber).trim().toLowerCase();
        matchedRoom = roomMap.get(roomKey) || null;
        if (!matchedRoom) {
          rowErrors.push({
            field: 'roomNumber',
            message: `"${row.roomNumber}" raqamli xona universitet tizimida topilmadi!`,
          });
        }
      }

      // Validation e: responsibleUsername
      let matchedUser: (typeof users)[0] | null = null;
      if (row.responsibleUsername && String(row.responsibleUsername).trim()) {
        const userKey = String(row.responsibleUsername).trim().toLowerCase();
        matchedUser = userMap.get(userKey) || null;
        if (!matchedUser) {
          rowErrors.push({
            field: 'responsibleUsername',
            message: `"${row.responsibleUsername}" loginli mas’ul xodim tizimda topilmadi!`,
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

