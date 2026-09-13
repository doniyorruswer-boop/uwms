import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { CreateWriteOffDto, VoteWriteOffDto } from './dto/write-off.dto';
import { AssetStatus, WriteOffStatus, VoteStatus, MovementType, RoleType } from '@prisma/client';

@Injectable()
export class WriteOffsService {
  constructor(
    private prisma: PrismaService,
    private codeGen: CodeGeneratorService,
  ) {}

  async getWriteOffs(query?: { status?: WriteOffStatus; assetId?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.assetId) where.assetId = query.assetId;

    const list = await this.prisma.writeOffRequest.findMany({
      where,
      include: {
        asset: {
          include: {
            item: { include: { category: true } },
            room: true,
            responsibleUser: true,
          },
        },
        createdBy: { select: { id: true, fullName: true, role: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, role: true, email: true } },
          },
          orderBy: { roleName: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((item) => {
      const dep = this.codeGen.calculateDepreciation(
        Number(item.asset.purchasePrice || 0),
        item.asset.purchaseDate || item.asset.createdAt,
        item.asset.item.category.name,
      );
      return {
        ...item,
        asset: {
          ...item.asset,
          depreciation: dep,
        },
      };
    });
  }

  async getWriteOffById(id: string) {
    const item = await this.prisma.writeOffRequest.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            item: { include: { category: true } },
            room: true,
            responsibleUser: true,
          },
        },
        createdBy: { select: { id: true, fullName: true, role: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, role: true, email: true } },
          },
          orderBy: { roleName: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Hisobdan chiqarish arizasi topilmadi!');

    const dep = this.codeGen.calculateDepreciation(
      Number(item.asset.purchasePrice || 0),
      item.asset.purchaseDate || item.asset.createdAt,
      item.asset.item.category.name,
    );

    return {
      ...item,
      asset: {
        ...item.asset,
        depreciation: dep,
      },
    };
  }

  async createWriteOff(dto: CreateWriteOffDto, createdById: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { id: dto.assetId },
      include: { item: { include: { category: true } }, room: true },
    });
    if (!asset) throw new NotFoundException('Asosiy vosita topilmadi!');

