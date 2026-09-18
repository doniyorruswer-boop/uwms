import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('IntegrationsService (Unit Tests)', () => {
  let service: IntegrationsService;
  let prisma: any;
  let systemAuditService: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      department: {
        count: jest.fn().mockResolvedValue(10),
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'dept-1' }),
      },
      room: { count: jest.fn().mockResolvedValue(20), findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      user: { count: jest.fn().mockResolvedValue(15) },
      systemAuditLog: { findFirst: jest.fn().mockResolvedValue(null) },
      itemInstance: { findMany: jest.fn().mockResolvedValue([]) },
      stockMovement: { findMany: jest.fn().mockResolvedValue([]) },
      stock: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('API URL sozlanmaganda status NOT_CONFIGURED qaytarishi kerak (getHemisStatus)', async () => {
    delete process.env.HEMIS_API_URL;
    delete process.env.HEMIS_MODE;

    const res = await service.getHemisStatus();
    expect(res.status).toBe('NOT_CONFIGURED');
    expect(res.isConfigured).toBe(false);
    expect(res.mode).toBe('NOT_CONFIGURED');
    expect(res.stats.syncedDepartments).toBe(10);
  });

  it('HEMIS_MODE=DEMO_STUB bo‘lganda status DEMO_STUB qaytarishi kerak', async () => {
    process.env.HEMIS_MODE = 'DEMO_STUB';

    const res = await service.getHemisStatus();
    expect(res.status).toBe('DEMO_STUB');
    expect(res.mode).toBe('DEMO_STUB');
  });

  it('API URL berilmaganda va test ping qilinganda BadRequestException otishi kerak', async () => {
    await expect(service.testHemisConnection({})).rejects.toThrow(BadRequestException);
  });

  it('DEMO_STUB rejimida syncHemis chaqirilganda isDemoStub=true va HEMIS_STUB_SYNC audit yozilishi kerak', async () => {
    const res = await service.syncHemis({ mode: 'DEMO_STUB' }, 'user-uuid');
    expect(res.success).toBe(true);
    expect(res.isDemoStub).toBe(true);
    expect(res.mode).toBe('DEMO_STUB');
    expect(systemAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HEMIS_STUB_SYNC',
      }),
    );
  });

  it('Sozlanmagan holda va stub rejimisiz syncHemis chaqirilsa BadRequestException otishi kerak', async () => {
    delete process.env.HEMIS_API_URL;
    await expect(service.syncHemis({}, 'user-uuid')).rejects.toThrow(BadRequestException);
  });
});
