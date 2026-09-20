import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SequenceService } from '../common/services/sequence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import {
  AssetStatus,
  TransferStatus,
  MovementType,
  RoleType,
  NotificationType,
  HandoverStatus,
  HandoverType,
  HandoverItemActionType,
  Prisma,
} from '@prisma/client';
import {
  BatchTransferAssetDto,
  RespondTransferDto,
  ReturnAssetDto,
  MassMolHandoffDto,
} from '../assets/dto/asset.dto';
import {
  CreateResponsibilityHandoverDto,
  QueryHandoversDto,
  SignHandoverDto,
  RejectHandoverDto,
} from './dto/handover.dto';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly notificationsService: NotificationsService,
    private readonly systemAuditService: SystemAuditService,
    private readonly documentStampsService: DocumentStampsService,
    @Optional() private readonly sequenceService?: SequenceService,
  ) {}

  /**
   * Barcha topshirish-qabul qilish arizalari ro'yxatini olish
   */
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

    const entityIds = list.map((t) => t.id);
    const archives = await this.prisma.documentArchive.findMany({
      where: { entityId: { in: entityIds } },
      include: { stamp: true },
    });
    const stampMap = new Map<string, string>();
    archives.forEach((a) => {
      stampMap.set(a.entityId, a.stamp?.docNumber || a.docNumber);
    });

    return list.map((t) => {
      const year = new Date(t.createdAt).getFullYear();
      const shortId = t.id.substring(0, 8).toUpperCase();
      const docNum = stampMap.get(t.id) || `OS1-${year}-${shortId}`;
      return {
        id: t.id,
        documentNumber: docNum,
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
      };
    });
  }

  /**
   * Bitta asosiy vositani boshqa xonaga / mas'ul shaxsga ko'chirish arizasini yaratish
   */
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

      const senderId =
        dto.executedById || (await tx.user.findFirst({ where: { role: 'HEAD_WAREHOUSE' } }))!.id;

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

  /**
   * Topshirish-qabul qilish arizasini qabul qilish (ACCEPTED) yoki rad etish (REJECTED)
   */
  async respondTransfer(
    transferId: string,
    dto: { status: 'ACCEPTED' | 'REJECTED'; note?: string; responderId?: string },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
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

      // Faqatgina qabul qiluvchi mas'ul shaxs (yoki omborga qaytarish bo'lsa omborchi) tasdiqlay oladi
      if (dto.responderId) {
        const responder = await tx.user.findUnique({ where: { id: dto.responderId } });
        if (!responder) {
          throw new UnauthorizedException('Foydalanuvchi topilmadi!');
        }
        if (responder.role === RoleType.SUPER_ADMIN) {
          throw new ForbiddenException('Super Admin boshqa mas’ul shaxslar nomidan ko‘chirishni qabul qila olmaydi!');
        }
        if (transfer.isReturn) {
          if (responder.role !== RoleType.HEAD_WAREHOUSE) {
            throw new ForbiddenException('Faqat Bosh omborchi qaytarilgan ashyoni qabul qilishi mumkin!');
          }
        } else {
          const isTargetReceiver =
            transfer.receiverId === dto.responderId ||
            (transfer.toRoom && transfer.toRoom.responsibleUserId === dto.responderId);
          if (!isTargetReceiver) {
            throw new ForbiddenException('Faqat ashyo biriktirilgan/qabul qiluvchi mas’ul shaxs (MOL) ushbu ko‘chirishni qabul qila oladi!');
          }
        }
      }

      const fromLoc = transfer.fromRoom
        ? `${transfer.fromRoom.number}-xona: ${transfer.fromRoom.name}`
        : 'Bosh omborxona';
      const toLoc = transfer.isReturn
        ? (transfer.toWarehouse ? transfer.toWarehouse.name : 'Bosh omborxona')
        : (transfer.toRoom ? `${transfer.toRoom.number}-xona: ${transfer.toRoom.name}` : 'Bosh omborxona');

      if (dto.status === 'ACCEPTED') {
        const updatedTransfer = await tx.transferAcceptance.update({
          where: { id: transferId },
          data: {
            status: TransferStatus.ACCEPTED,
            acceptedAt: new Date(),
            note: dto.note || transfer.note,
          },
        });

        if (transfer.isReturn) {
          await tx.itemInstance.update({
            where: { id: transfer.assetId },
            data: {
              roomId: null,
              responsibleUserId: null,
              status: AssetStatus.NEW,
            },
          });

          const movNum = this.sequenceService
            ? await this.sequenceService.nextMovementNumber(tx)
            : this.codeGen.generateMovementNumber((await tx.stockMovement.count()) + 1);

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

    if (dto.status === 'ACCEPTED') {
      try {
        const fullTransfer = await this.prisma.transferAcceptance.findUnique({
          where: { id: transferId },
          include: {
            asset: { include: { item: true } },
            fromRoom: true,
            toRoom: true,
            sender: true,
            receiver: true,
          },
        });
        if (fullTransfer) {
          const year = new Date().getFullYear();
          const shortId = transferId.substring(0, 8).toUpperCase();
          const actNumber = `OS1-${year}-${shortId}`;
          await this.documentStampsService.stampDocument({
            docType: 'OS_1',
            docNumber: actNumber,
            title: `Kirim va Topshirish-Qabul Qilish Dalolatnomasi (OS-1) — ${fullTransfer.asset.item.name}`,
            signerName: fullTransfer.receiver?.fullName || 'Kafedra mudiri',
            signerRole: fullTransfer.receiver?.position || 'Moddiy javobgar shaxs (MOL)',
            metadata: {
              entityId: fullTransfer.id,
              transferId: fullTransfer.id,
              assetName: fullTransfer.asset.item.name,
              inventoryNumber: fullTransfer.asset.inventoryNumber,
              sender: fullTransfer.sender.fullName,
              receiver: fullTransfer.receiver?.fullName,
            },
          });
        }
      } catch (e) {
        // Non-blocking stamp error
      }
    }

    return result;
  }

  /**
   * Bir nechta asosiy vositani ommaviy ko'chirish
   */
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

  /**
   * Asosiy vositani kafedradan omborga qaytarish talabnomasi
   */
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
      let warehouseId = dto.warehouseId;
      if (!warehouseId) {
        const mainWh =
          (await tx.warehouse.findFirst({ where: { isMain: true } })) ||
          (await tx.warehouse.findFirst());
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

    await this.notificationsService.notifyRole(
      RoleType.HEAD_WAREHOUSE,
      'Omborga Qaytarish Talabnomasi',
      `Kafedradan asosiy vosita qaytarish uchun yuborildi. Sabab: ${dto.reason}`,
      NotificationType.TRANSFER,
      '/assets',
    );

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

  /**
   * Moddiy javobgar shaxs (MOL) yalpi almashinuvi dalolatnomasi
   */
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
      const actNumber = this.sequenceService
        ? await this.sequenceService.nextDocNumber('MOL', tx, year)
        : `MOL-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      await tx.itemInstance.updateMany({
        where: { id: { in: assets.map((a) => a.id) } },
        data: { responsibleUserId: dto.toUserId },
      });

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
        assets: assets.map((a) => ({ id: a.id, inventoryNumber: a.inventoryNumber, itemName: a.item.name, model: a.item.model })),
        note: dto.note,
      };
    });

    await this.notificationsService.create({
      userId: toUser.id,
      title: 'MOL Yalpi Topshirish Akti',
      message: `Sizga ${fromUser.fullName} tomonidan ${assets.length} ta asosiy vosita rasmiy topshirildi (${result.actNumber}).`,
      type: NotificationType.TRANSFER,
      link: '/assets',
    });

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
      // Non-blocking stamp failure
    }

    return result;
  }

  /**
   * Yangi Moddiy Javobgarlikni Topshirish (ResponsibilityHandover) arizasini yaratish
   */
  async createResponsibilityHandover(dto: CreateResponsibilityHandoverDto, creatorId: string) {
    const departingUser = await this.prisma.user.findUnique({
      where: { id: dto.departingUserId },
    });
    if (!departingUser) {
      throw new NotFoundException('Topshiruvchi mas’ul shaxs (Eski MOL) topilmadi!');
    }

    // Auto-resolve building and commandant if roomId provided
    let buildingId = dto.buildingId;
    let commandantUserId = dto.commandantUserId;

    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: dto.roomId },
        include: { buildingRelation: true },
      });
      if (room?.buildingId && !buildingId) {
        buildingId = room.buildingId;
      }
      if (room?.buildingRelation?.commendantId && !commandantUserId) {
        commandantUserId = room.buildingRelation.commendantId;
      }
    } else if (buildingId && !commandantUserId) {
      const bld = await this.prisma.building.findUnique({ where: { id: buildingId } });
      if (bld?.commendantId) {
        commandantUserId = bld.commendantId;
      }
    }

    // Generate unique Handover / Act Number (e.g. AKT-2026-XXXX)
    const handoverNumber = this.sequenceService
      ? await this.sequenceService.nextNumber('AKT')
      : `AKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Validate that all items exist and belong to departingUser
    const itemIds = dto.items.map((i) => i.itemInstanceId);
    const existingAssets = await this.prisma.itemInstance.findMany({
      where: { id: { in: itemIds } },
      include: { item: true, room: true },
    });

    if (existingAssets.length !== itemIds.length) {
      throw new BadRequestException('Topshirilayotgan ayrim ashyolar bazadan topilmadi!');
    }

    for (const asset of existingAssets) {
      if (asset.responsibleUserId && asset.responsibleUserId !== dto.departingUserId) {
        throw new BadRequestException(
          `'${asset.item.name}' (${asset.inventoryNumber}) ashyosi topshiruvchi xodimga tegishli emas!`
        );
      }
    }

    // Create ResponsibilityHandover and HandoverItemAction records
    const handover = await this.prisma.responsibilityHandover.create({
      data: {
        handoverNumber,
        type: dto.type,
        status: HandoverStatus.PENDING_SIGNATURES,
        departingUserId: dto.departingUserId,
        targetUserId: dto.targetUserId,
        targetWarehouseId: dto.targetWarehouseId,
        buildingId,
        commandantUserId,
        accountantUserId: dto.accountantUserId,
        roomId: dto.roomId,
        note: dto.note,
        items: {
          create: dto.items.map((it) => ({
            itemInstanceId: it.itemInstanceId,
            actionType: it.actionType,
            targetUserId: it.targetUserId || dto.targetUserId,
            targetWarehouseId: it.targetWarehouseId || dto.targetWarehouseId,
            conditionNote: it.conditionNote,
            investigationNote: it.investigationNote,
          })),
        },
      },
      include: {
        items: {
          include: {
            itemInstance: {
              include: { item: true, room: true },
            },
          },
        },
        departingUser: { select: { id: true, fullName: true, role: true, position: true } },
        targetUser: { select: { id: true, fullName: true, role: true, position: true } },
        commandantUser: { select: { id: true, fullName: true, role: true, position: true } },
        accountantUser: { select: { id: true, fullName: true, role: true, position: true } },
        building: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, number: true, name: true, floor: true } },
        targetWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    // Notify participants
    if (dto.targetUserId) {
      await this.notificationsService.create({
        userId: dto.targetUserId,
        title: 'Moddiy Javobgarlik Topshirish Dalolatnomasi',
        message: `${departingUser.fullName} sizga ${dto.items.length} ta aktiv bo‘yicha javobgarlik topshirmoqda (${handoverNumber}).`,
        type: NotificationType.TRANSFER,
        link: '/assets',
      });
    }

    if (commandantUserId) {
      await this.notificationsService.create({
        userId: commandantUserId,
        title: 'Bino Bo‘yicha Moddiy Topshirish Dalolatnomasi',
        message: `Siz nazorat qiluvchi binoda moddiy topshirish dalolatnomasi (${handoverNumber}) rasmiylashtirilmoqda.`,
        type: NotificationType.TRANSFER,
        link: '/assets',
      });
    }

    await this.systemAuditService.log({
      action: 'CREATE',
      entity: 'RESPONSIBILITY_HANDOVER',
      entityId: handover.id,
      details: {
        handoverNumber,
        type: dto.type,
        departingUser: departingUser.fullName,
        itemsCount: dto.items.length,
      },
      userId: creatorId,
    });

    return handover;
  }

  /**
   * Topshirish dalolatnomalari ro'yxatini olish (sahifalash va filtrlar bilan)
   */
  async getResponsibilityHandovers(query: QueryHandoversDto) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ResponsibilityHandoverWhereInput = {};

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.departingUserId) where.departingUserId = query.departingUserId;
    if (query.targetUserId) where.targetUserId = query.targetUserId;
    if (query.buildingId) where.buildingId = query.buildingId;

    if (query.search) {
      where.OR = [
        { handoverNumber: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
        { departingUser: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { targetUser: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.responsibilityHandover.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          departingUser: { select: { id: true, fullName: true, role: true, position: true } },
          targetUser: { select: { id: true, fullName: true, role: true, position: true } },
          commandantUser: { select: { id: true, fullName: true, role: true, position: true } },
          accountantUser: { select: { id: true, fullName: true, role: true, position: true } },
          building: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, number: true, name: true, floor: true } },
          targetWarehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.responsibilityHandover.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Bitta dalolatnomaning to'liq ma'lumotlarini olish (barcha aktivlar bilan)
   */
  async getResponsibilityHandoverById(id: string) {
    const handover = await this.prisma.responsibilityHandover.findFirst({
      where: {
        OR: [{ id }, { handoverNumber: id }],
      },
      include: {
        departingUser: { select: { id: true, fullName: true, role: true, position: true, phone: true } },
        targetUser: { select: { id: true, fullName: true, role: true, position: true, phone: true } },
        commandantUser: { select: { id: true, fullName: true, role: true, position: true, phone: true } },
        accountantUser: { select: { id: true, fullName: true, role: true, position: true, phone: true } },
        approvedByUser: { select: { id: true, fullName: true, role: true, position: true } },
        building: true,
        room: true,
        targetWarehouse: true,
        docArchive: true,
        items: {
          include: {
            itemInstance: {
              include: {
                item: { include: { category: true } },
                room: true,
              },
            },
          },
        },
      },
    });

    if (!handover) {
      throw new NotFoundException('Topshirish dalolatnomasi topilmadi!');
    }

    return handover;
  }

  /**
   * Dalolatnomani imzolash va atomik tranzaksiyani bajarish
   */
  async signResponsibilityHandover(id: string, dto: SignHandoverDto, currentUserId: string) {
    const handover = await this.prisma.responsibilityHandover.findUnique({
      where: { id },
      include: {
        departingUser: true,
        targetUser: true,
        commandantUser: true,
        accountantUser: true,
      },
    });

    if (!handover) {
      throw new NotFoundException('Topshirish dalolatnomasi topilmadi!');
    }

    if (handover.status === HandoverStatus.COMPLETED) {
      throw new BadRequestException('Ushbu dalolatnoma allaqachon to‘liq imzolangan va yakunlangan!');
    }

    // Check user has permission to sign (departing, target, commandant, accountant, or superadmin)
    const currentUser = await this.prisma.user.findUnique({ where: { id: currentUserId } });
    const isSignatory =
      currentUserId === handover.departingUserId ||
      currentUserId === handover.targetUserId ||
      currentUserId === handover.commandantUserId ||
      currentUserId === handover.accountantUserId ||
      currentUser?.role === RoleType.SUPER_ADMIN ||
      currentUser?.role === RoleType.CHIEF_ACCOUNTANT ||
      currentUser?.role === RoleType.VICE_RECTOR_FINANCE;

    if (!isSignatory) {
      throw new ForbiddenException('Siz ushbu dalolatnomani imzolash huquqiga ega emassiz!');
    }

    // Execute atomic transaction
    const completed = await this.executeResponsibilityHandoverTransaction(id, currentUserId);

    // Generate electronic signature stamp (non-blocking)
    try {
      await this.documentStampsService.stampDocument({
        docType: 'MOL_TRANSFER',
        docNumber: completed.handoverNumber,
        title: `Moddiy Javobgarlikni Topshirish-Qabul Qilish Dalolatnomasi (${completed.handoverNumber})`,
        signerName: currentUser?.fullName || 'Mas’ul Shaxs',
        signerRole: currentUser?.position || currentUser?.role || 'MOL',
        metadata: {
          handoverNumber: completed.handoverNumber,
          type: completed.type,
          fromUser: completed.departingUser?.fullName,
          toUser: completed.targetUser?.fullName,
          itemsCount: completed.items.length,
        },
      });
    } catch (e) {
      // Non-blocking
    }

    await this.systemAuditService.log({
      action: 'TRANSFER',
      entity: 'RESPONSIBILITY_HANDOVER',
      entityId: completed.handoverNumber,
      details: {
        handoverId: completed.id,
        handoverNumber: completed.handoverNumber,
        type: completed.type,
        signedBy: currentUser?.fullName,
        itemsCount: completed.items.length,
      },
      userId: currentUserId,
    });

    return completed;
  }

  /**
   * Dalolatnomani rad etish
   */
  async rejectResponsibilityHandover(id: string, dto: RejectHandoverDto, currentUserId: string) {
    const handover = await this.prisma.responsibilityHandover.findUnique({
      where: { id },
      include: { departingUser: true },
    });

    if (!handover) {
      throw new NotFoundException('Topshirish dalolatnomasi topilmadi!');
    }

    if (handover.status === HandoverStatus.COMPLETED) {
      throw new BadRequestException('Yakunlangan dalolatnomani rad etib bo‘lmaydi!');
    }

    const updated = await this.prisma.responsibilityHandover.update({
      where: { id },
      data: {
        status: HandoverStatus.REJECTED,
        note: handover.note ? `${handover.note} | Rad etish: ${dto.reason}` : `Rad etish: ${dto.reason}`,
      },
    });

    await this.notificationsService.create({
      userId: handover.departingUserId,
      title: 'Topshirish Dalolatnomasi Rad Etildi',
      message: `${handover.handoverNumber} raqamli dalolatnoma rad etildi. Sabab: ${dto.reason}`,
      type: NotificationType.TRANSFER,
      link: '/assets',
    });

    return updated;
  }

  /**
   * Qat'iy Atomik Tranzaksiya ($transaction): Barcha ashyolar, xonalar va harakat jurnallarini ko'chirish
   */
  async executeResponsibilityHandoverTransaction(handoverId: string, executorId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const handover = await tx.responsibilityHandover.findUnique({
        where: { id: handoverId },
        include: {
          items: { include: { itemInstance: { include: { item: true, room: true } } } },
          departingUser: true,
          targetUser: true,
          commandantUser: true,
          accountantUser: true,
          targetWarehouse: { include: { manager: true } },
          room: true,
          building: true,
        },
      });

      if (!handover) {
        throw new NotFoundException('Topshirish dalolatnomasi topilmadi!');
      }

      if (handover.status === HandoverStatus.COMPLETED) {
        throw new BadRequestException('Ushbu topshirish allaqachon yakunlangan!');
      }

      for (const itemAction of handover.items) {
        const asset = itemAction.itemInstance;
        const fromLoc = asset.room ? `${asset.room.building} ${asset.room.number}-xona` : 'Xonasiz';

        if (itemAction.actionType === HandoverItemActionType.TRANSFER_TO_MOL) {
          const targetId = itemAction.targetUserId || handover.targetUserId;
          if (!targetId) {
            throw new BadRequestException(`'${asset.item.name}' uchun qabul qiluvchi shaxs ko‘rsatilmagan!`);
          }
          const targetUser = await tx.user.findUnique({ where: { id: targetId } });
          const targetRoomId = handover.roomId || asset.roomId;

          await tx.itemInstance.update({
            where: { id: asset.id },
            data: {
              responsibleUserId: targetId,
              roomId: targetRoomId,
              status: AssetStatus.IN_USE,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'MOL_ALMASHINUVI',
              fromLocation: fromLoc,
              toLocation: handover.room ? `${handover.room.building} ${handover.room.number}-xona` : fromLoc,
              fromUser: handover.departingUser.fullName,
              toUser: targetUser?.fullName || 'Yangi MOL',
              referenceDoc: `Qabul qilish-topshirish akti (${handover.handoverNumber})`,
              note: itemAction.conditionNote || handover.note || 'Moddiy javobgarlik o‘tkazildi',
              executedById: executorId,
            },
          });
        } else if (itemAction.actionType === HandoverItemActionType.RETURN_TO_WAREHOUSE) {
          const warehouseId = itemAction.targetWarehouseId || handover.targetWarehouseId;
          if (!warehouseId) {
            throw new BadRequestException(`'${asset.item.name}' uchun qabul qiluvchi ombor tanlanmagan!`);
          }
          const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
          const movNum = this.sequenceService
            ? await this.sequenceService.nextMovementNumber(tx)
            : this.codeGen.generateMovementNumber((await tx.stockMovement.count()) + 1);

          await tx.itemInstance.update({
            where: { id: asset.id },
            data: {
              roomId: null,
              responsibleUserId: warehouse?.managerId || null,
              status: AssetStatus.NEW,
            },
          });

          const movement = await tx.stockMovement.create({
            data: {
              movementNumber: movNum,
              movementType: MovementType.RETURN,
              referenceDoc: `Qaytarish akti (${handover.handoverNumber})`,
              note: itemAction.conditionNote || handover.note || 'Kafedradan omborga qaytarildi',
              executedById: executorId,
              fromRoomId: asset.roomId,
              toWarehouseId: warehouseId,
              fundingSource: asset.fundingSource,
            },
          });

          await tx.stockMovementItem.create({
            data: {
              movementId: movement.id,
              itemId: asset.itemId,
              itemInstanceId: asset.id,
              quantity: 1,
              note: 'Omborga qaytarib qabul qilindi',
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'QAYTARILDI_OMBORGA',
              fromLocation: fromLoc,
              toLocation: warehouse?.name || 'Markaziy ombor',
              fromUser: handover.departingUser.fullName,
              toUser: warehouse?.name || 'Omborchi',
              referenceDoc: `Qaytarish akti (${handover.handoverNumber})`,
              note: itemAction.conditionNote || 'Omborga muvaffaqiyatli qabul qilindi',
              executedById: executorId,
            },
          });
        } else if (itemAction.actionType === HandoverItemActionType.SEND_TO_REPAIR) {
          await tx.itemInstance.update({
            where: { id: asset.id },
            data: {
              status: AssetStatus.IN_REPAIR,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'TAMIRGA_YUBORILDI',
              fromLocation: fromLoc,
              toLocation: 'Ta’mirlash xizmati',
              fromUser: handover.departingUser.fullName,
              toUser: 'Servis markazi',
              referenceDoc: `Dalolatnoma (${handover.handoverNumber})`,
              note: itemAction.conditionNote || 'Topshirish chog‘ida nosozlik aniqlandi va ta’mirga yo‘naltirildi',
              executedById: executorId,
            },
          });
        } else if (itemAction.actionType === HandoverItemActionType.WRITE_OFF) {
          await tx.itemInstance.update({
            where: { id: asset.id },
            data: {
              status: AssetStatus.WRITTEN_OFF,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'HISOBDAN_CHIQARISHGA_BERILDI',
              fromLocation: fromLoc,
              toLocation: 'Hisobdan chiqarish komissiyasi',
              fromUser: handover.departingUser.fullName,
              toUser: 'Buxgalteriya',
              referenceDoc: `Dalolatnoma (${handover.handoverNumber})`,
              note: itemAction.conditionNote || 'Topshirish chog‘ida butunlay yaroqsizligi aniqlangan',
              executedById: executorId,
            },
          });
        } else if (itemAction.actionType === HandoverItemActionType.SHORTAGE) {
          await tx.itemInstance.update({
            where: { id: asset.id },
            data: {
              status: AssetStatus.MISSING,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'KAMOMAD_ANIQLANDI',
              fromLocation: fromLoc,
              toLocation: 'Tekshiruvda / Topilmadi',
              fromUser: handover.departingUser.fullName,
              toUser: 'Ichki audit komissiyasi',
              referenceDoc: `Dalolatnoma (${handover.handoverNumber})`,
              note: itemAction.investigationNote || itemAction.conditionNote || 'Topshirish chog‘ida jihoz mavjud emasligi aniqlandi',
              executedById: executorId,
            },
          });
        }
      }

      // If ROOM_TRANSFER and targetUserId specified, update room's responsible person
      if (handover.roomId && handover.targetUserId) {
        await tx.room.update({
          where: { id: handover.roomId },
          data: { responsibleUserId: handover.targetUserId },
        });
      }

      // Mark Handover as COMPLETED
      const completedHandover = await tx.responsibilityHandover.update({
        where: { id: handoverId },
        data: {
          status: HandoverStatus.COMPLETED,
          completedAt: new Date(),
          approvedByUserId: executorId,
        },
        include: {
          items: { include: { itemInstance: { include: { item: true } } } },
          departingUser: true,
          targetUser: true,
          commandantUser: true,
          accountantUser: true,
        },
      });

      return completedHandover;
    });
  }
}
