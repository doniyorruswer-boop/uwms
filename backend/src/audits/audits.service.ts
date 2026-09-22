import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditStatus, AuditRecordStatus, AssetStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuditsService {
  constructor(
    private prisma: PrismaService,
    private auditService: SystemAuditService,
    private documentStampsService: DocumentStampsService,
    @Optional() private eventsGateway?: EventsGateway,
  ) {}

  private generateAuditNumber(): string {
    const year = new Date().getFullYear();
    const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `AUD-${year}-${uniqueSuffix}`;
  }

  async startAudit(roomId: string, createdById?: string, campaignId?: string) {
    let creatorId = createdById;
    if (!creatorId) {
      const auditor = await this.prisma.user.findFirst({ where: { role: 'AUDITOR' } });
      creatorId = auditor?.id;
    }

    const auditNum = this.generateAuditNumber();
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    const audit = await this.prisma.inventoryAudit.create({
      data: {
        auditNumber: auditNum,
        title: `${room?.number || ''}-xona reja bo‘yicha inventarizatsiyasi`,
        roomId,
        campaignId: campaignId || null,
        createdById: creatorId!,
        status: AuditStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: {
        room: {
          include: {
            itemInstances: { include: { item: true } },
          },
        },
      },
    });

    await this.auditService.log({
      action: 'CREATE',
      entity: 'InventoryAudit',
      entityId: audit.id,
      details: { auditNumber: auditNum, roomId, roomNumber: room?.number, campaignId },
      userId: creatorId,
    });

    return audit;
  }

  async scanCode(roomId: string, qrCode: string, campaignId?: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { qrCode },
      include: {
        item: true,
        room: true,
        responsibleUser: { select: { fullName: true } },
      },
    });

    if (!asset) {
      return {
        found: false,
        message: 'Bazada mavjud bo‘lmagan noma’lum QR-kod!',
      };
    }

    const isMatch = asset.roomId === roomId;
    const recordStatus: AuditRecordStatus = isMatch
      ? AuditRecordStatus.MATCHED
      : AuditRecordStatus.RELOCATED;

    // Find active audit for this room or create/link to current session
    let audit = await this.prisma.inventoryAudit.findFirst({
      where: {
        roomId,
        status: AuditStatus.IN_PROGRESS,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!audit) {
      // Find default auditor user
      const auditor = await this.prisma.user.findFirst({ where: { role: 'AUDITOR' } });
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      audit = await this.prisma.inventoryAudit.create({
        data: {
          auditNumber: this.generateAuditNumber(),
          title: `${room?.number || ''}-xona tezkor inventarizatsiyasi`,
          roomId,
          campaignId: campaignId || null,
          createdById: auditor?.id || (await this.prisma.user.findFirst())!.id,
          status: AuditStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    // Collision Guard: Tekshirish — ushbu vosita boshqa xonada so'nggi paytda skanerlanganmi?
    let collision: {
      detected: boolean;
      previousRoomNumber?: string;
      previousRoomName?: string;
      scannedAt?: Date;
      minutesAgo?: number;
      message?: string;
    } | null = null;

    const previousRecentRecord = await this.prisma.inventoryAuditRecord.findFirst({
      where: {
        itemInstanceId: asset.id,
        foundRoomId: { not: roomId },
      },
      orderBy: { scannedAt: 'desc' },
      include: {
        audit: { include: { room: true } },
      },
    });

    if (previousRecentRecord) {
      const minutesAgo = Math.max(
        1,
        Math.round((Date.now() - new Date(previousRecentRecord.scannedAt).getTime()) / (1000 * 60)),
      );
      const prevRoomNum = previousRecentRecord.audit?.room?.number || 'boshqa';
      collision = {
        detected: true,
        previousRoomNumber: prevRoomNum,
        previousRoomName: previousRecentRecord.audit?.room?.name,
        scannedAt: previousRecentRecord.scannedAt,
        minutesAgo,
        message: `⚠️ Ushbu vosita ${minutesAgo} daqiqa oldin Xona ${prevRoomNum} da skanerlangan!`,
      };
    }

    // Check if asset was already scanned in this audit
    const existingRecord = await this.prisma.inventoryAuditRecord.findFirst({
      where: {
        auditId: audit.id,
        itemInstanceId: asset.id,
      },
    });

    if (!existingRecord) {
      // Persist scan in database
      await this.prisma.inventoryAuditRecord.create({
        data: {
          auditId: audit.id,
          itemInstanceId: asset.id,
          expectedRoomId: asset.roomId,
          foundRoomId: roomId,
          status: recordStatus,
          scannedAt: new Date(),
          notes: collision
            ? `Qayta skan (To‘qnashuv): Avval Xona ${collision.previousRoomNumber} da skanerlangan`
            : isMatch
            ? 'Reja bo‘yicha o‘z xonasida topildi'
            : `Nomutanosiblik: tegishli xona: ${asset.room?.name || 'ombor'}`,
        },
      });
    }

    // Ushbu xonadagi jami kutilgan va topilgan aktivlar soni
    const expectedCount = await this.prisma.itemInstance.count({
      where: {
        roomId,
        status: { notIn: [AssetStatus.WRITTEN_OFF] },
      },
    });

    const matchedCount = await this.prisma.inventoryAuditRecord.count({
      where: {
        auditId: audit.id,
        status: AuditRecordStatus.MATCHED,
      },
    });

    const isRoomComplete = expectedCount > 0 && matchedCount >= expectedCount;

    const eventPayload = {
      campaignId: campaignId || audit.campaignId || null,
      auditId: audit.id,
      roomId,
      roomNumber: asset.room?.number,
      asset: {
        id: asset.id,
        inventoryNumber: asset.inventoryNumber,
        serialNumber: asset.serialNumber,
        qrCode: asset.qrCode,
        itemName: asset.item.name,
        expectedRoom: asset.room ? `${asset.room.number}-xona` : 'Ombor',
        responsibleUser: asset.responsibleUser?.fullName,
      },
      status: recordStatus,
      isMatch,
      scannedAt: new Date().toISOString(),
      collision,
      roomStats: {
        roomId,
        expectedCount,
        matchedCount,
        isRoomComplete,
      },
    };

    // Real-Time Socket hodisalarini tarqatish (Multi-Auditor Sync)
    if (this.eventsGateway) {
      const targetCampaign = campaignId || audit.campaignId;
      if (targetCampaign) {
        this.eventsGateway.emitToRoom(
          `campaign:${targetCampaign}`,
          'audit:asset_scanned',
          eventPayload,
        );
      }
      this.eventsGateway.emitToRoom(`room:${roomId}`, 'audit:asset_scanned', eventPayload);

      if (collision) {
        if (targetCampaign) {
          this.eventsGateway.emitToRoom(
            `campaign:${targetCampaign}`,
            'audit:collision_detected',
            eventPayload,
          );
        }
        this.eventsGateway.emitToRoom(`room:${roomId}`, 'audit:collision_detected', eventPayload);
      }
    }

    return {
      found: true,
      isMatch,
      status: recordStatus,
      auditId: audit.id,
      asset: {
        id: asset.id,
        inventoryNumber: asset.inventoryNumber,
        serialNumber: asset.serialNumber,
        qrCode: asset.qrCode,
        itemName: asset.item.name,
        expectedRoom: asset.room ? `${asset.room.number}-xona` : 'Ombor',
        responsibleUser: asset.responsibleUser?.fullName,
      },
      collision,
      roomStats: {
        roomId,
        expectedCount,
        matchedCount,
        isRoomComplete,
      },
      message: collision
        ? collision.message
        : isMatch
        ? `Topildi: ${asset.item.name} (${asset.inventoryNumber})`
        : `DIQQAT! Bu uskuna ${asset.room?.name || 'ombor'}ga tegishli!`,
    };
  }

  async batchScan(items: Array<{ roomId: string; qrCode: string; campaignId?: string }>, userId?: string) {
    if (!items || items.length === 0) {
      return { processed: 0, matched: 0, relocated: 0, notFound: 0, auditIds: [] };
    }

    return this.prisma.$transaction(async (tx) => {
      let matched = 0;
      let relocated = 0;
      let notFound = 0;
      const auditIds = new Set<string>();

      for (const item of items) {
        const trimmedQr = item.qrCode?.trim();
        if (!trimmedQr) continue;

        const asset = await tx.itemInstance.findUnique({
          where: { qrCode: trimmedQr },
          include: {
            item: true,
            room: true,
            responsibleUser: { select: { fullName: true } },
          },
        });

        if (!asset) {
          notFound++;
          continue;
        }

        const isMatch = asset.roomId === item.roomId;
        const recordStatus: AuditRecordStatus = isMatch
          ? AuditRecordStatus.MATCHED
          : AuditRecordStatus.RELOCATED;

        if (isMatch) matched++;
        else relocated++;

        let audit = await tx.inventoryAudit.findFirst({
          where: {
            roomId: item.roomId,
            status: AuditStatus.IN_PROGRESS,
            ...(item.campaignId ? { campaignId: item.campaignId } : {}),
          },
          orderBy: { startedAt: 'desc' },
        });

        if (!audit) {
          const room = await tx.room.findUnique({ where: { id: item.roomId } });
          const defaultAuditor = userId
            ? await tx.user.findUnique({ where: { id: userId } })
            : await tx.user.findFirst({ where: { role: 'AUDITOR' } });
          const fallbackUser = defaultAuditor || (await tx.user.findFirst());

          audit = await tx.inventoryAudit.create({
            data: {
              auditNumber: this.generateAuditNumber(),
              title: `${room?.number || ''}-xona oflayn inventarizatsiyasi`,
              roomId: item.roomId,
              campaignId: item.campaignId || null,
              createdById: fallbackUser?.id || '',
              status: AuditStatus.IN_PROGRESS,
              startedAt: new Date(),
            },
          });
        }

        auditIds.add(audit.id);

        const existingRecord = await tx.inventoryAuditRecord.findFirst({
          where: {
            auditId: audit.id,
            itemInstanceId: asset.id,
          },
        });

        if (!existingRecord) {
          await tx.inventoryAuditRecord.create({
            data: {
              auditId: audit.id,
              itemInstanceId: asset.id,
              expectedRoomId: asset.roomId,
              foundRoomId: item.roomId,
              status: recordStatus,
              scannedAt: new Date(),
              notes: isMatch
                ? 'Oflayn navbatdan tranzaksion sinxronlandi (Mavjud)'
                : `Oflayn navbatdan tranzaksion sinxronlandi (Ko‘chirilgan / Boshqa joy: ${asset.room?.name || 'ombor'})`,
            },
          });
        }
      }

      return {
        processed: items.length,
        matched,
        relocated,
        notFound,
        auditIds: Array.from(auditIds),
      };
    });
  }

  async completeAudit(id: string, notes?: string, userId?: string) {
    const audit = await this.prisma.inventoryAudit.findUnique({
      where: { id },
      include: {
        room: true,
        records: true,
      },
    });

    if (!audit) {
      throw new NotFoundException('Inventarizatsiya sessiyasi topilmadi!');
    }

    if (audit.status === AuditStatus.COMPLETED) {
      throw new BadRequestException('Ushbu inventarizatsiya sessiyasi allaqachon yakunlangan!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let missingCount = 0;

      // Agar xonaga biriktirilgan audit bo'lsa, xonadagi barcha mavjud ashyolar bilan solishtirish
      if (audit.roomId) {
        const expectedRoomAssets = await tx.itemInstance.findMany({
          where: {
            roomId: audit.roomId,
            status: {
              notIn: [AssetStatus.WRITTEN_OFF],
            },
          },
        });

        const scannedAssetIds = new Set(audit.records.map((r) => r.itemInstanceId));
        const missingAssets = expectedRoomAssets.filter((a) => !scannedAssetIds.has(a.id));

        for (const missing of missingAssets) {
          await tx.inventoryAuditRecord.create({
            data: {
              auditId: audit.id,
              itemInstanceId: missing.id,
              expectedRoomId: audit.roomId,
              foundRoomId: null,
              status: AuditRecordStatus.MISSING,
              scannedAt: new Date(),
              notes: 'Inventarizatsiya davomida topilmadi (Kamomad)',
            },
          });
          missingCount++;
        }
      }

      const completed = await tx.inventoryAudit.update({
        where: { id: audit.id },
        data: {
          status: AuditStatus.COMPLETED,
          completedAt: new Date(),
          notes: notes || audit.notes || 'Inventarizatsiya muvaffaqiyatli yakunlandi va INV-19 shakllantirildi',
        },
        include: {
          room: {
            include: {
              department: true,
              responsibleUser: true,
            },
          },
          createdBy: { select: { id: true, fullName: true, username: true } },
          records: {
            include: {
              itemInstance: { include: { item: true, room: true, responsibleUser: true } },
            },
          },
        },
      });

      await this.auditService.log({
        action: 'COMPLETE',
        entity: 'InventoryAudit',
        entityId: audit.id,
        details: {
          auditNumber: audit.auditNumber,
          roomId: audit.roomId,
          roomNumber: audit.room?.number,
          totalRecords: completed.records.length,
          matchedCount: completed.records.filter((r) => r.status === AuditRecordStatus.MATCHED).length,
          relocatedCount: completed.records.filter((r) => r.status === AuditRecordStatus.RELOCATED).length,
          missingCount: completed.records.filter((r) => r.status === AuditRecordStatus.MISSING).length,
        },
        userId,
      });

      // Avtomatik rasmiy INV-19 aktini raqamli muhr bilan generatsiya qilish
      try {
        await this.documentStampsService.stampDocument({
          docType: 'INV_19',
          docNumber: completed.auditNumber,
          title: `Inventarizatsiya va Solishtirma Qaydnomasi (INV-19 Shakli) - ${completed.room?.number || ''}-xona`,
          signerName: completed.createdBy.fullName,
          signerRole: 'Bosh Auditor',
          metadata: {
            auditNumber: completed.auditNumber,
            roomNumber: completed.room?.number,
            roomName: completed.room?.name,
            auditorName: completed.createdBy.fullName,
            completedAt: completed.completedAt,
            totalRecords: completed.records.length,
            matchedCount: completed.records.filter((r) => r.status === AuditRecordStatus.MATCHED).length,
            missingCount: completed.records.filter((r) => r.status === AuditRecordStatus.MISSING).length,
            relocatedCount: completed.records.filter((r) => r.status === AuditRecordStatus.RELOCATED).length,
            items: completed.records.map((r) => ({
              inventoryNumber: r.itemInstance.inventoryNumber,
              name: r.itemInstance.item.name,
              model: r.itemInstance.item.model,
              status: r.status,
              notes: r.notes,
              price: r.itemInstance.purchasePrice ? Number(r.itemInstance.purchasePrice) : 0,
            })),
          },
        });
      } catch (stampErr) {
        // ignore stamping error if non-fatal
      }

      return completed;
    });

    if (this.eventsGateway) {
      const roomCompletedPayload = {
        campaignId: result.campaignId,
        auditId: result.id,
        roomId: result.roomId,
        roomNumber: result.room?.number,
        totalRecords: result.records.length,
        completedAt: result.completedAt,
      };
      if (result.campaignId) {
        this.eventsGateway.emitToRoom(
          `campaign:${result.campaignId}`,
          'audit:room_completed',
          roomCompletedPayload,
        );
      }
      if (result.roomId) {
        this.eventsGateway.emitToRoom(
          `room:${result.roomId}`,
          'audit:room_completed',
          roomCompletedPayload,
        );
      }
    }

    return result;
  }

  async getAllAudits() {
    const audits = await this.prisma.inventoryAudit.findMany({
      include: {
        room: true,
        createdBy: { select: { id: true, fullName: true } },
        records: {
          include: {
            itemInstance: { include: { item: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return audits.map((a) => ({
      id: a.id,
      auditNumber: a.auditNumber,
      title: a.title,
      status: a.status,
      startedAt: a.startedAt?.toISOString().substring(0, 16).replace('T', ' '),
      completedAt: a.completedAt?.toISOString().substring(0, 16).replace('T', ' '),
      roomNumber: a.room?.number,
      roomName: a.room?.name,
      auditorName: a.createdBy.fullName,
      totalScanned: a.records.length,
      matchedCount: a.records.filter((r) => r.status === 'MATCHED').length,
      relocatedCount: a.records.filter((r) => r.status === 'RELOCATED').length,
      missingCount: a.records.filter((r) => r.status === 'MISSING').length,
    }));
  }

  async getAuditById(id: string) {
    const audit = await this.prisma.inventoryAudit.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            department: true,
            responsibleUser: true,
            itemInstances: { include: { item: true } },
          },
        },
        createdBy: true,
        records: {
          include: {
            itemInstance: { include: { item: true, room: true, responsibleUser: true } },
          },
        },
      },
    });

    if (!audit) throw new NotFoundException('Audit sessiyasi topilmadi!');
    return audit;
  }
}
