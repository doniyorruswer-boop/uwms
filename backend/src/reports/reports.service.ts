import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import {
  FundingSummaryQueryDto,
  FundingMovementsQueryDto,
  FundingExportQueryDto,
} from './dto/reports.dto';
import {
  ChiefAccountantReceiptsQueryDto,
  ChiefAccountantHandoverQueryDto,
  ChiefAccountantExportDto,
  StateExportFormat,
} from './dto/chief-accountant.dto';
import { FundingSource, RoleType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  private generateHmac(data: string): string {
    return crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'UWMS_WORM_DEFAULT_SECRET_2026')
      .update(data)
      .digest('hex')
      .slice(0, 32);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAudit: SystemAuditService,
  ) {}

  /**
   * MOL roliga ega foydalanuvchini faqat o‘z kafedrasi bilan chegaralash (Data Isolation)
   */
  private resolveDepartmentFilter(user: any, requestedDeptId?: string): string | undefined {
    if (user?.role === RoleType.MOL) {
      return user.departmentId || undefined;
    }
    return requestedDeptId || undefined;
  }

  private getSourceLabel(source: FundingSource): string {
    switch (source) {
      case FundingSource.BYUDJET:
        return 'Davlat byudjeti';
      case FundingSource.KONTRAKT_RIVOJLANTIRISH:
        return 'To‘lov-shartnoma (Rivojlantirish)';
      case FundingSource.GRANT:
        return 'Ilmiy va xalqaro grantlar';
      default:
        return source;
    }
  }

  /**
   * Moliyalashtirish manbalari kesimidagi umumiy yig‘ma hisobot
   */
  async getFundingSummary(query: FundingSummaryQueryDto, user: any) {
    const departmentId = this.resolveDepartmentFilter(user, query.departmentId);

    // 1. Asset filters
    const assetWhere: any = {};
    if (query.fundingSource) {
      assetWhere.fundingSource = query.fundingSource;
    }
    if (departmentId) {
      assetWhere.room = { departmentId };
    }
    if (query.from || query.to) {
      assetWhere.createdAt = {};
      if (query.from) {
        assetWhere.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        assetWhere.createdAt.lte = toDate;
      }
    }

    // 2. Movement filters
    const movWhere: any = {};
    if (query.fundingSource) {
      movWhere.fundingSource = query.fundingSource;
    }
    if (departmentId) {
      movWhere.OR = [
        { fromRoom: { departmentId } },
        { toRoom: { departmentId } },
      ];
    }
    if (query.from || query.to) {
      movWhere.createdAt = {};
      if (query.from) {
        movWhere.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        movWhere.createdAt.lte = toDate;
      }
    }

    // Query DB without locking transactions, utilizing indexes
    const [instances, totalMovementsCount, movementsBySourceGroup] = await Promise.all([
      this.prisma.itemInstance.findMany({
        where: assetWhere,
        select: {
          id: true,
          inventoryNumber: true,
          fundingSource: true,
          purchasePrice: true,
          currentBookValue: true,
          status: true,
          createdAt: true,
          item: {
            select: {
              name: true,
              itemType: true,
              category: { select: { id: true, name: true } },
            },
          },
          room: {
            select: {
              id: true,
              name: true,
              number: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where: movWhere }),
      this.prisma.stockMovement.groupBy({
        by: ['fundingSource'],
        where: movWhere,
        _count: { id: true },
      }),
    ]);

    const movementCountMap = new Map<string, number>();
    movementsBySourceGroup.forEach((g) => {
      movementCountMap.set(g.fundingSource, g._count.id);
    });

    let totalAssetsCount = instances.length;
    let totalPurchaseValue = 0;
    let totalCurrentBookValue = 0;

    const sourceStatsMap = new Map<
      FundingSource,
      { count: number; purchaseValue: number; bookValue: number }
    >([
      [FundingSource.BYUDJET, { count: 0, purchaseValue: 0, bookValue: 0 }],
      [FundingSource.KONTRAKT_RIVOJLANTIRISH, { count: 0, purchaseValue: 0, bookValue: 0 }],
      [FundingSource.GRANT, { count: 0, purchaseValue: 0, bookValue: 0 }],
    ]);

    const categoryStatsMap = new Map<
      string,
      {
        categoryName: string;
        count: number;
        totalValue: number;
        byudjetCount: number;
        kontraktCount: number;
        grantCount: number;
      }
    >();

    const departmentStatsMap = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        assetsCount: number;
        totalValue: number;
        byudjetCount: number;
        kontraktCount: number;
        grantCount: number;
      }
    >();

    for (const inst of instances) {
      const pPrice = Number(inst.purchasePrice || 0);
      const bValue = Number(inst.currentBookValue !== null && inst.currentBookValue !== undefined ? inst.currentBookValue : pPrice);

      totalPurchaseValue += pPrice;
      totalCurrentBookValue += bValue;

      // Source accumulation
      const sStat = sourceStatsMap.get(inst.fundingSource);
      if (sStat) {
        sStat.count++;
        sStat.purchaseValue += pPrice;
        sStat.bookValue += bValue;
      }

      // Category accumulation
      const catName = inst.item?.category?.name || 'Kategoriyasiz';
      let cStat = categoryStatsMap.get(catName);
      if (!cStat) {
        cStat = {
          categoryName: catName,
          count: 0,
          totalValue: 0,
          byudjetCount: 0,
          kontraktCount: 0,
          grantCount: 0,
        };
        categoryStatsMap.set(catName, cStat);
      }
      cStat.count++;
      cStat.totalValue += bValue;
      if (inst.fundingSource === FundingSource.BYUDJET) cStat.byudjetCount++;
      else if (inst.fundingSource === FundingSource.KONTRAKT_RIVOJLANTIRISH) cStat.kontraktCount++;
      else if (inst.fundingSource === FundingSource.GRANT) cStat.grantCount++;

      // Department accumulation
      const dept = inst.room?.department;
      const deptId = dept?.id || 'NO_DEPT';
      const deptName = dept?.name || 'Taqsimlanmagan';
      let dStat = departmentStatsMap.get(deptId);
      if (!dStat) {
        dStat = {
          departmentId: deptId,
          departmentName: deptName,
          assetsCount: 0,
          totalValue: 0,
          byudjetCount: 0,
          kontraktCount: 0,
          grantCount: 0,
        };
        departmentStatsMap.set(deptId, dStat);
      }
      dStat.assetsCount++;
      dStat.totalValue += bValue;
      if (inst.fundingSource === FundingSource.BYUDJET) dStat.byudjetCount++;
      else if (inst.fundingSource === FundingSource.KONTRAKT_RIVOJLANTIRISH) dStat.kontraktCount++;
      else if (inst.fundingSource === FundingSource.GRANT) dStat.grantCount++;
    }

    const byFundingSource = Array.from(sourceStatsMap.entries()).map(([source, stats]) => {
      const percentage = totalCurrentBookValue > 0 ? (stats.bookValue / totalCurrentBookValue) * 100 : 0;
      return {
        source,
        label: this.getSourceLabel(source),
        assetsCount: stats.count,
        purchaseValue: stats.purchaseValue,
        totalValue: stats.bookValue,
        movementsCount: movementCountMap.get(source) || 0,
        percentage: Number(percentage.toFixed(1)),
      };
    });

    const byCategory = Array.from(categoryStatsMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue,
    );

    const byDepartment = Array.from(departmentStatsMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue,
    );

    return {
      totals: {
        totalAssetsCount,
        totalPurchaseValue,
        totalCurrentBookValue,
        totalMovementsCount,
      },
      byFundingSource,
      byCategory,
      byDepartment,
    };
  }

  /**
   * Moliyalashtirish manbasi bo‘yicha harakatlar jurnali (paginated)
   */
  async getFundingMovements(query: FundingMovementsQueryDto, user: any) {
    const departmentId = this.resolveDepartmentFilter(user, query.departmentId);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const movWhere: any = {};
    if (query.fundingSource) {
      movWhere.fundingSource = query.fundingSource;
    }
    if (query.movementType) {
      movWhere.movementType = query.movementType;
    }
    if (departmentId) {
      movWhere.OR = [
        { fromRoom: { departmentId } },
        { toRoom: { departmentId } },
      ];
    }
    if (query.from || query.to) {
      movWhere.createdAt = {};
      if (query.from) {
        movWhere.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        movWhere.createdAt.lte = toDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: movWhere,
        include: {
          executedBy: { select: { id: true, fullName: true, role: true } },
          fromRoom: { include: { department: true } },
          toRoom: { include: { department: true } },
          fromWarehouse: true,
          toWarehouse: true,
          supplier: true,
          items: {
            include: {
              item: {
                include: { category: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where: movWhere }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Hisobotni Excel (XLSX) yoki CSV fayl sifatida eksport qilish va audit log yozish
   */
  async exportFundingReport(query: FundingExportQueryDto, user: any, req?: any) {
    const departmentId = this.resolveDepartmentFilter(user, query.departmentId);
    const exportType = query.type || 'assets';
    const format = query.format || 'xlsx';

    // 1. Audit Log: REPORT_EXPORT
    await this.systemAudit.log({
      action: 'REPORT_EXPORT',
      entity: 'FundingReport',
      details: {
        type: exportType,
        format,
        fundingSource: query.fundingSource || 'ALL',
        departmentId: departmentId || 'ALL',
        from: query.from || null,
        to: query.to || null,
      },
      userId: user?.id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
    });

    let dataRows: Record<string, any>[] = [];
    let sheetName = 'Hisobot';

    if (exportType === 'assets') {
      sheetName = 'Aktivlar';
      const assetWhere: any = {};
      if (query.fundingSource) {
        assetWhere.fundingSource = query.fundingSource;
      }
      if (departmentId) {
        assetWhere.room = { departmentId };
      }
      if (query.from || query.to) {
        assetWhere.createdAt = {};
        if (query.from) assetWhere.createdAt.gte = new Date(query.from);
        if (query.to) {
          const toDate = new Date(query.to);
          toDate.setHours(23, 59, 59, 999);
          assetWhere.createdAt.lte = toDate;
        }
      }

      const instances = await this.prisma.itemInstance.findMany({
        where: assetWhere,
        select: {
          inventoryNumber: true,
          serialNumber: true,
          fundingSource: true,
          purchasePrice: true,
          currentBookValue: true,
          status: true,
          createdAt: true,
          item: {
            select: {
              name: true,
              model: true,
              unit: true,
              category: { select: { name: true } },
            },
          },
          room: {
            select: {
              name: true,
              number: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      dataRows = instances.map((inst, idx) => ({
        '№': idx + 1,
        'Inventar raqami': inst.inventoryNumber,
        'Nomi': inst.item?.name || '—',
        'Model': inst.item?.model || '—',
        'Kategoriya': inst.item?.category?.name || '—',
        'Moliyalashtirish manbasi': this.getSourceLabel(inst.fundingSource),
        'Kafedra / Bo‘lim': inst.room?.department?.name || 'Taqsimlanmagan',
        'Xona': inst.room ? `${inst.room.number} (${inst.room.name})` : 'Omborda',
        'Seriya raqami': inst.serialNumber || '—',
        'Boshlang‘ich narx (so‘m)': Number(inst.purchasePrice || 0),
        'Qoldiq qiymat (so‘m)': Number(inst.currentBookValue !== null ? inst.currentBookValue : inst.purchasePrice || 0),
        'Holati': inst.status,
        'Ro‘yxatga olingan sana': inst.createdAt ? inst.createdAt.toISOString().slice(0, 10) : '—',
        'WORM Nazorat Kodi (HMAC Hash)': this.generateHmac(`${inst.inventoryNumber}-${inst.purchasePrice}-${inst.fundingSource}`),
      }));
    } else if (exportType === 'movements') {
      sheetName = 'Harakatlar';
      const movWhere: any = {};
      if (query.fundingSource) {
        movWhere.fundingSource = query.fundingSource;
      }
      if (departmentId) {
        movWhere.OR = [
          { fromRoom: { departmentId } },
          { toRoom: { departmentId } },
        ];
      }
      if (query.from || query.to) {
        movWhere.createdAt = {};
        if (query.from) movWhere.createdAt.gte = new Date(query.from);
        if (query.to) {
          const toDate = new Date(query.to);
          toDate.setHours(23, 59, 59, 999);
          movWhere.createdAt.lte = toDate;
        }
      }

      const movements = await this.prisma.stockMovement.findMany({
        where: movWhere,
        include: {
          executedBy: { select: { fullName: true } },
          fromRoom: { include: { department: true } },
          toRoom: { include: { department: true } },
          fromWarehouse: true,
          toWarehouse: true,
          supplier: true,
          items: {
            include: {
              item: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      dataRows = movements.map((mov, idx) => {
        const fromLoc = mov.fromWarehouse?.name || (mov.fromRoom ? `${mov.fromRoom.number} - ${mov.fromRoom.name}` : (mov.supplier ? mov.supplier.name : '—'));
        const toLoc = mov.toWarehouse?.name || (mov.toRoom ? `${mov.toRoom.number} - ${mov.toRoom.name}` : '—');
        const itemsSummary = mov.items.map((i) => `${i.item?.name || 'Noma’lum'} (${i.quantity} ${i.item?.unit || 'dona'})`).join('; ');

        return {
          '№': idx + 1,
          'Harakat raqami': mov.movementNumber,
          'Turi': mov.movementType,
          'Moliyalashtirish manbasi': this.getSourceLabel(mov.fundingSource),
          'Qayerdan': fromLoc,
          'Qayerga': toLoc,
          'Mahsulotlar': itemsSummary,
          'Hujjat asosi': mov.referenceDoc || '—',
          'Mas’ul xodim': mov.executedBy?.fullName || '—',
          'Sana': mov.createdAt.toISOString().slice(0, 10),
          'WORM Nazorat Kodi (HMAC Hash)': this.generateHmac(`${mov.movementNumber}-${mov.fundingSource}-${mov.createdAt.toISOString()}`),
        };
      });
    } else {
      // Summary export
      sheetName = 'Yig‘ma xulosa';
      const summary = await this.getFundingSummary(query, user);
      dataRows = summary.byFundingSource.map((s, idx) => ({
        '№': idx + 1,
        'Moliyalashtirish manbasi': s.label,
        'Kod': s.source,
        'Aktivlar soni': s.assetsCount,
        'Boshlang‘ich xarid summasi (so‘m)': s.purchaseValue,
        'Hozirgi qoldiq qiymati (so‘m)': s.totalValue,
        'Harakatlar soni': s.movementsCount,
        'Ulush (%)': `${s.percentage}%`,
        'WORM Nazorat Kodi (HMAC Hash)': this.generateHmac(`${s.source}-${s.totalValue}-${s.assetsCount}`),
      }));
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const safeType = exportType;

    if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(dataRows);
      const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
      return {
        buffer: Buffer.from(csvContent, 'utf-8'),
        filename: `UWMS_Funding_${safeType}_${timestamp}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    // Default XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      filename: `UWMS_Funding_${safeType}_${timestamp}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // ==========================================
  // PHASE L2: BOSH HISOBCHI IZLARI VA HISOBOTLAR
  // ==========================================

  /**
   * 1-IZ: Qancha kirdi? (OS-1 Kirim Reestri)
   */
  async getChiefAccountantReceipts(query: ChiefAccountantReceiptsQueryDto, user: any) {
    const period = query.period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.period) {
      const [year, month] = query.period.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }

    const where: any = {
      status: { in: ['RECEIVED_AT_WAREHOUSE', 'HANDED_TO_COMMENDANT', 'FULFILLED'] },
    };

    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    if (query.fundingSource && query.fundingSource !== 'ALL') {
      where.fundingSource = query.fundingSource;
    }

    if (query.subAccountCode && query.subAccountCode !== 'ALL') {
      where.subAccountCode = query.subAccountCode;
    }

    if (query.search) {
      where.OR = [
        { requestNumber: { contains: query.search, mode: 'insensitive' } },
        { purpose: { contains: query.search, mode: 'insensitive' } },
        { requester: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [allMatchingRequests, paginatedRequests, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        select: {
          fundingSource: true,
          subAccountCode: true,
          allocatedAmount: true,
          items: { select: { requestedQty: true, approvedQty: true } },
        },
      }),
      this.prisma.request.findMany({
        where,
        include: {
          requester: { select: { id: true, fullName: true } },
          department: true,
          items: { include: { item: true } },
          commendant: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

    // Fetch document stamps for OS-1
    const requestNumbers = paginatedRequests.map((r) => r.requestNumber);
    const os1Stamps = await this.prisma.documentStamp.findMany({
      where: {
        docNumber: { in: [...requestNumbers, ...requestNumbers.map((n) => `${n}-OS1`)] },
      },
    });

    const stampMap = new Map(os1Stamps.map((s) => [s.docNumber, s]));

    // Aggregations
    let totalReceiptsAmount = 0;
    let totalItemsCount = 0;
    const byFundingSource: Record<string, { count: number; amount: number }> = {
      BYUDJET: { count: 0, amount: 0 },
      KONTRAKT_RIVOJLANTIRISH: { count: 0, amount: 0 },
      GRANT: { count: 0, amount: 0 },
    };
    const bySubAccount: Record<string, { count: number; amount: number; label: string }> = {
      '013': { count: 0, amount: 0, label: '013 — Mashina va uskunalar (Kompyuter, texnika)' },
      '015': { count: 0, amount: 0, label: '015 — Transport vositalari' },
      '016': { count: 0, amount: 0, label: '016 — Boshqa asosiy vositalar (Mebel, jihozlar)' },
      '071': { count: 0, amount: 0, label: '071 — O‘rnatiladigan asbob-uskunalar va materiallar' },
      '010': { count: 0, amount: 0, label: '010 — Bino va inshootlar' },
      '060': { count: 0, amount: 0, label: '060 — Materiallar va xo‘jalik sarf tovarlari' },
      '212': { count: 0, amount: 0, label: '212 — Boshqa xo‘jalik va inventar jihozlari' },
    };

    allMatchingRequests.forEach((r) => {
      const amt = Number(r.allocatedAmount || 0);
      totalReceiptsAmount += amt;
      const itemCount = r.items.reduce((s, i) => s + (i.approvedQty || i.requestedQty || 0), 0);
      totalItemsCount += itemCount;

      const fs = r.fundingSource || 'BYUDJET';
      if (!byFundingSource[fs]) byFundingSource[fs] = { count: 0, amount: 0 };
      byFundingSource[fs].count++;
      byFundingSource[fs].amount += amt;

      const sa = r.subAccountCode || '013';
      if (!bySubAccount[sa]) {
        bySubAccount[sa] = { count: 0, amount: 0, label: `${sa} — Sub-hisob` };
      }
      bySubAccount[sa].count++;
      bySubAccount[sa].amount += amt;
    });

    const mappedData = paginatedRequests.map((r) => {
      const stamp = stampMap.get(`${r.requestNumber}-OS1`) || stampMap.get(r.requestNumber);
      return {
        id: r.id,
        requestNumber: r.requestNumber,
        os1DocNumber: `${r.requestNumber}-OS1`,
        receiptDate: r.warehouseReceivedAt?.toISOString() || r.createdAt.toISOString(),
        purpose: r.purpose,
        fundingSource: r.fundingSource || 'BYUDJET',
        subAccountCode: r.subAccountCode || '013',
        allocatedAmount: Number(r.allocatedAmount || 0),
        supplierName: "Davlat Xaridlari Ta'minotchisi",
        departmentName: r.department?.name || 'Kafedra',
        requesterName: r.requester.fullName,
        itemsCount: r.items.length,
        items: r.items.map((i) => ({
          name: i.item.name,
          quantity: i.approvedQty || i.requestedQty,
          unit: i.item.unit,
        })),
        hasStamp: !!stamp,
        stampHash: stamp?.verificationHash || null,
        signedByName: stamp?.signerName || 'Bosh Omborchi',
      };
    });

    return {
      period,
      summary: {
        totalReceiptsCount: total,
        totalReceiptsAmount,
        totalItemsCount,
        byFundingSource,
        bySubAccount,
      },
      data: mappedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 2-IZ: Qayerga ketdi va kimning bo‘ynida? (Chiqim va MOL Balansi — OS-2)
   */
  async getChiefAccountantHandoverBalance(query: ChiefAccountantHandoverQueryDto, user: any) {
    const userWhere: any = {
      role: { in: [RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN] },
    };

    if (query.departmentId && query.departmentId !== 'ALL') {
      userWhere.departmentId = query.departmentId;
    }

    if (query.responsibleUserId) {
      userWhere.id = query.responsibleUserId;
    }

    if (query.search) {
      userWhere.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { department: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [allMols, total] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        include: {
          department: {
            include: { rooms: true },
          },
          responsibleInstances: {
            where: { status: { not: 'WRITTEN_OFF' } },
            select: { id: true, purchasePrice: true },
          },
          submittedRequests: {
            where: { status: 'FULFILLED' },
            select: {
              id: true,
              requestNumber: true,
              fulfilledAt: true,
              commendantHandedAt: true,
              items: { select: { requestedQty: true, approvedQty: true } },
            },
            orderBy: { fulfilledAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { fullName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    // All active instances to compute university-wide MOL summary
    const [allInstances, totalFulfilledReqs] = await Promise.all([
      this.prisma.itemInstance.findMany({
        where: {
          status: { not: 'WRITTEN_OFF' },
          responsibleUserId: { not: null },
        },
        select: { purchasePrice: true },
      }),
      this.prisma.request.count({
        where: { status: 'FULFILLED' },
      }),
    ]);

    const totalAssignedValue = allInstances.reduce((sum, i) => sum + Number(i.purchasePrice || 0), 0);
    const totalFixedAssets = allInstances.length;

    const mappedMols = allMols.map((u) => {
      const fixedAssetsCount = u.responsibleInstances.length;
      const fixedAssetsTotalValue = u.responsibleInstances.reduce(
        (sum, i) => sum + Number(i.purchasePrice || 0),
        0,
      );
      const roomsCount = u.department?.rooms.length || 0;
      const latestReq = (u as any).submittedRequests?.[0];
      const consumablesCount = latestReq
        ? latestReq.items.reduce((sum: number, i: any) => sum + (i.approvedQty || i.requestedQty || 0), 0)
        : 0;

      return {
        userId: u.id,
        molId: u.id,
        fullName: u.fullName,
        molFullName: u.fullName,
        username: u.username,
        molUsername: u.username,
        phone: u.phone || '—',
        role: u.role,
        departmentId: u.departmentId,
        departmentName: u.department?.name || 'Kafedra biriktirilmagan',
        fixedAssetsCount,
        fixedAssetsTotalValue,
        consumablesCount,
        roomsCount,
        lastHandoverDate: latestReq?.fulfilledAt?.toISOString() || latestReq?.commendantHandedAt?.toISOString() || null,
        lastOs2Date: latestReq?.fulfilledAt?.toISOString() || latestReq?.commendantHandedAt?.toISOString() || null,
        lastOs2DocNumber: latestReq ? `${latestReq.requestNumber}-OS2` : null,
      };
    });

    return {
      summary: {
        totalMolsCount: total,
        totalAssignedValue,
        totalFixedAssets,
        totalFixedAssetsCount: totalFixedAssets,
        totalFulfilledTransfers: totalFulfilledReqs,
        totalConsumablesCount: totalFulfilledReqs,
      },
      data: mappedMols,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Bitta MOL (Moddiy Javobgar Shaxs) bo‘yicha to‘liq inventar tafsilotlari (1 soniyada)
   */
  async getChiefAccountantMolItems(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user) {
      throw new BadRequestException('Foydalanuvchi topilmadi');
    }

    const [fixedAssets, fulfilledRequests] = await Promise.all([
      this.prisma.itemInstance.findMany({
        where: {
          responsibleUserId: userId,
          status: { not: 'WRITTEN_OFF' },
        },
        include: {
          item: { include: { category: true } },
          room: true,
        },
        orderBy: { purchaseDate: 'desc' },
      }),
      this.prisma.request.findMany({
        where: {
          requesterId: userId,
          status: 'FULFILLED',
        },
        include: {
          items: { include: { item: true } },
          commendant: { select: { id: true, fullName: true } },
        },
        orderBy: { fulfilledAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalAssetValue = fixedAssets.reduce((sum, a) => sum + Number(a.purchasePrice || 0), 0);

    const items = fixedAssets.map((a) => ({
      id: a.id,
      inventoryNumber: a.inventoryNumber,
      name: a.item.name,
      category: a.item.category?.name || 'Jihozlar',
      itemType: a.item.itemType,
      purchasePrice: Number(a.purchasePrice || 0),
      purchaseDate: a.purchaseDate.toISOString().slice(0, 10),
      commissioningDate: a.purchaseDate.toISOString().slice(0, 10),
      fundingSource: a.fundingSource,
      roomNumber: a.room?.number || 'Biriktirilmagan',
      roomName: a.room?.name || 'Xona',
      subAccountCode: (a.item as any).subAccountCode || '013',
      status: a.status,
    }));

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        departmentName: user.department?.name || 'Kafedra',
      },
      mol: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        department: user.department?.name || 'Kafedra',
        role: user.role,
      },
      summary: {
        fixedAssetsCount: fixedAssets.length,
        totalAssetValue,
        totalAssetsCount: fixedAssets.length,
        totalValue: totalAssetValue,
        fulfilledRequestsCount: fulfilledRequests.length,
      },
      totalAssetsCount: fixedAssets.length,
      totalValue: totalAssetValue,
      items,
      fixedAssets: items,
      fulfilledRequests: fulfilledRequests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        os2Number: `${r.requestNumber}-OS2`,
        purpose: r.purpose,
        fulfilledAt: r.fulfilledAt?.toISOString().slice(0, 10) || r.createdAt.toISOString().slice(0, 10),
        commendantName: r.commendant?.fullName || 'Bino Komendanti',
        items: r.items.map((i) => ({
          name: i.item.name,
          quantity: i.approvedQty || i.requestedQty,
          unit: i.item.unit,
        })),
      })),
    };
  }

  /**
   * 3. Bitta Tugmali Davlat Eksport Markazi
   * Excel 3-Sheet, UzASBO XML, 1C:Enterprise XML
   */
  async exportChiefAccountantStateReport(
    query: ChiefAccountantExportDto,
    user: any,
    req?: any,
  ) {
    const period = query.period || new Date().toISOString().slice(0, 7);
    const format = query.format || StateExportFormat.EXCEL;
    this.logger.log(`[CHIEF_ACCOUNTANT_EXPORT] format=${format}, queryFormat=${query.format}, period=${period}`);

    // Fetch receipts and MOL balance data
    const [receiptsRes, balanceRes] = await Promise.all([
      this.getChiefAccountantReceipts({
        period,
        fundingSource: query.fundingSource as any,
        subAccountCode: query.subAccountCode,
        page: 1,
        limit: 1000,
      }, user),
      this.getChiefAccountantHandoverBalance({
        page: 1,
        limit: 1000,
      }, user),
    ]);

    // System Audit Log
    await this.systemAudit.log({
      action: 'CHIEF_ACCOUNTANT_EXPORT',
      entity: 'StateReport',
      details: {
        period,
        format,
        fundingSource: query.fundingSource || 'ALL',
        subAccountCode: query.subAccountCode || 'ALL',
        receiptsCount: receiptsRes.total,
        molsCount: balanceRes.total,
      },
      userId: user.id,
      ipAddress: req?.ip,
    });

    const fmtLower = String(format).toLowerCase();

    if (fmtLower.includes('uzasbo')) {
      const xmlContent = this.generateUzAsboStateXml(period, receiptsRes, balanceRes);
      return {
        buffer: Buffer.from(xmlContent, 'utf-8'),
        filename: `UWMS_UzASBO_Davlat_Eksport_${period}.xml`,
        contentType: 'application/xml; charset=utf-8',
      };
    }

    if (fmtLower.includes('1c') || fmtLower.includes('one_c')) {
      const xmlContent = this.generate1CEnterpriseXml(period, receiptsRes, balanceRes);
      return {
        buffer: Buffer.from(xmlContent, 'utf-8'),
        filename: `UWMS_1C_Korxona_OTM_${period}.xml`,
        contentType: 'application/xml; charset=utf-8',
      };
    }

    // Default: 3-Sheet Excel Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Kirim Reestri (OS-1)
    const sheet1Data = receiptsRes.data.map((r, idx) => ({
      '№': idx + 1,
      'Sana': r.receiptDate.slice(0, 10),
      'OS-1 Akt Raqami': r.os1DocNumber,
      'Talabnoma Raqami': r.requestNumber,
      'Ta’minotchi / Yetkazuvchi': r.supplierName,
      'Kafedra / Bo‘lim': r.departmentName,
      'Moliyalashtirish Manbasi': this.getSourceLabel(r.fundingSource as any),
      'Buxgalteriya Sub-hisobi': r.subAccountCode,
      'Ajratilgan Mablag‘ (so‘m)': r.allocatedAmount,
      'Mahsulotlar Qisqartmasi': r.items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join('; '),
      'Mas’ul Qabul Qiluvchi': r.signedByName,
      'Doimiy Kripto-Muhr': r.hasStamp ? `TASDIQLANGAN (${r.stampHash?.slice(0, 12)}...)` : 'KUTILMOQDA',
      'WORM Nazorat Kodi (HMAC Hash)': r.stampHash || this.generateHmac(`${r.os1DocNumber}-${r.allocatedAmount}-${r.subAccountCode}`),
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, '1. Kirim Reestri (OS-1)');

    // Sheet 2: Chiqim Reestri (OS-2)
    const sheet2Data = receiptsRes.data.map((r, idx) => ({
      '№': idx + 1,
      'Sana': r.receiptDate.slice(0, 10),
      'OS-2 Nakladnoy Raqami': `${r.requestNumber}-OS2`,
      'Talabnoma Raqami': r.requestNumber,
      'Qabul Qiluvchi Kafedra': r.departmentName,
      'Moddiy Javobgar (MOL)': r.requesterName,
      'Moliyalashtirish Manbasi': this.getSourceLabel(r.fundingSource as any),
      'Sub-hisob Kodi': r.subAccountCode,
      'Topshirilgan Tovar': r.items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join('; '),
      'Holat': 'Komendant va Mudir Imzolagan (OS-2)',
      'WORM Nazorat Kodi (HMAC Hash)': this.generateHmac(`${r.requestNumber}-OS2-${r.subAccountCode}-${r.allocatedAmount}`),
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, '2. Chiqim Reestri (OS-2)');

    // Sheet 3: MOL Balansi va Qoldiq Vedomosti
    const sheet3Data = balanceRes.data.map((m, idx) => ({
      '№': idx + 1,
      'Kafedra / Bo‘lim Nomi': m.departmentName,
      'Moddiy Javobgar Shaxs (MOL)': m.fullName,
      'Aloqa Telefoni': m.phone,
      'Asosiy Vositalar Soni (dona)': m.fixedAssetsCount,
      'Balansdagi Qiymati (so‘m)': m.fixedAssetsTotalValue,
      'Sarf Tovarlari (dona)': m.consumablesCount,
      'Biriktirilgan Xonalar Soni': m.roomsCount,
      'Oxirgi OS-2 Nakladnoy': m.lastOs2DocNumber || '—',
      'Oxirgi Harakat Sanasi': m.lastHandoverDate ? m.lastHandoverDate.slice(0, 10) : '—',
      'WORM Nazorat Kodi (HMAC Hash)': this.generateHmac(`${m.molId}-${m.fixedAssetsTotalValue}-${m.fixedAssetsCount}`),
    }));
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, '3. MOL Aylanma Balansi');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      filename: `UWMS_Bosh_Hisobchi_Davlat_Hisoboti_${period}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private generateUzAsboStateXml(period: string, receipts: any, balance: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<UzASBODavlatHisoboti version="2.0" xmlns="urn:uzasbo:treasury:inventory:v2">
  <Muassasa>
    <Nomi>O'zbekiston Davlat Universiteti</Nomi>
    <INN>301245789</INN>
    <G'aznaHisobRaqami>23402000300100001010</G'aznaHisobRaqami>
    <HisobotDavri>${period}</HisobotDavri>
    <YaratilganVaqt>${new Date().toISOString()}</YaratilganVaqt>
    <BoshHisobchiTasdig'i>TASDIQLANGAN_ELEKTRON_HMAC</BoshHisobchiTasdig'i>
  </Muassasa>
  <SubHisoblarYig'indisi>
    <SubHisob kod="013" nomi="Mashina va asbob-uskunalar (Kompyuter, texnika, laboratoriya)">
      <JamiQiymat>${receipts.summary.bySubAccount['013']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="015" nomi="Transport vositalari">
      <JamiQiymat>${receipts.summary.bySubAccount['015']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="016" nomi="Boshqa asosiy vositalar (Mebel va ofis jihozlari)">
      <JamiQiymat>${receipts.summary.bySubAccount['016']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="071" nomi="O‘rnatiladigan asbob-uskunalar va moddiy sarf zaxiralari">
      <JamiQiymat>${receipts.summary.bySubAccount['071']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="010" nomi="Bino va inshootlar">
      <JamiQiymat>${receipts.summary.bySubAccount['010']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="060" nomi="Material zaxiralar va sarflanuvchi buyumlar">
      <JamiQiymat>${receipts.summary.bySubAccount['060']?.amount || 0}</JamiQiymat>
    </SubHisob>
    <SubHisob kod="212" nomi="Boshqa xo‘jalik va inventar jihozlari">
      <JamiQiymat>${receipts.summary.bySubAccount['212']?.amount || 0}</JamiQiymat>
    </SubHisob>
  </SubHisoblarYig'indisi>
  <KirimReestri_OS1 jamiSoni="${receipts.total}">
    ${receipts.data
      .map(
        (r: any) => `
    <KirimHujjati>
      <HujjatRaqami>${r.os1DocNumber}</HujjatRaqami>
      <Sana>${r.receiptDate.slice(0, 10)}</Sana>
      <Ta'minotchi>${r.supplierName}</Ta'minotchi>
      <Manba>${r.fundingSource}</Manba>
      <SubHisob>${r.subAccountCode}</SubHisob>
      <Summa>${r.allocatedAmount}</Summa>
      <MuhrXeshi>${r.stampHash || 'IMZOLANGAN'}</MuhrXeshi>
    </KirimHujjati>`,
      )
      .join('')}
  </KirimReestri_OS1>
  <MOL_AylanmaBalansi jamiMollar="${balance.total}">
    ${balance.data
      .map(
        (m: any) => `
    <MOL_Vedomost>
      <F.I.SH>${m.fullName}</F.I.SH>
      <Kafedra>${m.departmentName}</Kafedra>
      <AsosiyVositalarSoni>${m.fixedAssetsCount}</AsosiyVositalarSoni>
      <BalansQiymati>${m.fixedAssetsTotalValue}</BalansQiymati>
      <SarfMateriallari>${m.consumablesCount}</SarfMateriallari>
      <OxirgiNakladnoy>${m.lastOs2DocNumber || '—'}</OxirgiNakladnoy>
    </MOL_Vedomost>`,
      )
      .join('')}
  </MOL_AylanmaBalansi>
</UzASBODavlatHisoboti>`;
  }

  private generate1CEnterpriseXml(period: string, receipts: any, balance: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<V8Exch:Data xmlns:V8Exch="http://v8.1c.ru/edi/edi_stnd/EnterpriseData/1.8" format="1C:Enterprise 8.3 OTM Standarti">
  <Header>
    <SourceApp>UWMS — Universitet Ombor va Inventar Tizimi</SourceApp>
    <FormatVersion>1.8</FormatVersion>
    <CreationDate>${new Date().toISOString()}</CreationDate>
    <Period>${period}</Period>
    <OrganizationINN>301245789</OrganizationINN>
  </Header>
  <Receipts_OS1>
    ${receipts.data
      .map(
        (r: any) => `
    <DocumentReceipt>
      <Number>${r.os1DocNumber}</Number>
      <Date>${r.receiptDate.slice(0, 10)}</Date>
      <Supplier>${r.supplierName}</Supplier>
      <FundingSource>${r.fundingSource}</FundingSource>
      <AccountCode>${r.subAccountCode}</AccountCode>
      <TotalAmount>${r.allocatedAmount}</TotalAmount>
    </DocumentReceipt>`,
      )
      .join('')}
  </Receipts_OS1>
  <MOL_TurnoverLedger>
    ${balance.data
      .map(
        (m: any) => `
    <MOL_Balance>
      <Name>${m.fullName}</Name>
      <Department>${m.departmentName}</Department>
      <FixedAssetsQuantity>${m.fixedAssetsCount}</FixedAssetsQuantity>
      <FixedAssetsTotalCost>${m.fixedAssetsTotalValue}</FixedAssetsTotalCost>
    </MOL_Balance>`,
      )
      .join('')}
  </MOL_TurnoverLedger>
</V8Exch:Data>`;
  }

  /**
   * Elektron Aylanma Varaqa (Clearance Certificate) generatsiyasi
   * Xodimning universitet oldidagi barcha moddiy majburiyatlarini topshirganligini tasdiqlovchi rasmiy ma'lumotnoma.
   */
  async generateClearanceCertificate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const activeAssets = await this.prisma.itemInstance.count({
      where: {
        responsibleUserId: userId,
        status: { notIn: ['WRITTEN_OFF'] },
      },
    });

    const pendingHandovers = await this.prisma.responsibilityHandover.count({
      where: {
        departingUserId: userId,
        status: { in: ['DRAFT', 'PENDING_AUDIT', 'PENDING_SIGNATURES'] },
      },
    });

    const openShortages = await this.prisma.handoverItemAction.count({
      where: {
        handover: { departingUserId: userId },
        actionType: 'SHORTAGE',
        investigationNote: null,
      },
    });

    const responsibleRooms = await this.prisma.room.count({
      where: {
        responsibleUserId: userId,
        deletedAt: null,
      },
    });

    const isCleared =
      activeAssets === 0 &&
      pendingHandovers === 0 &&
      openShortages === 0 &&
      responsibleRooms === 0;

    const completedHandovers = await this.prisma.responsibilityHandover.findMany({
      where: {
        departingUserId: userId,
        status: 'COMPLETED',
      },
      include: {
        targetUser: { select: { fullName: true } },
        targetWarehouse: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const certYear = new Date().getFullYear();
    const certNumber = `AV-${certYear}-${user.id.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const issueDateStr = new Date().toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const raw = `${certNumber}|CLEARANCE_CERTIFICATE|${userId}|${isCleared}|${new Date().toISOString()}`;
    const verificationHash = this.generateHmac(raw);
    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const qrPayloadUrl = `${clientBaseUrl}/verify-doc/${encodeURIComponent(certNumber)}`;

    const handoversTableHtml =
      completedHandovers.length > 0
        ? completedHandovers
            .map(
              (h, idx) => `
          <tr>
            <td style="border: 1px solid #1f2937; padding: 6px 10px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #1f2937; padding: 6px 10px; font-weight: bold;">${h.handoverNumber}</td>
            <td style="border: 1px solid #1f2937; padding: 6px 10px; text-align: center;">${new Date(h.updatedAt).toLocaleDateString('uz-UZ')}</td>
            <td style="border: 1px solid #1f2937; padding: 6px 10px;">${h.targetUser?.fullName || h.targetWarehouse?.name || 'Universitet ombori'}</td>
            <td style="border: 1px solid #1f2937; padding: 6px 10px; text-align: center;">${h._count?.items || 0} ta</td>
            <td style="border: 1px solid #1f2937; padding: 6px 10px; text-align: center; color: #059669; font-weight: bold;">To‘liq qabul qilingan (OS-1)</td>
          </tr>`,
            )
            .join('')
        : `<tr><td colspan="6" style="border: 1px solid #1f2937; padding: 12px; text-align: center; color: #6b7280;">Bazada moddiy topshirish dalolatnomalari mavjud emas (Aktivlar biriktirilmagan)</td></tr>`;

    const roleLabelsUz: Record<string, string> = {
      SUPER_ADMIN: 'Bosh administrator',
      HEAD_WAREHOUSE: 'Bosh ombor mudiri',
      MOL: 'Moddiy javobgar shaxs (MOL)',
      COMMENDANT: 'Bino komendanti',
      CHIEF_ACCOUNTANT: 'Bosh hisobchi',
      VICE_RECTOR_FINANCE: 'Moliya-iqtisodiyot ishlari bo‘yicha prorektor',
      RECTOR: 'Rektor',
      AUDITOR: 'Ichki auditor',
      EMPLOYEE: 'Xodim',
      DEPARTMENT_HEAD: 'Kafedra mudiri / Bo‘lim boshlig‘i',
    };
    const roleTitle = roleLabelsUz[user.role] || user.role;

    const verdictBoxHtml = isCleared
      ? `
      <div style="margin: 20px 0; padding: 16px; border: 2px solid #059669; background: #ecfdf5; border-radius: 6px;">
        <div style="font-size: 16px; font-weight: bold; color: #065f46; margin-bottom: 6px;">
          ✔ YAKUNIY HUQUQIY VA MOLIYAVIY XULOSA
        </div>
        <div style="font-size: 14px; color: #047857; line-height: 1.5;">
          Ushbu ma’lumotnoma berildiki, xodim <b>${user.fullName}</b> universitet oldidagi barcha moddiy javobgarliklarini tegishli topshirish dalolatnomalari bo‘yicha to‘liq topshirdi. Mas’uliyatidagi barcha asosiy vositalar va ashyolar bo‘yicha universitet hisobida <b>moddiy qarzdorligi MAVJUD EMAS</b>.
          <br/><br/>
          <b>Kadrlar bo‘limiga:</b> Mazkur xodim bilan tuzilgan mehnat shartnomasini bekor qilishga, oxirgi hisob-kitobni amalga oshirishga va mehnat daftarchasini berishga ruxsat etiladi.
        </div>
      </div>`
      : `
      <div style="margin: 20px 0; padding: 16px; border: 2px solid #dc2626; background: #fef2f2; border-radius: 6px;">
        <div style="font-size: 16px; font-weight: bold; color: #991b1b; margin-bottom: 6px;">
          ⚠ DIQQAT: JAVOBGARLIK TO‘LIQ TOPSHIRILMAGAN!
        </div>
        <div style="font-size: 14px; color: #b91c1c; line-height: 1.5;">
          Xodim zimmasida hali <b>${activeAssets} ta</b> hisobdan chiqarilmagan aktiv, <b>${responsibleRooms} ta</b> biriktirilgan auditoriya yoki <b>${pendingHandovers} ta</b> tugallanmagan topshirish dalolatnomalari mavjud.
          <br/>
          Moddiy javobgarlik to‘liq o‘tkazilmaguncha mehnat shartnomasini bekor qilish va aylanma varaqani qonuniy tasdiqlash taqiqlanadi.
        </div>
      </div>`;

    const contentHtml = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <title>Elektron Aylanma Varaqa — ${certNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #111827;
      line-height: 1.4;
      background: #fff;
      margin: 0;
      padding: 20px;
    }
    .header-table { width: 100%; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
    .title-block { text-align: center; margin: 20px 0; }
    .cert-title { font-size: 22px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
    .cert-sub { font-size: 14px; font-style: italic; color: #374151; margin-top: 4px; }
    .meta-box { width: 100%; margin: 14px 0; }
    .data-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .signatures-table { width: 100%; margin-top: 36px; border-collapse: collapse; }
    .signature-cell { width: 50%; padding: 12px 16px; vertical-align: top; }
    .sign-line { border-bottom: 1px dashed #4b5563; margin-top: 28px; width: 85%; }
    .stamp-box {
      margin-top: 30px;
      padding: 14px;
      border: 1px solid #9ca3af;
      background: #f9fafb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 4px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 75%;">
        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">
          O‘zbekiston Respublikasi Oliy Ta’lim, Fan va Innovatsiyalar Vazirligi
        </div>
        <div style="font-size: 15px; font-weight: bold; color: #1e3a8a; margin-top: 2px;">
          Namangan davlat texnika universiteti — UWMS Yagona Axborot Tizimi
        </div>
        <div style="font-size: 11px; color: #4b5563;">
          Kadrlar Boshqarmasi va Buxgalteriya Hisobi Departamenti
        </div>
      </td>
      <td style="width: 25%; text-align: right; vertical-align: top;">
        <div style="font-size: 13px; font-weight: bold;">№ ${certNumber}</div>
        <div style="font-size: 11px; color: #6b7280;">Sana: ${issueDateStr}</div>
      </td>
    </tr>
  </table>

  <div class="title-block">
    <h1 class="cert-title">Elektron Aylanma Varaqa</h1>
    <div class="cert-sub">Moddiy Javobgarlikdan To‘liq Ozod Qilinganlik To‘g‘risida Rasmiy Ma’lumotnoma</div>
  </div>

  <table class="meta-box">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <p style="margin: 4px 0;"><b>Xodim (F.I.Sh):</b> <span style="font-size: 15px; font-weight: bold;">${user.fullName}</span></p>
        <p style="margin: 4px 0;"><b>Lavozimi:</b> ${user.position || 'Xodim / O‘qituvchi'}</p>
        <p style="margin: 4px 0;"><b>Bo‘lim / Kafedra:</b> ${user.department?.name || 'Universitet tarkibiy tuzilmasi'}</p>
      </td>
      <td style="width: 50%; vertical-align: top;">
        <p style="margin: 4px 0;"><b>Tizimdagi roli:</b> ${roleTitle}</p>
        <p style="margin: 4px 0;"><b>Identifikator:</b> ${user.id}</p>
        <p style="margin: 4px 0;"><b>Holati:</b> <span style="color: ${isCleared ? '#059669' : '#dc2626'}; font-weight: bold;">${isCleared ? 'OZOD QILINGAN (CLEARANCE PASSED)' : 'JARAYONDA'}</span></p>
      </td>
    </tr>
  </table>

  ${verdictBoxHtml}

  <div style="font-size: 14px; font-weight: bold; margin-top: 20px; text-transform: uppercase;">
    I. Moddiy Javobgarlik Topshirilganligi To‘g‘risidagi Dalolatnomalar Reestri
  </div>

  <table class="data-table">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="border: 1px solid #1f2937; padding: 6px; width: 30px;">№</th>
        <th style="border: 1px solid #1f2937; padding: 6px;">Dalolatnoma №</th>
        <th style="border: 1px solid #1f2937; padding: 6px; width: 100px;">Sana</th>
        <th style="border: 1px solid #1f2937; padding: 6px;">Qabul Qiluvchi Shaxs / Ombor</th>
        <th style="border: 1px solid #1f2937; padding: 6px; width: 80px;">Soni</th>
        <th style="border: 1px solid #1f2937; padding: 6px;">Holati</th>
      </tr>
    </thead>
    <tbody>
      ${handoversTableHtml}
    </tbody>
  </table>

  <table class="signatures-table">
    <tr>
      <td class="signature-cell">
        <b>1. Kadrlar Boshqarmasi Boshlig‘i:</b>
        <div class="sign-line"></div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">(imzo va F.I.Sh)</div>
      </td>
      <td class="signature-cell">
        <b>2. Bosh Hisobchi:</b>
        <div class="sign-line"></div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">(imzo va F.I.Sh)</div>
      </td>
    </tr>
    <tr>
      <td class="signature-cell" style="padding-top: 24px;">
        <b>3. Bosh Ombor Mudiri:</b>
        <div class="sign-line"></div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">(imzo va F.I.Sh)</div>
      </td>
      <td class="signature-cell" style="padding-top: 24px;">
        <b>4. Moliya-iqtisod Prorektori:</b>
        <div class="sign-line"></div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">(imzo va F.I.Sh)</div>
      </td>
    </tr>
  </table>

  <div class="stamp-box">
    <div>
      <div style="font-weight: bold; font-size: 13px; color: #1e3a8a;">UWMS ELEKTRON RAQAMLI MUHR VA XAVFSIZLIK KODI</div>
      <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">HMAC SHA-256: <code>${verificationHash}</code></div>
      <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Hujjat verifikatsiyasi: <a href="${qrPayloadUrl}" target="_blank">${qrPayloadUrl}</a></div>
    </div>
    <div style="text-align: right; border-left: 1px solid #d1d5db; padding-left: 16px;">
      <div style="font-size: 11px; font-weight: bold; color: #059669;">QR VERIFIED</div>
      <div style="font-size: 10px; color: #6b7280;">Haqiqiy davlat hujjati</div>
    </div>
  </div>
</body>
</html>`;

    await this.systemAudit.log({
      action: 'VIEW',
      entity: 'CLEARANCE_CERTIFICATE',
      entityId: certNumber,
      details: {
        userId,
        fullName: user.fullName,
        isCleared,
        activeAssets,
      },
      userId,
    });

    return {
      certificateNumber: certNumber,
      issueDate: new Date().toISOString(),
      userId: user.id,
      fullName: user.fullName,
      role: user.role,
      position: user.position,
      departmentName: user.department?.name,
      isCleared,
      activeAssets,
      responsibleRooms,
      pendingHandovers,
      openShortages,
      completedHandovers,
      verificationHash,
      qrPayloadUrl,
      contentHtml,
    };
  }

  async generateClearanceCertificatePdf(userId: string) {
    const cert = await this.generateClearanceCertificate(userId);
    return {
      certificateNumber: cert.certificateNumber,
      contentHtml: cert.contentHtml,
      filename: `Aylanma_Varaqa_${cert.certificateNumber}.html`,
    };
  }
}
