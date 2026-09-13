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

  async getAllRequests() {
    const requests = await this.prisma.request.findMany({
      include: {
        requester: { select: { id: true, fullName: true } },
        department: true,
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
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
  }

  async createRequest(dto: {
    purpose: string;
    requesterId: string;
    departmentId?: string;
    items: { itemName: string; quantity: number; unit?: string }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Find user & department
      const user = await tx.user.findUnique({ where: { id: dto.requesterId } });
      const departmentId = dto.departmentId || user?.departmentId || undefined;

      const reqNum = `REQ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

      const cat = await tx.category.upsert({
        where: { name: 'Kanselyariya va sarf materiallari' },
        update: {},
        create: { name: 'Kanselyariya va sarf materiallari' },
      });

      let isOverQuota = false;
      let specialApprovalNeeded = false;
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // Resolve items and check quotas
      const resolvedItems: { item: any; quantity: number }[] = [];

      for (const i of dto.items) {
        let item = null;
        if ((i as any).itemId) {
          item = await tx.item.findUnique({ where: { id: (i as any).itemId } });
        }
        if (!item && i.itemName) {
          item = await tx.item.findFirst({
            where: { name: { equals: i.itemName.trim(), mode: 'insensitive' } },
          });
        }

        if (!item) {
          item = await tx.item.create({
            data: {
              name: i.itemName.trim(),
              unit: i.unit || 'DONA',
              itemType: 'CONSUMABLE',
              categoryId: cat.id,
            },
          });
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
            ? '[⚠️ DIQQAT: Kafedra oylik kvotasi oshirilgan. Rektorat maxsus tasdig‘i talab qilinadi]'
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
        const movNum = `MOV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

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

    return result;
  }
}
