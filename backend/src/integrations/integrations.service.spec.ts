import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService, DEMO_HEMIS_SEED_DATA } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, BadGatewayException } from '@nestjs/common';
import {
  MockHemisAdapter,
  mapHemisDepartment,
  mapHemisRoom,
  mapHemisUser,
} from './hemis-adapter.interface';

describe('IntegrationsService (Unit Tests)', () => {
  let service: IntegrationsService;
  let prisma: any;
  let systemAuditService: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      department: {
        count: jest.fn().mockResolvedValue(10),
        upsert: jest.fn().mockResolvedValue({ id: 'dept-1', code: 'DEP_CS' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'dept-1', code: 'DEP_CS' }),
      },
      room: {
        count: jest.fn().mockResolvedValue(20),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'room-1' }),
        create: jest.fn().mockResolvedValue({ id: 'room-1' }),
      },
      user: {
        count: jest.fn().mockResolvedValue(15),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      systemAuditLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            action: 'HEMIS_LIVE_SYNC',
            entity: 'Integration',
            createdAt: new Date(),
            user: { id: 'u-1', fullName: 'Admin' },
            details: JSON.stringify({ syncedDepartments: 5, syncedRooms: 10, syncedUsers: 20, mode: 'LIVE' }),
          },
        ]),
      },
      itemInstance: { findMany: jest.fn().mockResolvedValue([]) },
      stockMovement: { findMany: jest.fn().mockResolvedValue([]) },
      stock: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    systemAuditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    notificationsService = {
      notifyRole: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: systemAuditService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  afterEach(() => {
    delete process.env.HEMIS_API_URL;
    delete process.env.HEMIS_API_KEY;
    delete process.env.HEMIS_MODE;
  });

  it('API URL va kalit sozlanmaganda va HEMIS_MODE=live bo‘lganda NOT_CONFIGURED qaytarishi kerak', async () => {
    delete process.env.HEMIS_API_URL;
    delete process.env.HEMIS_API_KEY;
    process.env.HEMIS_MODE = 'live';

    const res = await service.getHemisStatus();
    expect(res.status).toBe('NOT_CONFIGURED');
    expect(res.isConfigured).toBe(false);
    expect(res.mode).toBe('NOT_CONFIGURED');
    expect(res.message).toBe('Hozircha demo rejim. HEMIS_API_URL sozlanmagan');
  });

  it('HEMIS_MODE=demo bo‘lganda status DEMO va tegishli ogohlantirish matni qaytarishi kerak', async () => {
    delete process.env.HEMIS_API_URL;
    delete process.env.HEMIS_API_KEY;
    process.env.HEMIS_MODE = 'demo';

    const res = await service.getHemisStatus();
    expect(res.status).toBe('DEMO');
    expect(res.mode).toBe('DEMO');
    expect(res.message).toBe('Hozircha demo rejim. HEMIS_API_URL sozlanmagan');
  });

  it('API sozlamalari mavjud bo‘lib HEMIS_MODE=demo bo‘lganda CONFIGURED_BUT_STUB qaytarishi kerak', async () => {
    process.env.HEMIS_API_URL = 'https://hemis.otm.uz/api';
    process.env.HEMIS_API_KEY = 'secret-key-123';
    process.env.HEMIS_MODE = 'demo';

    const res = await service.getHemisStatus();
    expect(res.status).toBe('CONFIGURED_BUT_STUB');
    expect(res.mode).toBe('DEMO');
  });

  it('Oxirgi sinxron xatolik bilan yakunlangan bo‘lsa status ERROR va lastError xabari qaytarilishi kerak', async () => {
    process.env.HEMIS_API_URL = 'https://hemis.otm.uz/api';
    process.env.HEMIS_API_KEY = 'secret-key-123';
    process.env.HEMIS_MODE = 'live';

    // Mock systemAuditLog to return failed sync as latest
    prisma.systemAuditLog.findFirst = jest.fn().mockImplementation(({ where }) => {
      if (where?.action === 'HEMIS_SYNC_FAILED') {
        return Promise.resolve({
          id: 'log-err',
          action: 'HEMIS_SYNC_FAILED',
          details: { error: 'HEMIS API ulanish vaqti tugadi (Timeout 8000ms)' },
          createdAt: new Date('2026-09-18T10:00:00Z'),
        });
      }
      return Promise.resolve(null);
    });

    // Mock pingHemis
    (service as any).pingHemis = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      pingMs: 45,
    });

    const res = await service.getHemisStatus();
    expect(res.status).toBe('ERROR');
    expect(res.lastError).toBe('HEMIS API ulanish vaqti tugadi (Timeout 8000ms)');
  });

  it('API URL berilmaganda va test ping qilinganda BadRequestException otishi kerak', async () => {
    await expect(service.testHemisConnection({})).rejects.toThrow(BadRequestException);
  });

  it('DEMO rejimida forceDemo=true berilmasa BadRequestException otishi kerak', async () => {
    await expect(service.syncHemis({ mode: 'DEMO' }, 'user-uuid')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('DEMO rejimida forceDemo=true bo‘lganda $transaction orqali bajarilib, HEMIS_SYNC_DEMO audit yozilishi kerak', async () => {
    const res = await service.syncHemis({ mode: 'DEMO', forceDemo: true }, 'user-uuid');
    expect(res.success).toBe(true);
    expect(res.isDemoStub).toBe(true);
    expect(res.mode).toBe('DEMO');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(systemAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HEMIS_SYNC_DEMO',
      }),
    );
  });

  describe('PHASE J: HEMIS Live Sync & Adapter', () => {
    it('MockHemisAdapter yordamida live sinxronizatsiya kafedra, xona va xodimlarni upsert qilishi kerak', async () => {
      const mockAdapter = new MockHemisAdapter(
        [{ code: 'DEP_MATH', name: 'Oliy Matematika Kafedrasi', type: 'DEPARTMENT' }],
        [{ code: '301', name: 'Matematika Auditoriyasi', floor: 3, building: 'Bosh bino', deptCode: 'DEP_MATH' }],
        [{ login: 'karimov_a', full_name: 'Karimov Anvar Saidovich', email: 'anvar@edu.uz', position: 'Dotsent', deptCode: 'DEP_MATH' }],
      );

      service.setAdapter(mockAdapter);

      const res = await service.syncHemis(
        {
          mode: 'LIVE',
          hemisApiUrl: 'https://hemis.university.uz/api',
          apiKey: 'live-bearer-token-xyz',
        },
        'super-admin-id',
      );

      expect(res.success).toBe(true);
      expect(res.mode).toBe('LIVE');
      expect(res.syncedDepartments).toBe(1);
      expect(res.syncedRooms).toBe(1);
      expect(res.syncedUsers).toBe(1);
      expect(prisma.department.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'DEP_MATH' },
        }),
      );
      expect(prisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ number: '301', name: 'Matematika Auditoriyasi' }),
        }),
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ username: 'karimov_a', fullName: 'Karimov Anvar Saidovich' }),
        }),
      );
      expect(systemAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HEMIS_LIVE_SYNC',
          details: expect.objectContaining({
            syncedDepartments: 1,
            syncedRooms: 1,
            syncedUsers: 1,
            status: 'SUCCESS',
          }),
        }),
      );
      expect(notificationsService.notifyRole).toHaveBeenCalled();
    });

    it('Live sinxronizatsiyada tashqi xatolik yuz berganda HEMIS_SYNC_FAILED log yozilib, BadGatewayException otilishi kerak', async () => {
      const failingAdapter = {
        fetchDepartments: jest.fn().mockRejectedValue(new Error('Ulanish rad etildi (ECONNREFUSED)')),
        fetchRooms: jest.fn().mockResolvedValue([]),
        fetchUsers: jest.fn().mockResolvedValue([]),
      };

      service.setAdapter(failingAdapter);

      await expect(
        service.syncHemis(
          {
            mode: 'LIVE',
            hemisApiUrl: 'https://unreachable.hemis.uz',
            apiKey: 'token',
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadGatewayException);

      expect(systemAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HEMIS_SYNC_FAILED',
          details: expect.objectContaining({
            status: 'FAILED',
            error: 'Ulanish rad etildi (ECONNREFUSED)',
          }),
        }),
      );
    });

    it('Mapping funksiyalari (Department, Room, User) tashqi formatlarni to‘g‘ri formatlashi kerak', () => {
      const rawDept = { id: 12, name_uz: 'Fizika Kafedrasi', structureType: { code: '12' } };
      const mappedDept = mapHemisDepartment(rawDept);
      expect(mappedDept).toEqual({
        code: '12',
        name: 'Fizika Kafedrasi',
        type: 'DEPARTMENT',
      });

      const rawRoom = { code: 'AUD-505', name: 'Fizika Laboratoriyasi', floor: 5, building: { name: 'Laboratoriya korpusi' } };
      const mappedRoom = mapHemisRoom(rawRoom);
      expect(mappedRoom).toEqual({
        number: 'AUD-505',
        name: 'Fizika Laboratoriyasi',
        floor: 5,
        building: 'Laboratoriya korpusi',
        deptCode: undefined,
      });

      const rawUser = {
        employee_id_number: 'EMP-9988',
        name: 'Toshmatov Jamshid',
        email: 'jamshid@edu.uz',
        staff_position: { name: 'Katta O‘qituvchi' },
      };
      const mappedUser = mapHemisUser(rawUser);
      expect(mappedUser).toEqual({
        username: 'EMP-9988',
        fullName: 'Toshmatov Jamshid',
        email: 'jamshid@edu.uz',
        phone: null,
        position: 'Katta O‘qituvchi',
        deptCode: undefined,
      });
    });

    it('getHemisSyncLogs sinxronizatsiya audit loglarini to‘g‘ri shakllantirishi kerak', async () => {
      const logs = await service.getHemisSyncLogs(10);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('HEMIS_LIVE_SYNC');
      expect(logs[0].details).toEqual({
        syncedDepartments: 5,
        syncedRooms: 10,
        syncedUsers: 20,
        mode: 'LIVE',
      });
    });
  });
});


