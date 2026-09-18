import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HemisSyncDto, HemisTestConnectionDto, UzAsboExportQueryDto } from './integrations.dto';
import { NotificationType, RoleType } from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  private async pingHemis(
    apiUrl: string,
    apiKey?: string,
  ): Promise<{ ok: boolean; status: number; errorMessage?: string; pingMs: number }> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['api-key'] = apiKey;
      }

      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const response = await fetch(cleanUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;

      if (response.ok || response.status === 401 || response.status === 403 || response.status === 404) {
        return {
          ok: response.ok,
          status: response.status,
          errorMessage: response.ok
            ? undefined
            : `HTTP ${response.status}: ${response.statusText || 'Ruxsat xatosi'}`,
          pingMs,
        };
      }

      return {
        ok: false,
        status: response.status,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        pingMs,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        errorMessage: isTimeout ? 'Ulanish vaqti tugadi (Timeout: 3.5s)' : (err.message || 'Tarmoq xatosi'),
        pingMs,
      };
    }
  }

  async getHemisStatus() {
    const [deptCount, roomCount, userCount] = await Promise.all([
      this.prisma.department.count(),
      this.prisma.room.count(),
      this.prisma.user.count(),
    ]);

    const lastSyncLog = await this.prisma.systemAuditLog.findFirst({
      where: {
        action: { in: ['HEMIS_SYNC', 'HEMIS_STUB_SYNC', 'HEMIS_LIVE_SYNC'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const envUrl = process.env.HEMIS_API_URL;
    const envKey = process.env.HEMIS_API_KEY;
    const envMode = process.env.HEMIS_MODE; // 'DEMO_STUB' | 'LIVE'

    // 1. Agar muhitda DEMO_STUB deb aniq belgilangan bo'lsa
    if (envMode === 'DEMO_STUB') {
      return {
        status: 'DEMO_STUB',
        isConfigured: false,
        mode: 'DEMO_STUB',
        hemisVersion: 'HEMIS REST API v2.4 (Demo / Stub Rejimi)',
        apiUrl: envUrl ? this.maskUrl(envUrl) : null,
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        message: 'Tizim DEMO / STUB rejimida ishlamoqda. Haqiqiy HEMIS axborot tizimi ulanmagan.',
      };
    }

    // 2. Agar API URL kiritilmagan bo'lsa -> NOT_CONFIGURED
    if (!envUrl) {
      return {
        status: 'NOT_CONFIGURED',
        isConfigured: false,
        mode: 'NOT_CONFIGURED',
        hemisVersion: 'HEMIS REST API v2.4 (Oliy Ta’lim Muassasasi Standarti)',
        apiUrl: null,
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        message: 'HEMIS API integratsiyasi sozlanmagan. Iltimos, HEMIS_API_URL va HEMIS_API_KEY ni sozlang.',
      };
    }

    // 3. Agar URL sozlangan bo'lsa, real HTTP ping qilib ko'ramiz
    const pingResult = await this.pingHemis(envUrl, envKey);
    if (pingResult.ok) {
      return {
        status: 'CONNECTED',
        isConfigured: true,
        mode: 'LIVE',
        hemisVersion: 'HEMIS REST API v2.4 (Jonli Ulanish)',
        apiUrl: this.maskUrl(envUrl),
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        pingMs: pingResult.pingMs,
        message: 'HEMIS REST API bilan aloqa faol va tekshirildi.',
      };
    }

    const isAuthErr = pingResult.status === 401 || pingResult.status === 403;
    return {
      status: isAuthErr ? 'AUTHENTICATION_FAILED' : 'CONNECTION_FAILED',
      isConfigured: true,
      mode: 'LIVE',
      hemisVersion: 'HEMIS REST API v2.4 (Oliy Ta’lim Muassasasi Standarti)',
      apiUrl: this.maskUrl(envUrl),
      lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
      lastSyncType: lastSyncLog?.action || null,
      stats: {
        syncedDepartments: deptCount,
        syncedRooms: roomCount,
        syncedUsers: userCount,
      },
      errorMessage: pingResult.errorMessage,
      message: `HEMIS serveriga ulanishda xatolik: ${pingResult.errorMessage}`,
    };
  }

  async testHemisConnection(dto: HemisTestConnectionDto) {
    const targetUrl = dto.hemisApiUrl || process.env.HEMIS_API_URL;
    const targetKey = dto.apiKey || process.env.HEMIS_API_KEY;

    if (!targetUrl) {
      throw new BadRequestException('HEMIS API URL manzili kiritilishi shart!');
    }

    const ping = await this.pingHemis(targetUrl, targetKey);
    return {
      success: ping.ok,
      status: ping.ok
        ? 'CONNECTED'
        : ping.status === 401 || ping.status === 403
          ? 'AUTHENTICATION_FAILED'
          : 'CONNECTION_FAILED',
      statusCode: ping.status,
      pingMs: ping.pingMs,
      targetUrl: this.maskUrl(targetUrl),
      errorMessage: ping.errorMessage,
      message: ping.ok
        ? `HEMIS API serveriga muvaffaqiyatli ulandi (${ping.pingMs} ms).`
        : `HEMIS serveriga ulanib bo‘lmadi: ${ping.errorMessage}`,
    };
  }

  async syncHemis(dto: HemisSyncDto, userId: string) {
    const targetUrl = dto.hemisApiUrl || process.env.HEMIS_API_URL;
    const targetKey = dto.apiKey || process.env.HEMIS_API_KEY;
    const requestedMode =
      dto.mode ||
      (targetUrl ? 'LIVE' : process.env.HEMIS_MODE === 'DEMO_STUB' ? 'DEMO_STUB' : undefined);

    if (requestedMode === 'DEMO_STUB') {
      return this.executeStubSync(userId);
    }

    if (!targetUrl) {
      throw new BadRequestException(
        "HEMIS API sozlanmagan! Iltimos, API URL va API kalitni kiriting yoki 'DEMO_STUB' sinov rejimini tanlang.",
      );
    }

    return this.executeLiveSync(targetUrl, targetKey, userId);
  }

  private async executeLiveSync(apiUrl: string, apiKey: string | undefined, userId: string) {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['api-key'] = apiKey;
    }

    let deptsData: any[] = [];
    let roomsData: any[] = [];

    try {
      const deptsRes = await fetch(`${cleanUrl}/rest/v1/data/department-list`, { headers });
      if (!deptsRes.ok) {
        const fallbackDepts = await fetch(`${cleanUrl}/departments`, { headers });
        if (!fallbackDepts.ok) {
          throw new Error(`Kafedralar ro'yxatini olib bo'lmadi (HTTP ${deptsRes.status})`);
        }
        const json = await fallbackDepts.json();
        deptsData = Array.isArray(json) ? json : json.data || [];
      } else {
        const json = await deptsRes.json();
        deptsData = Array.isArray(json) ? json : json.data || [];
      }

      const roomsRes = await fetch(`${cleanUrl}/rest/v1/data/auditorium-list`, { headers });
      if (roomsRes.ok) {
        const json = await roomsRes.json();
        roomsData = Array.isArray(json) ? json : json.data || [];
      } else {
        const fallbackRooms = await fetch(`${cleanUrl}/auditoriums`, { headers });
        if (fallbackRooms.ok) {
          const json = await fallbackRooms.json();
          roomsData = Array.isArray(json) ? json : json.data || [];
        }
      }
    } catch (err: any) {
      await this.systemAuditService.log({
        action: 'HEMIS_SYNC_FAILED',
        entity: 'Integration',
        details: {
          apiUrl: this.maskUrl(apiUrl),
          error: err.message,
          mode: 'LIVE',
          status: 'FAILED',
        },
        userId,
      });

      throw new BadGatewayException(
        `HEMIS API serveriga ulanishda xatolik yuz berdi: ${err.message}`,
      );
    }

    let syncedDepts = 0;
    for (const d of deptsData) {
      const code = d.code || d.id?.toString();
      const name = d.name || d.name_uz || d.title;
      const type =
        d.structureType?.code === '11' || d.type === 'FACULTY' ? 'FACULTY' : 'DEPARTMENT';
      if (code && name) {
        await this.prisma.department.upsert({
          where: { code },
          update: { name, type },
          create: { code, name, type },
        });
        syncedDepts++;
      }
    }

    let syncedRooms = 0;
    for (const r of roomsData) {
      const number = r.code || r.name || r.number;
      const name = r.name || `Auditoriya ${number}`;
      const building = r.building?.name || r.building || 'Bosh bino';
      const floor = Number(r.floor) || 1;
      const deptCode = r.department?.code || r.deptCode;

      if (number) {
        let deptId: string | null = null;
        if (deptCode) {
          const dept = await this.prisma.department.findUnique({ where: { code: deptCode } });
          deptId = dept?.id || null;
        }

        const existingRoom = await this.prisma.room.findFirst({
          where: { number, building },
        });

        if (existingRoom) {
          await this.prisma.room.update({
            where: { id: existingRoom.id },
            data: { name, floor, departmentId: deptId },
          });
        } else {
          await this.prisma.room.create({
            data: { number, name, floor, building, departmentId: deptId },
          });
        }
        syncedRooms++;
      }
    }

    await this.systemAuditService.log({
      action: 'HEMIS_LIVE_SYNC',
      entity: 'Integration',
      details: {
        apiUrl: this.maskUrl(apiUrl),
        syncedDepartments: syncedDepts,
        syncedRooms: syncedRooms,
        mode: 'LIVE',
        status: 'SUCCESS',
      },
      userId,
    });

    await this.notificationsService.notifyRole(
      RoleType.SUPER_ADMIN,
      'HEMIS Jonli Sinxronizatsiyasi Yakunlandi',
      `HEMIS REST API orqali ${syncedDepts} ta kafedra va ${syncedRooms} ta xona muvaffaqiyatli yangilandi.`,
      NotificationType.SUCCESS,
      '/organization',
    );

    return {
      success: true,
      mode: 'LIVE',
      isDemoStub: false,
      message: 'Haqiqiy HEMIS REST API orqali sinxronizatsiya muvaffaqiyatli amalga oshirildi.',
      syncedDepartments: syncedDepts,
      syncedRooms: syncedRooms,
      timestamp: new Date(),
    };
  }

  private async executeStubSync(userId: string) {
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

    for (const d of hemisData.departments) {
      await this.prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name, type: d.type },
        create: { code: d.code, name: d.name, type: d.type },
      });
      syncedDepts++;
    }

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
      action: 'HEMIS_STUB_SYNC',
      entity: 'Integration',
      details: {
        syncedDepartments: syncedDepts,
        syncedRooms: syncedRooms,
        mode: 'DEMO_STUB',
        isStub: true,
        note: 'Namunaviy demo/stub ma’lumotlari orqali sinxronlashtirildi',
        status: 'SUCCESS',
      },
      userId,
    });

    await this.notificationsService.notifyRole(
      RoleType.SUPER_ADMIN,
      'HEMIS Demo/Stub Sinxronizatsiyasi Yakunlandi',
      `[DEMO / STUB] Sinov ma’lumotlari bo‘yicha ${syncedDepts} ta kafedra va ${syncedRooms} ta xona yangilandi.`,
      NotificationType.INFO,
      '/organization',
    );

    return {
      success: true,
      mode: 'DEMO_STUB',
      isDemoStub: true,
      message: 'DEMO / STUB rejimida sinov ma’lumotlari muvaffaqiyatli yuklandi (Haqiqiy HEMIS ulanishi emas!).',
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
