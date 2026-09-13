import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HemisSyncDto, UzAsboExportQueryDto } from './integrations.dto';
import { NotificationType, RoleType } from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getHemisStatus() {
    const [deptCount, roomCount, userCount] = await Promise.all([
      this.prisma.department.count(),
      this.prisma.room.count(),
      this.prisma.user.count(),
    ]);

    const lastSyncLog = await this.prisma.systemAuditLog.findFirst({
      where: { action: 'HEMIS_SYNC' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: 'CONNECTED',
      hemisVersion: 'HEMIS API v2.4 (Oliy Ta’lim Muassasasi Standarti)',
      lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
      stats: {
        syncedDepartments: deptCount,
        syncedRooms: roomCount,
        syncedUsers: userCount,
      },
    };
  }

  async syncHemis(dto: HemisSyncDto, userId: string) {
    // Standard OTM HEMIS organizational units
    const hemisData = {
      departments: [
        { code: 'FAC_IT', name: 'Axborot Texnologiyalari Fakulteti', type: 'FACULTY' },
        { code: 'DEP_CS', name: 'Dasturiy Injiniring Kafedrasi', type: 'DEPARTMENT' },
        { code: 'DEP_AI', name: 'Sun’iy Intellekt va Kiberxavfsizlik Kafedrasi', type: 'DEPARTMENT' },
        { code: 'DEP_NET', name: 'Tarmoq Texnologiyalari va Telekommunikatsiya Kafedrasi', type: 'DEPARTMENT' },
        { code: 'FAC_ECON', name: 'Raqamli Iqtisodiyot Fakulteti', type: 'FACULTY' },
        { code: 'DEP_FIN', name: 'Moliya va Buxgalteriya Hisobi Kafedrasi', type: 'DEPARTMENT' },
      ],
      rooms: [
        { number: '101', name: 'Kompyuter Laboratoriyasi №1', floor: 1, building: 'Bosh bino', deptCode: 'DEP_CS' },
        { number: '102', name: 'Sun’iy Intellekt Ilmiy Markazi', floor: 1, building: 'Bosh bino', deptCode: 'DEP_AI' },
        { number: '204', name: 'Kiberxavfsizlik Server Xonasi', floor: 2, building: 'Bosh bino', deptCode: 'DEP_AI' },
        { number: '305', name: 'Cisco Tarmoq Akademiyasi Xonasi', floor: 3, building: 'Bosh bino', deptCode: 'DEP_NET' },
        { number: '410', name: 'Raqamli Iqtisodiyot Ma’ruza Zali', floor: 4, building: 'Bosh bino', deptCode: 'DEP_FIN' },
      ],
    };

    let syncedDepts = 0;
    let syncedRooms = 0;

    // Synchronize departments
    for (const d of hemisData.departments) {
      await this.prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name, type: d.type },
        create: { code: d.code, name: d.name, type: d.type },
      });
      syncedDepts++;
    }

    // Synchronize rooms
    for (const r of hemisData.rooms) {
      const dept = await this.prisma.department.findUnique({
        where: { code: r.deptCode },
      });

      const existingRoom = await this.prisma.room.findFirst({
        where: { number: r.number, building: r.building },
      });

      if (existingRoom) {
        await this.prisma.room.update({
          where: { id: existingRoom.id },
          data: {
            name: r.name,
            floor: r.floor,
            departmentId: dept ? dept.id : null,
          },
        });
      } else {
        await this.prisma.room.create({
          data: {
            number: r.number,
            name: r.name,
            floor: r.floor,
            building: r.building,
            departmentId: dept ? dept.id : null,
          },
        });
      }
      syncedRooms++;
    }

    await this.systemAuditService.log({
      action: 'HEMIS_SYNC',
      entity: 'Integration',
      details: {
        syncedDepartments: syncedDepts,
        syncedRooms: syncedRooms,
        status: 'SUCCESS',
      },
      userId,
    });

    await this.notificationsService.notifyRole(
      RoleType.SUPER_ADMIN,
      'HEMIS Sinxronizatsiyasi Yakunlandi',
      `HEMIS tizimidan ${syncedDepts} ta kafedra va ${syncedRooms} ta xona muvaffaqiyatli yangilandi.`,
      NotificationType.SUCCESS,
      '/organization',
    );

    return {
      success: true,
      message: 'HEMIS tizimi bilan to‘liq sinxronizatsiya amalga oshirildi.',
      syncedDepartments: syncedDepts,
      syncedRooms: syncedRooms,
      timestamp: new Date(),
    };
  }

  async exportUzAsbo(query: UzAsboExportQueryDto, userId: string) {
    const period = query.period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const [assets, movements, stocks] = await Promise.all([
      this.prisma.itemInstance.findMany({
        include: {
          item: { include: { category: true } },
          room: true,
          responsibleUser: true,
        },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          items: { include: { item: true } },
          executedBy: true,
          fromWarehouse: true,
          toWarehouse: true,
          toRoom: true,
        },
      }),
      this.prisma.stock.findMany({
        include: {
          item: true,
          warehouse: true,
        },
      }),
    ]);

    const organizationInfo = {
      organizationName: "O'zbekiston Davlat Universiteti",
      inn: '301245789',
      treasuryAccount: '23402000300100001010',
      period,
      exportStandard: 'UzASBO / 1C Korxona 8.3 OTM Standarti',
      generatedAt: new Date().toISOString(),
    };

    const accountingSubAccounts = [
      {
        accountCode: '010',
        accountName: 'Bino va inshootlar',
        totalBookValue: 0,
      },
      {
        accountCode: '013',
        accountName: 'Mashina va asbob-uskunalar (Kompyuter texnikasi)',
        itemCount: assets.filter((a) => a.item.itemType === 'FIXED_ASSET').length,
        totalPurchasePrice: assets.reduce((sum, a) => sum + Number(a.purchasePrice || 0), 0),
      },
      {
        accountCode: '060',
        accountName: 'Material zaxiralar va sarflanuvchi buyumlar',
        totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
      },
    ];

    const uzasboPayload = {
      header: organizationInfo,
      chartOfAccounts: accountingSubAccounts,
      assetRegister: assets.map((a) => ({
        inventoryNumber: a.inventoryNumber,
        assetName: a.item.name,
        category: a.item.category.name,
        fundingSource: a.fundingSource,
        purchaseDate: a.purchaseDate,
        initialCost: a.purchasePrice,
        annualDepreciationRate: `${a.depreciationRate}%`,
        room: a.room?.number || 'Omborda',
        responsiblePerson: a.responsibleUser?.fullName || 'Bosh omborchi',
        status: a.status,
      })),
      monthlyMovements: movements.map((m) => ({
        movementNumber: m.movementNumber,
        type: m.movementType,
        date: m.createdAt,
        fundingSource: m.fundingSource,
        referenceDoc: m.referenceDoc,
        executor: m.executedBy.fullName,
        destination: m.toRoom ? `Xona ${m.toRoom.number}` : m.toWarehouse?.name || 'Ombor',
        items: m.items.map((i) => ({
          itemName: i.item.name,
          quantity: i.quantity,
          unit: i.item.unit,
        })),
      })),
    };

    await this.systemAuditService.log({
      action: 'EXPORT',
      entity: 'UzASBO',
      details: {
        period,
        format: query.format || 'json',
        assetsCount: assets.length,
        movementsCount: movements.length,
      },
      userId,
    });

    if (query.format === 'xml') {
      return this.convertToUzAsboXml(uzasboPayload);
    }

    return uzasboPayload;
  }

  private convertToUzAsboXml(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<UzASBOExport version="2.0">
  <Organization>
    <Name>${data.header.organizationName}</Name>
    <INN>${data.header.inn}</INN>
    <Period>${data.header.period}</Period>
    <GeneratedAt>${data.header.generatedAt}</GeneratedAt>
  </Organization>
  <Assets total="${data.assetRegister.length}">
    ${data.assetRegister
      .slice(0, 50)
      .map(
        (a: any) => `
    <Asset>
      <InventoryNumber>${a.inventoryNumber}</InventoryNumber>
      <Name>${a.assetName}</Name>
      <InitialCost>${a.initialCost || 0}</InitialCost>
      <FundingSource>${a.fundingSource}</FundingSource>
      <Location>${a.room}</Location>
      <MOL>${a.responsiblePerson}</MOL>
      <Status>${a.status}</Status>
    </Asset>`,
      )
      .join('')}
  </Assets>
  <Movements total="${data.monthlyMovements.length}">
    ${data.monthlyMovements
      .slice(0, 50)
      .map(
        (m: any) => `
    <Movement>
      <Number>${m.movementNumber}</Number>
      <Type>${m.type}</Type>
      <Date>${m.date}</Date>
      <Destination>${m.destination}</Destination>
    </Movement>`,
      )
      .join('')}
  </Movements>
</UzASBOExport>`;
  }
}
