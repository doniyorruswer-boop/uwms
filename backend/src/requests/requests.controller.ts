import { Controller, Get, Post, Body, Param, Patch, UseGuards, ForbiddenException, BadRequestException, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType, RequestStatus } from '@prisma/client';
import {
  CreateRequestDto,
  UpdateRequestStatusDto,
  QueryRequestsDto,
  WorkflowAdvanceDto,
  FinanceWorkflowDto,
  HandoverWorkflowDto,
  FulfillWorkflowDto,
} from './dto/request.dto';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller('api/requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha talabnomalar (zayavkalar) ro‘yxati (qidiruv, filtr, sahifalash, saralash)' })
  async getAllRequests(@Query() query: QueryRequestsDto, @CurrentUser() user: any) {
    return this.requestsService.getAllRequests(query, user);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi talabnoma yuborish' })
  async createRequest(@Body() dto: CreateRequestDto, @CurrentUser() user: any) {
    return this.requestsService.createRequest({
      purpose: dto.purpose,
      departmentId: dto.departmentId,
      items: dto.items,
      requesterId: user.id,
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Talabnoma holatini yangilash (Tasdiqlash, Chiqim qilish yoki Rad etish)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: any,
  ) {
    // Xavfsizlik: Tezkor tasdiqlash (QR-imzosiz) qat’iyan taqiqlanadi!
    if (dto.note?.includes('tezkor tasdiqlandi')) {
      throw new ForbiddenException(
        'Tezkor tasdiqlash qat’iyan taqiqlangan! Barcha talabnomalar faqat QR-kod orqali mobil biometrik imzo (TouchID/FaceID) bilan tasdiqlanishi shart. Iltimos, brauzerni to‘liq yangilang (Ctrl + F5).',
      );
    }

    // RBAC: Barcha status o‘zgarishlari uchun qat’iy lavozim tekshiruvi.
    // Hech kim, jumladan SUPER_ADMIN ham tegishli mansabdor shaxs (Rektor, Prorektor, Bosh hisobchi, Omborchi va h.k.) nomidan tasdiqlay olmaydi!
    switch (dto.status) {
      case RequestStatus.APPROVED_BY_PRORECTOR:
        if (user.role !== RoleType.VICE_RECTOR_FINANCE) {
          throw new ForbiddenException('Ushbu bosqichni faqat Moliya-iqtisod prorektori tasdiqlashi mumkin!');
        }
        break;
      case RequestStatus.APPROVED_BY_RECTOR:
        if (user.role !== RoleType.RECTOR) {
          throw new ForbiddenException('Ushbu bosqichni faqat Universitet Rektori tasdiqlashi mumkin!');
        }
        break;
      case RequestStatus.FINANCED_BY_ACCOUNTANT:
        if (user.role !== RoleType.CHIEF_ACCOUNTANT) {
          throw new ForbiddenException('Moliyalashtirishni faqat Bosh hisobchi tasdiqlashi mumkin!');
        }
        break;
      case RequestStatus.RECEIVED_AT_WAREHOUSE:
        if (user.role !== RoleType.HEAD_WAREHOUSE) {
          throw new ForbiddenException('Ombor kirimini faqat Bosh ombor mudiri tasdiqlashi mumkin!');
        }
        break;
      case RequestStatus.HANDED_TO_COMMENDANT:
        if (user.role !== RoleType.COMMENDANT) {
          throw new ForbiddenException('Binoga qabul qilishni faqat Bino komendanti imzolashi mumkin!');
        }
        break;
      case RequestStatus.FULFILLED:
        if (user.role === RoleType.COMMENDANT) {
          throw new ForbiddenException(
            'Bino komendanti topshiruvchi hisoblanadi. Yakuniy qabul qilish dalolatnomasini komendant qabul qiluvchi o‘rniga imzolay olmaydi!',
          );
        }
        if (
          user.role !== RoleType.MOL &&
          user.role !== RoleType.EMPLOYEE &&
          user.role !== RoleType.SUPER_ADMIN &&
          user.role !== RoleType.HEAD_WAREHOUSE
        ) {
          throw new ForbiddenException(
            'Talabnomani faqat talabgor xodim (yoki kafedra MOLi) qabul qilib yakunlashi mumkin!',
          );
        }
        break;
      case RequestStatus.REJECTED:
        if (
          user.role !== RoleType.VICE_RECTOR_FINANCE &&
          user.role !== RoleType.RECTOR &&
          user.role !== RoleType.CHIEF_ACCOUNTANT &&
          user.role !== RoleType.HEAD_WAREHOUSE
        ) {
          throw new ForbiddenException('Talabnomani faqat vakolatli rahbar yoki ombor mudiri rad eta oladi!');
        }
        if (!dto.note || !dto.note.trim()) {
          throw new BadRequestException('Rad etish sababi (izoh) kiritilishi shart!');
        }
        break;
      case RequestStatus.CANCELLED:
        // Service darajasida mualliflik yoki super admin tekshiriladi
        break;
      default:
        throw new ForbiddenException('Ushbu statusga o‘tishga ruxsat etilmagan!');
    }

    return this.requestsService.updateStatus(id, dto.status, {
      note: dto.note,
      approvedById: user.id,
      currentUser: user,
    });
  }

  @Post(':id/workflow-advance')
  @ApiOperation({ summary: '7 Bosqichli Xarid Zanjirini navbatdagi bosqichga o‘tkazish' })
  async advanceWorkflow(
    @Param('id') id: string,
    @Body() dto: WorkflowAdvanceDto,
    @CurrentUser() user: any,
  ) {
    return this.requestsService.advanceWorkflowStage(id, dto.status, user, {
      note: dto.note,
      fundingSource: dto.fundingSource,
      subAccountCode: dto.subAccountCode,
      allocatedAmount: dto.allocatedAmount,
      commendantId: dto.commendantId,
      targetRoomId: dto.targetRoomId,
    });
  }

  @Post(':id/finance')
  @ApiOperation({ summary: 'Bosh hisobchi tomonidan moliyalashtirish va sub-hisob biriktirish (4-bosqich)' })
  async financeRequest(
    @Param('id') id: string,
    @Body() dto: FinanceWorkflowDto,
    @CurrentUser() user: any,
  ) {
    return this.requestsService.advanceWorkflowStage(id, RequestStatus.FINANCED_BY_ACCOUNTANT, user, {
      note: dto.note,
      fundingSource: dto.fundingSource,
      subAccountCode: dto.subAccountCode,
      allocatedAmount: dto.allocatedAmount,
    });
  }

  @Post(':id/handover-commendant')
  @ApiOperation({ summary: 'Bino komendanti tomonidan qabul qilish (6-bosqich OS-2)' })
  async handoverToCommendant(
    @Param('id') id: string,
    @Body() dto: HandoverWorkflowDto,
    @CurrentUser() user: any,
  ) {
    return this.requestsService.advanceWorkflowStage(id, RequestStatus.HANDED_TO_COMMENDANT, user, {
      note: dto.note,
      commendantId: dto.commendantId || user.id,
    });
  }

  @Post(':id/fulfill-room')
  @ApiOperation({ summary: 'Kafedra mudiri / Talabgor tomonidan xonaga qabul qilish (7-bosqich Yakuniy)' })
  async fulfillRoom(
    @Param('id') id: string,
    @Body() dto: FulfillWorkflowDto,
    @CurrentUser() user: any,
  ) {
    if (user.role === RoleType.COMMENDANT) {
      throw new ForbiddenException(
        'Bino komendanti topshiruvchi hisoblanadi. Yakuniy qabul qilish dalolatnomasini komendant qabul qiluvchi o‘rniga imzolay olmaydi!',
      );
    }
    return this.requestsService.advanceWorkflowStage(id, RequestStatus.FULFILLED, user, {
      note: dto.note,
      targetRoomId: dto.targetRoomId,
    });
  }
}

