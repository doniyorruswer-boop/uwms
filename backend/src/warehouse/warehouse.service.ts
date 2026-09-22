import { Injectable, NotFoundException, BadRequestException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SequenceService } from '../common/services/sequence.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { EventsGateway } from '../events/events.gateway';
import { IngestStockDto, InterWarehouseTransferDto } from './dto/warehouse.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse-crud.dto';

@Injectable()
export class WarehouseService {
  constructor(
    private prisma: PrismaService,
    private codeGen: CodeGeneratorService,
    private systemAuditService: SystemAuditService,
    @Optional() private sequenceService?: SequenceService,
    @Optional() private documentStampsService?: DocumentStampsService,
    @Optional() private eventsGateway?: EventsGateway,
  ) {}

  async getStocks(query?: { search?: string; categoryId?: string; fundingSource?: string; page?: number | string; limit?: number | string }) {
    const where: any = {};
    const itemCondition: any = { deletedAt: null };
    if (query?.categoryId && query.categoryId !== 'ALL') {
      itemCondition.categoryId = query.categoryId;
    }
    where.item = itemCondition;

    if (query?.fundingSource && query.fundingSource !== 'ALL') {
      where.fundingSource = query.fundingSource as any;
    }

    if (query?.search) {
      where.OR = [
        { item: { name: { contains: query.search, mode: 'insensitive' }, deletedAt: null } },
        { warehouse: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const isPaginated = query?.page !== undefined || query?.limit !== undefined;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 25));
    const skip = (page - 1) * limit;

    const [stocks, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.stock.findMany({
            where,
            include: {
              warehouse: true,
              item: { include: { category: true } },
            },
            orderBy: { quantity: 'asc' },
            skip,
            take: limit,
          }),
          this.prisma.stock.count({ where }),
        ])
      : [
          await this.prisma.stock.findMany({
            where,
            include: {
              warehouse: true,
              item: { include: { category: true } },
            },
            orderBy: { quantity: 'asc' },
          }),
          0,
        ];

    const mapped = stocks.map((s) => ({
      id: s.id,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      itemId: s.itemId,
      itemName: s.item.name,
      categoryName: s.item.category.name,
      unit: s.item.unit,
      quantity: s.quantity,
      fundingSource: s.fundingSource,
      minStockLimit: s.item.minStockLimit,
      status: s.quantity <= s.item.minStockLimit ? 'LOW' : 'NORMAL',
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

  async getLowStockItems() {
    const stocks = await this.prisma.stock.findMany({
      include: {
        warehouse: true,
        item: { include: { category: true } },
      },
      orderBy: { quantity: 'asc' },
    });

    return stocks
      .filter((s) => s.quantity <= (s.item?.minStockLimit ?? 5))
      .map((s) => ({
        id: s.id,
        stockId: s.id,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        itemId: s.itemId,
        itemName: s.item.name,
        model: s.item.model || null,
        categoryName: s.item.category?.name || 'Boshqa',
        unit: s.item.unit,
        quantity: s.quantity,
        minStockLimit: s.item.minStockLimit,
        deficit: Math.max(0, s.item.minStockLimit - s.quantity),
        recommendedOrderQty: Math.max(10, s.item.minStockLimit * 2 - s.quantity),
        fundingSource: s.fundingSource,
        status: 'LOW' as const,
      }));
  }

  async replenishStock(stockId: string, amount: number, executedById?: string, fundingSource?: string) {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Kirim miqdori noldan katta (musbat son) bo‘lishi shart!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { id: stockId },
        include: { item: true, warehouse: true },
      });
      if (!stock) throw new NotFoundException('Tovar qoldig‘i topilmadi!');

      const targetFunding = (fundingSource || stock.fundingSource) as any;
      let targetStock: any;

      if (fundingSource && fundingSource !== stock.fundingSource) {
        targetStock = await tx.stock.upsert({
          where: {
            warehouseId_itemId_fundingSource: {
              warehouseId: stock.warehouseId,
              itemId: stock.itemId,
              fundingSource: targetFunding,
            },
          },
          update: {
            quantity: { increment: amount },
          },
          create: {
            warehouseId: stock.warehouseId,
            itemId: stock.itemId,
            quantity: amount,
            fundingSource: targetFunding,
          },
          include: { item: true, warehouse: true },
        });
      } else {
        targetStock = await tx.stock.update({
          where: { id: stockId },
          data: {
            quantity: { increment: amount },
          },
          include: { item: true, warehouse: true },
        });
      }

      // Log movement journal with sequential number
      const movNum = this.sequenceService
        ? await this.sequenceService.nextMovementNumber(tx)
        : this.codeGen.generateMovementNumber((await tx.stockMovement.count()) + 1);

      const movement = await tx.stockMovement.create({
        data: {
          movementNumber: movNum,
          movementType: 'INCOMING',
          referenceDoc: 'Kirim dalolatnomasi',
          note: `Ombor zaxirasini to‘ldirish (+${amount} ${stock.item.unit}) [${targetFunding}]`,
          executedById: executedById || (await tx.user.findFirst({ where: { role: 'HEAD_WAREHOUSE' } }))!.id,
          toWarehouseId: stock.warehouseId,
          fundingSource: targetFunding,
        },
      });

      await tx.stockMovementItem.create({
        data: {
          movementId: movement.id,
          itemId: stock.itemId,
          quantity: amount,
          note: `Kirim qilindi (${targetFunding})`,
        },
      });

      return {
        ...targetStock,
        status: targetStock.quantity <= stock.item.minStockLimit ? 'LOW' : 'NORMAL',
      };
    });

    if (this.eventsGateway?.server) {
      this.eventsGateway.server.emit('stock:updated', {
        action: 'REPLENISH',
        stockId: result.id,
        itemId: result.itemId,
        warehouseId: result.warehouseId,
        quantity: result.quantity,
        fundingSource: result.fundingSource,
      });
    }

    return result;
  }

