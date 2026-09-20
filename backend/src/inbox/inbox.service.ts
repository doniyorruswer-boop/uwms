import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RoleType,
  TransferStatus,
  RequestStatus,
  WriteOffStatus,
  VoteStatus,
  CampaignStatus,
  AuditStatus,
  HandoverStatus,
  Prisma,
} from '@prisma/client';
import { InboxResponseDto } from './dto/inbox.dto';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserInbox(user: any, scope?: string): Promise<InboxResponseDto> {
    const userId = user.id;
    const role: RoleType = user.role;
    const departmentId = user.departmentId;

    const isAdmin = role === RoleType.SUPER_ADMIN;
    const isProrector = role === RoleType.VICE_RECTOR_FINANCE;
    const isRector = role === RoleType.RECTOR;
    const isAccountant = role === RoleType.CHIEF_ACCOUNTANT;
    const isWarehouse = role === RoleType.HEAD_WAREHOUSE;
    const isCommendant = role === RoleType.COMMENDANT;
    const isMol = role === RoleType.MOL;
    const isAuditor = role === RoleType.AUDITOR;

    const isSystemScope = isAdmin && scope !== 'personal';

    // 1. Pending Transfers Query (Only the receiving party or warehouse manager for returns)
    let pendingTransfersPromise = Promise.resolve<any[]>([]);
    if (isSystemScope) {
      pendingTransfersPromise = this.prisma.transferAcceptance.findMany({
        where: { status: TransferStatus.PENDING },
        include: {
          asset: { include: { item: true } },
          fromRoom: { include: { department: true } },
          toRoom: { include: { department: true } },
          toWarehouse: true,
          sender: { select: { id: true, fullName: true, username: true } },
          receiver: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isWarehouse) {
      pendingTransfersPromise = this.prisma.transferAcceptance.findMany({
        where: {
          status: TransferStatus.PENDING,
          OR: [{ isReturn: true }, { toWarehouseId: { not: null } }],
        },
        include: {
          asset: { include: { item: true } },
          fromRoom: { include: { department: true } },
          toRoom: { include: { department: true } },
          toWarehouse: true,
          sender: { select: { id: true, fullName: true, username: true } },
          receiver: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (!isAdmin) {
      // MOL or any other receiver
      const roomOrConditions: any[] = [{ receiverId: userId }];
      if (departmentId) {
        roomOrConditions.push({ toRoom: { departmentId } });
      }
      roomOrConditions.push({ toRoom: { responsibleUserId: userId } });

      pendingTransfersPromise = this.prisma.transferAcceptance.findMany({
        where: {
          status: TransferStatus.PENDING,
          OR: roomOrConditions,
        },
        include: {
          asset: { include: { item: true } },
          fromRoom: { include: { department: true } },
          toRoom: { include: { department: true } },
          toWarehouse: true,
          sender: { select: { id: true, fullName: true, username: true } },
          receiver: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    }

    // 2. Pending Requests Query by Role (each role sees ONLY what requires their personal action)
    let pendingRequestsPromise = Promise.resolve<any[]>([]);
    if (isSystemScope) {
      // Super Admin sees all active requests across the university for system monitoring only
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          status: {
            in: [
              RequestStatus.SUBMITTED,
              RequestStatus.PENDING,
              RequestStatus.APPROVED_BY_HEAD,
              RequestStatus.APPROVED_BY_PRORECTOR,
              RequestStatus.APPROVED_BY_RECTOR,
              RequestStatus.FINANCED_BY_ACCOUNTANT,
              RequestStatus.RECEIVED_AT_WAREHOUSE,
              RequestStatus.HANDED_TO_COMMENDANT,
            ],
          },
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isProrector) {
      // Moliya-iqtisod prorektori: tasdiq kutayotgan arizalar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          status: { in: [RequestStatus.SUBMITTED, RequestStatus.PENDING, RequestStatus.APPROVED_BY_HEAD] },
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isRector) {
      // Rektor: Prorektor ma'qullagan va yakuniy viza kutayotgan arizalar hamda kvotadan oshganlar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          OR: [
            { status: RequestStatus.APPROVED_BY_PRORECTOR },
            {
              status: { in: [RequestStatus.SUBMITTED, RequestStatus.PENDING] },
              isOverQuota: true,
            },
          ],
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isAccountant) {
      // Bosh hisobchi: Rektor ruxsat bergan va moliyalashtirish/sub-hisob kutayotgan arizalar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          status: RequestStatus.APPROVED_BY_RECTOR,
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isWarehouse) {
      // Bosh omborchi: Moliyalashtirilgan va omborga kirim (OS-1) qilinishi lozim bo'lgan arizalar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          status: RequestStatus.FINANCED_BY_ACCOUNTANT,
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isCommendant) {
      // Bino komendanti: Ombordan binoga qabul qilib olish (OS-2) kutilayotgan arizalar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          status: RequestStatus.RECEIVED_AT_WAREHOUSE,
        },
        include: {
          requester: { select: { id: true, fullName: true, department: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else if (isMol) {
      // Xodim yoki Kafedra mudiri (MOL): Komendantdan xonaga qabul qilib olish (Yakuniy) kutilayotgan arizalar
      pendingRequestsPromise = this.prisma.request.findMany({
        where: {
          requesterId: userId,
          status: {
            in: [
              RequestStatus.HANDED_TO_COMMENDANT,
              RequestStatus.SUBMITTED,
              RequestStatus.PENDING,
            ],
          },
        },
        include: {
          requester: { select: { id: true, fullName: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    }

    // 3. Pending Write-Off Votes (Faqat komissiyadagi a'zoning o'ziga, yoki monitoringda butun komissiya holati)
    const pendingWriteOffVotesPromise = this.prisma.writeOffMemberVote.findMany({
      where: isSystemScope
        ? { vote: VoteStatus.PENDING, writeOffRequest: { status: WriteOffStatus.IN_REVIEW } }
        : { userId, vote: VoteStatus.PENDING, writeOffRequest: { status: WriteOffStatus.IN_REVIEW } },
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        writeOffRequest: {
          include: {
            asset: { include: { item: true } },
            createdBy: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { writeOffRequest: { createdAt: 'desc' } },
      take: 30,
    });

    // 4. Open Audits (Auditor, Admin, Warehouse, or MOL whose room is scoped)
    let openAuditsPromise = Promise.resolve<any[]>([]);
    if (isSystemScope) {
      openAuditsPromise = Promise.all([
        this.prisma.inventoryCampaign.findMany({
          where: { status: CampaignStatus.IN_PROGRESS },
          include: {
            createdBy: { select: { fullName: true } },
            scopes: { include: { room: true } },
            _count: { select: { audits: true, scopes: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.inventoryAudit.findMany({
          where: { status: AuditStatus.IN_PROGRESS },
          include: {
            createdBy: { select: { fullName: true } },
            room: true,
            _count: { select: { records: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]).then(([campaigns, audits]) => {
        const formattedCampaigns = campaigns.map((c) => ({
          type: 'CAMPAIGN',
          id: c.id,
          number: c.campaignNumber,
          title: c.title,
          startDate: c.periodStart,
          endDate: c.periodEnd,
          scopesCount: c._count.scopes,
          auditsCount: c._count.audits,
          createdAt: c.createdAt,
        }));
        const formattedAudits = audits.map((a) => ({
          type: 'ROOM_AUDIT',
          id: a.id,
          number: a.auditNumber,
          title: `${a.room?.number || ''} ${a.room?.name || 'Xona'} auditi`,
          roomName: a.room ? `${a.room.number} - ${a.room.name}` : 'Xona',
          auditorName: a.createdBy?.fullName,
          auditorId: a.createdById,
          scannedCount: a._count.records,
          createdAt: a.createdAt,
        }));
        return [...formattedCampaigns, ...formattedAudits];
      });
    } else if (isAuditor) {
      openAuditsPromise = Promise.all([
        this.prisma.inventoryCampaign.findMany({
          where: {
            status: CampaignStatus.IN_PROGRESS,
            assignedAuditorId: userId,
          },
          include: {
            createdBy: { select: { fullName: true } },
            scopes: { include: { room: true } },
            _count: { select: { audits: true, scopes: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.inventoryAudit.findMany({
          where: {
            status: AuditStatus.IN_PROGRESS,
            createdById: userId,
          },
          include: {
            createdBy: { select: { fullName: true } },
            room: true,
            _count: { select: { records: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]).then(([campaigns, audits]) => {
        const formattedCampaigns = campaigns.map((c) => ({
          type: 'CAMPAIGN',
          id: c.id,
          number: c.campaignNumber,
          title: c.title,
          startDate: c.periodStart,
          endDate: c.periodEnd,
          scopesCount: c._count.scopes,
          auditsCount: c._count.audits,
          createdAt: c.createdAt,
        }));
        const formattedAudits = audits.map((a) => ({
          type: 'ROOM_AUDIT',
          id: a.id,
          number: a.auditNumber,
          title: `${a.room?.number || ''} ${a.room?.name || 'Xona'} auditi`,
          roomName: a.room ? `${a.room.number} - ${a.room.name}` : 'Xona',
          auditorName: a.createdBy?.fullName,
          auditorId: a.createdById,
          scannedCount: a._count.records,
          createdAt: a.createdAt,
        }));
        return [...formattedCampaigns, ...formattedAudits];
      });
    } else if (isRector || isProrector) {
      openAuditsPromise = this.prisma.inventoryCampaign.findMany({
        where: {
          status: { in: [CampaignStatus.PLANNED, CampaignStatus.IN_PROGRESS] },
        },
        include: {
          createdBy: { select: { fullName: true } },
          assignedAuditor: { select: { fullName: true } },
          scopes: { include: { room: true } },
          _count: { select: { audits: true, scopes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).then((campaigns) =>
        campaigns.map((c) => ({
          type: 'CAMPAIGN',
          id: c.id,
          number: c.campaignNumber,
          title: c.title,
          status: c.status,
          orderNumber: c.orderNumber,
          auditorName: c.assignedAuditor?.fullName,
          startDate: c.periodStart,
          endDate: c.periodEnd,
          scopesCount: c._count.scopes,
          auditsCount: c._count.audits,
          createdAt: c.createdAt,
        })),
      );
    } else if (isMol) {
      openAuditsPromise = this.prisma.inventoryCampaign
        .findMany({
          where: {
            status: CampaignStatus.IN_PROGRESS,
            scopes: {
              some: {
                room: {
                  OR: [
                    { responsibleUserId: userId },
                    ...(departmentId ? [{ departmentId }] : []),
                  ],
                },
              },
            },
          },
          include: {
            scopes: { include: { room: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
        .then((campaigns) =>
          campaigns.map((c) => ({
            type: 'CAMPAIGN',
            id: c.id,
            number: c.campaignNumber,
            title: c.title,
            startDate: c.periodStart,
            endDate: c.periodEnd,
            scopesCount: c.scopes.length,
            createdAt: c.createdAt,
          })),
        );
    }

    // 5. Low Stock Alerts (Admin and Warehouse Manager)
    let lowStockAlertsPromise = Promise.resolve<any[]>([]);
    if (isSystemScope || isWarehouse) {
      lowStockAlertsPromise = this.prisma.stock
        .findMany({
          where: {
            item: {
              itemType: 'CONSUMABLE',
              deletedAt: null,
            },
          },
          include: {
            item: { include: { category: true } },
            warehouse: true,
          },
        })
        .then((stocks) =>
          stocks
            .filter((s) => s.quantity <= (s.item.minStockLimit ?? 5))
            .map((s) => ({
              id: s.id,
              warehouseName: s.warehouse?.name || 'Asosiy Ombor',
              itemId: s.itemId,
              itemName: s.item.name,
              sku: s.item.sku,
              unit: s.item.unit,
              categoryName: s.item.category?.name,
              currentQuantity: s.quantity,
              minLimit: s.item.minStockLimit ?? 5,
              shortage: Math.max(0, (s.item.minStockLimit ?? 5) - s.quantity),
            })),
        );
    }

    // 6. Over Quota Requests (Rector, Prorector, Admin, and Warehouse Manager)
    let overQuotaRequestsPromise = Promise.resolve<any[]>([]);
    if (isSystemScope || isRector || isProrector) {
      overQuotaRequestsPromise = this.prisma.request.findMany({
        where: {
          status: RequestStatus.PENDING,
          OR: [{ isOverQuota: true }, { specialApprovalNeeded: true }],
        },
        include: {
          requester: { select: { fullName: true } },
          department: true,
          items: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    }

    // 7. Pending Responsibility Handovers (OS-1 Dalolatnomalari)
    let pendingHandoversPromise = Promise.resolve<any[]>([]);
    const handoverActiveStatuses = [
      HandoverStatus.DRAFT,
      HandoverStatus.PENDING_AUDIT,
      HandoverStatus.PENDING_SIGNATURES,
    ];

    if (isSystemScope) {
      pendingHandoversPromise = this.prisma.responsibilityHandover.findMany({
        where: { status: { in: handoverActiveStatuses } },
        include: {
          departingUser: { select: { id: true, fullName: true, role: true, position: true } },
          targetUser: { select: { id: true, fullName: true, role: true, position: true } },
          commandantUser: { select: { id: true, fullName: true, role: true, position: true } },
          accountantUser: { select: { id: true, fullName: true, role: true, position: true } },
          building: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, number: true, name: true } },
          targetWarehouse: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } else {
      const orConditions: Prisma.ResponsibilityHandoverWhereInput[] = [
        { departingUserId: userId },
        { targetUserId: userId },
        { commandantUserId: userId },
        { accountantUserId: userId },
        { approvedByUserId: userId },
      ];
      if (isCommendant) {
        orConditions.push({ building: { commendantId: userId } });
      }
      if (isAccountant) {
        orConditions.push({ accountantUserId: null });
      }
      if (isProrector || isRector) {
        orConditions.push({ approvedByUserId: null });
      }

      pendingHandoversPromise = this.prisma.responsibilityHandover.findMany({
        where: {
          status: { in: handoverActiveStatuses },
          OR: orConditions,
        },
        include: {
          departingUser: { select: { id: true, fullName: true, role: true, position: true } },
          targetUser: { select: { id: true, fullName: true, role: true, position: true } },
          commandantUser: { select: { id: true, fullName: true, role: true, position: true } },
          accountantUser: { select: { id: true, fullName: true, role: true, position: true } },
          building: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, number: true, name: true } },
          targetWarehouse: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    }

    // Execute all queries in parallel without locks
    const [
      pendingTransfers,
      pendingRequests,
      pendingWriteOffVotes,
      openAudits,
      lowStockAlerts,
      overQuotaRequests,
      pendingHandovers,
    ] = await Promise.all([
      pendingTransfersPromise,
      pendingRequestsPromise,
      pendingWriteOffVotesPromise,
      openAuditsPromise,
      lowStockAlertsPromise,
      overQuotaRequestsPromise,
      pendingHandoversPromise,
    ]);

    const totalPendingCount =
      pendingTransfers.length +
      pendingRequests.length +
      pendingWriteOffVotes.length +
      openAudits.length +
      lowStockAlerts.length +
      overQuotaRequests.length +
      pendingHandovers.length;

    return {
      summary: {
        totalPendingCount,
        pendingTransfersCount: pendingTransfers.length,
        pendingRequestsCount: pendingRequests.length,
        pendingWriteOffVotesCount: pendingWriteOffVotes.length,
        openAuditsCount: openAudits.length,
        lowStockAlertsCount: lowStockAlerts.length,
        overQuotaRequestsCount: overQuotaRequests.length,
        pendingHandoversCount: pendingHandovers.length,
      },
      pendingTransfers,
      pendingRequests,
      pendingWriteOffVotes,
      openAudits,
      lowStockAlerts,
      overQuotaRequests,
      pendingHandovers,
    };
  }
}