    if (asset.status === AssetStatus.WRITTEN_OFF) {
      throw new BadRequestException('Ushbu ashyo allaqachon hisobdan chiqarilgan (Spisanie)!');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate OS-4 Act Number
      const count = await tx.writeOffRequest.count();
      const actNumber = this.codeGen.generateDocNumber('OS4', count + 1);

      // 2. Resolve commission members
      let membersToCreate = dto.members || [];
      if (!membersToCreate || membersToCreate.length === 0) {
        // Automatically populate standard university commission
        const admin = await tx.user.findFirst({ where: { role: RoleType.SUPER_ADMIN } });
        const whHead = await tx.user.findFirst({ where: { role: RoleType.HEAD_WAREHOUSE } });
        const allUsers = await tx.user.findMany({ take: 5 });

        const memberMap: { userId: string; roleName: string }[] = [];
        if (admin) {
          memberMap.push({ userId: admin.id, roleName: 'Komissiya raisi (Rektorat vakili)' });
        }
        if (whHead && whHead.id !== admin?.id) {
          memberMap.push({ userId: whHead.id, roleName: 'Bosh mexanik / Ombor mudiri' });
        }

        // Add additional unique committee users
        for (const u of allUsers) {
          if (!memberMap.some((m) => m.userId === u.id)) {
            if (memberMap.length === 2) {
              memberMap.push({ userId: u.id, roleName: 'Bosh buxgalter' });
            } else if (memberMap.length === 3) {
              memberMap.push({ userId: u.id, roleName: 'Yuridik bo‘lim mas’uli' });
            } else if (memberMap.length < 5) {
              memberMap.push({ userId: u.id, roleName: 'Kasaba uyushmasi vakili' });
            }
          }
        }
        membersToCreate = memberMap;
      }

      // 3. Create WriteOffRequest
      const writeOff = await tx.writeOffRequest.create({
        data: {
          actNumber,
          assetId: dto.assetId,
          reason: dto.reason,
          technicalConclusion: dto.technicalConclusion || 'Texnik ekspertiza: Jihoz jismoniy va ma’nan to‘liq eskirgan, ta’mirlash iqtisodiy jihatdan samarasiz.',
          status: WriteOffStatus.IN_REVIEW,
          createdById,
          members: {
            create: membersToCreate.map((m) => ({
              userId: m.userId,
              roleName: m.roleName,
              vote: VoteStatus.PENDING,
            })),
          },
        },
        include: {
          members: { include: { user: true } },
        },
      });

      // 4. Mark asset status as IN_REPAIR during review
      await tx.itemInstance.update({
        where: { id: dto.assetId },
        data: { status: AssetStatus.IN_REPAIR },
      });

      // 5. Log audit history
      await tx.assetHistory.create({
        data: {
          assetId: dto.assetId,
          action: 'SPISANIE_TALABNOMASI_OCHILDI',
          fromLocation: asset.room ? `${asset.room.number}-xona` : 'Omborxona',
          toLocation: 'Hisobdan chiqarish komissiyasi',
          referenceDoc: actNumber,
          note: `Sabab: ${dto.reason}. Komissiya a’zolari soni: ${membersToCreate.length} nafar.`,
          executedById: createdById,
        },
      });

      return writeOff;
    });
  }

  async voteWriteOff(writeOffId: string, userId: string, dto: VoteWriteOffDto) {
    return this.prisma.$transaction(async (tx) => {
      const memberVote = await tx.writeOffMemberVote.findUnique({
        where: {
          writeOffId_userId: {
            writeOffId,
            userId,
          },
        },
        include: { writeOffRequest: { include: { asset: { include: { item: true } } } } },
      });

      if (!memberVote) {
        throw new ForbiddenException('Siz ushbu hisobdan chiqarish komissiyasi a’zolari ro‘yxatida yo‘qsiz!');
      }

      if (memberVote.vote !== VoteStatus.PENDING) {
        throw new BadRequestException('Siz ushbu hujjat bo‘yicha ovoz berib bo‘lgansiz!');
      }

      // 1. Record member's vote
      await tx.writeOffMemberVote.update({
        where: { id: memberVote.id },
        data: {
          vote: dto.vote,
          comment: dto.comment,
          votedAt: new Date(),
        },
      });

      // 2. Fetch all votes for this request
      const allVotes = await tx.writeOffMemberVote.findMany({
        where: { writeOffId },
      });

      const hasRejection = allVotes.some((v) => v.vote === VoteStatus.REJECTED || (v.id === memberVote.id && dto.vote === VoteStatus.REJECTED));
      const allVoted = allVotes.every((v) => (v.id === memberVote.id ? dto.vote !== VoteStatus.PENDING : v.vote !== VoteStatus.PENDING));
      const allApproved = allVoted && allVotes.every((v) => (v.id === memberVote.id ? dto.vote === VoteStatus.APPROVED : v.vote === VoteStatus.APPROVED));

      const writeOff = memberVote.writeOffRequest;

      if (hasRejection) {
        // At least one member rejected
        await tx.writeOffRequest.update({
          where: { id: writeOffId },
          data: { status: WriteOffStatus.REJECTED },
        });

        await tx.assetHistory.create({
          data: {
            assetId: writeOff.assetId,
            action: 'SPISANIE_RAD_ETILDI',
            referenceDoc: writeOff.actNumber,
            note: `Komissiya a’zosi tomonidan rad etildi. Izoh: ${dto.comment || 'Rad sababi ko‘rsatilmadi'}`,
            executedById: userId,
          },
        });
      } else if (allApproved) {
        // ALL members approved: finalize write-off!
        await tx.writeOffRequest.update({
          where: { id: writeOffId },
          data: {
            status: WriteOffStatus.APPROVED,
            approvedAt: new Date(),
          },
        });

        // Update asset status
        await tx.itemInstance.update({
          where: { id: writeOff.assetId },
          data: {
            status: AssetStatus.WRITTEN_OFF,
            roomId: null,
            responsibleUserId: null,
          },
        });

        // Create Stock Movement (Disposal / Write-off)
        const movCount = await tx.stockMovement.count();
        const movNum = this.codeGen.generateMovementNumber(movCount + 1);

        const movement = await tx.stockMovement.create({
          data: {
            movementNumber: movNum,
            movementType: MovementType.WRITE_OFF,
            referenceDoc: writeOff.actNumber,
            note: `OS-4 Dalolatnomasi bo‘yicha hisobdan chiqarildi (Spisanie). Sabab: ${writeOff.reason}`,
            executedById: userId,
            fundingSource: writeOff.asset.fundingSource,
          },
        });

        await tx.stockMovementItem.create({
          data: {
            movementId: movement.id,
            itemId: writeOff.asset.itemId,
            itemInstanceId: writeOff.assetId,
            quantity: 1,
            note: `Hisobdan chiqarildi (${writeOff.actNumber})`,
          },
        });

        // Audit History
        await tx.assetHistory.create({
          data: {
            assetId: writeOff.assetId,
            action: 'HISOBDAN_CHIQARILDI_OS4',
            fromLocation: 'Komissiya ko‘rigi',
            toLocation: 'Balansdan chiqarildi',
            referenceDoc: writeOff.actNumber,
            note: `Komissiyaning barcha ${allVotes.length} a’zosi to‘liq tasdiqladi. Rasmiy OS-4 dalolatnomasi tasdiqlandi.`,
            executedById: userId,
          },
        });
      }

      return this.getWriteOffById(writeOffId);
    });
  }
}
