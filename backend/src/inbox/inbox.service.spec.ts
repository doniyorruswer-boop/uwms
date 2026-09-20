import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType, TransferStatus, RequestStatus, WriteOffStatus, VoteStatus } from '@prisma/client';

describe('InboxService (Unit Tests)', () => {
  let service: InboxService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      transferAcceptance: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      request: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      writeOffMemberVote: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryCampaign: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryAudit: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      responsibilityHandover: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);
  });

  describe('getUserInbox', () => {
    it('should aggregate tasks correctly for SUPER_ADMIN', async () => {
      prisma.transferAcceptance.findMany.mockResolvedValue([
        { id: 'trans-1', status: TransferStatus.PENDING },
      ]);
      prisma.request.findMany
        .mockResolvedValueOnce([{ id: 'req-1', status: RequestStatus.PENDING }]) // pending requests
        .mockResolvedValueOnce([{ id: 'req-overquota', isOverQuota: true }]); // overQuotaRequests
      prisma.writeOffMemberVote.findMany.mockResolvedValue([
        { id: 'vote-1', vote: VoteStatus.PENDING },
      ]);
      prisma.inventoryCampaign.findMany.mockResolvedValue([
        { id: 'camp-1', _count: { audits: 0, scopes: 2 }, createdAt: new Date() },
      ]);
      prisma.inventoryAudit.findMany.mockResolvedValue([]);
      prisma.stock.findMany.mockResolvedValue([
        {
          id: 'stock-1',
          quantity: 2,
          item: { name: 'Qalam', minStockLimit: 10, category: { name: 'Kantselyariya' } },
        },
      ]);

      const adminUser = { id: 'admin-1', role: RoleType.SUPER_ADMIN };
      const res = await service.getUserInbox(adminUser);

      expect(res.summary.pendingTransfersCount).toBe(1);
      expect(res.summary.pendingRequestsCount).toBe(1);
      expect(res.summary.pendingWriteOffVotesCount).toBe(1);
      expect(res.summary.openAuditsCount).toBe(1);
      expect(res.summary.lowStockAlertsCount).toBe(1);
      expect(res.summary.overQuotaRequestsCount).toBe(1);
      expect(res.summary.totalPendingCount).toBe(6);
    });

    it('should isolate tasks for MOL role and not return low stock alerts', async () => {
      prisma.transferAcceptance.findMany.mockResolvedValue([
        { id: 'trans-mol', status: TransferStatus.PENDING, receiverId: 'mol-1' },
      ]);
      prisma.request.findMany.mockResolvedValue([
        { id: 'req-mol', requesterId: 'mol-1', status: RequestStatus.PENDING },
      ]);
      prisma.writeOffMemberVote.findMany.mockResolvedValue([]);
      prisma.inventoryCampaign.findMany.mockResolvedValue([]);

      const molUser = { id: 'mol-1', role: RoleType.MOL, departmentId: 'dept-it' };
      const res = await service.getUserInbox(molUser);

      expect(res.summary.pendingTransfersCount).toBe(1);
      expect(res.summary.pendingRequestsCount).toBe(1);
      expect(res.summary.pendingWriteOffVotesCount).toBe(0);
      expect(res.summary.lowStockAlertsCount).toBe(0); // MOL does not manage warehouse low stock
      expect(res.lowStockAlerts).toEqual([]);
      expect(res.summary.totalPendingCount).toBe(2);

      // Verify prisma was queried with receiverId or toRoom condition
      expect(prisma.transferAcceptance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TransferStatus.PENDING,
            OR: expect.arrayContaining([
              { receiverId: 'mol-1' },
              { toRoom: { departmentId: 'dept-it' } },
            ]),
          }),
        }),
      );
    });

    it('should query return transfers and stock alerts for HEAD_WAREHOUSE', async () => {
      prisma.transferAcceptance.findMany.mockResolvedValue([
        { id: 'trans-ret', isReturn: true, status: TransferStatus.PENDING },
      ]);
      prisma.request.findMany.mockResolvedValue([]);
      prisma.writeOffMemberVote.findMany.mockResolvedValue([]);
      prisma.inventoryCampaign.findMany.mockResolvedValue([]);
      prisma.inventoryAudit.findMany.mockResolvedValue([]);
      prisma.stock.findMany.mockResolvedValue([
        {
          id: 'stock-paper',
          quantity: 1,
          item: { name: 'Qog‘oz A4', minStockLimit: 20 },
        },
      ]);

      const whUser = { id: 'wh-1', role: RoleType.HEAD_WAREHOUSE };
      const res = await service.getUserInbox(whUser);

      expect(res.summary.pendingTransfersCount).toBe(1);
      expect(res.summary.lowStockAlertsCount).toBe(1);
      expect(prisma.transferAcceptance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TransferStatus.PENDING,
            OR: [{ isReturn: true }, { toWarehouseId: { not: null } }],
          }),
        }),
      );
    });
  });
});
