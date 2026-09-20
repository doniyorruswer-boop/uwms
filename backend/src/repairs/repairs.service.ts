import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { CreateRepairDto, UpdateRepairStatusDto } from './dto/repair.dto';
import { AssetStatus, RepairStatus } from '@prisma/client';

@Injectable()
export class RepairsService {
  constructor(
    private prisma: PrismaService,
    private codeGen: CodeGeneratorService,
  ) {}

  async getRepairs(query?: { status?: RepairStatus; assetId?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.assetId) where.assetId = query.assetId;

    const list = await this.prisma.repairRecord.findMany({
      where,
      include: {
        asset: {
          include: {
            item: { include: { category: true } },
            room: true,
            responsibleUser: true,
          },
        },
        requestedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((r) => {
      const dep = this.codeGen.calculateDepreciation(
        Number(r.asset.purchasePrice || 0),
        r.asset.purchaseDate || r.asset.createdAt,
        r.asset.item.category.name,
      );
      return {
        ...r,
        cost: r.cost !== null && r.cost !== undefined ? Number(r.cost) : null,
        asset: {
          ...r.asset,
          purchasePrice: Number(r.asset.purchasePrice || 0),
          depreciation: dep,
        },
      };
    });
  }

  async getRepairById(id: string) {
    const r = await this.prisma.repairRecord.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            item: { include: { category: true } },
            room: true,
            responsibleUser: true,
          },
        },
        requestedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    if (!r) throw new NotFoundException('Ta’mirlash arizasi topilmadi!');

    const dep = this.codeGen.calculateDepreciation(
      Number(r.asset.purchasePrice || 0),
      r.asset.purchaseDate || r.asset.createdAt,
      r.asset.item.category.name,
    );

    return {
      ...r,
      cost: r.cost !== null && r.cost !== undefined ? Number(r.cost) : null,
      asset: {
        ...r.asset,
        purchasePrice: Number(r.asset.purchasePrice || 0),
        depreciation: dep,
      },
    };
  }

  async createRepair(dto: CreateRepairDto, requestedById?: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { id: dto.assetId },
      include: { room: true },
    });
    if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

    if (asset.status === AssetStatus.WRITTEN_OFF) {
      throw new BadRequestException('Hisobdan chiqarilgan (Spisanie) ashyoni ta’mirga yuborib bo‘lmaydi!');
    }

    const effectiveRequesterId =
      requestedById ||
      (await this.prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id ||
      asset.responsibleUserId;

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.repairRecord.count();
      const repairNumber = this.codeGen.generateRepairNumber(count + 1);

      // 1. Create Repair Record
      const record = await tx.repairRecord.create({
        data: {
          repairNumber,
          assetId: dto.assetId,
          issueDescription: dto.issueDescription,
          status: RepairStatus.IN_REPAIR,
          serviceProvider: dto.serviceProvider?.trim() || null,
          cost: dto.cost !== undefined && dto.cost !== null ? dto.cost : null,
          startDate: new Date(),
          notes: dto.notes?.trim() || null,
          requestedById: effectiveRequesterId,
        },
      });

      // 2. Mark asset as IN_REPAIR
      await tx.itemInstance.update({
        where: { id: dto.assetId },
        data: { status: AssetStatus.IN_REPAIR },
      });

      // 3. Log audit history
      const fromLoc = asset.room
        ? `${asset.room.number}-xona: ${asset.room.name}`
        : 'Omborxona';
      const toLoc = dto.serviceProvider?.trim() || 'Ta’mirlash ustaxonasi';

      await tx.assetHistory.create({
        data: {
          assetId: dto.assetId,
          action: 'TA‘MIRLASHGA_YUBORILDI',
          fromLocation: fromLoc,
          toLocation: toLoc,
          referenceDoc: repairNumber,
          note: dto.issueDescription,
          executedById: effectiveRequesterId,
        },
      });

      return {
        ...record,
        cost: record.cost !== null && record.cost !== undefined ? Number(record.cost) : null,
      };
    });
  }

  async updateRepairStatus(
    id: string,
    dto: UpdateRepairStatusDto,
    approverId?: string,
  ) {
    const repair = await this.prisma.repairRecord.findUnique({
      where: { id },
      include: { asset: { include: { room: true } } },
    });
    if (!repair) throw new NotFoundException('Ta’mirlash arizasi topilmadi!');

    const effectiveApproverId = approverId || repair.requestedById;

    return this.prisma.$transaction(async (tx) => {
      const isCompleted = dto.status === RepairStatus.COMPLETED;
      const isUnrepairable = dto.status === RepairStatus.UNREPAIRABLE;

      const actNumber = dto.actNumber?.trim()
        ? dto.actNumber.trim()
        : isCompleted
        ? (repair.actNumber || `AKT-REP-${repair.repairNumber}`)
        : repair.actNumber;

      const updated = await tx.repairRecord.update({
        where: { id },
        data: {
          status: dto.status,
          serviceProvider:
            dto.serviceProvider !== undefined
              ? (dto.serviceProvider?.trim() || null)
              : repair.serviceProvider,
          cost: dto.cost !== undefined && dto.cost !== null ? dto.cost : repair.cost,
          actNumber,
          notes: dto.notes !== undefined ? (dto.notes?.trim() || null) : repair.notes,
          completionDate: isCompleted ? (repair.completionDate || new Date()) : repair.completionDate,
          approvedById: effectiveApproverId,
        },
      });

      if (isCompleted) {
        // Return asset to IN_USE
        await tx.itemInstance.update({
          where: { id: repair.assetId },
          data: { status: AssetStatus.IN_USE },
        });

        await tx.assetHistory.create({
          data: {
            assetId: repair.assetId,
            action: 'TA‘MIRDAN_QAYTARILDI',
            fromLocation: updated.serviceProvider || 'Ta’mirlash ustaxonasi',
            toLocation: repair.asset.room
              ? `${repair.asset.room.number}-xona: ${repair.asset.room.name}`
              : 'Omborxona',
            referenceDoc: updated.actNumber || updated.repairNumber,
            note: `Ta’mir muvaffaqiyatli yakunlandi. Xarajat: ${updated.cost || 0} so‘m. Izoh: ${dto.notes || 'Yaroqli holatda topshirildi'}`,
            executedById: effectiveApproverId,
          },
        });
      } else if (isUnrepairable) {
        await tx.itemInstance.update({
          where: { id: repair.assetId },
          data: { status: AssetStatus.IN_REPAIR },
        });

        await tx.assetHistory.create({
          data: {
            assetId: repair.assetId,
            action: 'YAROQSIZ_DEB_TOPILDI',
            fromLocation: updated.serviceProvider || 'Ta’mirlash ustaxonasi',
            toLocation: repair.asset.room
              ? `${repair.asset.room.number}-xona: ${repair.asset.room.name}`
              : 'Omborxona',
            referenceDoc: updated.actNumber || updated.repairNumber,
            note: `Texnik ekspertiza: ta’mirlash imkoni yo‘q. Spisanie (OS-4) tavsiya etiladi. Izoh: ${dto.notes || ''}`,
            executedById: effectiveApproverId,
          },
        });
      }

      return {
        ...updated,
        cost: updated.cost !== null && updated.cost !== undefined ? Number(updated.cost) : null,
      };
    });
  }
}
