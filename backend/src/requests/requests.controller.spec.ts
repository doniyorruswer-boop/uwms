import { Test, TestingModule } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RoleType, RequestStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { IdempotencyService } from '../idempotency/idempotency.service';

describe('RequestsController (RBAC & Integration Tests)', () => {
  let controller: RequestsController;
  let requestsService: any;

  const mockRequestsService = {
    getAllRequests: jest.fn(),
    createRequest: jest.fn(),
    updateStatus: jest.fn(),
    advanceWorkflowStage: jest.fn(),
    getRequestById: jest.fn(),
  };

  const mockIdempotencyService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: mockRequestsService,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
      ],
    }).compile();

    controller = module.get<RequestsController>(RequestsController);
    requestsService = module.get<RequestsService>(RequestsService);
  });

  describe('RBAC on updateStatus (PATCH /api/requests/:id/status)', () => {
    const requestId = 'req-101';

    describe('APPROVED_BY_PRORECTOR', () => {
      it('should reject non-VICE_RECTOR_FINANCE with ForbiddenException', async () => {
        const user = { id: 'u-emp', role: RoleType.EMPLOYEE };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.APPROVED_BY_PRORECTOR }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow VICE_RECTOR_FINANCE to approve prorektor stage', async () => {
        const user = { id: 'u-vr', role: RoleType.VICE_RECTOR_FINANCE };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.APPROVED_BY_PRORECTOR });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.APPROVED_BY_PRORECTOR, note: 'Viza berildi' }, user);
        expect(res.status).toBe(RequestStatus.APPROVED_BY_PRORECTOR);
        expect(requestsService.updateStatus).toHaveBeenCalledWith(
          requestId,
          RequestStatus.APPROVED_BY_PRORECTOR,
          expect.objectContaining({ approvedById: user.id, currentUser: user }),
        );
      });
    });

    describe('APPROVED_BY_RECTOR', () => {
      it('should reject non-RECTOR (e.g. VICE_RECTOR_FINANCE) with ForbiddenException', async () => {
        const user = { id: 'u-vr', role: RoleType.VICE_RECTOR_FINANCE };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.APPROVED_BY_RECTOR }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow RECTOR to approve rector stage', async () => {
        const user = { id: 'u-rector', role: RoleType.RECTOR };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.APPROVED_BY_RECTOR });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.APPROVED_BY_RECTOR }, user);
        expect(res.status).toBe(RequestStatus.APPROVED_BY_RECTOR);
        expect(requestsService.updateStatus).toHaveBeenCalledWith(
          requestId,
          RequestStatus.APPROVED_BY_RECTOR,
          expect.objectContaining({ approvedById: user.id }),
        );
      });
    });

    describe('FINANCED_BY_ACCOUNTANT', () => {
      it('should reject non-CHIEF_ACCOUNTANT with ForbiddenException', async () => {
        const user = { id: 'u-emp', role: RoleType.EMPLOYEE };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.FINANCED_BY_ACCOUNTANT }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow CHIEF_ACCOUNTANT to approve finance stage', async () => {
        const user = { id: 'u-ca', role: RoleType.CHIEF_ACCOUNTANT };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.FINANCED_BY_ACCOUNTANT });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.FINANCED_BY_ACCOUNTANT }, user);
        expect(res.status).toBe(RequestStatus.FINANCED_BY_ACCOUNTANT);
        expect(requestsService.updateStatus).toHaveBeenCalledTimes(1);
      });
    });

    describe('RECEIVED_AT_WAREHOUSE', () => {
      it('should reject non-HEAD_WAREHOUSE with ForbiddenException', async () => {
        const user = { id: 'u-cmd', role: RoleType.COMMENDANT };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.RECEIVED_AT_WAREHOUSE }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow HEAD_WAREHOUSE to record warehouse arrival', async () => {
        const user = { id: 'u-wh', role: RoleType.HEAD_WAREHOUSE };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.RECEIVED_AT_WAREHOUSE });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.RECEIVED_AT_WAREHOUSE }, user);
        expect(res.status).toBe(RequestStatus.RECEIVED_AT_WAREHOUSE);
        expect(requestsService.updateStatus).toHaveBeenCalledTimes(1);
      });
    });

    describe('HANDED_TO_COMMENDANT', () => {
      it('should reject non-COMMENDANT with ForbiddenException', async () => {
        const user = { id: 'u-emp', role: RoleType.EMPLOYEE };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.HANDED_TO_COMMENDANT }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow COMMENDANT to accept handover', async () => {
        const user = { id: 'u-cmd', role: RoleType.COMMENDANT };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.HANDED_TO_COMMENDANT });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.HANDED_TO_COMMENDANT }, user);
        expect(res.status).toBe(RequestStatus.HANDED_TO_COMMENDANT);
        expect(requestsService.updateStatus).toHaveBeenCalledTimes(1);
      });
    });

    describe('FULFILLED', () => {
      it('should reject unauthorized role (e.g. AUDITOR) with ForbiddenException', async () => {
        const user = { id: 'u-aud', role: RoleType.AUDITOR };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.FULFILLED }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should reject COMMENDANT from completing fulfillment with ForbiddenException', async () => {
        const user = { id: 'u-cmd', role: RoleType.COMMENDANT };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.FULFILLED }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow authorized stakeholder (MOL) to complete fulfillment', async () => {
        const user = { id: 'u-mol', role: RoleType.MOL };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.FULFILLED });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.FULFILLED }, user);
        expect(res.status).toBe(RequestStatus.FULFILLED);
        expect(requestsService.updateStatus).toHaveBeenCalledTimes(1);
      });
    });

    describe('REJECTED', () => {
      it('should reject ordinary EMPLOYEE from rejecting requests', async () => {
        const user = { id: 'u-emp', role: RoleType.EMPLOYEE };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.REJECTED }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });

      it('should allow VICE_RECTOR_FINANCE or RECTOR to reject requests', async () => {
        const user = { id: 'u-vr', role: RoleType.VICE_RECTOR_FINANCE };
        mockRequestsService.updateStatus.mockResolvedValue({ id: requestId, status: RequestStatus.REJECTED });

        const res = await controller.updateStatus(requestId, { status: RequestStatus.REJECTED, note: 'Smeta yetarli emas' }, user);
        expect(res.status).toBe(RequestStatus.REJECTED);
        expect(requestsService.updateStatus).toHaveBeenCalledTimes(1);
      });
    });

    describe('SUPER_ADMIN administrative restriction', () => {
      it('should prevent SUPER_ADMIN from signing role-specific stages', async () => {
        const user = { id: 'u-admin', role: RoleType.SUPER_ADMIN };
        await expect(
          controller.updateStatus(requestId, { status: RequestStatus.APPROVED_BY_PRORECTOR }, user),
        ).rejects.toThrow(ForbiddenException);

        expect(requestsService.updateStatus).not.toHaveBeenCalled();
      });
    });

    describe('Invalid status transition', () => {
      it('should throw ForbiddenException when transitioning to an unsupported status', async () => {
        const user = { id: 'u-mol', role: RoleType.MOL };
        await expect(
          controller.updateStatus(requestId, { status: 'UNKNOWN_STATUS' as any }, user),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('getAllRequests & createRequest', () => {
    it('should delegate getAllRequests to RequestsService with currentUser', async () => {
      const user = { id: 'u-1', role: RoleType.MOL, departmentId: 'dep-1' };
      const query = { page: 1, limit: 10 };
      mockRequestsService.getAllRequests.mockResolvedValue({ data: [], total: 0 });

      const res = await controller.getAllRequests(query as any, user);
      expect((res as any).data).toEqual([]);
      expect(requestsService.getAllRequests).toHaveBeenCalledWith(query, user);
    });

    it('should delegate createRequest with requesterId from CurrentUser', async () => {
      const user = { id: 'u-requester', role: RoleType.EMPLOYEE };
      const dto = { purpose: 'Kantselyariya tovarlari', departmentId: 'dep-1', items: [{ itemId: 'item-1', requestedQty: 5 }] };
      mockRequestsService.createRequest.mockResolvedValue({ id: 'req-new', ...dto });

      const res = await controller.createRequest(dto as any, user);
      expect(res.id).toBe('req-new');
      expect(requestsService.createRequest).toHaveBeenCalledWith({
        purpose: dto.purpose,
        departmentId: dto.departmentId,
        items: dto.items,
        requesterId: user.id,
      });
    });
  });
});
