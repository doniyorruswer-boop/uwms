import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStatus, FundingSource } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(user?: any) {
    const now = new Date();

    const isDepartmentStaff = user?.role === 'MOL' || user?.role === 'EMPLOYEE';
    const isWarehouse = user?.role === 'HEAD_WAREHOUSE';
    const isCommendant = user?.role === 'COMMENDANT';

    const requestWhere: any = {};
    if (isDepartmentStaff && user) {
      if (user.departmentId) {
        requestWhere.OR = [{ departmentId: user.departmentId }, { requesterId: user.id }];
      } else {
        requestWhere.requesterId = user.id;
      }
    } else if (isWarehouse) {
      requestWhere.status = {
        in: [
          'FINANCED_BY_ACCOUNTANT',
          'RECEIVED_AT_WAREHOUSE',
          'APPROVED_BY_WAREHOUSE',
          'HANDED_TO_COMMENDANT',
          'FULFILLED',
        ],
      };
    } else if (isCommendant) {
      requestWhere.status = {
        in: ['RECEIVED_AT_WAREHOUSE', 'HANDED_TO_COMMENDANT', 'FULFILLED'],
      };
    }

    const pendingCountWhere: any = { status: 'PENDING' };
    if (isDepartmentStaff && user) {
      if (user.departmentId) {
        pendingCountWhere.OR = [{ departmentId: user.departmentId }, { requesterId: user.id }];
      } else {
        pendingCountWhere.requesterId = user.id;
      }
    }

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
              department: {
                select: {
                  id: true,
                  name: true,
                  parent: { select: { id: true, name: true } },
                },
              },
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
        where: pendingCountWhere,
      }),
      this.prisma.supplier.count(),
      this.prisma.stockMovement.findMany({
        take: 6,
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
        where: requestWhere,
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { fullName: true } },
          approvedBy: { select: { fullName: true, role: true, position: true } },
          department: { select: { name: true, type: true } },
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
      MISSING: 0,
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
      const dept = asset.room?.department;
      const deptName = dept?.name || 'Markaziy omborda';
      const facultyName = dept?.parent?.name || (dept ? 'Tegishli bo‘lim' : 'Markaziy bino');
      const deptKey = dept?.id || 'warehouse';
      const deptEntry = departmentMap.get(deptKey) || {
        id: deptKey,
        name: deptName,
        facultyName,
        count: 0,
        initialCost: 0,
        netBookValue: 0,
      };
      deptEntry.count += 1;
      deptEntry.initialCost += price;
      deptEntry.netBookValue += bookValue;
      departmentMap.set(deptKey, deptEntry);
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

    // Top Departments sorted by asset count and value
    const departmentsList = Array.from(departmentMap.values())
      .sort((a, b) => b.count - a.count || b.initialCost - a.initialCost)
      .slice(0, 20)
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
        userRole: user?.role || 'SUPER_ADMIN',
        userDepartmentId: user?.departmentId || null,
        userDepartmentAssetCount: user?.departmentId
          ? departmentMap.get(user.departmentId)?.count || 0
          : 0,
        userDepartmentBookValue: user?.departmentId
          ? departmentMap.get(user.departmentId)?.netBookValue || 0
          : 0,
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
      recentRequests: recentRequests.map((r) => {
        let approvalMethod = 'Tizim orqali';
        if (r.status === 'REJECTED') {
          approvalMethod = r.approvalNote ? `Rad etildi: ${r.approvalNote}` : 'Rad etilgan';
        } else if (r.status === 'APPROVED_BY_HEAD') {
          approvalMethod = r.approvalNote || 'Kafedra/Bo‘lim rahbari tasdiqlagan (Elektron viza)';
        } else if (r.status === 'APPROVED_BY_PRORECTOR') {
          approvalMethod = 'Moliya prorektori elektron vizasi (QR)';
        } else if (r.status === 'APPROVED_BY_RECTOR') {
          approvalMethod = 'Rektor raqamli tasdig‘i (QR)';
        } else if (r.status === 'FINANCED_BY_ACCOUNTANT') {
          approvalMethod = 'Bosh buxgalteriya moliyalashtirgan';
        } else if (r.status === 'RECEIVED_AT_WAREHOUSE' || r.status === 'APPROVED_BY_WAREHOUSE') {
          approvalMethod = 'Ombor qabul akti (OS-1)';
        } else if (r.status === 'HANDED_TO_COMMENDANT') {
          approvalMethod = 'Bino komendanti qabul nakladnoyi (OS-2)';
        } else if (r.status === 'FULFILLED') {
          approvalMethod = 'Xonada qabul qilingan (Topshirilgan)';
        } else if (r.status === 'PENDING' || r.status === 'SUBMITTED') {
          approvalMethod = 'Ko‘rib chiqish kutilmoqda';
        } else if (r.status === 'CANCELLED') {
          approvalMethod = 'Talabgor tomonidan bekor qilingan';
        }

        return {
          id: r.id,
          requestNumber: r.requestNumber,
          requesterName: r.requester?.fullName || 'Noma’lum xodim',
          departmentName: r.department?.name,
          purpose: r.purpose,
          status: r.status,
          approvalNote: r.approvalNote,
          approvedByName: r.approvedBy?.fullName,
          approvalMethod,
          createdAt: r.createdAt.toISOString().split('T')[0],
        };
      }),
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
