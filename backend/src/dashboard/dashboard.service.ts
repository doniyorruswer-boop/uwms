import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, FundingSource } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics() {
    const now = new Date();

    // 1. Fetch assets, stocks, requests, movements, suppliers, transfers, repairs, write-offs, and MOL counts
    const [
      assets,
      stocks,
      pendingRequestsCount,
      suppliersCount,
      recentMovements,
      recentRequests,
      pendingTransfersCount,
      activeRepairsCount,
      pendingWriteOffsCount,
      molsCount,
    ] = await Promise.all([
      this.prisma.itemInstance.findMany({
        select: {
          id: true,
          purchasePrice: true,
          purchaseDate: true,
          depreciationRate: true,
          currentBookValue: true,
          accumulatedDepreciation: true,
          status: true,
          fundingSource: true,
          createdAt: true,
          item: {
            select: {
              name: true,
              category: { select: { id: true, name: true } },
            },
          },
          room: {
            select: {
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.stock.findMany({
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              minStockLimit: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.request.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.supplier.count(),
      this.prisma.stockMovement.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          toWarehouse: { select: { name: true } },
          toRoom: { select: { name: true, number: true } },
          items: {
            include: {
              item: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.request.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { fullName: true } },
        },
      }),
      this.prisma.transferAcceptance.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.repairRecord.count({
        where: { status: { in: ['PENDING', 'IN_REPAIR'] } },
      }),
      this.prisma.writeOffRequest.count({
        where: { status: 'IN_REVIEW' },
      }),
      this.prisma.user.count({
        where: { role: 'MOL' },
      }),
    ]);

    // 2. Financial & Depreciation Engine (Amortizatsiya kalkulyatsiyasi)
    let totalInitialCost = 0;
    let totalDepreciated = 0;
    let totalNetBookValue = 0;

    // Funding source aggregates
    const fundingSources: Record<
      FundingSource,
      { count: number; initialCost: number; netBookValue: number }
    > = {
      BYUDJET: { count: 0, initialCost: 0, netBookValue: 0 },
      KONTRAKT_RIVOJLANTIRISH: { count: 0, initialCost: 0, netBookValue: 0 },
      GRANT: { count: 0, initialCost: 0, netBookValue: 0 },
    };

    // Category breakdown
    const categoryMap = new Map<
      string,
      { name: string; count: number; initialCost: number; netBookValue: number }
    >();

    // Department breakdown
    const departmentMap = new Map<
      string,
      { name: string; count: number; initialCost: number; netBookValue: number }
    >();

    // Status breakdown
    const statusCounts: Record<AssetStatus, number> = {
      NEW: 0,
      IN_USE: 0,
      IN_REPAIR: 0,
      WRITTEN_OFF: 0,
    };

    for (const asset of assets) {
      statusCounts[asset.status] = (statusCounts[asset.status] || 0) + 1;

      const price = asset.purchasePrice ? Number(asset.purchasePrice) : 0;
      totalInitialCost += price;

      // Depreciation calculation
      let depreciation = 0;
      let bookValue = price;

      if (asset.status === AssetStatus.WRITTEN_OFF) {
        depreciation = price;
        bookValue = 0;
      } else if (asset.currentBookValue !== null && asset.currentBookValue !== undefined) {
        bookValue = Number(asset.currentBookValue);
        depreciation = Number(asset.accumulatedDepreciation ?? Math.max(0, price - bookValue));
      } else {
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : asset.createdAt;
        const yearsDiff = Math.max(
          0,
          (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        );
        const rate = (asset.depreciationRate || 20.0) / 100;
        depreciation = Math.min(price, price * rate * yearsDiff);
        bookValue = Math.max(0, price - depreciation);
      }

      totalDepreciated += depreciation;
      totalNetBookValue += bookValue;

      // Funding Source
      const fs = asset.fundingSource || FundingSource.BYUDJET;
      if (fundingSources[fs]) {
        fundingSources[fs].count += 1;
        fundingSources[fs].initialCost += price;
        fundingSources[fs].netBookValue += bookValue;
      }

      // Category
      const catName = asset.item?.category?.name || 'Boshqa uskunalar';
      const catEntry = categoryMap.get(catName) || {
        name: catName,
        count: 0,
        initialCost: 0,
        netBookValue: 0,
      };
      catEntry.count += 1;
      catEntry.initialCost += price;
      catEntry.netBookValue += bookValue;
      categoryMap.set(catName, catEntry);

      // Department
      const deptName = asset.room?.department?.name || 'Markaziy omborda';
      const deptEntry = departmentMap.get(deptName) || {
        name: deptName,
        count: 0,
        initialCost: 0,
        netBookValue: 0,
      };
      deptEntry.count += 1;
      deptEntry.initialCost += price;
      deptEntry.netBookValue += bookValue;
      departmentMap.set(deptName, deptEntry);
    }

    // 3. Consumable Stock Metrics
    const totalStockUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
    const lowStockItems = stocks.filter((s) => s.quantity <= (s.item?.minStockLimit || 5));

    // 4. Funding Sources array with percentage
    const fundingSourcesList = Object.entries(fundingSources).map(([key, data]) => ({
      key,
      name:
        key === 'BYUDJET'
          ? 'Davlat Byudjeti'
          : key === 'KONTRAKT_RIVOJLANTIRISH'
          ? 'To‘lov-Kontrakt Jamg‘armasi'
          : 'Xalqaro & Ilmiy Grantlar',
      count: data.count,
      initialCost: Math.round(data.initialCost),
      netBookValue: Math.round(data.netBookValue),
      percentage:
        totalInitialCost > 0 ? Math.round((data.initialCost / totalInitialCost) * 100) : 0,
    }));

    // Categories sorted by value
    const categoriesList = Array.from(categoryMap.values())
      .sort((a, b) => b.initialCost - a.initialCost)
      .map((c) => ({
        ...c,
        percentage:
          totalInitialCost > 0 ? Math.round((c.initialCost / totalInitialCost) * 100) : 0,
      }));

    // Top Departments sorted by value
    const departmentsList = Array.from(departmentMap.values())
      .sort((a, b) => b.initialCost - a.initialCost)
      .slice(0, 6)
      .map((d) => ({
        ...d,
        percentage:
          totalInitialCost > 0 ? Math.round((d.initialCost / totalInitialCost) * 100) : 0,
      }));

    return {
      summary: {
        totalAssets: assets.length,
        totalInitialCost: Math.round(totalInitialCost),
        totalDepreciated: Math.round(totalDepreciated),
        totalNetBookValue: Math.round(totalNetBookValue),
        depreciationPercentage:
          totalInitialCost > 0 ? Math.round((totalDepreciated / totalInitialCost) * 100) : 0,
        totalStockUnits,
        lowStockCount: lowStockItems.length,
        pendingRequestsCount,
        pendingTransfersCount,
        activeRepairsCount,
        pendingWriteOffsCount,
        molsCount,
        suppliersCount,
        statusCounts,
      },
      needsAttention: {
        lowStockCount: lowStockItems.length,
        pendingRequestsCount,
        pendingTransfersCount,
        activeRepairsCount,
        pendingWriteOffsCount,
        totalAttentionItems:
          lowStockItems.length +
          pendingRequestsCount +
          pendingTransfersCount +
          activeRepairsCount +
          pendingWriteOffsCount,
      },
      fundingSources: fundingSourcesList,
      categories: categoriesList,
      departments: departmentsList,
      recentMovements: recentMovements.map((m) => {
        const itemsText = m.items.map((it) => it.item.name).join(', ') || 'Mahsulotlar';
        return {
          id: m.id,
          movementNumber: m.movementNumber,
          movementType: m.movementType,
          itemSummary: itemsText,
          targetLocation: m.toRoom
            ? `${m.toRoom.number}-xona (${m.toRoom.name})`
            : m.toWarehouse?.name || 'Markaziy Ombor',
          createdAt: m.createdAt.toISOString().split('T')[0],
        };
      }),
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        requesterName: r.requester?.fullName || 'Noma’lum xodim',
        purpose: r.purpose,
        status: r.status,
        createdAt: r.createdAt.toISOString().split('T')[0],
      })),
      lowStockItems: lowStockItems.map((s) => ({
        id: s.id,
        itemId: s.itemId,
        name: s.item.name,
        sku: s.item.sku,
        categoryName: s.item.category?.name || 'Sarf materiali',
        quantity: s.quantity,
        unit: s.item.unit,
        minLimit: s.item.minStockLimit,
        deficit: Math.max(0, s.item.minStockLimit - s.quantity),
        percentage: Math.min(100, Math.round((s.quantity / (s.item.minStockLimit || 1)) * 100)),
      })),
    };
  }
}
