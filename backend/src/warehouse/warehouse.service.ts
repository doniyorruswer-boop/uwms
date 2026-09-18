import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { IngestStockDto, InterWarehouseTransferDto } from './dto/warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(
    private prisma: PrismaService,
    private codeGen: CodeGeneratorService,
  ) {}

  async getStocks(query?: { search?: string; categoryId?: string; page?: number | string; limit?: number | string }) {
    const where: any = {};
    if (query?.categoryId && query.categoryId !== 'ALL') {
      where.item = { categoryId: query.categoryId };
    }
    if (query?.search) {
      where.OR = [
        { item: { name: { contains: query.search, mode: 'insensitive' } } },
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

  async replenishStock(stockId: string, amount: number, executedById?: string) {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findUnique({
        where: { id: stockId },
        include: { item: true, warehouse: true },
      });
      if (!stock) throw new NotFoundException('Tovar qoldig‘i topilmadi!');

      const updated = await tx.stock.update({
        where: { id: stockId },
        data: {
          quantity: { increment: amount },
        },
      });

      // Log movement journal with sequential number
      const movementCount = await tx.stockMovement.count();
      const movNum = this.codeGen.generateMovementNumber(movementCount + 1);

      const movement = await tx.stockMovement.create({
        data: {
          movementNumber: movNum,
          movementType: 'INCOMING',
          referenceDoc: 'Kirim dalolatnomasi',
          note: `Ombor zaxirasini to‘ldirish (+${amount} ${stock.item.unit})`,
          executedById: executedById || (await tx.user.findFirst({ where: { role: 'HEAD_WAREHOUSE' } }))!.id,
          toWarehouseId: stock.warehouseId,
          fundingSource: stock.fundingSource,
        },
      });

      await tx.stockMovementItem.create({
        data: {
          movementId: movement.id,
          itemId: stock.itemId,
          quantity: amount,
          note: 'Kirim qilindi',
        },
      });

      return {
        ...updated,
        status: updated.quantity <= stock.item.minStockLimit ? 'LOW' : 'NORMAL',
      };
    });
  }

  async ingestStock(dto: IngestStockDto & { executedById: string }) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Kirim qilish uchun kamida bitta mahsulot ko‘rsatilishi shart!');
    }

    return this.prisma.$transaction(async (tx) => {
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
      const invoiceCount = await tx.invoice.count();
      const invoiceNumber =
        dto.invoiceNumber?.trim() || this.codeGen.generateInvoiceNumber(invoiceCount + 1);

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

            const instance = await tx.itemInstance.create({
              data: {
                itemId: item.id,
                inventoryNumber: invNumber,
                serialNumber: serial,
                qrCode,
                status: 'NEW',
                fundingSource: dto.fundingSource || 'BYUDJET',
                purchasePrice: entry.purchasePrice || 0,
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

          docItems.push({
            inventoryNumber: this.codeGen.generateInventoryNumber(assetSeq - entry.quantity + 1),
            name: item.name,
            model: item.model || 'Standart',
            serialNumber: entry.serialNumbers?.[0] || '—',
            quantity: entry.quantity,
            unit: item.unit,
            price: entry.purchasePrice || 0,
          });
        } else {
          // Consumable stock replenishment
          const existingStock = await tx.stock.findUnique({
            where: {
              warehouseId_itemId: {
                warehouseId: warehouse!.id,
                itemId: item.id,
              },
            },
          });

          if (existingStock) {
            await tx.stock.update({
              where: { id: existingStock.id },
              data: {
                quantity: existingStock.quantity + entry.quantity,
                fundingSource: dto.fundingSource || existingStock.fundingSource,
              },
            });
          } else {
            await tx.stock.create({
              data: {
                warehouseId: warehouse!.id,
                itemId: item.id,
                quantity: entry.quantity,
                fundingSource: dto.fundingSource || 'BYUDJET',
              },
            });
          }

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
      const movNumber = this.codeGen.generateMovementNumber(movementCount + 1);
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
      const docNumber = this.codeGen.generateDocNumber('OS1', movementCount + 1);

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
  }

  async getMovements(query?: { search?: string; type?: string; page?: number | string; limit?: number | string }) {
    const where: any = {};
    if (query?.type && query.type !== 'ALL') {
      where.movementType = query.type as any;
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

      return {
        id: m.id,
        movementNumber: m.movementNumber,
        movementType: m.movementType,
        fundingSource: m.fundingSource,
        referenceDoc: m.referenceDoc || 'Ichki hujjat',
        executedByName: m.executedBy?.fullName || 'Bosh omborchi',
        sourceLocation,
        targetLocation,
        createdAt: m.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        itemSummary,
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

    return this.prisma.$transaction(async (tx) => {
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
          warehouseId_itemId: {
            warehouseId: dto.toWarehouseId,
            itemId: dto.itemId,
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

      return {
        success: true,
        movementNumber: movNum,
        transferredItem: sourceStock.itemName,
        quantity: dto.quantity,
        fromWarehouse: sourceStock.warehouseName,
        toWarehouse: targetWh.name,
      };
    });
  }
}
