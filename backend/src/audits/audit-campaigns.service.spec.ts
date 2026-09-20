import { Test, TestingModule } from '@nestjs/testing';
import { AuditCampaignsService } from './audit-campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CampaignStatus, AuditStatus, AuditRecordStatus, RoleType, NotificationType } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AuditCampaignsService (Unit Tests)', () => {
  let service: AuditCampaignsService;
  let prisma: any;
  let systemAudit: any;
  let documentStamps: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      room: {
        findMany: jest.fn(),
      },
      itemInstance: {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryCampaign: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryAudit: {
        update: jest.fn(),
      },
      inventoryAuditRecord: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', fullName: 'Aliyev Vali', role: RoleType.AUDITOR }),
      },
      documentStamp: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'stamp-1',
          docNumber: 'CMP-2026-001',
          signerName: 'Aliyev Vali',
          signerRole: 'Bosh Auditor / Komissiya Raisi',
          verificationHash: 'SHA256-TEST-HASH',
          createdAt: new Date(),
        }),
      },
      $transaction: jest.fn((cb) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    documentStamps = {
      stampDocument: jest.fn().mockResolvedValue({ id: 'stamp-1' }),
    };

    notifications = {
      create: jest.fn().mockResolvedValue(null),
      notifyRole: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditCampaignsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: documentStamps },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AuditCampaignsService>(AuditCampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if no valid rooms found', async () => {
      prisma.room.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          {
            title: 'Test Campaign',
            periodStart: '2026-09-01',
            periodEnd: '2026-09-30',
            roomIds: ['invalid-room'],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create campaign with scopes and log audit', async () => {
      prisma.room.findMany.mockResolvedValue([{ id: 'room-1' }, { id: 'room-2' }]);
      prisma.inventoryCampaign.create.mockResolvedValue({
        id: 'camp-1',
        campaignNumber: 'CMP-2026-TEST1',
        title: 'Test Campaign',
        status: CampaignStatus.PLANNED,
        scopes: [{ roomId: 'room-1' }, { roomId: 'room-2' }],
      });

      const result = await service.create(
        {
          title: 'Test Campaign',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          roomIds: ['room-1', 'room-2'],
        },
        'user-1',
      );

      expect(result.id).toBe('camp-1');
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'InventoryCampaign',
          entityId: 'camp-1',
        }),
      );
    });
  });

  describe('start', () => {
    it('should update campaign status to IN_PROGRESS and log audit', async () => {
      prisma.inventoryCampaign.findUnique.mockResolvedValue({
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        title: 'Autumn Audit',
        status: CampaignStatus.PLANNED,
      });
      prisma.inventoryCampaign.update.mockResolvedValue({
        id: 'camp-1',
        status: CampaignStatus.IN_PROGRESS,
      });

      const result = await service.start('camp-1', 'user-1');
      expect(result.status).toBe(CampaignStatus.IN_PROGRESS);
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'START',
          entity: 'InventoryCampaign',
        }),
      );
    });
  });

  describe('getProgress', () => {
    it('should calculate room-by-room progress and aggregated totals', async () => {
      prisma.inventoryCampaign.findUnique.mockResolvedValue({
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        title: 'Autumn Audit',
        status: CampaignStatus.IN_PROGRESS,
        scopes: [
          {
            room: {
              id: 'room-1',
              number: '101',
              name: 'Fizika lab',
              building: 'Bosh bino',
              department: { name: 'Fizika' },
              responsibleUser: { fullName: 'Ali Valiyev', phone: '+998901234567' },
            },
          },
        ],
        audits: [
          {
            id: 'audit-1',
            roomId: 'room-1',
            status: AuditStatus.COMPLETED,
            records: [
              { status: AuditRecordStatus.MATCHED },
              { status: AuditRecordStatus.MATCHED },
              { status: AuditRecordStatus.MISSING },
            ],
          },
        ],
      });

      prisma.itemInstance.count.mockResolvedValue(3);

      const progress = await service.getProgress('camp-1');
      expect(progress.totals.totalRooms).toBe(1);
      expect(progress.totals.completedRooms).toBe(1);
      expect(progress.totals.progressPercent).toBe(100);
      expect(progress.totals.totalMatched).toBe(2);
      expect(progress.totals.totalMissing).toBe(1);
      expect(progress.rooms[0].roomNumber).toBe('101');
      expect(progress.rooms[0].isCompleted).toBe(true);
    });
  });

  describe('complete', () => {
    it('should complete campaign, notify MOLs & HEAD_WAREHOUSE, and stamp INV-19', async () => {
      const mockCampaign = {
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        title: 'Autumn Audit',
        status: CampaignStatus.IN_PROGRESS,
        scopes: [{ room: { id: 'room-1', number: '101', name: 'Lab' } }],
        createdBy: { fullName: 'Komissiya Raisi' },
        audits: [
          {
            id: 'audit-1',
            roomId: 'room-1',
            status: AuditStatus.IN_PROGRESS,
            records: [
              {
                status: AuditRecordStatus.MISSING,
                itemInstance: {
                  id: 'item-1',
                  inventoryNumber: 'INV-100',
                  responsibleUserId: 'mol-1',
                  responsibleUser: { fullName: 'Qodir Karimov' },
                  item: { name: 'Proyektor' },
                },
              },
            ],
          },
        ],
      };

      prisma.inventoryCampaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.itemInstance.findMany.mockResolvedValue([]);
      prisma.inventoryCampaign.update.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.COMPLETED,
      });

      const result = await service.complete('camp-1', 'user-1', 'Barcha xonalar tekshirildi');
      expect(result.status).toBe(CampaignStatus.COMPLETED);

      // Verify notification sent to MOL
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'mol-1',
          type: NotificationType.WARNING,
        }),
      );

      // Verify notification sent to HEAD_WAREHOUSE
      expect(notifications.notifyRole).toHaveBeenCalledWith(
        RoleType.HEAD_WAREHOUSE,
        expect.any(String),
        expect.any(String),
        NotificationType.AUDIT,
        '/audit-campaigns',
      );

      // Verify INV-19 stamping
      expect(documentStamps.stampDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          docType: 'INV_19',
          docNumber: 'CMP-2026-001',
          signerName: 'Aliyev Vali',
        }),
      );

      // Verify audit log
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPLETE',
          entity: 'InventoryCampaign',
        }),
      );
    });

    it('should accept custom signerName, signerRole and signatureHash in CompleteCampaignDto', async () => {
      const mockCampaign = {
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        title: 'Semestr Inventarizatsiyasi',
        status: CampaignStatus.IN_PROGRESS,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        createdBy: { fullName: 'Eski User' },
        scopes: [{ roomId: 'room-1', room: { number: '101', name: 'Lab' } }],
        audits: [],
      };

      prisma.inventoryCampaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.inventoryCampaign.update.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.COMPLETED,
      });

      const result = await service.complete('camp-1', 'user-1', {
        notes: 'Tekshiruv muvaffaqiyatli o‘tdi',
        signerName: 'Qosim Jo‘rayev',
        signerRole: 'Komissiya Raisi',
        signatureHash: 'SHA256-HASH-XYZ',
      });

      expect(result.status).toBe(CampaignStatus.COMPLETED);
      expect(documentStamps.stampDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          docType: 'INV_19',
          docNumber: 'CMP-2026-001',
          signerName: 'Qosim Jo‘rayev',
          signerRole: 'Komissiya Raisi',
        }),
      );
    });
  });

  describe('exportCampaignExcel', () => {
    it('should generate a 3-sheet INV-19 Excel workbook and log REPORT_EXPORT audit', async () => {
      const mockCampaign = {
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        title: 'Yillik Inventarizatsiya',
        status: CampaignStatus.COMPLETED,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        notes: 'Barcha xonalar tekshirildi',
        createdBy: { fullName: 'Aliyev Vali', username: 'auditor1' },
        scopes: [
          {
            roomId: 'room-1',
            room: {
              id: 'room-1',
              number: '204',
              name: 'Fizika laboratoriyasi',
              building: 'B bino',
              department: { name: 'Fizika kafedrasi' },
              responsibleUser: { fullName: 'Karim Karimov', phone: '+998901234567' },
            },
          },
        ],
        audits: [
          {
            id: 'audit-1',
            roomId: 'room-1',
            status: AuditStatus.COMPLETED,
            records: [
              {
                status: AuditRecordStatus.MATCHED,
                itemInstanceId: 'inst-1',
                itemInstance: {
                  id: 'inst-1',
                  inventoryNumber: 'INV-101',
                  item: { name: 'Mikroskop' },
                  room: { number: '204', name: 'Fizika lab' },
                  responsibleUser: { fullName: 'Karim Karimov' },
                },
              },
            ],
          },
        ],
      };

      prisma.inventoryCampaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.itemInstance.count.mockResolvedValue(1);

      const excelResult = await service.exportCampaignExcel('camp-1', 'user-1');

      expect(excelResult).toBeDefined();
      expect(excelResult.filename).toMatch(/^UWMS_INV19_CMP-2026-001_.*\.xlsx$/);
      expect(excelResult.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(Buffer.isBuffer(excelResult.buffer)).toBe(true);

      // Verify REPORT_EXPORT audit log
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPORT_EXPORT',
          entity: 'InventoryCampaign',
          entityId: 'camp-1',
        }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel campaign and log audit', async () => {
      prisma.inventoryCampaign.findUnique.mockResolvedValue({
        id: 'camp-1',
        campaignNumber: 'CMP-2026-001',
        status: CampaignStatus.PLANNED,
      });
      prisma.inventoryCampaign.update.mockResolvedValue({
        id: 'camp-1',
        status: CampaignStatus.CANCELLED,
      });

      const result = await service.cancel('camp-1', 'user-1', 'Rektorat buyrug‘iga asosan');
      expect(result.status).toBe(CampaignStatus.CANCELLED);
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CANCEL',
          entity: 'InventoryCampaign',
        }),
      );
    });
  });
});
