import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { AuditStatus, AuditRecordStatus, AssetStatus } from '@prisma/client';

@Injectable()
export class AuditsService {
  constructor(
    private prisma: PrismaService,
    private auditService: SystemAuditService,
  ) {}

  async startAudit(roomId: string, createdById?: string) {
    let creatorId = createdById;
    if (!creatorId) {
      const auditor = await this.prisma.user.findFirst({ where: { role: 'AUDITOR' } });
      creatorId = auditor?.id;
    }

    const auditNum = `AUD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    const audit = await this.prisma.inventoryAudit.create({
      data: {
        auditNumber: auditNum,
        title: `${room?.number || ''}-xona reja bo‘yicha inventarizatsiyasi`,
        roomId,
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
      details: { auditNumber: auditNum, roomId, roomNumber: room?.number },
      userId: creatorId,
    });

    return audit;
  }

  async scanCode(roomId: string, qrCode: string) {
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
      where: { roomId, status: AuditStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    });

    if (!audit) {
      // Find default auditor user
      const auditor = await this.prisma.user.findFirst({ where: { role: 'AUDITOR' } });
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      audit = await this.prisma.inventoryAudit.create({
        data: {
          auditNumber: `AUD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          title: `${room?.number || ''}-xona tezkor inventarizatsiyasi`,
          roomId,
          createdById: auditor?.id || (await this.prisma.user.findFirst())!.id,
          status: AuditStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
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
          notes: isMatch
            ? 'Reja bo‘yicha o‘z xonasida topildi'
            : `Nomutanosiblik: tegishli xona: ${asset.room?.name || 'ombor'}`,
        },
      });
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
      message: isMatch
        ? `Topildi: ${asset.item.name} (${asset.inventoryNumber})`
        : `DIQQAT! Bu uskuna ${asset.room?.name || 'ombor'}ga tegishli!`,
    };
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

    return this.prisma.$transaction(async (tx) => {
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

      return completed;
    });
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
