import { Test, TestingModule } from '@nestjs/testing';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../common/code-generator.service';
import { SequenceService } from '../common/services/sequence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { DocumentStampsService } from '../document-stamps/document-stamps.service';
import { TransferStatus, AssetStatus, MovementType, RoleType, HandoverStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TransfersService (Unit Tests)', () => {
  let service: TransfersService;
  let prisma: any;
  let notifications: any;
  let systemAudit: any;
  let documentStamps: any;
  let sequenceService: any;

  beforeEach(async () => {
    prisma = {
      transferAcceptance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      itemInstance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      room: {
        findUnique: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where?.id || 'user-1',
            role: where?.id?.includes('wh') ? RoleType.HEAD_WAREHOUSE : RoleType.MOL,
            fullName: 'Test User',
          }),
        ),
      },
      documentArchive: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1', movementNumber: 'MOV-2026-0001' }),
        count: jest.fn().mockResolvedValue(0),
      },
      stockMovementItem: {
        create: jest.fn(),
      },
      assetHistory: {
        create: jest.fn(),
      },
      building: {
        findUnique: jest.fn(),
      },
      responsibilityHandover: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      handoverItemAction: {
        create: jest.fn(),
      },
      signingSession: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
      },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };

    notifications = {
      create: jest.fn().mockResolvedValue(null),
      notifyRole: jest.fn().mockResolvedValue(null),
    };

    systemAudit = {
      log: jest.fn().mockResolvedValue(null),
    };

    documentStamps = {
      stampDocument: jest.fn().mockResolvedValue({ id: 'stamp-1' }),
    };

    sequenceService = {
      nextMovementNumber: jest.fn().mockResolvedValue('MOV-2026-0001'),
      nextDocNumber: jest.fn().mockResolvedValue('OS1-2026-0001'),
      nextNumber: jest.fn().mockResolvedValue('AKT-2026-0001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        CodeGeneratorService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: SystemAuditService, useValue: systemAudit },
        { provide: DocumentStampsService, useValue: documentStamps },
        { provide: SequenceService, useValue: sequenceService },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  describe('getTransfers', () => {
    it('topshirish arizalari ro‘yxatini to‘g‘ri shakllantirishi kerak', async () => {
      prisma.transferAcceptance.findMany.mockResolvedValue([
        {
          id: 'trf-1',
          assetId: 'asset-1',
          status: TransferStatus.PENDING,
          isReturn: false,
          note: 'Ko‘chirish',
          fromRoom: { number: '101', name: 'Lab 1' },
          toRoom: { number: '102', name: 'Lab 2' },
          toWarehouse: null,
          sender: { fullName: 'Aliyev Ali' },
          receiver: { fullName: 'Valiyev Vali' },
          receiverId: 'user-2',
          createdAt: new Date('2026-09-19T10:00:00Z'),
          acceptedAt: null,
          asset: {
            inventoryNumber: 'INV-2026-0001',
            item: { name: 'Kompyuter', model: 'Dell' },
          },
        },
      ]);

      const result = await service.getTransfers();
      expect(result).toHaveLength(1);
      expect(result[0].assetName).toBe('Kompyuter');
      expect(result[0].status).toBe(TransferStatus.PENDING);
      expect(result[0].fromRoomName).toBe('101-xona: Lab 1');
      expect(result[0].toRoomName).toBe('102-xona: Lab 2');
    });
  });

  describe('transferAsset', () => {
    it('uskunani ko‘chirish uchun PENDING transferAcceptance yaratishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-1',
        roomId: 'room-1',
        room: { number: '101', name: 'Lab 1' },
      });
      prisma.room.findUnique.mockResolvedValue({
        id: 'room-2',
        number: '102',
        name: 'Lab 2',
        responsibleUserId: 'mol-2',
      });
      prisma.transferAcceptance.create.mockResolvedValue({
        id: 'trf-created-1',
        assetId: 'asset-1',
        status: TransferStatus.PENDING,
      });

      const res = await service.transferAsset('asset-1', {
        toRoomId: 'room-2',
        note: 'Yangi laboratoriyaga berildi',
        executedById: 'admin-1',
      });

      expect(res.status).toBe(TransferStatus.PENDING);
      expect(prisma.transferAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            toRoomId: 'room-2',
            receiverId: 'mol-2',
            status: TransferStatus.PENDING,
          }),
        }),
      );
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'KO‘CHIRISHGA_YUBORILDI',
          }),
        }),
      );
    });

    it('aktiv topilmasa NotFoundException berishi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue(null);
      await expect(
        service.transferAsset('not-found', { toRoomId: 'room-2' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('respondTransfer', () => {
    it('ACCEPTED bo‘lganda aktivni yangi xona va mas’ul shaxsga biriktirishi kerak', async () => {
      prisma.transferAcceptance.findUnique.mockResolvedValue({
        id: 'trf-1',
        assetId: 'asset-1',
        status: TransferStatus.PENDING,
        isReturn: false,
        fromRoom: { number: '101', name: 'Lab 1' },
        toRoom: { number: '102', name: 'Lab 2' },
        toRoomId: 'room-2',
        receiverId: 'user-mol-2',
        sender: { fullName: 'Aliyev Ali' },
        receiver: { fullName: 'Valiyev Vali' },
        asset: { itemId: 'item-1', fundingSource: 'BYUDJET', item: { name: 'Dell' } },
      });
      prisma.transferAcceptance.update.mockResolvedValue({
        id: 'trf-1',
        status: TransferStatus.ACCEPTED,
      });

      const res = await service.respondTransfer('trf-1', {
        status: 'ACCEPTED',
        note: 'Qabul qildim',
        responderId: 'user-mol-2',
      });

      expect(res.status).toBe(TransferStatus.ACCEPTED);
      expect(prisma.itemInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            roomId: 'room-2',
            responsibleUserId: 'user-mol-2',
            status: AssetStatus.IN_USE,
          }),
        }),
      );
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TOPSHIRILDI_QABUL_QILINDI',
          }),
        }),
      );
    });

    it('omborga qaytarish ACCEPTED bo‘lganda ombor harakatini yaratishi va aktivni bo‘shatishi kerak', async () => {
      prisma.transferAcceptance.findUnique.mockResolvedValue({
        id: 'trf-ret-1',
        assetId: 'asset-1',
        status: TransferStatus.PENDING,
        isReturn: true,
        fromRoom: { number: '101', name: 'Lab 1' },
        toWarehouse: { name: 'Bosh ombor' },
        fromRoomId: 'room-1',
        toWarehouseId: 'wh-main',
        senderId: 'user-mol-1',
        receiverId: 'user-wh-1',
        sender: { fullName: 'Aliyev Ali' },
        receiver: { fullName: 'Omborchi Omon' },
        asset: { itemId: 'item-1', fundingSource: 'BYUDJET', item: { name: 'Dell' } },
      });
      prisma.transferAcceptance.update.mockResolvedValue({
        id: 'trf-ret-1',
        status: TransferStatus.ACCEPTED,
      });

      const res = await service.respondTransfer('trf-ret-1', {
        status: 'ACCEPTED',
        note: 'Omborga qabul qilindi',
        responderId: 'user-wh-1',
      });

      expect(res.status).toBe(TransferStatus.ACCEPTED);
      expect(prisma.itemInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            roomId: null,
            responsibleUserId: null,
            status: AssetStatus.NEW,
          }),
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: MovementType.RETURN,
          }),
        }),
      );
    });

    it('REJECTED bo‘lganda arizani rad etishi va audit tarixini yozishi kerak', async () => {
      prisma.transferAcceptance.findUnique.mockResolvedValue({
        id: 'trf-rej-1',
        assetId: 'asset-1',
        status: TransferStatus.PENDING,
        isReturn: false,
        fromRoom: { number: '101', name: 'Lab 1' },
        toRoom: { number: '102', name: 'Lab 2' },
        sender: { fullName: 'Aliyev' },
        receiver: { fullName: 'Valiyev' },
        asset: { item: { name: 'Dell' } },
      });
      prisma.transferAcceptance.update.mockResolvedValue({
        id: 'trf-rej-1',
        status: TransferStatus.REJECTED,
      });

      const res = await service.respondTransfer('trf-rej-1', {
        status: 'REJECTED',
        note: 'Uskuna shikastlangan',
      });

      expect(res.status).toBe(TransferStatus.REJECTED);
      expect(prisma.assetHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'KO‘CHIRISH_RAD_ETILDI',
          }),
        }),
      );
    });
  });

  describe('transferBatch', () => {
    it('bir nechta asosiy vositani ommaviy ko‘chirishi kerak', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: 'room-target',
        number: '204',
        name: 'Seminar xonasi',
        responsibleUserId: 'mol-target',
      });
      prisma.itemInstance.updateMany.mockResolvedValue({ count: 3 });

      const res = await service.transferBatch({
        assetIds: ['a-1', 'a-2', 'a-3'],
        toRoomId: 'room-target',
        executedById: 'admin-1',
      });

      expect(res.count).toBe(3);
      expect(prisma.itemInstance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['a-1', 'a-2', 'a-3'] } },
          data: { roomId: 'room-target', responsibleUserId: 'mol-target' },
        }),
      );
      expect(prisma.assetHistory.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('returnAsset', () => {
    it('aktiv hisobdan chiqarilgan bo‘lsa qaytarishga yo‘l qo‘ymasligi kerak', async () => {
      prisma.itemInstance.findUnique.mockResolvedValue({
        id: 'asset-written-off',
        status: AssetStatus.WRITTEN_OFF,
      });

      await expect(
        service.returnAsset(
          { assetId: 'asset-written-off', reason: 'Ortiqcha' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('massMolHandoff', () => {
    it('barcha aktivlarni yangi mas’ul shaxsga rasmiy topshirishi kerak', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'old-mol', fullName: 'Eski Mudir' })
        .mockResolvedValueOnce({ id: 'new-mol', fullName: 'Yangi Mudir', position: 'Kafedra mudiri' });
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          inventoryNumber: 'INV-001',
          room: { number: '101', name: 'Xona 1' },
          item: { name: 'PC 1' },
        },
      ]);
      prisma.itemInstance.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.massMolHandoff(
        { fromUserId: 'old-mol', toUserId: 'new-mol' },
        'admin-1',
      );

      expect(res.success).toBe(true);
      expect(res.transferredCount).toBe(1);
      expect(prisma.itemInstance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { responsibleUserId: 'new-mol' },
        }),
      );
      expect(documentStamps.stampDocument).toHaveBeenCalled();
    });
  });

  describe('ResponsibilityHandover (Phase 1 Tests)', () => {
    it('yangi moddiy javobgarlik topshirish arizasini PENDING_SIGNATURES holatida yaratishi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-mol', fullName: 'Aliyev Anvar' });
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          responsibleUserId: 'user-mol',
          inventoryNumber: 'INV-001',
          item: { name: 'Kompyuter' },
          room: { id: 'room-1', number: '204', building: 'Bosh bino' },
        },
      ]);
      prisma.responsibilityHandover.create.mockResolvedValue({
        id: 'handover-1',
        handoverNumber: 'AKT-2026-0001',
        type: 'FULL_TRANSFER',
        status: 'PENDING_SIGNATURES',
        items: [{ id: 'action-1', itemInstanceId: 'asset-1', actionType: 'TRANSFER_TO_MOL' }],
      });

      const res = await service.createResponsibilityHandover(
        {
          type: 'FULL_TRANSFER' as any,
          departingUserId: 'user-mol',
          targetUserId: 'target-mol',
          items: [
            {
              itemInstanceId: 'asset-1',
              actionType: 'TRANSFER_TO_MOL' as any,
            },
          ],
        },
        'user-mol',
      );

      expect(res.id).toBe('handover-1');
      expect(prisma.responsibilityHandover.create).toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalled();
      expect(systemAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'RESPONSIBILITY_HANDOVER',
        }),
      );
    });

    it('boshqa xodimga tegishli ashyoni topshirishga uringanda BadRequestException berishi kerak', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-mol', fullName: 'Aliyev Anvar' });
      prisma.itemInstance.findMany.mockResolvedValue([
        {
          id: 'asset-1',
          responsibleUserId: 'different-user',
          inventoryNumber: 'INV-001',
          item: { name: 'Kompyuter' },
        },
      ]);

      await expect(
        service.createResponsibilityHandover(
          {
            type: 'FULL_TRANSFER' as any,
            departingUserId: 'user-mol',
            items: [{ itemInstanceId: 'asset-1', actionType: 'TRANSFER_TO_MOL' as any }],
          },
          'user-mol',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('executeResponsibilityHandoverTransaction da barcha aktivlar atomik ko‘chishi va status COMPLETED bo‘lishi kerak', async () => {
      const mockHandover = {
        id: 'handover-1',
        handoverNumber: 'AKT-2026-0001',
        type: 'FULL_TRANSFER',
        status: 'PENDING_SIGNATURES',
        departingUserId: 'old-mol',
        targetUserId: 'new-mol',
        targetWarehouseId: 'wh-1',
        departingUser: { id: 'old-mol', fullName: 'Eski MOL' },
        targetUser: { id: 'new-mol', fullName: 'Yangi MOL' },
        items: [
          {
            actionType: 'TRANSFER_TO_MOL',
            itemInstance: { id: 'item-1', itemId: 'it-1', room: { number: '101', building: 'Bosh bino' }, item: { name: 'Kompyuter' } },
          },
          {
            actionType: 'RETURN_TO_WAREHOUSE',
            itemInstance: { id: 'item-2', itemId: 'it-2', room: null, item: { name: 'Printer' }, fundingSource: 'BYUDJET' },
          },
          {
            actionType: 'SHORTAGE',
            itemInstance: { id: 'item-3', itemId: 'it-3', room: null, item: { name: 'Monitor' } },
            investigationNote: 'Topilmadi',
          },
        ],
      };

      prisma.responsibilityHandover.findUnique.mockResolvedValue(mockHandover);
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1', name: 'Asosiy Ombor', managerId: 'wh-manager' });
      prisma.user.findUnique.mockResolvedValue({ id: 'new-mol', fullName: 'Yangi MOL' });
      prisma.responsibilityHandover.update.mockResolvedValue({
        ...mockHandover,
        status: 'COMPLETED',
      });

      const res = await service.executeResponsibilityHandoverTransaction('handover-1', 'admin-1');

      expect(res.status).toBe('COMPLETED');
      // Verify TRANSFER_TO_MOL updated item-1
      expect(prisma.itemInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ responsibleUserId: 'new-mol' }),
        }),
      );
      // Verify RETURN_TO_WAREHOUSE updated item-2 with warehouse manager
      expect(prisma.itemInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-2' },
          data: expect.objectContaining({ responsibleUserId: 'wh-manager' }),
        }),
      );
      // Verify SHORTAGE updated item-3 to MISSING
      expect(prisma.itemInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-3' },
          data: expect.objectContaining({ status: AssetStatus.MISSING }),
        }),
      );
    });

    it('submitResponsibilityHandover: DRAFT holatidagi arizani RECEIVER_REVIEW ga o‘tkazishi va xabarnoma yuborishi kerak', async () => {
      const mockDraft = {
        id: 'handover-draft',
        handoverNumber: 'AKT-2026-0009',
        status: HandoverStatus.DRAFT,
        departingUserId: 'user-mol',
        targetUserId: 'target-mol',
        departingUser: { id: 'user-mol', fullName: 'Aliyev Anvar' },
      };

      prisma.responsibilityHandover.findUnique.mockResolvedValue(mockDraft);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-mol', role: RoleType.MOL });
      prisma.responsibilityHandover.update.mockResolvedValue({
        ...mockDraft,
        status: HandoverStatus.RECEIVER_REVIEW,
      });

      const res = await service.submitResponsibilityHandover('handover-draft', 'user-mol');
      expect(res.status).toBe(HandoverStatus.RECEIVER_REVIEW);
      expect(prisma.responsibilityHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'handover-draft' },
          data: { status: HandoverStatus.RECEIVER_REVIEW },
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-mol',
        }),
      );
    });

    it('cancelResponsibilityHandover: arizani CANCELLED holatiga o‘tkazishi kerak', async () => {
      const mockPending = {
        id: 'handover-pending',
        handoverNumber: 'AKT-2026-0010',
        status: HandoverStatus.SUBMITTED,
        departingUserId: 'user-mol',
        departingUser: { id: 'user-mol', fullName: 'Aliyev Anvar' },
      };

      prisma.responsibilityHandover.findUnique.mockResolvedValue(mockPending);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-mol', role: RoleType.MOL });
      prisma.responsibilityHandover.update.mockResolvedValue({
        ...mockPending,
        status: HandoverStatus.CANCELLED,
      });

      const res = await service.cancelResponsibilityHandover('handover-pending', { reason: 'Xato topshirildi' }, 'user-mol');
      expect(res.status).toBe(HandoverStatus.CANCELLED);
      expect(prisma.responsibilityHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'handover-pending' },
          data: expect.objectContaining({ status: HandoverStatus.CANCELLED }),
        }),
      );
    });

    it('signResponsibilityHandover: barcha 3 ta mas’ul imzolaganda status PENDING_APPROVAL bo‘lishi kerak', async () => {
      const mockHandover = {
        id: 'handover-sign',
        handoverNumber: 'AKT-2026-0011',
        status: HandoverStatus.COMMANDANT_REVIEW,
        departingUserId: 'user-old',
        targetUserId: 'user-new',
        commandantUserId: 'user-cmd',
        accountantUserId: 'user-acc',
        departingUser: { id: 'user-old', fullName: 'Eski MOL' },
        targetUser: { id: 'user-new', fullName: 'Yangi MOL' },
        commandantUser: { id: 'user-cmd', fullName: 'Komendant' },
        accountantUser: { id: 'user-acc', fullName: 'Hisobchi' },
        items: [{ id: 'item-1' }],
      };

      prisma.responsibilityHandover.findUnique.mockResolvedValue(mockHandover);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-acc', role: RoleType.EMPLOYEE, fullName: 'Hisobchi' });
      // Signed sessions for TARGET and COMMANDANT already present, now ACCOUNTANT signs
      prisma.signingSession.findMany.mockResolvedValue([
        { docNumber: 'AKT-2026-0011', status: 'SIGNED', signedById: 'user-new', metadataJson: '{"signatoryRole":"TARGET"}' },
        { docNumber: 'AKT-2026-0011', status: 'SIGNED', signedById: 'user-cmd', metadataJson: '{"signatoryRole":"COMMANDANT"}' },
        { docNumber: 'AKT-2026-0011', status: 'SIGNED', signedById: 'user-acc', metadataJson: '{"signatoryRole":"ACCOUNTANT"}' },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'finance-1', role: RoleType.VICE_RECTOR_FINANCE }]);
      prisma.responsibilityHandover.update.mockResolvedValue({
        ...mockHandover,
        status: HandoverStatus.PENDING_APPROVAL,
      });

      const res = await service.signResponsibilityHandover('handover-sign', { note: 'Buxgalteriya ko‘rigi yakunlandi' }, 'user-acc');
      expect(res.status).toBe(HandoverStatus.PENDING_APPROVAL);
      expect(prisma.responsibilityHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'handover-sign' },
          data: expect.objectContaining({ status: HandoverStatus.PENDING_APPROVAL }),
        }),
      );
    });

    it('rejectResponsibilityHandover: arizani REJECTED holatiga o‘tkazishi va xabarnoma yuborishi kerak', async () => {
      const mockHandover = {
        id: 'handover-rej',
        handoverNumber: 'AKT-2026-0012',
        status: HandoverStatus.RECEIVER_REVIEW,
        departingUserId: 'user-old',
        targetUserId: 'user-new',
        departingUser: { id: 'user-old', fullName: 'Eski MOL' },
      };

      prisma.responsibilityHandover.findUnique.mockResolvedValue(mockHandover);
      prisma.responsibilityHandover.update.mockResolvedValue({
        ...mockHandover,
        status: HandoverStatus.REJECTED,
      });

      const res = await service.rejectResponsibilityHandover('handover-rej', { reason: 'Ashyolar butun emas' }, 'user-new');
      expect(res.status).toBe(HandoverStatus.REJECTED);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-old',
          title: 'Topshirish Dalolatnomasi Rad Etildi',
        }),
      );
    });
  });
});
