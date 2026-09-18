import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { RunDepreciationDto, PreviewDepreciationDto, DepreciationQueryDto } from './depreciation.dto';
import { Prisma } from '@prisma/client';

export interface DepreciationCalculationResult {
  assetId: string;
  inventoryNumber: string;
  itemName: string;
  categoryName: string;
  fundingSource: string;
  initialCost: number;
  openingBookValue: number;
  monthlyDepreciation: number;
  closingBookValue: number;
  accumulatedTotal: number;
  annualRate: number;
  isFullyDepreciated: boolean;
  isAlreadyDepreciatedInPeriod: boolean;
}

@Injectable()
export class DepreciationService implements OnModuleInit {
  private readonly logger = new Logger(DepreciationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly systemAudit: SystemAuditService,
  ) {}

  async onModuleInit() {
    this.logger.log('DepreciationEngine initialized. Checking periodic status...');
    try {
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const runForCurrentPeriod = await this.prisma.depreciationRun.findFirst({
        where: { period: currentPeriod },
      });
      if (!runForCurrentPeriod) {
        this.logger.log(
          `Depreciation notice: Current period [${currentPeriod}] has not been run yet. Ready for periodic trigger.`,
        );
      } else {
        this.logger.log(
          `Depreciation notice: Current period [${currentPeriod}] already processed (${runForCurrentPeriod.totalAssetsCount} assets).`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not check initial depreciation status: ${err?.message || err}`);
    }
  }

  /**
   * Dry-run / Ko‘rik (Preview) — Bazani o‘zgartirmagan holda oylik hisob-kitob natijasini prognoz qilish
   */
  async previewDepreciation(dto: PreviewDepreciationDto) {
    const { period, categoryIds } = dto;

    const whereClause: Prisma.ItemInstanceWhereInput = {
      item: {
        itemType: 'FIXED_ASSET',
        ...(categoryIds && categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      },
      status: { not: 'WRITTEN_OFF' },
    };

    const assets = await this.prisma.itemInstance.findMany({
      where: whereClause,
      include: {
        item: { include: { category: true } },
        room: true,
        responsibleUser: true,
      },
      orderBy: { inventoryNumber: 'asc' },
    });

    const existingRecords = await this.prisma.depreciationRecord.findMany({
      where: { period },
      select: { assetId: true },
    });
    const alreadyDepreciatedSet = new Set(existingRecords.map((r) => r.assetId));

    const calculations: DepreciationCalculationResult[] = [];
    let totalInitialCost = 0;
    let totalProjectedDepreciation = 0;
    let totalProjectedBookValue = 0;
    let alreadyDepreciatedCount = 0;
    let fullyDepreciatedCount = 0;
    let newlyEligibleCount = 0;

    for (const asset of assets) {
      const isAlreadyDone = alreadyDepreciatedSet.has(asset.id);
      if (isAlreadyDone) {
        alreadyDepreciatedCount++;
      }

      const initialCost = Number(asset.purchasePrice || 0);
      const openingBookValue =
        asset.currentBookValue !== null && asset.currentBookValue !== undefined
          ? Number(asset.currentBookValue)
          : initialCost;

      const rate = asset.depreciationRate || 20.0;
      const monthlyRate = (rate / 100) / 12;

      let monthlyDepreciation = 0;
      let closingBookValue = openingBookValue;
      let accumulatedTotal = Number(asset.accumulatedDepreciation || 0);
      const isFullyDepreciated = openingBookValue <= 0;

      if (isFullyDepreciated) {
        fullyDepreciatedCount++;
      } else if (!isAlreadyDone) {
        monthlyDepreciation = Math.min(openingBookValue, Math.round(initialCost * monthlyRate));
        closingBookValue = Math.max(0, openingBookValue - monthlyDepreciation);
        accumulatedTotal += monthlyDepreciation;
        newlyEligibleCount++;
        totalProjectedDepreciation += monthlyDepreciation;
      }

      totalInitialCost += initialCost;
      totalProjectedBookValue += closingBookValue;

      calculations.push({
        assetId: asset.id,
        inventoryNumber: asset.inventoryNumber,
        itemName: asset.item.name,
        categoryName: asset.item.category.name,
        fundingSource: asset.fundingSource,
        initialCost,
        openingBookValue,
        monthlyDepreciation,
        closingBookValue,
        accumulatedTotal,
        annualRate: rate,
        isFullyDepreciated,
        isAlreadyDepreciatedInPeriod: isAlreadyDone,
      });
    }

    return {
      period,
      totalAssetsCount: assets.length,
      alreadyDepreciatedCount,
      newlyEligibleCount,
      fullyDepreciatedCount,
      totalInitialCost,
      totalProjectedDepreciation,
      totalProjectedBookValue,
      items: calculations.slice(0, 200), // Return sample for preview UI
    };
  }

  /**
   * Oylik Amortizatsiyani Rasmiy Ishga Tushirish (Depreciation Run)
   * Tranzaksiya ichida har bir aktivning balans qiymati yangilanadi va jurnal yoziladi.
   */
  async runDepreciation(dto: RunDepreciationDto, executedById: string) {
    if (dto.dryRun) {
      return this.previewDepreciation(dto);
    }

    const { period, categoryIds, notes } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. OTM asosiy vositalarini saralash
      const whereClause: Prisma.ItemInstanceWhereInput = {
        item: {
          itemType: 'FIXED_ASSET',
          ...(categoryIds && categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
        },
        status: { not: 'WRITTEN_OFF' },
      };

      const assets = await tx.itemInstance.findMany({
        where: whereClause,
        include: {
          item: { include: { category: true } },
        },
        orderBy: { inventoryNumber: 'asc' },
      });

      if (assets.length === 0) {
        throw new BadRequestException('Amortizatsiya hisoblash uchun asosiy vositalar topilmadi!');
      }

      // 2. Ushbu davrda allaqachon hisoblangan aktivlarni aniqlash
      const existingRecords = await tx.depreciationRecord.findMany({
        where: { period },
        select: { assetId: true },
      });
      const alreadyDepreciatedSet = new Set(existingRecords.map((r) => r.assetId));

      const eligibleAssets = assets.filter((a) => !alreadyDepreciatedSet.has(a.id));

      if (eligibleAssets.length === 0) {
        throw new BadRequestException(
          `Ushbu davr (${period}) uchun barcha asosiy vositalar amortizatsiyasi allaqachon hisoblab bo‘lingan! Takroriy hisoblash qat’iyan man etiladi.`,
        );
      }

      // 3. Batch raqamini generatsiya qilish
      const runsCount = await tx.depreciationRun.count();
      const batchNumber = this.codeGen.generateDepreciationBatchNumber(period, runsCount + 1);

      // 4. DepreciationRun yaratish
      const run = await tx.depreciationRun.create({
        data: {
          batchNumber,
          period,
          status: 'COMPLETED',
          notes: notes || `${period} davri uchun reja bo‘yicha OTM oylik amortizatsiya hisobi`,
          executedById,
        },
      });

      let totalDepreciationAmount = 0;
      let totalBookValue = 0;
      const recordInserts: Prisma.DepreciationRecordCreateManyInput[] = [];

      // 5. Har bir aktiv bo‘yicha hisoblash va yangilash
      for (const asset of eligibleAssets) {
        const initialCost = Number(asset.purchasePrice || 0);
        const openingBookValue =
          asset.currentBookValue !== null && asset.currentBookValue !== undefined
            ? Number(asset.currentBookValue)
            : initialCost;

        const rate = asset.depreciationRate || 20.0;
        const monthlyRate = (rate / 100) / 12;

        let monthlyDepreciation = 0;
        let closingBookValue = openingBookValue;
        let accumulatedTotal = Number(asset.accumulatedDepreciation || 0);

        if (openingBookValue > 0) {
          monthlyDepreciation = Math.min(openingBookValue, Math.round(initialCost * monthlyRate));
          closingBookValue = Math.max(0, openingBookValue - monthlyDepreciation);
          accumulatedTotal += monthlyDepreciation;
        }

        totalDepreciationAmount += monthlyDepreciation;
        totalBookValue += closingBookValue;

        // ItemInstance ni yangilash
        await tx.itemInstance.update({
          where: { id: asset.id },
          data: {
            currentBookValue: new Prisma.Decimal(closingBookValue),
            accumulatedDepreciation: new Prisma.Decimal(accumulatedTotal),
            lastDepreciatedAt: new Date(),
          },
        });

        recordInserts.push({
          runId: run.id,
          assetId: asset.id,
          period,
          initialCost: new Prisma.Decimal(initialCost),
          openingBookValue: new Prisma.Decimal(openingBookValue),
          depreciationAmount: new Prisma.Decimal(monthlyDepreciation),
          closingBookValue: new Prisma.Decimal(closingBookValue),
          accumulatedTotal: new Prisma.Decimal(accumulatedTotal),
          annualRate: rate,
        });
      }

      // 6. Recordlarni ommaviy saqlash
      await tx.depreciationRecord.createMany({
        data: recordInserts,
      });

      // 7. Run yozuvidagi umumiy jami summalarni yangilash
      const updatedRun = await tx.depreciationRun.update({
        where: { id: run.id },
        data: {
          totalAssetsCount: eligibleAssets.length,
          totalDepreciationAmount: new Prisma.Decimal(totalDepreciationAmount),
          totalBookValue: new Prisma.Decimal(totalBookValue),
        },
      });

      // 8. Tizim audit jurnaliga yozish
      await this.systemAudit.log({
        userId: executedById,
        action: 'DEPRECIATION_RUN',
        entity: 'DepreciationRun',
        entityId: run.id,
        details: {
          batchNumber,
          period,
          assetsCount: eligibleAssets.length,
          totalDepreciationAmount,
          totalBookValue,
        },
      });

      return {
        success: true,
        message: `${period} davri uchun ${eligibleAssets.length} ta asosiy vosita amortizatsiyasi muvaffaqiyatli hisoblandi!`,
        run: {
          id: updatedRun.id,
          batchNumber: updatedRun.batchNumber,
          period: updatedRun.period,
          totalAssetsCount: updatedRun.totalAssetsCount,
          totalDepreciationAmount: Number(updatedRun.totalDepreciationAmount),
          totalBookValue: Number(updatedRun.totalBookValue),
          createdAt: updatedRun.createdAt,
        },
      };
    });
  }

  /**
   * O‘tgan hisob-kitob partiyalari ro‘yxatini olish (Paginatsiya bilan)
   */
  async getRuns(query: DepreciationQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DepreciationRunWhereInput = {};
    if (query.period) {
      where.period = query.period;
    }
    if (query.search) {
      where.OR = [
        { batchNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [runs, total] = await this.prisma.$transaction([
      this.prisma.depreciationRun.findMany({
        where,
        include: {
          executedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.depreciationRun.count({ where }),
    ]);

    return {
      data: runs.map((r) => ({
        id: r.id,
        batchNumber: r.batchNumber,
        period: r.period,
        totalAssetsCount: r.totalAssetsCount,
        totalDepreciationAmount: Number(r.totalDepreciationAmount),
        totalBookValue: Number(r.totalBookValue),
        status: r.status,
        notes: r.notes,
        executedByName: r.executedBy?.fullName || 'Tizim Avtomatik',
        executedByRole: r.executedBy?.role || 'SYSTEM',
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Bitta partiya tafsilotlari va uning ichidagi barcha aktivlar yozuvlari
   */
  async getRunDetails(id: string) {
    const run = await this.prisma.depreciationRun.findUnique({
      where: { id },
      include: {
        executedBy: { select: { id: true, fullName: true, role: true } },
        records: {
          include: {
            asset: {
              include: {
                item: { include: { category: true } },
                room: true,
                responsibleUser: true,
              },
            },
          },
          orderBy: { asset: { inventoryNumber: 'asc' } },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Amortizatsiya partiyasi topilmadi!');
    }

    return {
      id: run.id,
      batchNumber: run.batchNumber,
      period: run.period,
      totalAssetsCount: run.totalAssetsCount,
      totalDepreciationAmount: Number(run.totalDepreciationAmount),
      totalBookValue: Number(run.totalBookValue),
      status: run.status,
      notes: run.notes,
      executedByName: run.executedBy?.fullName || 'Tizim Avtomatik',
      createdAt: run.createdAt.toISOString(),
      records: run.records.map((rec) => ({
        id: rec.id,
        inventoryNumber: rec.asset.inventoryNumber,
        itemName: rec.asset.item.name,
        categoryName: rec.asset.item.category.name,
        roomName: rec.asset.room ? `${rec.asset.room.number}-xona: ${rec.asset.room.name}` : 'Ombor',
        responsibleUserName: rec.asset.responsibleUser?.fullName || 'Mas’ul biriktirilmagan',
        initialCost: Number(rec.initialCost),
        openingBookValue: Number(rec.openingBookValue),
        depreciationAmount: Number(rec.depreciationAmount),
        closingBookValue: Number(rec.closingBookValue),
        accumulatedTotal: Number(rec.accumulatedTotal),
        annualRate: rec.annualRate,
      })),
    };
  }

  /**
   * Bitta aktiv bo‘yicha oylar kesimidagi amortizatsiya tarixi (Asset Ledger)
   */
  async getAssetDepreciationHistory(assetId: string) {
    const asset = await this.prisma.itemInstance.findUnique({
      where: { id: assetId },
      include: {
        item: { include: { category: true } },
        room: true,
        responsibleUser: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asosiy vosita topilmadi!');
    }

    const records = await this.prisma.depreciationRecord.findMany({
      where: { assetId },
      include: {
        run: { select: { batchNumber: true, createdAt: true } },
      },
      orderBy: { period: 'asc' },
    });

    return {
      asset: {
        id: asset.id,
        inventoryNumber: asset.inventoryNumber,
        itemName: asset.item.name,
        categoryName: asset.item.category.name,
        purchasePrice: Number(asset.purchasePrice || 0),
        currentBookValue:
          asset.currentBookValue !== null ? Number(asset.currentBookValue) : Number(asset.purchasePrice || 0),
        accumulatedDepreciation: Number(asset.accumulatedDepreciation || 0),
        depreciationRate: asset.depreciationRate || 20.0,
        lastDepreciatedAt: asset.lastDepreciatedAt?.toISOString(),
      },
      history: records.map((r) => ({
        id: r.id,
        period: r.period,
        batchNumber: r.run.batchNumber,
        initialCost: Number(r.initialCost),
        openingBookValue: Number(r.openingBookValue),
        depreciationAmount: Number(r.depreciationAmount),
        closingBookValue: Number(r.closingBookValue),
        accumulatedTotal: Number(r.accumulatedTotal),
        calculatedAt: r.calculatedAt.toISOString(),
      })),
    };
  }

  /**
   * Davlat OTM rasmiy Amortizatsiya Qaydnomasi (Kategoriyalar va moliyalashtirish manbalari kesimida)
   */
  async getOfficialStatement(period: string) {
    const records = await this.prisma.depreciationRecord.findMany({
      where: { period },
      include: {
        asset: {
          include: {
            item: { include: { category: true } },
          },
        },
      },
      orderBy: { asset: { inventoryNumber: 'asc' } },
    });

    if (records.length === 0) {
      throw new NotFoundException(`"${period}" davri uchun amortizatsiya qaydlari topilmadi!`);
    }

    // Kategoriya bo'yicha guruhlash
    const categorySummaryMap = new Map<
      string,
      {
        categoryName: string;
        annualRate: number;
        count: number;
        initialCost: number;
        openingBookValue: number;
        depreciationAmount: number;
        closingBookValue: number;
        accumulatedTotal: number;
      }
    >();

    // Moliyalashtirish manbasi bo'yicha guruhlash
    const fundingSummaryMap = new Map<
      string,
      {
        fundingSource: string;
        count: number;
        initialCost: number;
        depreciationAmount: number;
        closingBookValue: number;
      }
    >();

    let grandInitialCost = 0;
    let grandOpeningBookValue = 0;
    let grandDepreciationAmount = 0;
    let grandClosingBookValue = 0;
    let grandAccumulatedTotal = 0;

    for (const rec of records) {
      const catName = rec.asset.item.category.name;
      const fs = rec.asset.fundingSource;

      const initCost = Number(rec.initialCost);
      const openVal = Number(rec.openingBookValue);
      const depAmt = Number(rec.depreciationAmount);
      const closeVal = Number(rec.closingBookValue);
      const accTot = Number(rec.accumulatedTotal);

      grandInitialCost += initCost;
      grandOpeningBookValue += openVal;
      grandDepreciationAmount += depAmt;
      grandClosingBookValue += closeVal;
      grandAccumulatedTotal += accTot;

      // Kategoriya
      const existingCat = categorySummaryMap.get(catName) || {
        categoryName: catName,
        annualRate: rec.annualRate,
        count: 0,
        initialCost: 0,
        openingBookValue: 0,
        depreciationAmount: 0,
        closingBookValue: 0,
        accumulatedTotal: 0,
      };
      existingCat.count += 1;
      existingCat.initialCost += initCost;
      existingCat.openingBookValue += openVal;
      existingCat.depreciationAmount += depAmt;
      existingCat.closingBookValue += closeVal;
      existingCat.accumulatedTotal += accTot;
      categorySummaryMap.set(catName, existingCat);

      // Moliyalashtirish
      const existingFs = fundingSummaryMap.get(fs) || {
        fundingSource: fs,
        count: 0,
        initialCost: 0,
        depreciationAmount: 0,
        closingBookValue: 0,
      };
      existingFs.count += 1;
      existingFs.initialCost += initCost;
      existingFs.depreciationAmount += depAmt;
      existingFs.closingBookValue += closeVal;
      fundingSummaryMap.set(fs, existingFs);
    }

    return {
      period,
      documentName: 'ASOSIY VOSITALAR AMORTIZATSIYASI VA ESKIRISHI QAYDNOMASI',
      standardRef: 'O‘zbekiston Respublikasi OTM Buxgalteriya Standarti (Teng me’yorli eskirish)',
      generatedDate: new Date().toLocaleDateString('uz-UZ'),
      totals: {
        totalAssets: records.length,
        initialCost: grandInitialCost,
        openingBookValue: grandOpeningBookValue,
        monthlyDepreciation: grandDepreciationAmount,
        closingBookValue: grandClosingBookValue,
        accumulatedDepreciation: grandAccumulatedTotal,
      },
      categorySummary: Array.from(categorySummaryMap.values()),
      fundingSummary: Array.from(fundingSummaryMap.values()),
    };
  }
}
