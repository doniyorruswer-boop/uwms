import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, TransferStatus, MovementType, RoleType } from '@prisma/client';
import { CodeGeneratorService } from '../common/code-generator.service';
import { ImportExcelAssetRowDto, ReturnAssetDto, MassMolHandoffDto } from './dto/asset.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private codeGeneratorService: CodeGeneratorService,
    private codeGen: CodeGeneratorService,
    private notificationsService: NotificationsService,
    private systemAuditService: SystemAuditService,
    private documentStampsService: DocumentStampsService,
  ) {}

  async getAllAssets(query?: {
    search?: string;
    status?: string;
    roomId?: string;
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

    if (query?.search) {
      where.OR = [
        { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { item: { name: { contains: query.search, mode: 'insensitive' } } },
        { room: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
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

    const [instances, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.itemInstance.findMany({
            where,
            include: {
              item: { include: { category: true } },
              room: true,
              responsibleUser: { select: { id: true, fullName: true } },
              supplier: true,
            },
            orderBy: { [sortField]: sortOrder },
            skip,
            take: limit,
          }),
          this.prisma.itemInstance.count({ where }),
        ])
      : [
          await this.prisma.itemInstance.findMany({
            where,
            include: {
              item: { include: { category: true } },
              room: true,
              responsibleUser: { select: { id: true, fullName: true } },
              supplier: true,
            },
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
        depreciationRate: dep.annualRate,
        accumulatedDepreciation: dep.accumulatedDepreciation,
        currentBookValue: dep.currentBookValue,
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
        supplierName: inst.supplier?.name,
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
      },
    });

    if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

    const dep = this.codeGen.calculateDepreciation(
      asset.purchasePrice ? Number(asset.purchasePrice) : 0,
      asset.purchaseDate || asset.createdAt,
      asset.item.category.name,
    );

    return {
      ...asset,
      depreciation: dep,
    };
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

      // 4. Create instance
      const instance = await tx.itemInstance.create({
        data: {
          inventoryNumber: dto.inventoryNumber,
          serialNumber: dto.serialNumber,
          qrCode,
          purchasePrice: dto.purchasePrice || 0,
          purchaseDate: new Date(),
          warrantyMonths: dto.warrantyMonths || 24,
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
    const where: any = {};
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as TransferStatus;
    }
    if (query?.receiverId) {
      where.receiverId = query.receiverId;
    }
    if (query?.assetId) {
      where.assetId = query.assetId;
    }

    const list = await this.prisma.transferAcceptance.findMany({
      where,
      include: {
        asset: { include: { item: true } },
        fromRoom: true,
        toRoom: true,
        toWarehouse: true,
        sender: { select: { id: true, fullName: true, username: true } },
        receiver: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((t) => ({
      id: t.id,
      assetId: t.assetId,
      assetName: t.asset.item.name,
      assetModel: t.asset.item.model,
      inventoryNumber: t.asset.inventoryNumber,
      status: t.status,
      isReturn: t.isReturn,
      note: t.note,
      fromRoomName: t.fromRoom ? `${t.fromRoom.number}-xona: ${t.fromRoom.name}` : 'Bosh omborxona',
      toRoomName: t.isReturn
        ? (t.toWarehouse ? t.toWarehouse.name : 'Bosh omborxona')
        : (t.toRoom ? `${t.toRoom.number}-xona: ${t.toRoom.name}` : 'Bosh omborxona'),
      toRoomId: t.toRoomId,
      toWarehouseId: t.toWarehouseId,
      senderName: t.sender.fullName,
      receiverName: t.receiver?.fullName || (t.isReturn ? 'Bosh omborchi' : 'Kafedra mudiri'),
      receiverId: t.receiverId,
      createdAt: t.createdAt.toISOString().substring(0, 16).replace('T', ' '),
      acceptedAt: t.acceptedAt ? t.acceptedAt.toISOString().substring(0, 16).replace('T', ' ') : null,
    }));
  }

  async transferAsset(
    assetId: string,
    dto: { toRoomId: string; note?: string; executedById?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.itemInstance.findUnique({
        where: { id: assetId },
        include: { room: true },
      });
      if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

      const targetRoom = await tx.room.findUnique({
        where: { id: dto.toRoomId },
        include: { responsibleUser: true },
      });
      if (!targetRoom) throw new NotFoundException('Ko‘chirilayotgan xona topilmadi!');

      const fromLoc = asset.room ? `${asset.room.number}-xona: ${asset.room.name}` : 'Bosh omborxona';
      const toLoc = `${targetRoom.number}-xona: ${targetRoom.name}`;

      // Resolve sender
      const senderId =
        dto.executedById || (await tx.user.findFirst({ where: { role: 'HEAD_WAREHOUSE' } }))!.id;

      // Create 2-sided transfer acceptance record in PENDING state
      const transfer = await tx.transferAcceptance.create({
        data: {
          assetId,
          fromRoomId: asset.roomId,
          toRoomId: targetRoom.id,
          senderId,
          receiverId: targetRoom.responsibleUserId,
          status: TransferStatus.PENDING,
          note: dto.note || 'Xonaga ko‘chirish va topshirish-qabul qilish dalolatnomasi',
        },
      });

      // Log asset history: Pending acceptance
      await tx.assetHistory.create({
        data: {
          assetId,
          action: 'KO‘CHIRISHGA_YUBORILDI',
          fromLocation: fromLoc,
          toLocation: toLoc,
          referenceDoc: `TRF-${transfer.id.substring(0, 8).toUpperCase()}`,
          note: dto.note || 'Kafedra mudiriga qabul qilish uchun yuborildi',
          executedById: senderId,
        },
      });

      return transfer;
    });
  }

  async respondTransfer(
    transferId: string,
    dto: { status: 'ACCEPTED' | 'REJECTED'; note?: string; responderId?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transferAcceptance.findUnique({
        where: { id: transferId },
        include: {
          asset: { include: { item: true } },
          fromRoom: true,
          toRoom: true,
          toWarehouse: true,
          sender: true,
          receiver: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException('Topshirish-qabul qilish arizasi topilmadi!');
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new NotFoundException('Ushbu ko‘chirish arizasi allaqachon ko‘rib chiqilgan!');
      }

      const fromLoc = transfer.fromRoom
        ? `${transfer.fromRoom.number}-xona: ${transfer.fromRoom.name}`
        : 'Bosh omborxona';
      const toLoc = transfer.isReturn
        ? (transfer.toWarehouse ? transfer.toWarehouse.name : 'Bosh omborxona')
        : (transfer.toRoom ? `${transfer.toRoom.number}-xona: ${transfer.toRoom.name}` : 'Bosh omborxona');

      if (dto.status === 'ACCEPTED') {
        // 1. Mark transfer accepted
        const updatedTransfer = await tx.transferAcceptance.update({
          where: { id: transferId },
          data: {
            status: TransferStatus.ACCEPTED,
            acceptedAt: new Date(),
            note: dto.note || transfer.note,
          },
        });

        if (transfer.isReturn) {
          // Return to warehouse
          await tx.itemInstance.update({
            where: { id: transfer.assetId },
            data: {
              roomId: null,
              responsibleUserId: null,
              status: AssetStatus.NEW,
            },
          });

          // Create stock movement for return
          const movCount = await tx.stockMovement.count();
          const movNum = this.codeGen.generateMovementNumber(movCount + 1);

          const movement = await tx.stockMovement.create({
            data: {
              movementNumber: movNum,
              movementType: MovementType.RETURN,
              referenceDoc: 'Qaytarish dalolatnomasi',
              note: dto.note || transfer.note || 'Kafedradan omborga qaytarildi',
              executedById: dto.responderId || transfer.receiverId || transfer.senderId,
              fromRoomId: transfer.fromRoomId,
              toWarehouseId: transfer.toWarehouseId,
              fundingSource: transfer.asset.fundingSource,
            },
          });

          await tx.stockMovementItem.create({
            data: {
              movementId: movement.id,
              itemId: transfer.asset.itemId,
              itemInstanceId: transfer.assetId,
              quantity: 1,
              note: 'Omborga qaytarib qabul qilindi',
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: transfer.assetId,
              action: 'QAYTARILDI_OMBORGA',
              fromLocation: fromLoc,
              toLocation: toLoc,
              fromUser: transfer.sender.fullName,
              toUser: transfer.receiver?.fullName || 'Bosh omborchi',
              referenceDoc: 'Qaytarish dalolatnomasi',
              note: dto.note || 'Omborga muvaffaqiyatli qabul qilindi va balansga olindi',
              executedById: dto.responderId || transfer.receiverId,
            },
          });
        } else {
          // Transfer to room
          await tx.itemInstance.update({
            where: { id: transfer.assetId },
            data: {
              roomId: transfer.toRoomId,
              responsibleUserId: transfer.receiverId,
              status: AssetStatus.IN_USE,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: transfer.assetId,
              action: 'TOPSHIRILDI_QABUL_QILINDI',
              fromLocation: fromLoc,
              toLocation: toLoc,
              fromUser: transfer.sender.fullName,
              toUser: transfer.receiver?.fullName || 'Kafedra mudiri',
              referenceDoc: 'Qabul qilish-topshirish dalolatnomasi (OS-1)',
              note: dto.note || 'Kafedra mudiri tomonidan to‘liq qabul qilindi va hisobga olindi',
              executedById: dto.responderId || transfer.receiverId,
            },
          });
        }

        return updatedTransfer;
      } else {
        // Mark transfer rejected
        const updatedTransfer = await tx.transferAcceptance.update({
          where: { id: transferId },
          data: {
            status: TransferStatus.REJECTED,
            note: dto.note || 'Rad etildi',
          },
        });

        await tx.assetHistory.create({
          data: {
            assetId: transfer.assetId,
            action: 'KO‘CHIRISH_RAD_ETILDI',
            fromLocation: fromLoc,
            toLocation: toLoc,
            note: dto.note || 'Qabul qiluvchi tomonidan dalolatnoma rad etildi',
            executedById: dto.responderId || transfer.receiverId,
          },
        });

        return updatedTransfer;
      }
    });
  }

  async transferBatch(dto: {
    assetIds: string[];
    toRoomId: string;
    note?: string;
    executedById?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const targetRoom = await tx.room.findUnique({
        where: { id: dto.toRoomId },
      });
      if (!targetRoom) throw new NotFoundException('Xona topilmadi!');

      const toLoc = `${targetRoom.number}-xona (${targetRoom.name})`;

      await tx.itemInstance.updateMany({
        where: { id: { in: dto.assetIds } },
        data: {
          roomId: targetRoom.id,
          responsibleUserId: targetRoom.responsibleUserId,
        },
      });

      for (const assetId of dto.assetIds) {
        await tx.assetHistory.create({
          data: {
            assetId,
            action: 'OMMAVIY_KO‘CHIRILDI',
            toLocation: toLoc,
            note: dto.note || 'Ommaviy qayta taqsimlash',
            executedById: dto.executedById,
          },
        });
      }

      return { count: dto.assetIds.length, targetRoom: toLoc };
    });
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

  async importExcelAssets(
    dto: { rows: ImportExcelAssetRowDto[] },
    executedById?: string,
  ) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('Import qilish uchun ma’lumotlar topilmadi!');
    }

    return this.prisma.$transaction(async (tx) => {
      const rooms = await tx.room.findMany();
      const roomMap = new Map<string, typeof rooms[0]>();
      for (const r of rooms) {
        roomMap.set(r.number.trim().toLowerCase(), r);
        roomMap.set(r.id, r);
      }

      const results = [];
      let currentAssetCount = await tx.itemInstance.count();

      for (const row of dto.rows) {
        // 1. Category
        const cat = await tx.category.upsert({
          where: { name: row.categoryName || 'Boshqa uskunalar' },
          update: {},
          create: { name: row.categoryName || 'Boshqa uskunalar' },
        });

        // 2. Item
        let item = await tx.item.findFirst({
          where: { name: row.itemName, model: row.model || null },
        });
        if (!item) {
          item = await tx.item.create({
            data: {
              name: row.itemName,
              model: row.model,
              categoryId: cat.id,
            },
          });
        }

        // 3. Room resolution
        let roomId: string | null = null;
        let responsibleUserId: string | null = null;
        let roomName = 'Markaziy Omborxona';

        if (row.roomNumber) {
          const matchedRoom = roomMap.get(row.roomNumber.trim().toLowerCase());
          if (matchedRoom) {
            roomId = matchedRoom.id;
            responsibleUserId = matchedRoom.responsibleUserId;
            roomName = `${matchedRoom.number}-xona: ${matchedRoom.name}`;
          }
        }

        // 4. Sequential Unique Inventory Number
        currentAssetCount++;
        let invNumber = row.inventoryNumber?.trim();
        if (!invNumber) {
          invNumber = this.codeGeneratorService.generateInventoryNumber(currentAssetCount);
        } else {
          const existing = await tx.itemInstance.findUnique({
            where: { inventoryNumber: invNumber },
          });
          if (existing) {
            invNumber = this.codeGeneratorService.generateInventoryNumber(currentAssetCount);
          }
        }

        const qrCode = `UWMS:${invNumber}:${row.serialNumber || 'NA'}`;

        const instance = await tx.itemInstance.create({
          data: {
            inventoryNumber: invNumber,
            serialNumber: row.serialNumber,
            qrCode,
            purchasePrice: row.purchasePrice || 0,
            purchaseDate: new Date(),
            warrantyMonths: row.warrantyMonths || 24,
            fundingSource: (row.fundingSource as any) || 'BYUDJET',
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

        results.push(instance);
      }

      return {
        success: true,
        importedCount: results.length,
        items: results.map((r) => ({
          id: r.id,
          inventoryNumber: r.inventoryNumber,
          fundingSource: r.fundingSource,
        })),
      };
    });
  }

  async returnAsset(dto: ReturnAssetDto, senderId: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { id: dto.assetId },
      include: { room: true },
    });
    if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

    if (asset.status === AssetStatus.WRITTEN_OFF) {
      throw new BadRequestException('Hisobdan chiqarilgan (Spisanie) ashyoni omborga qaytarib bo‘lmaydi!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Resolve target warehouse
      let warehouseId = dto.warehouseId;
      if (!warehouseId) {
        const mainWh = (await tx.warehouse.findFirst({ where: { isMain: true } })) || (await tx.warehouse.findFirst());
        warehouseId = mainWh?.id;
      }

      if (!warehouseId) {
        throw new NotFoundException('Qabul qiluvchi omborxona tizimda topilmadi!');
      }

      const headWh = await tx.user.findFirst({ where: { role: RoleType.HEAD_WAREHOUSE } });

      const transfer = await tx.transferAcceptance.create({
        data: {
          assetId: dto.assetId,
          fromRoomId: asset.roomId,
          toWarehouseId: warehouseId,
          isReturn: true,
          senderId,
          receiverId: headWh?.id,
          status: TransferStatus.PENDING,
          note: `Omborga qaytarish: ${dto.reason}${dto.note ? ' (' + dto.note + ')' : ''}`,
        },
      });

      const fromLoc = asset.room ? `${asset.room.number}-xona: ${asset.room.name}` : 'Kafedra xonasi';
      const wh = await tx.warehouse.findUnique({ where: { id: warehouseId } });
      const toLoc = wh ? wh.name : 'Bosh omborxona';

      await tx.assetHistory.create({
        data: {
          assetId: dto.assetId,
          action: 'QAYTARISHGA_YUBORILDI',
          fromLocation: fromLoc,
          toLocation: toLoc,
          referenceDoc: `RET-${transfer.id.substring(0, 8).toUpperCase()}`,
          note: dto.reason,
          executedById: senderId,
        },
      });

      return transfer;
    });

    // Notify Warehouse Heads
    await this.notificationsService.notifyRole(
      RoleType.HEAD_WAREHOUSE,
      'Omborga Qaytarish Talabnomasi',
      `Kafedradan asosiy vosita qaytarish uchun yuborildi. Sabab: ${dto.reason}`,
      NotificationType.TRANSFER,
      '/assets',
    );

    // Audit log
    await this.systemAuditService.log({
      action: 'RETURN',
      entity: 'ItemInstance',
      entityId: dto.assetId,
      details: {
        reason: dto.reason,
        note: dto.note,
      },
      userId: senderId,
    });

    return result;
  }

  async massMolHandoff(dto: MassMolHandoffDto, executedById: string) {
    const fromUser = await this.prisma.user.findUnique({ where: { id: dto.fromUserId } });
    const toUser = await this.prisma.user.findUnique({ where: { id: dto.toUserId } });
    if (!fromUser || !toUser) {
      throw new NotFoundException('Topshiruvchi yoki qabul qiluvchi mas’ul shaxs topilmadi!');
    }

    const where: any = {
      responsibleUserId: dto.fromUserId,
      status: { not: AssetStatus.WRITTEN_OFF },
    };
    if (dto.roomId) {
      where.roomId = dto.roomId;
    }

    const assets = await this.prisma.itemInstance.findMany({
      where,
      include: { room: true, item: true },
    });

    if (assets.length === 0) {
      throw new BadRequestException('Ushbu mas’ul shaxsga biriktirilgan faol asosiy vositalar topilmadi!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.transferAcceptance.count();
      const actNumber = `MOL-${year}-${String(count + 1).padStart(4, '0')}`;

      // Update all matching assets
      await tx.itemInstance.updateMany({
        where: { id: { in: assets.map((a) => a.id) } },
        data: { responsibleUserId: dto.toUserId },
      });

      // Audit history for each asset
      for (const a of assets) {
        const loc = a.room ? `${a.room.number}-xona: ${a.room.name}` : 'Universitet hududi';
        await tx.assetHistory.create({
          data: {
            assetId: a.id,
            action: 'MOL_YALPI_ALMASHINUVI',
            fromLocation: loc,
            toLocation: loc,
            fromUser: fromUser.fullName,
            toUser: toUser.fullName,
            referenceDoc: actNumber,
            note: dto.note || `Kafedra mudiri / MOL almashinuvi: barcha jihozlar yangi mas’ul shaxsga rasmiy topshirildi`,
            executedById,
          },
        });
      }

      return {
        success: true,
        actNumber,
        transferredCount: assets.length,
        fromUser: { id: fromUser.id, fullName: fromUser.fullName },
        toUser: { id: toUser.id, fullName: toUser.fullName },
        assets: assets.map((a) => ({ id: a.id, inventoryNumber: a.inventoryNumber })),
      };
    });

    // Notify receiving MOL
    await this.notificationsService.create({
      userId: toUser.id,
      title: 'MOL Yalpi Topshirish Akti',
      message: `Sizga ${fromUser.fullName} tomonidan ${assets.length} ta asosiy vosita rasmiy topshirildi (${result.actNumber}).`,
      type: NotificationType.TRANSFER,
      link: '/assets',
    });

    // System audit log
    await this.systemAuditService.log({
      action: 'TRANSFER',
      entity: 'MOL_HANDOFF',
      entityId: result.actNumber,
      details: {
        actNumber: result.actNumber,
        fromUser: fromUser.fullName,
        toUser: toUser.fullName,
        transferredCount: assets.length,
      },
      userId: executedById,
    });

    // Document Stamp for MOL Transfer
    try {
      await this.documentStampsService.stampDocument({
        docType: 'MOL_TRANSFER',
        docNumber: result.actNumber,
        title: `MOL Yalpi Topshirish-Qabul Qilish Dalolatnomasi (${fromUser.fullName} -> ${toUser.fullName})`,
        signerName: toUser.fullName,
        signerRole: toUser.position || 'Kafedra Mudiri / Yangi MOL',
        metadata: {
          actNumber: result.actNumber,
          fromUser: fromUser.fullName,
          toUser: toUser.fullName,
          itemsCount: assets.length,
          items: assets.slice(0, 30).map((a) => ({
            name: a.item.name,
            inv: a.inventoryNumber,
            room: a.room?.number,
          })),
        },
      });
    } catch (e) {
      // ignore stamping error
    }

    return result;
  }
}

