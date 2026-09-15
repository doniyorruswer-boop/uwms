import { Controller, Get, Post, Body, Param, Patch, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType, RequestStatus } from '@prisma/client';
import { CreateRequestDto, UpdateRequestStatusDto, QueryRequestsDto } from './dto/request.dto';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha talabnomalar (zayavkalar) ro‘yxati (qidiruv, filtr, sahifalash, saralash)' })
  async getAllRequests(@Query() query: QueryRequestsDto) {
    return this.requestsService.getAllRequests(query);
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
    // Role verification for fulfillment: Only HEAD_WAREHOUSE or SUPER_ADMIN can FULFILL
    if (dto.status === RequestStatus.FULFILLED) {
      if (user.role !== RoleType.HEAD_WAREHOUSE && user.role !== RoleType.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Talabnomani faqat Bosh Omborchi yoki Super Admin tarqatishi va hisobdan chiqarishi mumkin!',
        );
      }
    }

    return this.requestsService.updateStatus(id, dto.status, {
      note: dto.note,
      approvedById: user.id,
    });
  }
}

