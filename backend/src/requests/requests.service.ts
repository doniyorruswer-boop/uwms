import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotasService } from '../quotas/quotas.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { SequenceService } from '../common/services/sequence.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { EventsGateway } from '../events/events.gateway';
import { RequestStatus, RoleType, NotificationType, FundingSource, Prisma } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly quotasService: QuotasService,
    private readonly systemAuditService: SystemAuditService,
    private readonly documentStampsService: DocumentStampsService,
    @Optional() private readonly sequenceService?: SequenceService,
    @Optional() private readonly warehouseService?: WarehouseService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async getAllRequests(
    query?: {
      search?: string;
      status?: RequestStatus;
      departmentId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    user?: any,
  ) {
    const where: any = {};

    // Multi-tenant / Role Data Isolation:
    if (user && user.role !== RoleType.SUPER_ADMIN) {
      if (user.role === RoleType.EMPLOYEE) {
        where.requesterId = user.id;
      } else if (user.role === RoleType.MOL && user.departmentId) {
        where.OR = [
          { requesterId: user.id },
          { departmentId: user.departmentId },
        ];
      }
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query?.search) {
      where.OR = [
        { requestNumber: { contains: query.search, mode: 'insensitive' } },
        { purpose: { contains: query.search, mode: 'insensitive' } },
        { requester: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const isPaginated = query?.page !== undefined || query?.limit !== undefined;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const validSortFields = ['createdAt', 'requestNumber', 'status', 'purpose'];
    const sortBy = query?.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';

    const requestInclude = {
      requester: { select: { id: true, fullName: true, role: true, position: true } },
      department: true,
      items: { include: { item: true } },
      targetRoom: true,
      commendant: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true, role: true } },
      prorektorApprovedBy: { select: { id: true, fullName: true } },
      rectorApprovedBy: { select: { id: true, fullName: true } },
      accountantFinancedBy: { select: { id: true, fullName: true } },
      warehouseReceivedBy: { select: { id: true, fullName: true } },
      commendantHandedBy: { select: { id: true, fullName: true } },
    };

    const [requests, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.request.findMany({
            where,
            include: requestInclude,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          this.prisma.request.count({ where }),
        ])
      : [
          await this.prisma.request.findMany({
            where,
            include: requestInclude,
            orderBy: { [sortBy]: sortOrder },
          }),
          0,
        ];

    const mapped = requests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      purpose: r.purpose,
      status: r.status,
      isOverQuota: r.isOverQuota,
      specialApprovalNeeded: r.specialApprovalNeeded,
      requesterId: r.requesterId,
      requesterName: r.requester.fullName,
      requesterRole: r.requester.role,
      requesterPosition: r.requester.position ?? undefined,  // Lavozim: "Kafedra mudiri", "Prorektor", "Laborant" va h.k.
      departmentName: r.department?.name,
      approvalNote: r.approvalNote,
      approvedById: r.approvedById,
      approvedByName: r.approvedBy?.fullName,
      fundingSource: r.fundingSource,
      subAccountCode: r.subAccountCode,
      allocatedAmount: r.allocatedAmount ? Number(r.allocatedAmount) : undefined,
      targetRoomId: r.targetRoomId,
      targetRoomName: r.targetRoom?.name,
      targetRoomNumber: r.targetRoom?.number,
      commendantId: r.commendantId,
      commendantName: r.commendant?.fullName,
      submittedAt: r.submittedAt?.toISOString(),
      prorektorApprovedAt: r.prorektorApprovedAt?.toISOString(),
      prorektorApprovedById: r.prorektorApprovedById,
      prorektorApprovedByName: r.prorektorApprovedBy?.fullName,
      rectorApprovedAt: r.rectorApprovedAt?.toISOString(),
      rectorApprovedById: r.rectorApprovedById,
      rectorApprovedByName: r.rectorApprovedBy?.fullName,
      accountantFinancedAt: r.accountantFinancedAt?.toISOString(),
      accountantFinancedById: r.accountantFinancedById,
      accountantFinancedByName: r.accountantFinancedBy?.fullName,
      warehouseReceivedAt: r.warehouseReceivedAt?.toISOString(),
      warehouseReceivedById: r.warehouseReceivedById,
      warehouseReceivedByName: r.warehouseReceivedBy?.fullName,
      commendantHandedAt: r.commendantHandedAt?.toISOString(),
      commendantHandedById: r.commendantHandedById,
      commendantHandedByName: r.commendantHandedBy?.fullName,
      fulfilledAt: r.fulfilledAt?.toISOString(),
      createdAt: r.createdAt.toISOString().replace('T', ' ').substring(0, 16),
      items: r.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        itemName: i.item.name,
        requestedQty: i.requestedQty,
        approvedQty: i.approvedQty,
        unit: i.item.unit,
      })),
    }));

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

  async createRequest(dto: {
    purpose: string;
    requesterId: string;
    departmentId?: string;
    items: { itemId?: string; itemName?: string; quantity: number; unit?: string }[];
  }) {
    const created = await this.prisma.$transaction(async (tx) => {
      // Find user & department
      const user = await tx.user.findUnique({ where: { id: dto.requesterId } });
      const departmentId = dto.departmentId || user?.departmentId || undefined;

      // Kolliziyasiz unikal va murakkab requestNumber: REQ-YYYY-XXXXXXXX (masalan: REQ-2026-816F1B1B)
      const reqNum = this.sequenceService
        ? await this.sequenceService.nextRequestNumber(tx)
        : `REQ-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      let isOverQuota = false;
      let specialApprovalNeeded = false;
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // Resolve items: agar mavjud bo'lsa mavjudidan oladi, agar yangi bo'lsa (hali omborda mavjud bo'lmagan tovar), yangi Item yaratadi
      const resolvedItems: { item: any; quantity: number }[] = [];

      for (const i of dto.items) {
        let item: any = null;
        if (i.itemId) {
          item = await tx.item.findUnique({ where: { id: i.itemId } });
        }
        if (!item && i.itemName) {
          item = await tx.item.findFirst({
            where: { name: { equals: i.itemName.trim(), mode: 'insensitive' } },
          });
        }

        // Agar omborda va katalogda hali mavjud bo'lmagan yangi tovar bo'lsa:
        if (!item && i.itemName) {
          let category = await tx.category.findFirst();
          if (!category) {
            category = await tx.category.create({
              data: { name: 'Xarid Mahsulotlari', description: 'Talabnoma orqali yangi kiritilgan mahsulotlar' },
            });
          }

          item = await tx.item.create({
            data: {
              name: i.itemName.trim(),
              unit: i.unit || 'DONA',
              categoryId: category.id,
              itemType: 'FIXED_ASSET',
              minStockLimit: 0,
            },
          });
        }

        if (!item) {
          throw new BadRequestException(
            `Mahsulot topilmadi yoki nomi ko‘rsatilmadi. Iltimos, tovar nomini to‘liq kiriting!`,
          );
        }

        resolvedItems.push({ item, quantity: i.quantity });

        // If department is known, check quota limit via QuotasService
        if (departmentId) {
          const quotaCheck = await this.quotasService.checkQuota(
            {
              departmentId,
              itemId: item.id,
              requestedQty: i.quantity,
              period: currentPeriod,
            },
            tx,
          );

          if (quotaCheck.isExceeded) {
            isOverQuota = true;
            specialApprovalNeeded = true;
          }
        }
      }

      const request = await tx.request.create({
        data: {
          requestNumber: reqNum,
          purpose: dto.purpose,
          requesterId: dto.requesterId,
          departmentId,
          status: RequestStatus.SUBMITTED,
          submittedAt: new Date(),
          isOverQuota,
          specialApprovalNeeded,
          notes: isOverQuota
            ? '[⚠️ DIQQAT: Kafedra oylik kvotasi oshirilgan. Rektorat maxsus tasdig\'i talab qilinadi]'
            : null,
        },
      });

      for (const resolved of resolvedItems) {
        await tx.requestItem.create({
          data: {
            requestId: request.id,
            itemId: resolved.item.id,
            requestedQty: resolved.quantity,
          },
        });
      }

      // 1-bosqich: Prorektorga bildirishnoma yuborish
      await this.notificationsService.notifyRole(
        RoleType.VICE_RECTOR_FINANCE,
        'Yangi Talabnoma (Prorektor Vizasi Kutilmoqda)',
        `${user?.fullName || 'Kafedra mudiri'} tomonidan yangi talabnoma (${reqNum}) yuborildi: ${dto.purpose}`,
        isOverQuota ? NotificationType.WARNING : NotificationType.REQUEST,
        '/requests',
      );

      // Ombor mudirini ham xabardor qilish
      await this.notificationsService.notifyRole(
        RoleType.HEAD_WAREHOUSE,
        'Yangi Talabnoma Kelib Tushdi',
        `${user?.fullName || 'Xodim'} tomonidan yangi talabnoma (${reqNum}) topshirildi: ${dto.purpose}`,
        isOverQuota ? NotificationType.WARNING : NotificationType.REQUEST,
        '/requests',
      );

      // Audit log
      await this.systemAuditService.log({
        action: 'CREATE',
        entity: 'Request',
        entityId: request.id,
        details: {
          requestNumber: reqNum,
          purpose: dto.purpose,
          isOverQuota,
          itemsCount: dto.items.length,
          stage: 'SUBMITTED',
        },
        userId: dto.requesterId,
      });

      return request;
    });

    if (this.eventsGateway) {
      const eventPayload = {
        id: created.id,
        requestNumber: created.requestNumber,
        purpose: created.purpose,
        status: created.status,
        requesterId: created.requesterId,
        departmentId: created.departmentId,
        isOverQuota: created.isOverQuota,
        createdAt: created.createdAt,
      };

      this.eventsGateway.emitToRole('VICE_RECTOR_FINANCE', 'REQUEST_CREATED', eventPayload);
      this.eventsGateway.emitToRole('VICE_RECTOR_FINANCE', 'request:created', eventPayload);
      this.eventsGateway.emitToRole('RECTOR', 'REQUEST_CREATED', eventPayload);
      this.eventsGateway.emitToRole('RECTOR', 'request:created', eventPayload);
      this.eventsGateway.emitToRole('HEAD_WAREHOUSE', 'REQUEST_CREATED', eventPayload);
      this.eventsGateway.emitToRole('HEAD_WAREHOUSE', 'request:created', eventPayload);
      this.eventsGateway.broadcast('REQUEST_CREATED', eventPayload);
      this.eventsGateway.broadcast('request:created', eventPayload);
      this.eventsGateway.broadcast('REQUEST_UPDATED', eventPayload);
      this.eventsGateway.broadcast('request:updated', eventPayload);
    }

    return created;
  }

  async advanceWorkflowStage(
    id: string,
    targetStatus: RequestStatus,
    user: { id: string; fullName?: string; role: RoleType; departmentId?: string },
    payload?: {
      note?: string;
      fundingSource?: string;
      subAccountCode?: string;
      allocatedAmount?: number;
      commendantId?: string;
      targetRoomId?: string;
    },
  ) {
    // 1. Role verification for 7-step sequence (no role bypass, each step requires designated role)
    if (targetStatus === RequestStatus.APPROVED_BY_PRORECTOR) {
      if (user.role !== RoleType.VICE_RECTOR_FINANCE) {
        throw new ForbiddenException('Ushbu bosqichni faqat Moliya-iqtisod prorektori tasdiqlashi mumkin!');
      }
    } else if (targetStatus === RequestStatus.APPROVED_BY_RECTOR) {
      if (user.role !== RoleType.RECTOR) {
        throw new ForbiddenException('Ushbu bosqichni faqat Universitet Rektori tasdiqlashi mumkin!');
      }
    } else if (targetStatus === RequestStatus.FINANCED_BY_ACCOUNTANT) {
      if (user.role !== RoleType.CHIEF_ACCOUNTANT) {
        throw new ForbiddenException('Moliyalashtirishni faqat Bosh hisobchi tasdiqlashi mumkin!');
      }
    } else if (targetStatus === RequestStatus.RECEIVED_AT_WAREHOUSE) {
      if (user.role !== RoleType.HEAD_WAREHOUSE) {
        throw new ForbiddenException('Ombor kirimini faqat Bosh ombor mudiri tasdiqlashi mumkin!');
      }
    } else if (targetStatus === RequestStatus.HANDED_TO_COMMENDANT) {
      if (user.role !== RoleType.COMMENDANT) {
        throw new ForbiddenException('Binoga qabul qilishni faqat Bino komendanti imzolashi mumkin!');
      }
    } else if (targetStatus === RequestStatus.FULFILLED) {
      if (user.role === RoleType.COMMENDANT) {
        throw new ForbiddenException(
          'Bino komendanti topshiruvchi hisoblanadi. Yakuniy qabul qilish dalolatnomasini komendant qabul qiluvchi o‘rniga imzolay olmaydi!',
        );
      }
      const req = await this.prisma.request.findUnique({ where: { id } });
      const isAuthorized =
        user.id === req?.requesterId ||
        (user.role === RoleType.MOL && (!user.departmentId || user.departmentId === req?.departmentId)) ||
        user.role === RoleType.SUPER_ADMIN;
      if (!isAuthorized) {
        throw new ForbiddenException(
          'Yakuniy qabul va topshirish dalolatnomasini faqat talabnoma kiritgan xodim yoki kafedra mas’uli (MOL) imzolashi mumkin!',
        );
      }
    }

    return this.updateStatus(id, targetStatus, {
      note: payload?.note,
      approvedById: user.id,
      fundingSource: payload?.fundingSource,
      subAccountCode: payload?.subAccountCode,
      allocatedAmount: payload?.allocatedAmount,
      commendantId: payload?.commendantId,
      targetRoomId: payload?.targetRoomId,
      currentUser: user,
    });
  }

  async updateStatus(
    id: string,
    status: RequestStatus,
    dto?: {
      note?: string;
      approvedById?: string;
      fundingSource?: string;
      subAccountCode?: string;
      allocatedAmount?: number;
      commendantId?: string;
      targetRoomId?: string;
      currentUser?: any;
    },
  ) {
    let fulfilledRequest: any = null;
    let outgoingMovement: any = null;
    const lowStockAlerts: { name: string; remainingQty: number; minLimit: number; unit: string }[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({
        where: { id },
        include: {
          items: { include: { item: true } },
          department: true,
          requester: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Talabnoma topilmadi!');
      }

      // Qat'iy etapma-etap o'tish tekshiruvi (Sequential State Machine Enforcement):
      // Oldingi etap to'liq yakunlanib, o'zaro imzo/akt rasmiylashtirilmaguncha keyingi etapga o'tib bo'lmaydi!
      const validTransitions: Record<string, RequestStatus[]> = {
        [RequestStatus.APPROVED_BY_PRORECTOR]: [
          RequestStatus.SUBMITTED,
          RequestStatus.PENDING,
          RequestStatus.APPROVED_BY_HEAD,
        ],
        [RequestStatus.APPROVED_BY_RECTOR]: [
          RequestStatus.APPROVED_BY_PRORECTOR,
          RequestStatus.PENDING,
          RequestStatus.SUBMITTED,
        ],
        [RequestStatus.FINANCED_BY_ACCOUNTANT]: [RequestStatus.APPROVED_BY_RECTOR],
        [RequestStatus.RECEIVED_AT_WAREHOUSE]: [RequestStatus.FINANCED_BY_ACCOUNTANT, RequestStatus.APPROVED_BY_HEAD],
        [RequestStatus.HANDED_TO_COMMENDANT]: [RequestStatus.RECEIVED_AT_WAREHOUSE],
        [RequestStatus.FULFILLED]: [RequestStatus.HANDED_TO_COMMENDANT],
        [RequestStatus.REJECTED]: [
          RequestStatus.SUBMITTED,
          RequestStatus.PENDING,
          RequestStatus.APPROVED_BY_HEAD,
          RequestStatus.APPROVED_BY_PRORECTOR,
          RequestStatus.APPROVED_BY_RECTOR,
          RequestStatus.FINANCED_BY_ACCOUNTANT,
          RequestStatus.RECEIVED_AT_WAREHOUSE,
        ],
        [RequestStatus.CANCELLED]: [RequestStatus.SUBMITTED, RequestStatus.PENDING],
      };

      const allowedStatuses = validTransitions[status];
      if (allowedStatuses && !allowedStatuses.includes(request.status)) {
        throw new BadRequestException(
          `Bosqichni o‘tkazib yuborish taqiqlanadi! Navbatdagi etapga o‘tish uchun avvalgi bosqich to‘liq yakunlanishi va tegishli hujjat (OS-1 yoki OS-2) QR orqali o‘zaro imzolanib rasmiylashtirilgan bo‘lishi shart. Joriy holat: ${request.status}, talab etilayotgan avvalgi holat: ${allowedStatuses.join(' yoki ')}`,
        );
      }

      if (status === RequestStatus.CANCELLED) {
        const executor = dto?.currentUser;
        if (executor && executor.role !== RoleType.SUPER_ADMIN && executor.id !== request.requesterId) {
          throw new ForbiddenException('Talabnomani faqat uni kiritgan muallif yoki Super Admin bekor qila oladi!');
        }
      }

      if (status === RequestStatus.FULFILLED) {
        const executor = dto?.currentUser;
        if (executor) {
          if (executor.role === RoleType.COMMENDANT) {
            throw new ForbiddenException(
              'Bino komendanti topshiruvchi hisoblanadi. Talabnomani faqat uni kiritgan talabgor xodim yoki kafedra mas’uli (MOL) qabul qilib yakunlashi mumkin!',
            );
          }
          const isAllowed =
            executor.id === request.requesterId ||
            (executor.role === RoleType.MOL && (!executor.departmentId || executor.departmentId === request.departmentId)) ||
            executor.role === RoleType.SUPER_ADMIN;
          if (!isAllowed) {
            throw new ForbiddenException(
              'Talabnomani faqat uni kiritgan talabgor xodim (yoki kafedra MOLi) qabul qilib yakunlashi mumkin!',
            );
          }
        }
      }

      // Agar kafedra oylik kvotasi oshirilgan bo'lsa (isOverQuota === true),
      // rektoratning maxsus roziligisiz (APPROVED_BY_RECTOR) talabnomani FULFILLED qilib bo'lmaydi!
      if (status === RequestStatus.FULFILLED && request.isOverQuota) {
        if (!request.rectorApprovedAt && !request.rectorApprovedById) {
          throw new BadRequestException(
            'Ushbu talabnomada kafedra oylik kvotasi oshirilgan! Rektorat maxsus tasdig‘i (APPROVED_BY_RECTOR) bo‘lmaguncha tovarlarni tarqatish (FULFILLED) qat’iyan taqiqlanadi.',
          );
        }
      }

      // If fulfilling, verify stock availability, deduct atomically, and update quotas
      if (status === RequestStatus.FULFILLED) {
        if (!request.items || request.items.length === 0) {
          throw new BadRequestException('Talabnomada mahsulotlar mavjud emas!');
        }

        const executorId = dto?.approvedById || request.requesterId;
        if (this.warehouseService) {
          const deductionResult = await this.warehouseService.deductStockForRequest(request, executorId, tx);
          outgoingMovement = deductionResult.movement;
          lowStockAlerts.push(...deductionResult.lowStockAlerts);
        }

        // Update approved quantity on request items and record department quota
        for (const reqItem of request.items) {
          await tx.requestItem.update({
            where: { id: reqItem.id },
            data: { approvedQty: reqItem.requestedQty },
          });

          if (request.departmentId) {
            await this.quotasService.recordUsage(
              request.departmentId,
              reqItem.itemId,
              reqItem.requestedQty,
              undefined,
              tx,
            );
          }
        }

        fulfilledRequest = request;
      }

      // Tayyorlovchi ma'lumotlar
      const updateData: any = {
        status,
        approvalNote: dto?.note || request.approvalNote,
        approvedById: dto?.approvedById,
      };

      if (status === RequestStatus.APPROVED_BY_PRORECTOR) {
        updateData.prorektorApprovedAt = new Date();
        updateData.prorektorApprovedById = dto?.approvedById;
      } else if (status === RequestStatus.APPROVED_BY_RECTOR) {
        updateData.rectorApprovedAt = new Date();
        updateData.rectorApprovedById = dto?.approvedById;
      } else if (status === RequestStatus.FINANCED_BY_ACCOUNTANT) {
        updateData.accountantFinancedAt = new Date();
        updateData.accountantFinancedById = dto?.approvedById;
        if (dto?.fundingSource) {
          updateData.fundingSource = dto.fundingSource as FundingSource;
        }
        if (dto?.subAccountCode) {
          updateData.subAccountCode = dto.subAccountCode;
        }
        if (dto?.allocatedAmount !== undefined) {
          updateData.allocatedAmount = new Prisma.Decimal(dto.allocatedAmount);
        }
      } else if (status === RequestStatus.RECEIVED_AT_WAREHOUSE) {
        updateData.warehouseReceivedAt = new Date();
        updateData.warehouseReceivedById = dto?.approvedById;

        if (this.warehouseService) {
          const executorId = dto?.approvedById || request.requesterId;
          await this.warehouseService.receiveStockForRequest(request, executorId, tx);
        }
      } else if (status === RequestStatus.HANDED_TO_COMMENDANT) {
        updateData.commendantHandedAt = new Date();
        updateData.commendantHandedById = dto?.approvedById;
        if (dto?.commendantId) {
          updateData.commendantId = dto.commendantId;
        }
      } else if (status === RequestStatus.FULFILLED) {
        updateData.fulfilledAt = new Date();
        if (dto?.targetRoomId) {
          updateData.targetRoomId = dto.targetRoomId;
        }
      }

      const updatedRequest = await tx.request.update({
        where: { id },
        data: updateData,
        include: {
          requester: true,
          department: true,
          items: { include: { item: true } },
          targetRoom: true,
          commendant: true,
          warehouseReceivedBy: true,
          commendantHandedBy: true,
          accountantFinancedBy: true,
          prorektorApprovedBy: true,
          rectorApprovedBy: true,
        },
      });

      return updatedRequest;
    });

    // Post-transaction actions: notification, audit log, document stamp
    const statusTitles: Record<string, string> = {
      SUBMITTED: 'Xodim Talabnomasi Yuborildi',
      APPROVED_BY_PRORECTOR: 'Moliya Prorektori Vizasi Berildi',
      APPROVED_BY_RECTOR: 'Rektor Vizasi Berildi (Xaridga Ruxsat)',
      FINANCED_BY_ACCOUNTANT: 'Bosh Hisobchi Moliyalashtirdi (Sub-hisob biriktirildi)',
      RECEIVED_AT_WAREHOUSE: 'Mahsulot Omborga Qabul Qilindi (OS-1 Kirim)',
      HANDED_TO_COMMENDANT: 'Komendantga Topshirildi (OS-2 Chiqim)',
      FULFILLED: 'Talabnoma Bajarildi va Xonaga Qabul Qilindi',
      REJECTED: 'Talabnoma Rad Etildi',
      APPROVED_BY_HEAD: "Bo'lim Boshlig'i / Mas'ul Tasdiqladi",
      APPROVED_BY_WAREHOUSE: 'Omborchi Tasdiqladi',
    };

    const itemsList = (result.items || [])
      .map((i: any) => `${i.item?.name || 'Ashyo'} (${i.approvedQty || i.requestedQty} ${i.item?.unit || 'DONA'})`)
      .join(', ');

    if (status === RequestStatus.RECEIVED_AT_WAREHOUSE) {
      // 1. Talabgorga maxsus xushxabar (Mahsulot bosh omborga kelganligi haqida):
      await this.notificationsService.create({
        userId: result.requesterId,
        title: '📦 Mahsulotingiz Universitet Bosh Omboriga Yetib Keldi!',
        message: `Siz so‘ragan ashyolar (${itemsList}) xarid qilinib, bosh omborga (OS-1 kirim akti asosida) muvaffaqiyatli qabul qilindi. Tez orada bino komendanti orqali kafedrangiz / xonangizga yetkaziladi.`,
        type: NotificationType.SUCCESS,
        link: '/requests',
      });

      // 2. Bino komendantiga topshiriq bildirishnomasi:
      await this.notificationsService.notifyRole(
        RoleType.COMMENDANT,
        'Binoga Qabul Qilish Kutilmoqda (Bino Komendanti)',
        `"${result.purpose}" mahsulotlari (${itemsList}) omborga yetib keldi (${result.requestNumber}). Ombordan binoga qabul qilib olishingiz so‘raladi.`,
        NotificationType.REQUEST,
        '/requests',
      );
    } else if (status === RequestStatus.HANDED_TO_COMMENDANT) {
      await this.notificationsService.create({
        userId: result.requesterId,
        title: '🚚 Ashyolar Binoga Yetkazildi (Komendant Qabul Qildi)',
        message: `Talabnomangiz bo‘yicha ashyolar (${itemsList}) omborchi tomonidan bino komendantiga topshirildi (OS-2 nakladnoyi). Komendantdan xonangizda qabul qilib, yakuniy dalolatnomani tasdiqlashingiz so‘raladi.`,
        type: NotificationType.INFO,
        link: '/requests',
      });
    } else if (status === RequestStatus.FULFILLED) {
      await this.notificationsService.create({
        userId: result.requesterId,
        title: '🎉 Ashyolar To‘liq Qabul Qilindi va Balansga O‘tdi!',
        message: `"${result.purpose}" talabnomasi bo‘yicha barcha ashyolar (${itemsList}) muvaffaqiyatli topshirildi va hisobingizga biriktirildi.`,
        type: NotificationType.SUCCESS,
        link: '/requests',
      });
    } else {
      const notifType =
        status === RequestStatus.REJECTED
          ? NotificationType.ERROR
          : NotificationType.INFO;

      await this.notificationsService.create({
        userId: result.requesterId,
        title: `Talabnoma Holati: ${statusTitles[status] || status}`,
        message: `Sizning "${result.purpose}" nomli talabnomangiz (${result.requestNumber}) holati yangilandi: ${statusTitles[status] || status}. ${dto?.note ? `Izoh: ${dto.note}` : ''}`,
        type: notifType,
        link: '/requests',
      });
    }

    // Navbatdagi mas'ullarni avtomatlashtirilgan xabardor qilish
    if (status === RequestStatus.SUBMITTED) {
      await this.notificationsService.notifyRole(
        RoleType.VICE_RECTOR_FINANCE,
        'Yangi Xarid Talabnomasi (Moliya Prorektori Vizasi)',
        `"${result.purpose}" bo‘yicha yangi talabnoma (${result.requestNumber}) kiritildi va sizning tasdiqlashingizni kutmoqda.`,
        NotificationType.REQUEST,
        '/requests',
      );
    } else if (status === RequestStatus.APPROVED_BY_PRORECTOR) {
      await this.notificationsService.notifyRole(
        RoleType.RECTOR,
        'Yangi Talabnoma (Rektor Vizasi Kutilmoqda)',
        `"${result.purpose}" nomli talabnoma (${result.requestNumber}) Prorektor tomonidan ma’qullandi. Yakuniy vizangiz kutilmoqda.`,
        NotificationType.REQUEST,
        '/requests',
      );
    } else if (status === RequestStatus.APPROVED_BY_RECTOR) {
      await this.notificationsService.notifyRole(
        RoleType.CHIEF_ACCOUNTANT,
        'Moliyalashtirish Kutilmoqda (Bosh Hisobchi)',
        `"${result.purpose}" talabnomasi (${result.requestNumber}) Rektor tomonidan tasdiqlandi. Manba va sub-hisob biriktirishingiz so‘raladi.`,
        NotificationType.REQUEST,
        '/requests',
      );
    } else if (status === RequestStatus.FINANCED_BY_ACCOUNTANT) {
      await this.notificationsService.notifyRole(
        RoleType.HEAD_WAREHOUSE,
        'Xarid va Omborga Kirim Qilish Kutilmoqda',
        `"${result.purpose}" talabnomasi (${result.requestNumber}) moliyalashtirildi. Tovarlar keltirilgach omborga kirim (OS-1) qilinishi lozim.`,
        NotificationType.REQUEST,
        '/requests',
      );
    }

    await this.systemAuditService.log({
      action: status === RequestStatus.FULFILLED ? 'FULFILL' : status === RequestStatus.REJECTED ? 'REJECT' : 'ADVANCE_STAGE',
      entity: 'Request',
      entityId: result.id,
      details: {
        requestNumber: result.requestNumber,
        newStatus: status,
        note: dto?.note,
        fundingSource: dto?.fundingSource,
        subAccountCode: dto?.subAccountCode,
        allocatedAmount: dto?.allocatedAmount,
      },
      userId: dto?.approvedById,
    });

    if (result.isOverQuota && (status === RequestStatus.APPROVED_BY_RECTOR || status === RequestStatus.APPROVED_BY_PRORECTOR)) {
      await this.systemAuditService.log({
        action: 'QUOTA_OVERRIDE',
        entity: 'Request',
        entityId: result.id,
        details: {
          requestNumber: result.requestNumber,
          purpose: result.purpose,
          overrideStatus: status,
          note: dto?.note,
          approvedById: dto?.approvedById,
        },
        userId: dto?.approvedById,
      });
    }

    const warehouseSigner = result.warehouseReceivedBy?.fullName || 'Bosh ombor mudiri';
    const commendantSigner = result.commendantHandedBy?.fullName || result.commendant?.fullName || 'Bino komendanti';
    const requesterSigner = result.requester?.fullName || 'Mas’ul xodim';

    // 5-bosqich: OS-1 Kirim Dalolatnomasini avtomatik muhrlash
    if (status === RequestStatus.RECEIVED_AT_WAREHOUSE) {
      try {
        await this.documentStampsService.stampDocument({
          docType: 'OS_1',
          docNumber: `${result.requestNumber}-OS1`,
          title: `Kirim Dalolatnomasi OS-1 (Ombor qabuli) — ${result.purpose}`,
          signerName: warehouseSigner,
          signerRole: 'Bosh ombor mudiri',
          metadata: {
            requestNumber: result.requestNumber,
            purpose: result.purpose,
            department: result.department?.name,
            requester: requesterSigner,
            fundingSource: result.fundingSource,
            subAccountCode: result.subAccountCode,
            allocatedAmount: result.allocatedAmount,
            items: result.items.map((i: any) => ({
              name: i.item.name,
              qty: i.approvedQty || i.requestedQty,
              unit: i.item.unit,
            })),
          },
        });
      } catch (e) {
        // stamping failure shouldn't fail the response
      }
    }

    // 6-bosqich: OS-2 Chiqim Nakladnoyini avtomatik muhrlash (Bosh omborchi -> Bino komendanti)
    if (status === RequestStatus.HANDED_TO_COMMENDANT) {
      try {
        await this.documentStampsService.stampDocument({
          docType: 'OS_2',
          docNumber: `${result.requestNumber}-OS2`,
          title: `OS-2 Chiqim Nakladnoyi (Komendantga topshirish) — ${result.purpose}`,
          signerName: warehouseSigner,
          signerRole: 'Bosh ombor mudiri',
          metadata: {
            requestNumber: result.requestNumber,
            purpose: result.purpose,
            department: result.department?.name,
            commendantName: commendantSigner,
            items: result.items.map((i: any) => ({
              name: i.item.name,
              qty: i.approvedQty || i.requestedQty,
              unit: i.item.unit,
            })),
            signatures: [
              {
                role: 'Topshiruvchi (Bosh Ombor Mudiri)',
                name: warehouseSigner,
                isSigned: true,
                signedAt: new Date(),
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
              {
                role: 'Qabul Qiluvchi (Bino Komendanti)',
                name: commendantSigner,
                isSigned: true,
                signedAt: new Date(),
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
            ],
          },
        });
      } catch (e) {
        // stamping failure shouldn't fail the response
      }
    }

    // 7-bosqich: Kafedra/Bo‘lim topshirish-qabul qilish dalolatnomasini muhrlash
    if (status === RequestStatus.FULFILLED && fulfilledRequest) {
      try {
        await this.documentStampsService.stampDocument({
          docType: 'AKT',
          docNumber: `${result.requestNumber}-AKT`,
          title: `Ichki topshirish-qabul qilish dalolatnomasi (${result.purpose})`,
          signerName: commendantSigner,
          signerRole: 'Bosh bino komendanti',
          metadata: {
            requestNumber: result.requestNumber,
            purpose: result.purpose,
            department: result.department?.name,
            requester: requesterSigner,
            room: result.targetRoom?.name || result.targetRoom?.number,
            movementNumber: outgoingMovement?.movementNumber,
            items: result.items.map((i: any) => ({
              name: i.item.name,
              qty: i.approvedQty || i.requestedQty,
              unit: i.item.unit,
            })),
            signatures: [
              {
                role: 'Topshiruvchi (Bino Komendanti)',
                name: commendantSigner,
                isSigned: true,
                signedAt: new Date(),
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
              {
                role: 'Qabul Qiluvchi (Mas’ul Shaxs)',
                name: requesterSigner,
                isSigned: true,
                signedAt: new Date(),
                method: 'UWMS Tizim Tasdig‘i (Workflow Auth)',
              },
            ],
          },
        });
      } catch (e) {
        // stamping failure shouldn't fail the response
      }
    }

    if (status === RequestStatus.FULFILLED && lowStockAlerts.length > 0) {
      for (const alert of lowStockAlerts) {
        await this.notificationsService.notifyRole(
          RoleType.HEAD_WAREHOUSE,
          '⚠️ Omborda Mahsulot Qoldig‘i Kritik Darajaga Tushdi!',
          `"${alert.name}" mahsuloti ombor qoldig‘i me’yor darajasiga yetdi: ${alert.remainingQty} ${alert.unit} (Minimal limit: ${alert.minLimit} ${alert.unit}). Yangi xarid buyurtmasini shakllantirish tavsiya etiladi.`,
          NotificationType.WARNING,
          '/warehouse',
        );
      }
    }

    if (this.eventsGateway) {
      const eventPayload = {
        id: result.id,
        requestNumber: result.requestNumber,
        purpose: result.purpose,
        status: result.status,
        requesterId: result.requesterId,
        requesterName: result.requester?.fullName,
        departmentId: result.departmentId,
        departmentName: result.department?.name,
        approvalNote: result.approvalNote,
        fundingSource: result.fundingSource,
        subAccountCode: result.subAccountCode,
        allocatedAmount: result.allocatedAmount ? Number(result.allocatedAmount) : undefined,
        targetRoomId: result.targetRoomId,
        targetRoomName: result.targetRoom?.name,
        targetRoomNumber: result.targetRoom?.number,
        commendantId: result.commendantId,
        commendantName: result.commendant?.fullName,
        submittedAt: result.submittedAt?.toISOString(),
        prorektorApprovedAt: result.prorektorApprovedAt?.toISOString(),
        prorektorApprovedById: result.prorektorApprovedById,
        prorektorApprovedByName: result.prorektorApprovedBy?.fullName,
        rectorApprovedAt: result.rectorApprovedAt?.toISOString(),
        rectorApprovedById: result.rectorApprovedById,
        rectorApprovedByName: result.rectorApprovedBy?.fullName,
        accountantFinancedAt: result.accountantFinancedAt?.toISOString(),
        accountantFinancedById: result.accountantFinancedById,
        accountantFinancedByName: result.accountantFinancedBy?.fullName,
        warehouseReceivedAt: result.warehouseReceivedAt?.toISOString(),
        warehouseReceivedById: result.warehouseReceivedById,
        warehouseReceivedByName: result.warehouseReceivedBy?.fullName,
        commendantHandedAt: result.commendantHandedAt?.toISOString(),
        commendantHandedById: result.commendantHandedById,
        commendantHandedByName: result.commendantHandedBy?.fullName,
        fulfilledAt: result.fulfilledAt?.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Tizim bo'ylab barcha faol mijozlarga umumiy yangilanish signali
      this.eventsGateway.broadcast('REQUEST_UPDATED', eventPayload);

      // 2. Talabnoma kiritgan shaxsning ekrani (Stepper jonli oldinga siljishi uchun)
      this.eventsGateway.emitToUser(result.requesterId, 'REQUEST_UPDATED', eventPayload);

      // 3. Rollar kesimida navbatdagi mas'ul xodimga maqsadli signal:
      if (status === RequestStatus.APPROVED_BY_PRORECTOR) {
        this.eventsGateway.emitToRole('RECTOR', 'REQUEST_UPDATED', eventPayload);
      } else if (status === RequestStatus.APPROVED_BY_RECTOR) {
        this.eventsGateway.emitToRole('CHIEF_ACCOUNTANT', 'REQUEST_UPDATED', eventPayload);
      } else if (status === RequestStatus.FINANCED_BY_ACCOUNTANT) {
        this.eventsGateway.emitToRole('HEAD_WAREHOUSE', 'REQUEST_UPDATED', eventPayload);
      } else if (status === RequestStatus.RECEIVED_AT_WAREHOUSE) {
        this.eventsGateway.emitToRole('COMMENDANT', 'REQUEST_UPDATED', eventPayload);
      } else if (status === RequestStatus.HANDED_TO_COMMENDANT) {
        this.eventsGateway.emitToUser(result.requesterId, 'REQUEST_UPDATED', eventPayload);
      } else if (status === RequestStatus.FULFILLED) {
        this.eventsGateway.emitToUser(result.requesterId, 'REQUEST_UPDATED', eventPayload);
      }
    }

    return result;
  }
}