  async ingestStock(dto: IngestStockDto & { executedById: string }) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Kirim qilish uchun kamida bitta mahsulot ko‘rsatilishi shart!');
    }

    if (dto.items.some((i) => !i.quantity || i.quantity <= 0)) {
      throw new BadRequestException('Barcha mahsulotlar miqdori noldan katta bo‘lishi shart!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Check supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) throw new NotFoundException('Tanlangan ta’minotchi topilmadi!');

      // 2. Resolve warehouse
      let warehouseId = dto.warehouseId;
      if (!warehouseId) {
        const mainWh =
          (await tx.warehouse.findFirst({ where: { isMain: true } })) ||
          (await tx.warehouse.findFirst());
        if (!mainWh) throw new NotFoundException('Ombor mavjud emas!');
        warehouseId = mainWh.id;
      }
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });

      // 3. Resolve or create Invoice
      let invoiceNumber = dto.invoiceNumber?.trim();
      if (!invoiceNumber) {
        invoiceNumber = this.sequenceService
          ? await this.sequenceService.nextInvoiceNumber(tx)
          : this.codeGen.generateInvoiceNumber((await tx.invoice.count()) + 1);
      }

      let invoice = await tx.invoice.findUnique({ where: { invoiceNumber } });
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
            totalAmount: dto.totalAmount || 0,
            supplierId: supplier.id,
            notes: dto.note,
          },
        });
      }

      // 4. Counts for sequential generation
      let assetSeq = await tx.itemInstance.count();
      const movementCount = await tx.stockMovement.count();

      const createdInstances: any[] = [];
      const movementItemsData: any[] = [];
      const docItems: any[] = [];

      for (const entry of dto.items) {
        let item: any = null;
        if (entry.itemId && typeof entry.itemId === 'string' && entry.itemId.trim().length > 0) {
          item = await tx.item.findUnique({
            where: { id: entry.itemId.trim() },
            include: { category: true },
          });
        }

        if (!item && entry.name) {
          item = await tx.item.findFirst({
            where: { name: entry.name },
            include: { category: true },
          });
        }

        if (!item) {
          const cat = await tx.category.upsert({
            where: { name: entry.categoryName || 'Kompyuter va IT uskunalari' },
            update: {},
            create: { name: entry.categoryName || 'Kompyuter va IT uskunalari' },
          });

          item = await tx.item.create({
            data: {
              name: entry.name,
              model: entry.model,
              unit: entry.unit || 'dona',
              itemType: entry.type === 'CONSUMABLE' ? 'CONSUMABLE' : 'FIXED_ASSET',
              categoryId: cat.id,
            },
            include: { category: true },
          });
        }


        if (item.itemType === 'FIXED_ASSET') {

          // Create individual tracked instances
          for (let q = 0; q < entry.quantity; q++) {
            assetSeq++;
            const invNumber = this.codeGen.generateInventoryNumber(assetSeq);
            const qrCode = this.codeGen.generateQRCode(invNumber);
            const serial = entry.serialNumbers?.[q] || null;

            const purchasePrice = entry.purchasePrice || 0;
            const instance = await tx.itemInstance.create({
              data: {
                itemId: item.id,
                inventoryNumber: invNumber,
                serialNumber: serial,
                qrCode,
                status: 'NEW',
                fundingSource: dto.fundingSource || 'BYUDJET',
                purchasePrice,
                currentBookValue: purchasePrice,
                accumulatedDepreciation: 0,
                supplierId: supplier.id,
                invoiceId: invoice.id,
              },
            });

            await tx.assetHistory.create({
              data: {
                assetId: instance.id,
                action: 'KIRIM',
                toLocation: warehouse?.name || 'Ombor',
                referenceDoc: `${invoice.invoiceNumber} (Kirim Akti OS-1)`,
                note: `Ta’minotchi ${supplier.name} dan qabul qilindi`,
                executedById: dto.executedById,
              },
            });

            createdInstances.push(instance);
          }

          const firstInv = createdInstances[createdInstances.length - entry.quantity]?.inventoryNumber || '—';
          const lastInv = createdInstances[createdInstances.length - 1]?.inventoryNumber || firstInv;
          const displayInv = entry.quantity > 1 ? `${firstInv} ... ${lastInv}` : firstInv;

          docItems.push({
            inventoryNumber: displayInv,
            name: item.name,
            model: item.model || 'Standart',
            serialNumber: entry.serialNumbers?.[0] || '—',
            quantity: entry.quantity,
            unit: item.unit,
            price: entry.purchasePrice || 0,
          });
        } else {
          // Consumable stock replenishment (ATOMIC UPSERT)
          const funding = (dto.fundingSource || 'BYUDJET') as any;
          await tx.stock.upsert({
            where: {
              warehouseId_itemId_fundingSource: {
                warehouseId: warehouse!.id,
                itemId: item.id,
                fundingSource: funding,
              },
            },
            update: {
              quantity: { increment: entry.quantity },
            },
            create: {
              warehouseId: warehouse!.id,
              itemId: item.id,
              quantity: entry.quantity,
              fundingSource: funding,
            },
          });

          docItems.push({
            inventoryNumber: `OMBOR-${item.sku || 'SARF'}`,
            name: item.name,
            model: item.model || 'Sarf materiali',
            serialNumber: '—',
            quantity: entry.quantity,
            unit: item.unit,
            price: entry.purchasePrice || 0,
          });
        }

        movementItemsData.push({
          itemId: item.id,
          quantity: entry.quantity,
          note: `Kirim (+${entry.quantity} ${item.unit})`,
        });
      }

      // 5. Create StockMovement (INCOMING)
      const movNumber = this.sequenceService
        ? await this.sequenceService.nextMovementNumber(tx)
        : this.codeGen.generateMovementNumber((await tx.stockMovement.count()) + 1);

      const movement = await tx.stockMovement.create({
        data: {
          movementNumber: movNumber,
          movementType: 'INCOMING',
          referenceDoc: `Faktura № ${invoice.invoiceNumber}`,
          note: dto.note || `Ta’minotchi: ${supplier.name} (${dto.fundingSource || 'BYUDJET'})`,
          supplierId: supplier.id,
          invoiceNumber: invoice.invoiceNumber,
          fundingSource: dto.fundingSource || 'BYUDJET',
          executedById: dto.executedById,
          toWarehouseId: warehouse!.id,
          items: {
            create: movementItemsData,
          },
        },
      });

      // 6. Generate official OS-1 Receipt Act data
      const docNumber = this.sequenceService
        ? await this.sequenceService.nextDocNumber('OS1', tx)
        : this.codeGen.generateDocNumber('OS1', (await tx.stockMovement.count()));

      return {
        success: true,
        message: 'Omborga kirim muvaffaqiyatli amalga oshirildi!',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        movementNumber: movement.movementNumber,
        createdAssetsCount: createdInstances.length,
        officialDoc: {
          docType: 'KIRIM',
          docNumber,
          date: new Date().toLocaleDateString('uz-UZ'),
          sourceLocation: `${supplier.name} (Shartnoma: ${supplier.contractNumber || '№1'})`,
          targetLocation: warehouse?.name || 'Markaziy ombor',
          senderName: supplier.contactPerson || supplier.name,
          receiverName: 'Bosh Omborchi',
          reason: `Hisob-faktura № ${invoice.invoiceNumber}. Moliyalashtirish: ${dto.fundingSource || 'BYUDJET'}`,
          items: docItems,
        },
      };
    });

    if (this.documentStampsService && result?.officialDoc?.docNumber) {
      try {
        const executor = dto.executedById
          ? await this.prisma.user.findUnique({ where: { id: dto.executedById } })
          : null;

        const stamp = await this.documentStampsService.stampDocument({
          docType: 'OS_1',
          docNumber: result.officialDoc.docNumber,
          title: `Kirim va Topshirish-Qabul Qilish Dalolatnomasi (OS-1) — Faktura № ${result.invoiceNumber}`,
          signerName: executor?.fullName || 'Bosh Omborchi',
          signerRole: executor?.position || 'Bosh ombor mudiri',
          metadata: {
            invoiceNumber: result.invoiceNumber,
            movementNumber: result.movementNumber,
            fundingSource: dto.fundingSource || 'BYUDJET',
            itemsCount: dto.items.length,
          },
        });
        if (stamp) {
          (result.officialDoc as any).stampId = stamp.id;
          (result.officialDoc as any).verificationUrl = stamp.verificationUrl;
          (result as any).stampId = stamp.id;
        }
      } catch (stampErr) {
        // Safe fallback
      }
    }

    if (this.eventsGateway?.server) {
      this.eventsGateway.server.emit('stock:updated', {
        action: 'INGEST',
        invoiceNumber: result.invoiceNumber,
        movementNumber: result.movementNumber,
        itemsCount: dto.items.length,
        warehouseId: dto.warehouseId,
        fundingSource: dto.fundingSource || 'BYUDJET',
      });
    }

    return result;
  }

  async getMovements(query?: { search?: string; type?: string; fundingSource?: string; page?: number | string; limit?: number | string }) {
    const where: any = {};
    if (query?.type && query.type !== 'ALL') {
      where.movementType = query.type as any;
    }
    if (query?.fundingSource && query.fundingSource !== 'ALL') {
      where.fundingSource = query.fundingSource as any;
    }
    if (query?.search) {
      where.OR = [
        { movementNumber: { contains: query.search, mode: 'insensitive' } },
        { referenceDoc: { contains: query.search, mode: 'insensitive' } },
        { executedBy: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const isPaginated = query?.page !== undefined || query?.limit !== undefined;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 25));
    const skip = (page - 1) * limit;

    const [movements, total] = isPaginated
      ? await this.prisma.$transaction([
          this.prisma.stockMovement.findMany({
            where,
            include: {
              executedBy: { select: { fullName: true } },
              supplier: { select: { name: true, inn: true } },
              fromWarehouse: true,
              toWarehouse: true,
              fromRoom: true,
              toRoom: true,
              items: { include: { item: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.stockMovement.count({ where }),
        ])
      : [
          await this.prisma.stockMovement.findMany({
            where,
            include: {
              executedBy: { select: { fullName: true } },
              supplier: { select: { name: true, inn: true } },
              fromWarehouse: true,
              toWarehouse: true,
              fromRoom: true,
              toRoom: true,
              items: { include: { item: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          0,
        ];

    const docNumbers = movements
      .map((m) => m.referenceDoc)
      .filter((doc): doc is string => Boolean(doc && doc.trim().length > 0));
    const movNumbers = movements.map((m) => m.movementNumber);

    const stamps = await this.prisma.documentStamp.findMany({
      where: {
        OR: [
          { docNumber: { in: docNumbers } },
          { docNumber: { in: movNumbers } },
        ],
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

    const mapped = movements.map((m) => {
      const firstItem = m.items[0];
      const itemSummary = firstItem
        ? `${firstItem.item.name} (${firstItem.quantity} ${firstItem.item.unit})${m.items.length > 1 ? ` va yana ${m.items.length - 1} ta` : ''}`
        : 'Mahsulotlar';

      const sourceLocation =
        m.supplier?.name ||
        m.fromWarehouse?.name ||
        (m.fromRoom ? `${m.fromRoom.number}-xona` : 'Bosh ombor');
      const targetLocation =
        m.toWarehouse?.name ||
        (m.toRoom ? `${m.toRoom.number}-xona (${m.toRoom.name})` : 'Taqsimot');

      const stamp = (m.referenceDoc ? stampMap.get(m.referenceDoc) : null) || stampMap.get(m.movementNumber);

      return {
        id: m.id,
        movementNumber: m.movementNumber,
        movementType: m.movementType,
        fundingSource: m.fundingSource,
        referenceDoc: m.referenceDoc || null,
        executedByName: m.executedBy?.fullName || 'Bosh omborchi',
        sourceLocation,
        targetLocation,
        createdAt: m.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        itemSummary,
        stamp: stamp
          ? {
              id: stamp.id,
              docNumber: stamp.docNumber,
              docType: stamp.docType,
              isValid: stamp.isValid,
              signerName: stamp.signerName,
              signerRole: stamp.signerRole,
            }
          : null,
        hasWormStamp: Boolean(stamp && stamp.isValid),
        items: m.items.map((it) => ({
          name: it.item.name,
          quantity: it.quantity,
          unit: it.item.unit,
        })),
      };
    });

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

  async transferBetweenWarehouses(dto: InterWarehouseTransferDto, executedById: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Chiqaruvchi va qabul qiluvchi omborxona bir xil bo‘lishi mumkin emas!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Check source stock with row-level lock (FOR UPDATE) to prevent concurrency races
      const lockedStocks = await tx.$queryRaw<
        Array<{
          id: string;
          quantity: number;
          fundingSource: string;
          warehouseName: string;
          itemName: string;
          itemUnit: string;
        }>
      >`
        SELECT s.id, s.quantity, s."fundingSource", w.name as "warehouseName", i.name as "itemName", i.unit as "itemUnit"
        FROM stocks s
        JOIN warehouses w ON s."warehouseId" = w.id
        JOIN items i ON s."itemId" = i.id
        WHERE s."warehouseId" = ${dto.fromWarehouseId} AND s."itemId" = ${dto.itemId}
        FOR UPDATE
      `;

      const sourceStock = lockedStocks[0];

      if (!sourceStock || sourceStock.quantity < dto.quantity) {
        throw new BadRequestException(
          `Jo‘natuvchi omborda yetarli qoldiq mavjud emas! Mavjud: ${sourceStock?.quantity ?? 0}, So‘ralgan: ${dto.quantity}`,
        );
      }

      const targetWh = await tx.warehouse.findUnique({ where: { id: dto.toWarehouseId } });
      if (!targetWh) {
        throw new NotFoundException('Qabul qiluvchi omborxona topilmadi!');
      }

      // 2. Decrement source stock atomically with row count validation (defense-in-depth)
      const updateCount = await tx.$executeRaw`
        UPDATE stocks
        SET quantity = quantity - ${dto.quantity}, "updatedAt" = NOW()
        WHERE id = ${sourceStock.id} AND quantity >= ${dto.quantity}
      `;

      if (updateCount === 0) {
        throw new BadRequestException(
          `Jo‘natuvchi omborda yetarli qoldiq mavjud emas! Parallel tranzaksiya tufayli qoldiq yetmadi.`,
        );
      }

      // 3. Increment / upsert target stock
      await tx.stock.upsert({
        where: {
          warehouseId_itemId_fundingSource: {
            warehouseId: dto.toWarehouseId,
            itemId: dto.itemId,
            fundingSource: sourceStock.fundingSource as any,
          },
        },
        update: {
          quantity: { increment: dto.quantity },
        },
        create: {
          warehouseId: dto.toWarehouseId,
          itemId: dto.itemId,
          quantity: dto.quantity,
          fundingSource: sourceStock.fundingSource as any,
        },
      });

      // 4. Create Movement record
      const movCount = await tx.stockMovement.count();
      const movNum = this.codeGen.generateMovementNumber(movCount + 1);

      const movement = await tx.stockMovement.create({
        data: {
          movementNumber: movNum,
          movementType: 'TRANSFER',
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          referenceDoc: `TRF-${movNum}`,
          note: dto.note || `Omborlararo ko‘chirish: ${sourceStock.warehouseName} -> ${targetWh.name}`,
          executedById,
          fundingSource: sourceStock.fundingSource as any,
        },
      });

      await tx.stockMovementItem.create({
        data: {
          movementId: movement.id,
          itemId: dto.itemId,
          quantity: dto.quantity,
          note: `Ko‘chirildi: ${dto.quantity} ${sourceStock.itemUnit}`,
        },
      });

      const transferResult = {
        success: true,
        movementNumber: movNum,
        transferredItem: sourceStock.itemName,
        quantity: dto.quantity,
        fromWarehouse: sourceStock.warehouseName,
        toWarehouse: targetWh.name,
      };

      return transferResult;
    });

    if (this.eventsGateway?.server) {
      this.eventsGateway.server.emit('stock:updated', {
        action: 'TRANSFER',
        movementNumber: result.movementNumber,
        itemId: dto.itemId,
        transferredItem: result.transferredItem,
        quantity: result.quantity,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
      });
    }

    return result;
  }

  /**
   * Domain-Driven: Safely and atomically deducts stock when a request is fulfilled.
   * Enforces row-level locking (FOR UPDATE), checks quantity, updates atomically,
   * creates OUTGOING StockMovement and movement items, and returns low-stock alerts.
   */
  async deductStockForRequest(
    request: {
      id: string;
      requestNumber: string;
      purpose: string;
      requesterId: string;
      fundingSource?: string | null;
      items: Array<{
        id: string;
        itemId: string;
        requestedQty: number;
        approvedQty?: number | null;
        item: { name: string; unit: string; minStockLimit: number };
      }>;
    },
    executorId: string,
    tx?: any,
  ): Promise<{
    movement: any;
    lowStockAlerts: Array<{ name: string; remainingQty: number; minLimit: number; unit: string }>;
  }> {
    const client = tx || this.prisma;
    const warehouse =
      (await client.warehouse.findFirst({ where: { isMain: true } })) ||
      (await client.warehouse.findFirst());

    if (!warehouse) {
      throw new NotFoundException('Tizimda asosiy ombor topilmadi!');
    }

    // 1. Qator darajasida bloklash (SELECT ... FOR UPDATE) va barcha mahsulotlar qoldig‘ini tekshirish
    const lockedStockEntries: Array<{
      stock: { id: string; quantity: number };
      reqItem: (typeof request.items)[0];
    }> = [];

    for (const reqItem of request.items) {
      const lockedStocks = await client.$queryRaw<
        Array<{ id: string; quantity: number }>
      >`
        SELECT id, quantity
        FROM stocks
        WHERE "warehouseId" = ${warehouse.id} AND "itemId" = ${reqItem.itemId}
        FOR UPDATE
      `;

      const stock = lockedStocks[0];

      if (!stock || stock.quantity < reqItem.requestedQty) {
        const currentQty = stock?.quantity ?? 0;
        throw new BadRequestException(
          `Omborda "${reqItem.item.name}" mahsulotidan yetarli qoldiq mavjud emas! Mavjud qoldiq: ${currentQty} ${reqItem.item.unit}, Talab qilingan: ${reqItem.requestedQty} ${reqItem.item.unit}. Operatsiya to‘xtatildi.`,
        );
      }

      lockedStockEntries.push({ stock, reqItem });
    }

    // 2. Chiqim harakati (StockMovement) jurnalini yaratish
    const movNum = this.sequenceService
      ? await this.sequenceService.nextMovementNumber(client)
      : this.codeGen.generateMovementNumber((await client.stockMovement.count()) + 1);

    const movement = await client.stockMovement.create({
      data: {
        movementNumber: movNum,
        movementType: 'OUTGOING',
        referenceDoc: request.requestNumber,
        note: `Talabnoma bo‘yicha tarqatildi: ${request.purpose}`,
        executedById: executorId,
        fromWarehouseId: warehouse.id,
      },
    });

    const lowStockAlerts: Array<{ name: string; remainingQty: number; minLimit: number; unit: string }> = [];

    // 3. Qoldiqlarni atomik kamaytirish
    for (const { stock, reqItem } of lockedStockEntries) {
      const updateCount = await client.$executeRaw`
        UPDATE stocks
        SET quantity = quantity - ${reqItem.requestedQty}, "updatedAt" = NOW()
        WHERE id = ${stock.id} AND quantity >= ${reqItem.requestedQty}
      `;

      if (updateCount === 0) {
        throw new BadRequestException(
          `Omborda "${reqItem.item.name}" mahsulotidan yetarli qoldiq mavjud emas! Parallel tranzaksiya tufayli qoldiq yetmadi.`,
        );
      }

      await client.stockMovementItem.create({
        data: {
          movementId: movement.id,
          itemId: reqItem.itemId,
          quantity: reqItem.requestedQty,
          note: `Berilgan miqdor: ${reqItem.requestedQty}`,
        },
      });

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

    if (this.eventsGateway?.server) {
      this.eventsGateway.server.emit('stock:updated', {
        action: 'DEDUCT',
        requestNumber: request.requestNumber,
        warehouseId: warehouse.id,
        itemsCount: request.items.length,
      });

      if (lowStockAlerts.length > 0) {
        for (const alert of lowStockAlerts) {
          const alertPayload = {
            itemName: alert.name,
            remainingQty: alert.remainingQty,
            minLimit: alert.minLimit,
            unit: alert.unit,
            message: `🚨 ${alert.name} kritik darajaga tushdi (${alert.remainingQty} ${alert.unit} qoldi)!`,
          };
          this.eventsGateway.emitToRole('HEAD_WAREHOUSE', 'stock:low_alert', alertPayload);
          this.eventsGateway.emitToRole('MOL', 'stock:low_alert', alertPayload);
          this.eventsGateway.emitToRole('SUPER_ADMIN', 'stock:low_alert', alertPayload);
          this.eventsGateway.server.emit('stock:low_alert', alertPayload);
        }
      }
    }

    return { movement, lowStockAlerts };
  }

  /**
   * Domain-Driven: Safely and atomically ingests procurement items into warehouse stock.
   * Atomically upserts stock records and creates INCOMING StockMovement and movement items.
   */
  async receiveStockForRequest(
    request: {
      id: string;
      requestNumber: string;
      purpose: string;
      requesterId: string;
      fundingSource?: string | null;
      items: Array<{
        id: string;
        itemId: string;
        requestedQty: number;
        approvedQty?: number | null;
        item?: { name: string; unit: string };
      }>;
    },
    executorId: string,
    tx?: any,
  ): Promise<any> {
    if (!request.items || request.items.length === 0) {
      return null;
    }

    const client = tx || this.prisma;
    const warehouse =
      (await client.warehouse.findFirst({ where: { isMain: true } })) ||
      (await client.warehouse.findFirst());

    if (!warehouse) {
      throw new NotFoundException('Tizimda asosiy ombor topilmadi!');
    }

    const fundingSource = (request.fundingSource || 'BYUDJET') as any;

    for (const reqItem of request.items) {
      const qty = reqItem.approvedQty || reqItem.requestedQty;
      await client.stock.upsert({
        where: {
          warehouseId_itemId_fundingSource: {
            warehouseId: warehouse.id,
            itemId: reqItem.itemId,
            fundingSource,
          },
        },
        update: {
          quantity: { increment: qty },
        },
        create: {
          warehouseId: warehouse.id,
          itemId: reqItem.itemId,
          quantity: qty,
          fundingSource,
        },
      });
    }

    const incomingMovNum = this.sequenceService
      ? await this.sequenceService.nextMovementNumber(client)
      : this.codeGen.generateMovementNumber((await client.stockMovement.count()) + 1);

    const movement = await client.stockMovement.create({
      data: {
        movementNumber: incomingMovNum,
        movementType: 'INCOMING',
        referenceDoc: request.requestNumber,
        note: `Xarid bo‘yicha ombor qabuli (OS-1): ${request.purpose}`,
        executedById: executorId,
        toWarehouseId: warehouse.id,
        fundingSource,
        items: {
          create: request.items.map((ri) => ({
            itemId: ri.itemId,
            quantity: ri.approvedQty || ri.requestedQty,
            note: `Omborga qabul qilindi: ${ri.approvedQty || ri.requestedQty}`,
          })),
        },
      },
    });

    if (this.eventsGateway?.server) {
      this.eventsGateway.server.emit('stock:updated', {
        action: 'RECEIVE_REQUEST',
        requestNumber: request.requestNumber,
        warehouseId: warehouse.id,
        itemsCount: request.items.length,
      });
    }

    return movement;
  }

  // ==================== WAREHOUSE CRUD ====================

  async getAllWarehouses(showDeleted?: boolean) {
    const where: any = showDeleted ? { deletedAt: { not: null } } : { deletedAt: null };
    return this.prisma.warehouse.findMany({
      where,
      include: {
        building: {
          select: { id: true, name: true, code: true, floorsCount: true },
        },
        manager: {
          select: { id: true, fullName: true, username: true, phone: true, role: true },
        },
        _count: {
          select: { stocks: true },
        },
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
  }

  async createWarehouse(dto: CreateWarehouseDto, executorId: string) {
    const nameTrimmed = dto.name.trim();

    // 1. Check unique name
    const nameConflict = await this.prisma.warehouse.findFirst({
      where: {
        name: { equals: nameTrimmed, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (nameConflict) {
      throw new ConflictException(`'${nameTrimmed}' nomli omborxona allaqachon mavjud`);
    }

    // 2. Check unique code if provided
    if (dto.code && dto.code.trim().length > 0) {
      const codeTrimmed = dto.code.trim().toUpperCase();
      const codeConflict = await this.prisma.warehouse.findUnique({
        where: { code: codeTrimmed },
      });
      if (codeConflict) {
        throw new ConflictException(`'${codeTrimmed}' kodli omborxona allaqachon mavjud`);
      }
    }

    // 3. Check building if provided
    if (dto.buildingId) {
      const building = await this.prisma.building.findUnique({
        where: { id: dto.buildingId },
      });
      if (!building) {
        throw new NotFoundException('Biriktirilayotgan bino topilmadi');
      }
    }

    // 4. Check manager if provided
    if (dto.managerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.managerId },
      });
      if (!user) {
        throw new NotFoundException('Ombor mudiri (foydalanuvchi) topilmadi');
      }
    }

    const warehouse = await this.prisma.$transaction(async (tx) => {
      // If marked as main, unset any other main warehouses
      if (dto.isMain) {
        await tx.warehouse.updateMany({
          where: { isMain: true },
          data: { isMain: false },
        });
      }

      return tx.warehouse.create({
        data: {
          name: nameTrimmed,
          code: dto.code ? dto.code.trim().toUpperCase() : null,
          buildingId: dto.buildingId || null,
          location: dto.location?.trim() || null,
          managerId: dto.managerId || null,
          isMain: dto.isMain ?? false,
        },
        include: {
          building: true,
          manager: {
            select: { id: true, fullName: true, username: true, phone: true },
          },
        },
      });
    });

    await this.systemAuditService.log({
      action: 'WAREHOUSE_CREATED',
      entity: 'Warehouse',
      entityId: warehouse.id,
      userId: executorId,
      details: {
        name: warehouse.name,
        code: warehouse.code,
        building: warehouse.building?.name,
        location: warehouse.location,
        isMain: warehouse.isMain,
      },
    });

    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, executorId: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Omborxona topilmadi');
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const nameConflict = await this.prisma.warehouse.findFirst({
        where: {
          id: { not: id },
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (nameConflict) {
        throw new ConflictException(`'${dto.name.trim()}' nomli boshqa ombor mavjud`);
      }
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeConflict = await this.prisma.warehouse.findFirst({
        where: {
          id: { not: id },
          code: dto.code.trim().toUpperCase(),
        },
      });
      if (codeConflict) {
        throw new ConflictException(`'${dto.code.trim().toUpperCase()}' kodli boshqa ombor mavjud`);
      }
    }

    if (dto.buildingId) {
      const b = await this.prisma.building.findUnique({ where: { id: dto.buildingId } });
      if (!b) throw new NotFoundException('Tanlangan bino topilmadi');
    }

    if (dto.managerId) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
      if (!u) throw new NotFoundException('Tanlangan ombor mudiri topilmadi');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.warehouse.updateMany({
          where: { id: { not: id }, isMain: true },
          data: { isMain: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? (dto.code ? dto.code.trim().toUpperCase() : null) : undefined,
          buildingId: dto.buildingId !== undefined ? dto.buildingId : undefined,
          location: dto.location !== undefined ? (dto.location ? dto.location.trim() : null) : undefined,
          managerId: dto.managerId !== undefined ? dto.managerId : undefined,
          isMain: dto.isMain !== undefined ? dto.isMain : undefined,
        },
        include: {
          building: true,
          manager: {
            select: { id: true, fullName: true, username: true, phone: true },
          },
        },
      });
    });

    await this.systemAuditService.log({
      action: 'WAREHOUSE_UPDATED',
      entity: 'Warehouse',
      entityId: id,
      userId: executorId,
      details: {
        changes: dto,
        targetName: updated.name,
      },
    });

    return updated;
  }

  async deleteWarehouse(id: string, executorId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: { where: { quantity: { gt: 0 } } },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Omborxona topilmadi');
    }

    if (warehouse.stocks.length > 0) {
      throw new BadRequestException(
        `Omborda ${warehouse.stocks.length} xil tovar qoldig‘i mavjud! Tovarlar qoldig‘i bo‘lgan omborni o‘chirib bo‘lmaydi. Avval tovarlarni boshqa omborga ko‘chiring`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.warehouse.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.systemAuditService.log({
      action: 'SOFT_DELETE',
      entity: 'Warehouse',
      entityId: id,
      userId: executorId,
      details: {
        deletedName: warehouse.name,
        code: warehouse.code,
      },
    });

    return {
      success: true,
      message: `'${warehouse.name}' omborxonasi muvaffaqiyatli o‘chirildi (Soft delete)`,
    };
  }

  async restoreWarehouse(id: string, executorId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('Omborxona topilmadi');
    }
    if (!warehouse.deletedAt) {
      throw new BadRequestException('Ushbu ombor o‘chirilmagan!');
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      return tx.warehouse.update({
        where: { id },
        data: { deletedAt: null },
      });
    });

    await this.systemAuditService.log({
      action: 'RESTORE',
      entity: 'Warehouse',
      entityId: id,
      userId: executorId,
      details: {
        name: warehouse.name,
        code: warehouse.code,
      },
    });

    return restored;
  }
}
