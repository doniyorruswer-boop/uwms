import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotasService } from '../quotas/quotas.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { RequestStatus, RoleType, NotificationType } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly quotasService: QuotasService,
    private readonly systemAuditService: SystemAuditService,
    private readonly documentStampsService: DocumentStampsService,
  ) {}

  async getAllRequests(query?: {
    search?: string;
    status?: RequestStatus;
    departmentId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const where: any = {};

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

    const [requests, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.request.findMany({
            where,
            include: {
              requester: { select: { id: true, fullName: true } },
              department: true,
              items: { include: { item: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          this.prisma.request.count({ where }),
        ])
      : [
          await this.prisma.request.findMany({
            where,
            include: {
              requester: { select: { id: true, fullName: true } },
              department: true,
              items: { include: { item: true } },
            },
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
      departmentName: r.department?.name,
      approvalNote: r.approvalNote,
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
    items: { itemId: string; itemName?: string; quantity: number; unit?: string }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Find user & department
      const user = await tx.user.findUnique({ where: { id: dto.requesterId } });
      const departmentId = dto.departmentId || user?.departmentId || undefined;

      // Kolliziyasiz requestNumber: REQ-YYYY-<UUID 8 belgi>
      const reqNum = `REQ-${new Date().getFullYear()}-${require('crypto').randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

      let isOverQuota = false;
      let specialApprovalNeeded = false;
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // Resolve items from existing catalog only — yangi item yaratish TAQIQLANGAN
      const resolvedItems: { item: any; quantity: number }[] = [];

      for (const i of dto.items) {
        // itemId majburiy: faqat mavjud katalogdan olish
        const item = await tx.item.findUnique({ where: { id: i.itemId } });

        if (!item) {
          throw new BadRequestException(
            `Mahsulot topilmadi (itemId: "${i.itemId}"). Faqat mavjud katalogdan tanlang!`,
          );
        }

        resolvedItems.push({ item, quantity: i.quantity });

        // If department is known, check quota limit
        if (departmentId) {
          const quota = await tx.departmentQuota.findUnique({
            where: {
              departmentId_itemId_period: {
                departmentId,
                itemId: item.id,
                period: currentPeriod,
              },
            },
          });

          if (quota && quota.usedQuantity + i.quantity > quota.monthlyLimit) {
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
          status: RequestStatus.PENDING,
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

      // Notify warehouse heads
      await this.notificationsService.notifyRole(
        RoleType.HEAD_WAREHOUSE,
        'Yangi Talabnoma Kelib Tushdi',
        `${user?.fullName || 'Xodim'} tomonidan yangi talabnoma (${reqNum}) yuborildi: ${dto.purpose}`,
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
        },
        userId: dto.requesterId,
      });

      return request;
    });
  }


  async updateStatus(
    id: string,
    status: RequestStatus,
    dto?: { note?: string; approvedById?: string },
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

      // If fulfilling, verify stock availability, deduct atomically, and update quotas
      if (status === RequestStatus.FULFILLED) {
        const warehouse =
          (await tx.warehouse.findFirst({ where: { isMain: true } })) ||
          (await tx.warehouse.findFirst());

        if (!warehouse) {
          throw new NotFoundException('Tizimda asosiy ombor topilmadi!');
        }

        const executorId = dto?.approvedById || request.requesterId;
        // Kolliziyasiz movementNumber: MOV-YYYY-<UUID 8 belgi>
        const movNum = `MOV-${new Date().getFullYear()}-${require('crypto').randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

        const movement = await tx.stockMovement.create({
          data: {
            movementNumber: movNum,
            movementType: 'OUTGOING',
            referenceDoc: request.requestNumber,
            note: dto?.note || `Talabnoma bo‘yicha tarqatildi: ${request.purpose}`,
            executedById: executorId,
            fromWarehouseId: warehouse.id,
          },
        });

        outgoingMovement = movement;
        const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        for (const reqItem of request.items) {
          // Check stock
          const stock = await tx.stock.findUnique({
            where: {
              warehouseId_itemId: {
                warehouseId: warehouse.id,
                itemId: reqItem.itemId,
              },
            },
          });

          if (!stock || stock.quantity < reqItem.requestedQty) {
            const currentQty = stock?.quantity || 0;
            throw new BadRequestException(
              `Omborda "${reqItem.item.name}" yetarli emas! Mavjud qoldiq: ${currentQty} ${reqItem.item.unit}, Talab qilingan: ${reqItem.requestedQty} ${reqItem.item.unit}. Operatsiya to‘xtatildi.`,
            );
          }

          // Decrement stock
          await tx.stock.update({
            where: { id: stock.id },
            data: {
              quantity: {
                decrement: reqItem.requestedQty,
              },
            },
          });

          // Log movement item
          await tx.stockMovementItem.create({
            data: {
              movementId: movement.id,
              itemId: reqItem.itemId,
              quantity: reqItem.requestedQty,
              note: `Berilgan miqdor: ${reqItem.requestedQty}`,
            },
          });

          // Update approved quantity on request item
          await tx.requestItem.update({
            where: { id: reqItem.id },
            data: { approvedQty: reqItem.requestedQty },
          });

          // Record department quota usage
          if (request.departmentId) {
            const quota = await tx.departmentQuota.findUnique({
              where: {
                departmentId_itemId_period: {
                  departmentId: request.departmentId,
                  itemId: reqItem.itemId,
                  period: currentPeriod,
                },
              },
            });

            if (quota) {
              await tx.departmentQuota.update({
                where: { id: quota.id },
                data: {
                  usedQuantity: {
                    increment: reqItem.requestedQty,
                  },
                },
              });
            }
          }

          const remainingQty = stock.quantity - reqItem.requestedQty;
          if (remainingQty <= reqItem.item.minStockLimit) {
            lowStockAlerts.push({
              name: reqItem.item.name,
              remainingQty,
              minLimit: reqItem.item.minStockLimit,
              unit: reqItem.item.unit,
            });
          }
        }

        fulfilledRequest = request;
      }

      const updatedRequest = await tx.request.update({
        where: { id },
        data: {
          status,
          approvalNote: dto?.note || request.approvalNote,
          approvedById: dto?.approvedById,
        },
        include: {
          requester: true,
          department: true,
          items: { include: { item: true } },
        },
      });

      return updatedRequest;
    });

    // Post-transaction actions: notification, audit log, document stamp
    const statusTitles: Record<string, string> = {
      APPROVED_BY_HEAD: 'Kafedra Mudiri Tasdiqladi',
      APPROVED_BY_WAREHOUSE: 'Omborchi Tasdiqladi',
      FULFILLED: 'Talabnoma Bajarildi va Tarqatildi',
      REJECTED: 'Talabnoma Rad Etildi',
    };

    const notifType =
      status === RequestStatus.FULFILLED
        ? NotificationType.SUCCESS
        : status === RequestStatus.REJECTED
          ? NotificationType.ERROR
          : NotificationType.INFO;

    await this.notificationsService.create({
      userId: result.requesterId,
      title: `Talabnoma Holati: ${statusTitles[status] || status}`,
      message: `Sizning "${result.purpose}" nomli talabnomangiz (${result.requestNumber}) holati o‘zgardi. ${dto?.note ? `Izoh: ${dto.note}` : ''}`,
      type: notifType,
      link: '/requests',
    });

    await this.systemAuditService.log({
      action: status === RequestStatus.FULFILLED ? 'FULFILL' : status === RequestStatus.REJECTED ? 'REJECT' : 'APPROVE',
      entity: 'Request',
      entityId: result.id,
      details: {
        requestNumber: result.requestNumber,
        newStatus: status,
        note: dto?.note,
      },
      userId: dto?.approvedById,
    });

    if (status === RequestStatus.FULFILLED && fulfilledRequest) {
      // Create Document Stamp for official OS-2 Nakladnoy
      try {
        await this.documentStampsService.stampDocument({
          docType: 'OS_2',
          docNumber: result.requestNumber,
          title: `OS-2 Chiqim Nakladnoyi (${result.purpose})`,
          signerName: 'Bosh omborchi',
          signerRole: 'Bosh ombor mudiri',
          metadata: {
            purpose: result.purpose,
            department: result.department?.name,
            requester: result.requester?.fullName,
            movementNumber: outgoingMovement?.movementNumber,
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

    return result;
  }
}
