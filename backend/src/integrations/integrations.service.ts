import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HemisSyncDto, HemisTestConnectionDto, UzAsboExportQueryDto } from './integrations.dto';
import { NotificationType, RoleType } from '@prisma/client';
import {
  HemisAdapter,
  HttpHemisAdapter,
  mapHemisDepartment,
  mapHemisRoom,
  mapHemisUser,
} from './hemis-adapter.interface';

export const DEMO_HEMIS_SEED_DATA = {
  departments: [
    { code: 'FAC_IT', name: 'Axborot Texnologiyalari Fakulteti', type: 'FACULTY' as const },
    { code: 'DEP_CS', name: 'Dasturiy Injiniring Kafedrasi', type: 'DEPARTMENT' as const },
    { code: 'DEP_AI', name: 'Sun’iy Intellekt va Kiberxavfsizlik Kafedrasi', type: 'DEPARTMENT' as const },
    { code: 'DEP_NET', name: 'Tarmoq Texnologiyalari va Telekommunikatsiya Kafedrasi', type: 'DEPARTMENT' as const },
    { code: 'FAC_ECON', name: 'Raqamli Iqtisodiyot Fakulteti', type: 'FACULTY' as const },
    { code: 'DEP_FIN', name: 'Moliya va Buxgalteriya Hisobi Kafedrasi', type: 'DEPARTMENT' as const },
  ],
  rooms: [
    { number: '101', name: 'Kompyuter Laboratoriyasi №1', floor: 1, building: 'Bosh bino', deptCode: 'DEP_CS' },
    { number: '102', name: 'Sun’iy Intellekt Ilmiy Markazi', floor: 1, building: 'Bosh bino', deptCode: 'DEP_AI' },
    { number: '204', name: 'Kiberxavfsizlik Server Xonasi', floor: 2, building: 'Bosh bino', deptCode: 'DEP_AI' },
    { number: '305', name: 'Cisco Tarmoq Akademiyasi Xonasi', floor: 3, building: 'Bosh bino', deptCode: 'DEP_NET' },
    { number: '410', name: 'Raqamli Iqtisodiyot Ma’ruza Zali', floor: 4, building: 'Bosh bino', deptCode: 'DEP_FIN' },
  ],
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private adapter: HemisAdapter = new HttpHemisAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAuditService: SystemAuditService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  setAdapter(adapter: HemisAdapter) {
    this.adapter = adapter;
  }

  private getHemisApiUrl(): string | undefined {
    return this.configService?.get<string>('HEMIS_API_URL')?.trim() || process.env.HEMIS_API_URL?.trim();
  }

  private getHemisApiKey(): string | undefined {
    return this.configService?.get<string>('HEMIS_API_KEY')?.trim() || process.env.HEMIS_API_KEY?.trim();
  }

  private getHemisMode(): string {
    const mode =
      this.configService?.get<string>('HEMIS_MODE')?.trim().toLowerCase() ||
      process.env.HEMIS_MODE?.trim().toLowerCase();
    return mode || 'demo';
  }

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
  ): Promise<{ ok: boolean; status: number; errorMessage?: string; pingMs: number; details?: string }> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

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

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          pingMs,
          details: 'HEMIS REST API serveri bilan aloqa muvaffaqiyatli o‘rnatildi.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: response.status,
          errorMessage: `HTTP ${response.status}: Avtorizatsiya xatosi (API Kalit noto‘g‘ri yoki muddati tugagan)`,
          pingMs,
          details: 'HEMIS serveri topildi, lekin taqdim etilgan API kalit (Bearer token) orqali ruxsat berilmadi.',
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          status: response.status,
          errorMessage: `HTTP 404: Ko‘rsatilgan API yo‘li topilmadi`,
          pingMs,
          details: 'HEMIS serveri javob bermoqda, biroq kiritilgan URL manzilda API xizmati topilmadi.',
        };
      }

      return {
        ok: false,
        status: response.status,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        pingMs,
        details: `HEMIS serveri javob berdi: status ${response.status}`,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Ulanish vaqti tugadi (Timeout: 4.0s)'
        : (err.message || 'Tarmoq xatosi');

      return {
        ok: false,
        status: 0,
        errorMessage: errMsg,
        pingMs,
        details: isTimeout
          ? 'HEMIS serveri belgilangan vaqt ichida javob bermadi.'
          : 'Serverga ulanib bo‘lmadi (DNS yoki tarmoq xatosi).',
      };
    }
  }

  async getHemisStatus() {
    const [deptCount, roomCount, userCount] = await Promise.all([
      this.prisma.department.count(),
      this.prisma.room.count(),
      this.prisma.user.count(),
    ]);

    const [lastSyncLog, lastFailedLog] = await Promise.all([
      this.prisma.systemAuditLog.findFirst({
        where: {
          action: { in: ['HEMIS_SYNC', 'HEMIS_SYNC_DEMO', 'HEMIS_STUB_SYNC', 'HEMIS_LIVE_SYNC'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.systemAuditLog.findFirst({
        where: {
          action: 'HEMIS_SYNC_FAILED',
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const envUrl = this.getHemisApiUrl();
    const envKey = this.getHemisApiKey();
    const envMode = this.getHemisMode();

    // 1. Agar HEMIS_API_URL va HEMIS_API_KEY yo'q bo'lsa -> NOT_CONFIGURED yoki DEMO (Kalitlar kutilmoqda)
    if (!envUrl && !envKey) {
      const isDemoMode = envMode === 'demo' || envMode === 'demo_stub' || !envMode;
      return {
        status: isDemoMode ? 'DEMO' : 'NOT_CONFIGURED',
        isConfigured: false,
        isWaitingForCredentials: true,
        mode: isDemoMode ? 'DEMO' : 'NOT_CONFIGURED',
        hemisVersion: 'HEMIS REST API v2.4 (Xavfsiz Sinov Rejimi)',
        apiUrl: null,
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        lastError: null,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        message: 'HEMIS API kalitlari hali kiritilmagan. Tizim xavfsiz sinov (DEMO) rejimida to‘liq ishlamoqda.',
        instructions: '',
      };
    }

    // 2. Agar parametrlar chala bo'lsa (faqat bittasi kiritilgan)
    if (!envUrl || !envKey) {
      return {
        status: 'NOT_CONFIGURED',
        isConfigured: false,
        isWaitingForCredentials: true,
        mode: 'NOT_CONFIGURED',
        hemisVersion: 'HEMIS REST API v2.4',
        apiUrl: envUrl ? this.maskUrl(envUrl) : null,
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        lastError: 'HEMIS_API_URL yoki HEMIS_API_KEY to‘liq kiritilmagan',
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        message: 'HEMIS sozlamalari to‘liq emas: URL va API kalit ikkalasi ham kiritilishi shart.',
      };
    }

    // 3. Agar env bor bo'lsa, lekin DEMO rejimida bo'lsa -> CONFIGURED_BUT_STUB
    if (envMode === 'demo' || envMode === 'demo_stub') {
      return {
        status: 'CONFIGURED_BUT_STUB',
        isConfigured: true,
        isWaitingForCredentials: false,
        mode: 'DEMO',
        hemisVersion: 'HEMIS REST API v2.4 (Stub / Sinov Rejimi)',
        apiUrl: this.maskUrl(envUrl),
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        lastError: null,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        message: 'HEMIS API sozlamalari mavjud, biroq tizim STUB/DEMO rejimida turibdi.',
      };
    }

    // 4. Agar env bor bo'lsa va LIVE rejimda bo'lsa:
    const pingResult = await this.pingHemis(envUrl, envKey);
    const latestFailed =
      lastFailedLog && (!lastSyncLog || lastFailedLog.createdAt > lastSyncLog.createdAt);
    const lastErrorMsg = latestFailed
      ? (lastFailedLog.details as any)?.error || 'Oxirgi sinxronizatsiyada xatolik yuz bergan'
      : undefined;

    if (pingResult.ok) {
      return {
        status: latestFailed ? 'ERROR' : 'CONNECTED',
        isConfigured: true,
        mode: 'LIVE',
        hemisVersion: 'HEMIS REST API v2.4 (Jonli Ulanish)',
        apiUrl: this.maskUrl(envUrl),
        lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
        lastSyncType: lastSyncLog?.action || null,
        lastError: lastErrorMsg,
        stats: {
          syncedDepartments: deptCount,
          syncedRooms: roomCount,
          syncedUsers: userCount,
        },
        pingMs: pingResult.pingMs,
        message: latestFailed
          ? `HEMIS oxirgi sinxronizatsiyasida xatolik: ${lastErrorMsg}`
          : 'HEMIS REST API bilan aloqa faol va tekshirildi.',
      };
    }

    const isAuthErr = pingResult.status === 401 || pingResult.status === 403;
    const errorDetails = pingResult.errorMessage || lastErrorMsg || 'HEMIS serveriga ulanishda xatolik';
    return {
      status: isAuthErr ? 'AUTHENTICATION_FAILED' : 'ERROR',
      isConfigured: true,
      mode: 'LIVE',
      hemisVersion: 'HEMIS REST API v2.4 (Oliy Ta’lim Muassasasi Standarti)',
      apiUrl: this.maskUrl(envUrl),
      lastSyncAt: lastSyncLog ? lastSyncLog.createdAt : null,
      lastSyncType: lastSyncLog?.action || null,
      lastError: errorDetails,
      stats: {
        syncedDepartments: deptCount,
        syncedRooms: roomCount,
        syncedUsers: userCount,
      },
      errorMessage: errorDetails,
      message: `HEMIS serveriga ulanishda xatolik: ${errorDetails}`,
    };
  }

  async testHemisConnection(dto: HemisTestConnectionDto) {
    const targetUrl = dto.hemisApiUrl || this.getHemisApiUrl();
    const targetKey = dto.apiKey || this.getHemisApiKey();

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
    const targetUrl = dto.hemisApiUrl || this.getHemisApiUrl();
    const targetKey = dto.apiKey || this.getHemisApiKey();
    const envMode = this.getHemisMode();

    const isDemoMode =
      dto.mode === 'DEMO' ||
      dto.mode === 'DEMO_STUB' ||
      (!dto.mode && (envMode === 'demo' || envMode === 'demo_stub' || !targetUrl));

    if (isDemoMode) {
      if (dto.forceDemo !== true) {
        throw new BadRequestException(
          "Demo sinxronizatsiya faqat 'forceDemo: true' bayrog'i tasdiqlanganda ishlaydi. Bu haqiqiy HEMIS ulanishi emasligini tasdiqlang.",
        );
      }
      return this.executeStubSync(userId);
    }

    if (!targetUrl || !targetKey) {
      throw new BadRequestException(
        "HEMIS API sozlanmagan! Iltimos, HEMIS_API_URL va HEMIS_API_KEY ni sozlang yoki 'DEMO' rejimida forceDemo: true bilan bajaring.",
      );
    }

    return this.executeLiveSync(targetUrl, targetKey, userId);
  }

  private async executeLiveSync(apiUrl: string, apiKey: string | undefined, userId: string) {
    let rawDepts: any[] = [];
    let rawRooms: any[] = [];
    let rawUsers: any[] = [];

    try {
      // 1. Departments, Rooms, Users endpointlariga GET so'rovlar (Strict Read-Only, timeout handling)
      [rawDepts, rawRooms, rawUsers] = await Promise.all([
        this.adapter.fetchDepartments(apiUrl, apiKey),
        this.adapter.fetchRooms(apiUrl, apiKey),
        this.adapter.fetchUsers(apiUrl, apiKey),
      ]);
    } catch (err: any) {
      await this.systemAuditService.log({
        action: 'HEMIS_SYNC_FAILED',
        entity: 'Integration',
        details: {
          apiUrl: this.maskUrl(apiUrl),
          error: err.message || 'HEMIS serveriga so‘rov yuborishda xatolik',
          mode: 'LIVE',
          status: 'FAILED',
        },
        userId,
      });

      throw new BadGatewayException(
        `HEMIS API serveriga ulanishda xatolik yuz berdi: ${err.message}`,
      );
    }

    // 2. Mapping: tashqi kontrakt ma'lumotlarini ichki tizim DTO/strukturasiga xaritalash
    const mappedDepts = rawDepts
      .map(mapHemisDepartment)
      .filter((d): d is NonNullable<typeof d> => d !== null);
    const mappedRooms = rawRooms
      .map(mapHemisRoom)
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const mappedUsers = rawUsers
      .map(mapHemisUser)
      .filter((u): u is NonNullable<typeof u> => u !== null);

    // 3. Majburiy Tranzaksion Zanjir: prisma.$transaction orqali xavfsiz upsert
    const { syncedDepts, syncedRooms, syncedUsers } = await this.prisma.$transaction(async (tx) => {
      let sDepts = 0;
      for (const d of mappedDepts) {
        await tx.department.upsert({
          where: { code: d.code },
          update: { name: d.name, type: d.type },
          create: { code: d.code, name: d.name, type: d.type },
        });
        sDepts++;
      }

      let sRooms = 0;
      for (const r of mappedRooms) {
        let deptId: string | null = null;
        if (r.deptCode) {
          const dept = await tx.department.findUnique({ where: { code: r.deptCode } });
          deptId = dept?.id || null;
        }

        const existingRoom = await tx.room.findFirst({
          where: { number: r.number, building: r.building },
        });

        if (existingRoom) {
          await tx.room.update({
            where: { id: existingRoom.id },
            data: { name: r.name, floor: r.floor, departmentId: deptId },
          });
        } else {
          await tx.room.create({
            data: {
              number: r.number,
              name: r.name,
              floor: r.floor,
              building: r.building,
              departmentId: deptId,
            },
          });
        }
        sRooms++;
      }

      let sUsers = 0;
      const defaultHashedPassword = await bcrypt.hash('HemisUser2026!', 10);

      for (const u of mappedUsers) {
        let deptId: string | null = null;
        if (u.deptCode) {
          const dept = await tx.department.findUnique({ where: { code: u.deptCode } });
          deptId = dept?.id || null;
        }

        const existingUser = await tx.user.findUnique({
          where: { username: u.username },
        });

        if (existingUser) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              fullName: u.fullName,
              email: u.email || existingUser.email,
              phone: u.phone || existingUser.phone,
              position: u.position || existingUser.position,
              departmentId: deptId || existingUser.departmentId,
            },
          });
        } else {
          await tx.user.create({
            data: {
              username: u.username,
              fullName: u.fullName,
              email: u.email,
              phone: u.phone,
              position: u.position,
              departmentId: deptId,
              role: RoleType.EMPLOYEE,
              password: defaultHashedPassword,
              mustChangePassword: true,
            },
          });
        }
        sUsers++;
      }

      return { syncedDepts: sDepts, syncedRooms: sRooms, syncedUsers: sUsers };
    });

    const lastSyncAt = new Date();

    // 4. Audit Log va Notification
    await this.systemAuditService.log({
      action: 'HEMIS_LIVE_SYNC',
      entity: 'Integration',
      details: {
        apiUrl: this.maskUrl(apiUrl),
        syncedDepartments: syncedDepts,
        syncedRooms: syncedRooms,
        syncedUsers: syncedUsers,
        mode: 'LIVE',
        status: 'SUCCESS',
      },
      userId,
    });

    await this.notificationsService.notifyRole(
      RoleType.SUPER_ADMIN,
      'HEMIS Jonli Sinxronizatsiyasi Yakunlandi',
      `HEMIS REST API orqali ${syncedDepts} ta kafedra, ${syncedRooms} ta xona va ${syncedUsers} ta xodim muvaffaqiyatli yangilandi.`,
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
      syncedUsers: syncedUsers,
      lastSyncAt,
    };
  }

  private async executeStubSync(userId: string) {
    // Majburiy Tranzaksion Zanjir: prisma.$transaction orqali demo seed data yozish
    const { syncedDepts, syncedRooms } = await this.prisma.$transaction(async (tx) => {
      let sDepts = 0;
      let sRooms = 0;

      for (const d of DEMO_HEMIS_SEED_DATA.departments) {
        await tx.department.upsert({
          where: { code: d.code },
          update: { name: d.name, type: d.type },
          create: { code: d.code, name: d.name, type: d.type },
        });
        sDepts++;
      }

      for (const r of DEMO_HEMIS_SEED_DATA.rooms) {
        const dept = await tx.department.findUnique({
          where: { code: r.deptCode },
        });

        const existingRoom = await tx.room.findFirst({
          where: { number: r.number, building: r.building },
        });

        if (existingRoom) {
          await tx.room.update({
            where: { id: existingRoom.id },
            data: {
              name: r.name,
              floor: r.floor,
              departmentId: dept ? dept.id : null,
            },
          });
        } else {
          await tx.room.create({
            data: {
              number: r.number,
              name: r.name,
              floor: r.floor,
              building: r.building,
              departmentId: dept ? dept.id : null,
            },
          });
        }
        sRooms++;
      }

      return { syncedDepts: sDepts, syncedRooms: sRooms };
    });

    // DEMO rejimida action: HEMIS_SYNC_DEMO deb yoziladi
    await this.systemAuditService.log({
      action: 'HEMIS_SYNC_DEMO',
      entity: 'Integration',
      details: {
        syncedDepartments: syncedDepts,
        syncedRooms: syncedRooms,
        mode: 'DEMO',
        isStub: true,
        forceDemo: true,
        note: 'Namunaviy demo seed ma’lumotlari orqali sinxronlashtirildi',
        status: 'SUCCESS',
      },
      userId,
    });

    await this.notificationsService.notifyRole(
      RoleType.SUPER_ADMIN,
      'HEMIS Demo Sinxronizatsiyasi Yakunlandi',
      `[DEMO] Sinov ma’lumotlari bo‘yicha ${syncedDepts} ta kafedra va ${syncedRooms} ta xona yangilandi.`,
      NotificationType.INFO,
      '/organization',
    );

    return {
      success: true,
      mode: 'DEMO',
      isDemoStub: true,
      message: 'DEMO rejimida sinov ma’lumotlari muvaffaqiyatli yuklandi (Haqiqiy HEMIS ulanishi emas!).',
      syncedDepartments: syncedDepts,
      syncedRooms: syncedRooms,
      syncedUsers: 0,
      lastSyncAt: new Date(),
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

    if (query.format === 'xlsx') {
      return this.convertToUzAsboXlsx(uzasboPayload, period);
    }

    return uzasboPayload;
  }

  private escapeXml(unsafe: string | number | null | undefined): string {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private convertToUzAsboXml(data: any): string {
    const esc = this.escapeXml.bind(this);
    return `<?xml version="1.0" encoding="UTF-8"?>
<UzASBOExport version="2.0">
  <Organization>
    <Name>${esc(data.header.organizationName)}</Name>
    <INN>${esc(data.header.inn)}</INN>
    <TreasuryAccount>${esc(data.header.treasuryAccount)}</TreasuryAccount>
    <Period>${esc(data.header.period)}</Period>
    <Standard>${esc(data.header.exportStandard)}</Standard>
    <GeneratedAt>${esc(data.header.generatedAt)}</GeneratedAt>
  </Organization>
  <ChartOfAccounts>
    ${data.chartOfAccounts
      .map(
        (c: any) => `
    <Account code="${esc(c.accountCode)}" name="${esc(c.accountName)}">
      ${c.itemCount !== undefined ? `<ItemCount>${c.itemCount}</ItemCount>` : ''}
      ${c.totalPurchasePrice !== undefined ? `<TotalValue>${c.totalPurchasePrice}</TotalValue>` : ''}
      ${c.totalQuantity !== undefined ? `<TotalQuantity>${c.totalQuantity}</TotalQuantity>` : ''}
    </Account>`,
      )
      .join('')}
  </ChartOfAccounts>
  <Assets total="${data.assetRegister.length}">
    ${data.assetRegister
      .map(
        (a: any) => `
    <Asset>
      <InventoryNumber>${esc(a.inventoryNumber)}</InventoryNumber>
      <Name>${esc(a.assetName)}</Name>
      <Category>${esc(a.category)}</Category>
      <FundingSource>${esc(a.fundingSource)}</FundingSource>
      <InitialCost>${esc(a.initialCost || 0)}</InitialCost>
      <AnnualDepreciationRate>${esc(a.annualDepreciationRate)}</AnnualDepreciationRate>
      <Location>${esc(a.room)}</Location>
      <MOL>${esc(a.responsiblePerson)}</MOL>
      <Status>${esc(a.status)}</Status>
    </Asset>`,
      )
      .join('')}
  </Assets>
  <Movements total="${data.monthlyMovements.length}">
    ${data.monthlyMovements
      .map(
        (m: any) => `
    <Movement>
      <Number>${esc(m.movementNumber)}</Number>
      <Type>${esc(m.type)}</Type>
      <Date>${esc(m.date)}</Date>
      <FundingSource>${esc(m.fundingSource)}</FundingSource>
      <ReferenceDoc>${esc(m.referenceDoc)}</ReferenceDoc>
      <Executor>${esc(m.executor)}</Executor>
      <Destination>${esc(m.destination)}</Destination>
      <Items>
        ${m.items
          .map(
            (i: any) => `
        <Item>
          <Name>${esc(i.itemName)}</Name>
          <Quantity>${esc(i.quantity)}</Quantity>
          <Unit>${esc(i.unit)}</Unit>
        </Item>`,
          )
          .join('')}
      </Items>
    </Movement>`,
      )
      .join('')}
  </Movements>
</UzASBOExport>`;
  }

  private convertToUzAsboXlsx(data: any, period: string) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tashkilot
    const orgRows = [
      ['Tashkilot Nomi', data.header.organizationName],
      ['INN (STIR)', data.header.inn],
      ['G‘aznachilik Hisob Raqami', data.header.treasuryAccount],
      ['Hisobot Davri', data.header.period],
      ['Standart', data.header.exportStandard],
      ['Shakllantirilgan Sana', data.header.generatedAt],
    ];
    const wsOrg = XLSX.utils.aoa_to_sheet(orgRows);
    XLSX.utils.book_append_sheet(wb, wsOrg, 'Tashkilot');

    // Sheet 2: Asosiy Vositalar (013)
    const assetRows = data.assetRegister.map((a: any) => ({
      'Inventar №': a.inventoryNumber,
      'Nomi': a.assetName,
      'Kategoriya': a.category,
      'Moliyalashtirish Manbasi': a.fundingSource,
      'Boshlang‘ich Qiymati (so‘m)': a.initialCost || 0,
      'Amortizatsiya Me’yori': a.annualDepreciationRate,
      'Joylashuvi (Xona)': a.room,
      'Moddiy Javobgar Shaxs (MOL)': a.responsiblePerson,
      'Holati': a.status,
    }));
    const wsAssets = XLSX.utils.json_to_sheet(assetRows);
    XLSX.utils.book_append_sheet(wb, wsAssets, 'Asosiy_Vositalar_013');

    // Sheet 3: Harakatlar Jurnali
    const movementRows = data.monthlyMovements.flatMap((m: any) =>
      m.items.map((i: any) => ({
        'Harakat №': m.movementNumber,
        'Turi': m.type,
        'Sana': m.date ? new Date(m.date).toLocaleDateString('uz-UZ') : '—',
        'Moliyalashtirish': m.fundingSource || '—',
        'Asos Hujjat': m.referenceDoc || '—',
        'Bajaruvchi': m.executor,
        'Yo‘nalish (Manzil)': m.destination,
        'Mahsulot Nomi': i.itemName,
        'Miqdor': i.quantity,
        'Birlik': i.unit,
      })),
    );
    const wsMovements = XLSX.utils.json_to_sheet(movementRows);
    XLSX.utils.book_append_sheet(wb, wsMovements, 'Harakatlar_Jurnali');

    const buffer = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return {
      format: 'xlsx',
      fileName: `UzASBO_Hisoboti_${period}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer,
    };
  }

  async getHemisSyncLogs(limit = 20) {
    const logs = await this.prisma.systemAuditLog.findMany({
      where: {
        OR: [
          { action: { in: ['HEMIS_SYNC', 'HEMIS_SYNC_DEMO', 'HEMIS_STUB_SYNC', 'HEMIS_LIVE_SYNC', 'HEMIS_SYNC_FAILED'] } },
          { entity: 'Integration' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 20,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
          },
        },
      },
    });

    return logs.map((log) => {
      let parsedDetails: any = null;
      if (log.details) {
        try {
          parsedDetails = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        } catch {
          parsedDetails = { raw: log.details };
        }
      }
      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        createdAt: log.createdAt,
        user: log.user,
        details: parsedDetails,
        ipAddress: log.ipAddress,
      };
    });
  }
}
