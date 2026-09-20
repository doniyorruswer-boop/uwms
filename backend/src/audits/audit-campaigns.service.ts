import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CampaignStatus,
  AuditStatus,
  AuditRecordStatus,
  AssetStatus,
  RoleType,
  NotificationType,
} from '@prisma/client';
import { CreateCampaignDto, QueryCampaignsDto, CompleteCampaignDto, StartCampaignDto } from './dto/audit-campaigns.dto';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';

@Injectable()
export class AuditCampaignsService {
  constructor(
    private prisma: PrismaService,
    private systemAuditService: SystemAuditService,
    private documentStampsService: DocumentStampsService,
    private notificationsService: NotificationsService,
  ) {}

  private generateCampaignNumber(): string {
    const year = new Date().getFullYear();
    const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `CMP-${year}-${uniqueSuffix}`;
  }

  async create(dto: CreateCampaignDto, userId: string) {
    const campaignNumber = this.generateCampaignNumber();

    // Verify rooms exist
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: dto.roomIds } },
      select: { id: true },
    });

    if (rooms.length === 0) {
      throw new BadRequestException('Tanlangan xonalar topilmadi!');
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCampaign.create({
        data: {
          campaignNumber,
          title: dto.title,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          status: CampaignStatus.PLANNED,
          notes: dto.notes,
          orderNumber: dto.orderNumber || null,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : null,
          assignedAuditorId: dto.assignedAuditorId || null,
          createdById: userId,
          scopes: {
            createMany: {
              data: rooms.map((r) => ({ roomId: r.id })),
            },
          },
        },
        include: {
          scopes: { include: { room: true } },
          createdBy: { select: { id: true, fullName: true, username: true } },
          assignedAuditor: { select: { id: true, fullName: true, username: true } },
        },
      });

      return created;
    });

    try {
      await this.notificationsService.notifyRole(
        RoleType.RECTOR,
        'Yangi inventarizatsiya rejalashtirildi',
        `"${campaign.title}" kampaniyasi rejalashtirildi va Rektor farmoyishi (boshlash) kutilmoqda.`,
        NotificationType.AUDIT,
        '/audit-campaigns',
      );
      await this.notificationsService.notifyRole(
        RoleType.VICE_RECTOR_FINANCE,
        'Yangi inventarizatsiya rejalashtirildi',
        `"${campaign.title}" kampaniyasi rejalashtirildi va Rektorat farmoyishi kutilmoqda.`,
        NotificationType.AUDIT,
        '/audit-campaigns',
      );
    } catch (err) {
      // non-fatal notification error
    }

    await this.systemAuditService.log({
      action: 'CREATE',
      entity: 'InventoryCampaign',
      entityId: campaign.id,
      details: {
        campaignNumber: campaign.campaignNumber,
        title: campaign.title,
        orderNumber: campaign.orderNumber,
        roomsCount: rooms.length,
      },
      userId,
    });

    return campaign;
  }

  async findAll(query?: QueryCampaignsDto) {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { campaignNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const campaigns = await this.prisma.inventoryCampaign.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        assignedAuditor: { select: { id: true, fullName: true, username: true } },
        approvedBy: { select: { id: true, fullName: true, username: true } },
        scopes: {
          include: {
            room: {
              select: {
                id: true,
                number: true,
                name: true,
                building: true,
              },
            },
          },
        },
        audits: {
          include: {
            records: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const campaignNumbers = campaigns.map((c) => c.campaignNumber);
    const stamps = await this.prisma.documentStamp.findMany({
      where: {
        docNumber: { in: campaignNumbers },
        isValid: true,
      },
      select: {
        id: true,
        docNumber: true,
        docType: true,
        signerName: true,
        signerRole: true,
        isValid: true,
        createdAt: true,
      },
    });

    const stampMap = new Map<string, (typeof stamps)[0]>();
    for (const s of stamps) {
      stampMap.set(s.docNumber, s);
    }

    return campaigns.map((c) => {
      const totalRooms = c.scopes.length;
      const completedAudits = c.audits.filter((a) => a.status === AuditStatus.COMPLETED);
      const completedRoomIds = new Set(completedAudits.map((a) => a.roomId).filter(Boolean));
      const completedRooms = c.scopes.filter((s) => completedRoomIds.has(s.roomId)).length;

      const progressPercent = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

      let matchedCount = 0;
      let missingCount = 0;
      let relocatedCount = 0;

      for (const audit of c.audits) {
        for (const record of audit.records) {
          if (record.status === AuditRecordStatus.MATCHED) matchedCount++;
          else if (record.status === AuditRecordStatus.MISSING) missingCount++;
          else if (record.status === AuditRecordStatus.RELOCATED) relocatedCount++;
        }
      }

      const stamp = stampMap.get(c.campaignNumber);

      return {
        id: c.id,
        campaignNumber: c.campaignNumber,
        title: c.title,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        status: c.status,
        notes: c.notes,
        orderNumber: c.orderNumber,
        orderDate: c.orderDate,
        assignedAuditorId: c.assignedAuditorId,
        assignedAuditor: c.assignedAuditor,
        approvedById: c.approvedById,
        approvedBy: c.approvedBy,
        approvedAt: c.approvedAt,
        signatureHash: c.signatureHash,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        totalRooms,
        completedRooms,
        progressPercent,
        matchedCount,
        missingCount,
        relocatedCount,
        scopes: c.scopes,
        stamp: stamp || null,
        hasWormStamp: Boolean(stamp && stamp.isValid),
      };
    });
  }

  async findById(id: string) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        assignedAuditor: { select: { id: true, fullName: true, username: true } },
        approvedBy: { select: { id: true, fullName: true, username: true } },
        scopes: {
          include: {
            room: {
              include: {
                department: true,
                responsibleUser: { select: { id: true, fullName: true, phone: true, email: true } },
              },
            },
          },
        },
        audits: {
          include: {
            records: {
              include: {
                itemInstance: {
                  include: {
                    item: true,
                    responsibleUser: true,
                  },
                },
              },
            },
            createdBy: { select: { id: true, fullName: true } },
            room: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Inventarizatsiya kampaniyasi topilmadi!');
    }

    const stamp = await this.prisma.documentStamp.findFirst({
      where: { docNumber: campaign.campaignNumber, isValid: true },
      select: {
        id: true,
        docNumber: true,
        docType: true,
        signerName: true,
        signerRole: true,
        isValid: true,
        createdAt: true,
      },
    });

    return {
      ...campaign,
      stamp: stamp || null,
      hasWormStamp: Boolean(stamp && stamp.isValid),
    };
  }

  async start(id: string, userId: string, dto?: StartCampaignDto) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        scopes: { include: { room: true } },
        assignedAuditor: { select: { id: true, fullName: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Ushbu kampaniya allaqachon yakunlangan!');
    }

    if (campaign.status === CampaignStatus.IN_PROGRESS) {
      throw new BadRequestException('Ushbu kampaniya allaqachon boshlangan va davom etmoqda!');
    }

    const signerUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true },
    });

    const signerName = dto?.signerName?.trim() || signerUser?.fullName || 'Universitet Rektori';
    const signerRole =
      dto?.signerRole?.trim() ||
      (signerUser?.role === RoleType.RECTOR
        ? 'Universitet Rektori'
        : 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor');

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update campaign to IN_PROGRESS with Rector stamp metadata
      const c = await tx.inventoryCampaign.update({
        where: { id },
        data: {
          status: CampaignStatus.IN_PROGRESS,
          approvedById: userId,
          approvedAt: new Date(),
          signatureHash: dto?.signatureHash || null,
        },
        include: {
          assignedAuditor: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
        },
      });

      // 2. Auto-initialize room audits scoped to this campaign & assigned auditor
      const auditorId = campaign.assignedAuditorId || userId;
      for (const scope of campaign.scopes) {
        const existingAudit = await tx.inventoryAudit.findFirst({
          where: {
            roomId: scope.roomId,
            campaignId: campaign.id,
            status: AuditStatus.IN_PROGRESS,
          },
        });

        if (!existingAudit) {
          const year = new Date().getFullYear();
          const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
          const auditNum = `AUD-${year}-${uniqueSuffix}`;

          await tx.inventoryAudit.create({
            data: {
              auditNumber: auditNum,
              title: `${scope.room?.number || ''}-xona auditi (${campaign.title})`,
              roomId: scope.roomId,
              campaignId: campaign.id,
              createdById: auditorId,
              status: AuditStatus.IN_PROGRESS,
              startedAt: new Date(),
            },
          });
        }
      }

      return c;
    });

    // 3. DocumentStamp for start decree (INV_19 start stamp)
    try {
      await this.documentStampsService.stampDocument({
        docType: 'INV_19',
        docNumber: `${campaign.campaignNumber}-FARMOYISH`,
        title: `Rektor Farmoyishi: Inventarizatsiyani boshlash - ${campaign.title}`,
        signerName,
        signerRole,
        metadata: {
          campaignNumber: campaign.campaignNumber,
          title: campaign.title,
          orderNumber: campaign.orderNumber,
          orderDate: campaign.orderDate,
          assignedAuditorId: campaign.assignedAuditorId,
          assignedAuditorName: campaign.assignedAuditor?.fullName,
          signatureHash: dto?.signatureHash || null,
        },
      });
    } catch (err) {
      // non-fatal stamp error
    }

    // 4. Notify assigned auditor
    if (campaign.assignedAuditorId) {
      try {
        await this.notificationsService.create({
          userId: campaign.assignedAuditorId,
          title: 'Inventarizatsiya boshlandi (Rektor Farmoyishi)',
          message: `Rektor tomonidan "${campaign.title}" kampaniyasi rasman tasdiqlandi. Belgilangan xonalar bo‘yicha inventarizatsiya o‘tkazishingiz mumkin.`,
          type: NotificationType.AUDIT,
          link: '/audit-campaigns',
        });
      } catch (err) {
        // non-fatal notification error
      }
    }

    // 5. System audit log
    await this.systemAuditService.log({
      action: 'START',
      entity: 'InventoryCampaign',
      entityId: id,
      details: {
        campaignNumber: campaign.campaignNumber,
        title: campaign.title,
        signerName,
        signatureHash: dto?.signatureHash,
      },
      userId,
    });

    return updated;
  }

  async getProgress(id: string) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        scopes: {
          include: {
            room: {
              include: {
                department: true,
                responsibleUser: { select: { id: true, fullName: true, phone: true } },
              },
            },
          },
        },
        audits: {
          include: {
            records: true,
          },
        },
      },
    });

    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');

    const roomSummaries = await Promise.all(
      campaign.scopes.map(async (scope) => {
        const room = scope.room;
        // Count expected items currently in room
        const expectedCount = await this.prisma.itemInstance.count({
          where: {
            roomId: room.id,
            status: { notIn: [AssetStatus.WRITTEN_OFF] },
          },
        });

        // Find audits for this room in this campaign
        const roomAudits = campaign.audits.filter((a) => a.roomId === room.id);
        const latestAudit = roomAudits[0] || null;

        let matched = 0;
        let missing = 0;
        let relocated = 0;

        for (const audit of roomAudits) {
          for (const rec of audit.records) {
            if (rec.status === AuditRecordStatus.MATCHED) matched++;
            else if (rec.status === AuditRecordStatus.MISSING) missing++;
            else if (rec.status === AuditRecordStatus.RELOCATED) relocated++;
          }
        }

        const isCompleted = roomAudits.some((a) => a.status === AuditStatus.COMPLETED);

        return {
          roomId: room.id,
          roomNumber: room.number,
          roomName: room.name,
          building: room.building,
          departmentName: room.department?.name || 'Biriktirilmagan',
          responsibleMOL: room.responsibleUser?.fullName || 'Tayinlanmagan',
          responsiblePhone: room.responsibleUser?.phone || '—',
          expectedCount,
          matchedCount: matched,
          missingCount: missing,
          relocatedCount: relocated,
          totalScanned: matched + relocated,
          auditStatus: latestAudit ? latestAudit.status : 'NOT_STARTED',
          auditId: latestAudit?.id || null,
          isCompleted,
        };
      }),
    );

    const totalRooms = roomSummaries.length;
    const completedRooms = roomSummaries.filter((r) => r.isCompleted).length;
    const totalExpected = roomSummaries.reduce((sum, r) => sum + r.expectedCount, 0);
    const totalMatched = roomSummaries.reduce((sum, r) => sum + r.matchedCount, 0);
    const totalMissing = roomSummaries.reduce((sum, r) => sum + r.missingCount, 0);
    const totalRelocated = roomSummaries.reduce((sum, r) => sum + r.relocatedCount, 0);
    const progressPercent = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

    return {
      campaignId: campaign.id,
      campaignNumber: campaign.campaignNumber,
      title: campaign.title,
      status: campaign.status,
      totals: {
        totalRooms,
        completedRooms,
        totalExpected,
        totalMatched,
        totalMissing,
        totalRelocated,
        progressPercent,
      },
      rooms: roomSummaries,
    };
  }

  async getMissingReport(id: string) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        scopes: { select: { roomId: true } },
        audits: {
          include: {
            records: {
              where: { status: AuditRecordStatus.MISSING },
              include: {
                itemInstance: {
                  include: {
                    item: true,
                    room: true,
                    responsibleUser: { select: { id: true, fullName: true, phone: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');

    const missingItemsMap = new Map<string, any>();

    for (const audit of campaign.audits) {
      for (const rec of audit.records) {
        const inst = rec.itemInstance;
        if (!missingItemsMap.has(inst.id)) {
          missingItemsMap.set(inst.id, {
            id: inst.id,
            inventoryNumber: inst.inventoryNumber,
            serialNumber: inst.serialNumber || '—',
            name: inst.item.name,
            model: inst.item.model || '—',
            purchasePrice: inst.purchasePrice ? Number(inst.purchasePrice) : 0,
            expectedRoomNumber: inst.room?.number || '—',
            expectedRoomName: inst.room?.name || '—',
            responsibleMOL: inst.responsibleUser
              ? {
                  id: inst.responsibleUser.id,
                  fullName: inst.responsibleUser.fullName,
                  phone: inst.responsibleUser.phone || '—',
                  email: inst.responsibleUser.email || '—',
                }
              : null,
            scannedAt: rec.scannedAt,
            notes: rec.notes || 'Inventarizatsiya davomida topilmadi (Kamomad)',
          });
        }
      }
    }

    const items = Array.from(missingItemsMap.values());
    const totalCount = items.length;
    const totalValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);

    return {
      campaignId: campaign.id,
      campaignNumber: campaign.campaignNumber,
      title: campaign.title,
      totalMissingCount: totalCount,
      totalMissingValue: totalValue,
      items,
    };
  }

  async complete(id: string, userId: string, notesOrDto?: string | CompleteCampaignDto) {
    const dto: CompleteCampaignDto =
      typeof notesOrDto === 'string'
        ? { notes: notesOrDto }
        : notesOrDto || {};

    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        createdBy: true,
        scopes: { include: { room: true } },
        audits: {
          include: {
            records: {
              include: {
                itemInstance: { include: { item: true, responsibleUser: true } },
              },
            },
          },
        },
      },
    });

    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');
    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Ushbu kampaniya allaqachon yakunlangan!');
    }

    // Resolve inspector/signer details
    const completingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true },
    });

    const signerName =
      dto.signerName?.trim() ||
      completingUser?.fullName ||
      campaign.createdBy?.fullName ||
      'Bosh Auditor';

    const signerRole =
      dto.signerRole?.trim() ||
      (completingUser?.role === RoleType.AUDITOR
        ? 'Bosh Auditor / Komissiya Raisi'
        : completingUser?.role
        ? `Mas’ul Tekshiruvchi (${completingUser.role})`
        : 'Komissiya Raisi / Auditor');

    const formattedNotes = dto.notes
      ? `${dto.notes} | Tekshirdi va imzoladi: ${signerName} (${signerRole})`
      : `Kampaniya muvaffaqiyatli yakunlandi. Tekshirdi va imzoladi: ${signerName} (${signerRole})`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark in-progress audits of this campaign as COMPLETED
      for (const audit of campaign.audits) {
        if (audit.status === AuditStatus.IN_PROGRESS) {
          // Check if missing items need to be generated for this room
          if (audit.roomId) {
            const expectedAssets = await tx.itemInstance.findMany({
              where: {
                roomId: audit.roomId,
                status: { notIn: [AssetStatus.WRITTEN_OFF] },
              },
            });

            const scannedIds = new Set(audit.records.map((r) => r.itemInstanceId));
            const unscanned = expectedAssets.filter((a) => !scannedIds.has(a.id));

            for (const missing of unscanned) {
              await tx.inventoryAuditRecord.create({
                data: {
                  auditId: audit.id,
                  itemInstanceId: missing.id,
                  expectedRoomId: audit.roomId,
                  foundRoomId: null,
                  status: AuditRecordStatus.MISSING,
                  notes: 'Rejali kampaniya doirasida topilmadi (Kamomad)',
                },
              });
            }
          }

          await tx.inventoryAudit.update({
            where: { id: audit.id },
            data: {
              status: AuditStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        }
      }

      // 2. Update campaign status to COMPLETED
      const completedCampaign = await tx.inventoryCampaign.update({
        where: { id },
        data: {
          status: CampaignStatus.COMPLETED,
          notes: formattedNotes,
        },
        include: {
          scopes: { include: { room: true } },
          audits: {
            include: {
              records: {
                include: {
                  itemInstance: {
                    include: { item: true, room: true, responsibleUser: true },
                  },
                },
              },
            },
          },
        },
      });

      // 3. Aggregate missing assets and group by responsible MOL
      const molMissingMap = new Map<string, { molName: string; assets: any[] }>();
      const allMissingAssets: any[] = [];

      for (const audit of completedCampaign.audits) {
        for (const rec of audit.records) {
          if (rec.status === AuditRecordStatus.MISSING) {
            const asset = rec.itemInstance;
            allMissingAssets.push(asset);

            if (asset.responsibleUserId) {
              if (!molMissingMap.has(asset.responsibleUserId)) {
                molMissingMap.set(asset.responsibleUserId, {
                  molName: asset.responsibleUser?.fullName || 'Mas’ul xodim',
                  assets: [],
                });
              }
              molMissingMap.get(asset.responsibleUserId)!.assets.push(asset);
            }
          }
        }
      }

      // 4. Send notifications to each affected MOL
      for (const [molId, data] of molMissingMap.entries()) {
        try {
          await this.notificationsService.create({
            userId: molId,
            title: 'Inventarizatsiya kamomadi aniqlandi',
            message: `"${completedCampaign.title}" inventarizatsiya rejasida sizga biriktirilgan ${data.assets.length} ta asosiy vosita topilmadi. Iltimos, hisobot bilan tanishing.`,
            type: NotificationType.WARNING,
            link: '/audit-campaigns',
          });
        } catch (err) {
          // non-fatal notification error
        }
      }

      // 5. Send notification to HEAD_WAREHOUSE
      try {
        await this.notificationsService.notifyRole(
          RoleType.HEAD_WAREHOUSE,
          'Inventarizatsiya kampaniyasi yakunlandi',
          `"${completedCampaign.title}" kampaniyasi yakunlandi. Jami ${allMissingAssets.length} ta kamomad (MISSING) qayd etildi.`,
          NotificationType.AUDIT,
          '/audit-campaigns',
        );
      } catch (err) {
        // non-fatal notification error
      }

      // 6. Generate and stamp official INV-19 akt with Inspector's real signature
      try {
        await this.documentStampsService.stampDocument({
          docType: 'INV_19',
          docNumber: completedCampaign.campaignNumber,
          title: `Yalpi Inventarizatsiya va Solishtirma Dalolatnomasi (INV-19) - ${completedCampaign.title}`,
          signerName,
          signerRole,
          metadata: {
            campaignNumber: completedCampaign.campaignNumber,
            title: completedCampaign.title,
            periodStart: completedCampaign.periodStart,
            periodEnd: completedCampaign.periodEnd,
            totalRooms: completedCampaign.scopes.length,
            rooms: completedCampaign.scopes.map((s) => `${s.room.number} (${s.room.name})`),
            totalMissingCount: allMissingAssets.length,
            signerName,
            signerRole,
            signatureHash: dto.signatureHash || null,
            committeeMembers: dto.committeeMembers || [],
            signedAt: new Date().toISOString(),
            missingItems: allMissingAssets.slice(0, 100).map((a) => ({
              inventoryNumber: a.inventoryNumber,
              name: a.item?.name,
              model: a.item?.model,
              roomNumber: a.room?.number,
              molName: a.responsibleUser?.fullName,
            })),
          },
        });
      } catch (stampErr) {
        // non-fatal stamp error
      }

      await this.systemAuditService.log({
        action: 'COMPLETE',
        entity: 'InventoryCampaign',
        entityId: campaign.id,
        details: {
          campaignNumber: completedCampaign.campaignNumber,
          totalMissing: allMissingAssets.length,
          signerName,
          signerRole,
          signatureHash: dto.signatureHash ? `${dto.signatureHash.slice(0, 16)}...` : undefined,
        },
        userId,
      });

      return completedCampaign;
    });
  }

  /**
   * Kampaniya bo‘yicha rasmiy 3-varaqli INV-19 Excel (.xlsx) hisobotini generatsiya qilish
   */
  async exportCampaignExcel(id: string, userId?: string) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');

    const progress = await this.getProgress(id);
    const missingReport = await this.getMissingReport(id);

    // Fetch official stamp for verification details
    const stamp = await this.prisma.documentStamp.findUnique({
      where: { docNumber: campaign.campaignNumber },
    });

    const wb = XLSX.utils.book_new();

    // -------------------------------------------------------------
    // VARAQ 1: INV-19 Solishtirma Dalolatnomasi (Xulosa va Imzolar)
    // -------------------------------------------------------------
    const periodStr = `${new Date(campaign.periodStart).toISOString().slice(0, 10)} dan ${new Date(campaign.periodEnd).toISOString().slice(0, 10)} gacha`;
    const statusLabel =
      campaign.status === CampaignStatus.COMPLETED
        ? 'YAKUNLANGAN (Rasmiy Imzolangan va Muhrlangan)'
        : campaign.status === CampaignStatus.IN_PROGRESS
        ? 'JARAYONDA (O‘tkazilmoqda)'
        : campaign.status === CampaignStatus.PLANNED
        ? 'REJALASHTIRILGAN'
        : 'BEKOR QILINGAN';

    const signerName = stamp?.signerName || campaign.createdBy?.fullName || 'Bosh Auditor';
    const signerRole = stamp?.signerRole || 'Komissiya Raisi / Auditor';
    const stampHash = stamp?.verificationHash || 'TASDIQLANMOQDA';
    const stampDate = stamp?.createdAt
      ? new Date(stamp.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const sheet1Data = [
      { 'Ko‘rsatkich / Parametr': 'Davlat Standarti Hujjat Shakli', 'Qiymat / Ma’lumot': 'INV-19 (Yalpi Inventarizatsiya va Solishtirma Dalolatnomasi)' },
      { 'Ko‘rsatkich / Parametr': 'Tashkilot / Muassasa', 'Qiymat / Ma’lumot': 'O‘zbekiston Respublikasi Oliy Ta’lim Muassasasi' },
      { 'Ko‘rsatkich / Parametr': 'Inventarizatsiya Reja Kodi', 'Qiymat / Ma’lumot': campaign.campaignNumber },
      { 'Ko‘rsatkich / Parametr': 'Kampaniya Nomi', 'Qiymat / Ma’lumot': campaign.title },
      { 'Ko‘rsatkich / Parametr': 'O‘tkazilish Davri', 'Qiymat / Ma’lumot': periodStr },
      { 'Ko‘rsatkich / Parametr': 'Kampaniya Holati', 'Qiymat / Ma’lumot': statusLabel },
      { 'Ko‘rsatkich / Parametr': 'Qamrovdagi Jami Xonalar Soni', 'Qiymat / Ma’lumot': `${progress.totals.totalRooms} ta` },
      { 'Ko‘rsatkich / Parametr': 'Tekshiruv Bajarilgan Xonalar', 'Qiymat / Ma’lumot': `${progress.totals.completedRooms} ta (${progress.totals.progressPercent}%)` },
      { 'Ko‘rsatkich / Parametr': 'Jami Rejadagi Kutilgan Asosiy Vositalar', 'Qiymat / Ma’lumot': `${progress.totals.totalExpected} ta` },
      { 'Ko‘rsatkich / Parametr': 'Mavjud Topilgan Asosiy Vositalar', 'Qiymat / Ma’lumot': `${progress.totals.totalMatched} ta` },
      { 'Ko‘rsatkich / Parametr': 'Aniqlangan Kamomadlar Soni (MISSING)', 'Qiymat / Ma’lumot': `${progress.totals.totalMissing} ta` },
      { 'Ko‘rsatkich / Parametr': 'Kamomad Bo‘yicha Jami Zarar / Qiymat', 'Qiymat / Ma’lumot': `${missingReport.totalMissingValue.toLocaleString()} so‘m` },
      { 'Ko‘rsatkich / Parametr': 'Begona Xonadan Topilgan Vositalar', 'Qiymat / Ma’lumot': `${progress.totals.totalRelocated} ta` },
      { 'Ko‘rsatkich / Parametr': 'Tekshirgan Mas’ul (Auditor / Komissiya Raisi)', 'Qiymat / Ma’lumot': signerName },
      { 'Ko‘rsatkich / Parametr': 'Auditor Lavozimi / Roli', 'Qiymat / Ma’lumot': signerRole },
      { 'Ko‘rsatkich / Parametr': 'Elektron Imzo Holati', 'Qiymat / Ma’lumot': stamp ? 'IMZOLANDI VA HUQUQIY TASDIQLANDI' : 'KUTILMOQDA' },
      { 'Ko‘rsatkich / Parametr': 'Kriptografik SHA-256 Muhr Xeshi', 'Qiymat / Ma’lumot': stampHash },
      { 'Ko‘rsatkich / Parametr': 'Imzolangan / Rasmiylashtirilgan Sana', 'Qiymat / Ma’lumot': stampDate },
      { 'Ko‘rsatkich / Parametr': 'Auditorlik Dalolatnomasi Xulosasi', 'Qiymat / Ma’lumot': campaign.notes || 'Kampaniya rejaga muvofiq to‘liq o‘tkazildi.' },
    ];

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, '1. INV-19 Dalolatnoma');

    // -------------------------------------------------------------
    // VARAQ 2: Kamomadlar Qaydnomasi (Topilmagan vositalar)
    // -------------------------------------------------------------
    const sheet2Data =
      missingReport.items.length > 0
        ? missingReport.items.map((item, idx) => ({
            '№': idx + 1,
            'Inventar Raqami': item.inventoryNumber,
            'Asosiy Vosita Nomi': item.name,
            'Model / Turi': item.model || '—',
            'Seriya Raqami': item.serialNumber || '—',
            'Boshlang‘ich Qiymati (so‘m)': item.purchasePrice || 0,
            'Kutilgan Joylashuv (Xona)': `${item.expectedRoomNumber} (${item.expectedRoomName})`,
            'Moddiy Javobgar Shaxs (MOL)': item.responsibleMOL?.fullName || 'Tayinlanmagan',
            'MOL Telefoni': item.responsibleMOL?.phone || '—',
            'Holati': 'KAMOMAD (Topilmadi)',
            'Auditorlik Izohi': item.notes || 'Inventarizatsiya rejasida topilmadi (Kamomad)',
          }))
        : [
            {
              '№': 1,
              'Inventar Raqami': '—',
              'Asosiy Vosita Nomi': 'Kamomad aniqlanmadi (Barcha asosiy vositalar to‘liq mavjud)',
              'Model / Turi': '—',
              'Seriya Raqami': '—',
              'Boshlang‘ich Qiymati (so‘m)': 0,
              'Kutilgan Joylashuv (Xona)': '—',
              'Moddiy Javobgar Shaxs (MOL)': '—',
              'MOL Telefoni': '—',
              'Holati': 'Barcha ashyolar mavjud',
              'Auditorlik Izohi': 'Kamomad qayd etilmadi',
            },
          ];

    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, '2. Kamomadlar Qaydnomasi');

    // -------------------------------------------------------------
    // VARAQ 3: Xonalar Kesimida Ijro Progressi
    // -------------------------------------------------------------
    const sheet3Data = progress.rooms.map((r, idx) => ({
      '№': idx + 1,
      'Xona Raqami': r.roomNumber,
      'Xona Nomi': r.roomName,
      'Bino': r.building || 'Asosiy bino',
      'Kafedra / Bo‘lim': r.departmentName,
      'Moddiy Javobgar (MOL)': r.responsibleMOL,
      'MOL Telefoni': r.responsiblePhone,
      'Kutilgan Vositalar (dona)': r.expectedCount,
      'Topilgan Mavjud (dona)': r.matchedCount,
      'Kamomad (dona)': r.missingCount,
      'Begona Vositalar (dona)': r.relocatedCount,
      'Ijro Foizi (%)': r.expectedCount > 0 ? Math.round((r.matchedCount / r.expectedCount) * 100) : 100,
      'Audit Holati': r.isCompleted ? 'Tugallangan (COMPLETED)' : r.auditStatus === 'IN_PROGRESS' ? 'Jarayonda' : 'Boshlanmagan',
    }));

    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, '3. Xonalar Ijro Vedomosti');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `UWMS_INV19_${campaign.campaignNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    await this.systemAuditService.log({
      action: 'REPORT_EXPORT',
      entity: 'InventoryCampaign',
      entityId: campaign.id,
      details: {
        format: 'XLSX',
        filename,
        totalRooms: progress.totals.totalRooms,
        totalMissingCount: missingReport.totalMissingCount,
        totalMissingValue: missingReport.totalMissingValue,
      },
      userId,
    });

    return {
      buffer,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }


  async cancel(id: string, userId: string, reason?: string) {
    const campaign = await this.prisma.inventoryCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Kampaniya topilmadi!');

    const updated = await this.prisma.inventoryCampaign.update({
      where: { id },
      data: {
        status: CampaignStatus.CANCELLED,
        notes: reason || campaign.notes || 'Kampaniya bekor qilindi',
      },
    });

    await this.systemAuditService.log({
      action: 'CANCEL',
      entity: 'InventoryCampaign',
      entityId: id,
      details: { campaignNumber: campaign.campaignNumber, reason },
      userId,
    });

    return updated;
  }
}
