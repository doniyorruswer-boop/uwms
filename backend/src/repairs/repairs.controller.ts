import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RepairsService } from './repairs.service';
import { CreateRepairDto, UpdateRepairStatusDto } from './dto/repair.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType, RepairStatus } from '@prisma/client';

@ApiTags('Repairs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/repairs')
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha ta’mirlash jurnali va arizalar' })
  async getRepairs(@Query() query: { status?: RepairStatus; assetId?: string }) {
    return this.repairsService.getRepairs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta ta’mirlash arizasining to‘liq ma’lumoti' })
  async getRepairById(@Param('id') id: string) {
    return this.repairsService.getRepairById(id);
  }

  @Post()
  @Roles(RoleType.MOL, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.COMMENDANT)
  @ApiOperation({ summary: 'Yangi ta’mirlash talabnomasi yuborish' })
  async createRepair(@Body() dto: CreateRepairDto, @CurrentUser() user: any) {
    return this.repairsService.createRepair(dto, user?.id);
  }

  @Patch(':id/status')
  @Roles(RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN, RoleType.COMMENDANT, RoleType.MOL)
  @ApiOperation({ summary: 'Ta’mirlash holatini yangilash (Qabul qilish / Yakunlash / Yaroqsiz deb topish)' })
  async updateRepairStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRepairStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.repairsService.updateRepairStatus(id, dto, user?.id || user?.sub);
  }
}
