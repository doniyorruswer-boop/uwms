import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditCampaignsService } from './audit-campaigns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { CreateCampaignDto, QueryCampaignsDto, CompleteCampaignDto, StartCampaignDto } from './dto/audit-campaigns.dto';

@ApiTags('Audit Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/audits/campaigns')
export class AuditCampaignsController {
  constructor(private readonly campaignsService: AuditCampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha inventarizatsiya kampaniyalari ro‘yxati va progressi' })
  async getAll(@Query() query: QueryCampaignsDto) {
    return this.campaignsService.findAll(query);
  }

  @Post()
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.RECTOR, RoleType.VICE_RECTOR_FINANCE)
  @ApiOperation({ summary: 'Yangi rejali inventarizatsiya kampaniyasi yaratish' })
  async create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    return this.campaignsService.create(dto, user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kampaniya tafsilotlari va qamrovdagi xonalar' })
  async getById(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Post(':id/start')
  @Roles(RoleType.RECTOR, RoleType.VICE_RECTOR_FINANCE)
  @ApiOperation({ summary: 'Kampaniyani Rektor farmoyishi va QR-imzo orqali boshlash (IN_PROGRESS holatga o‘tkazish)' })
  async start(
    @Param('id') id: string,
    @Body() dto: StartCampaignDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.start(id, user?.id, dto);
  }

  @Post(':id/complete')
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Kampaniyani tekshiruvchi imzosi bilan yakunlash, kamomadlarni hisoblash, xabarnoma yuborish va INV-19 muhrlash' })
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteCampaignDto,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.complete(id, user?.id, dto);
  }

  @Get(':id/export/excel')
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HEAD_WAREHOUSE, RoleType.CHIEF_ACCOUNTANT, RoleType.RECTOR, RoleType.VICE_RECTOR_FINANCE)
  @ApiOperation({ summary: 'Kampaniya bo‘yicha INV-19 rasmiy 3-varaqli Excel (.xlsx) hisobotini yuklab olish' })
  async exportExcel(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const result = await this.campaignsService.exportCampaignExcel(id, user?.id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }


  @Post(':id/cancel')
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Kampaniyani bekor qilish' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.campaignsService.cancel(id, user?.id, reason);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Kampaniya bo‘yicha xonalar kesimidagi joriy progress' })
  async getProgress(@Param('id') id: string) {
    return this.campaignsService.getProgress(id);
  }

  @Get(':id/missing-report')
  @ApiOperation({ summary: 'Kampaniya doirasida topilmagan ashyolar (kamomad) va javobgar MOLlar ro‘yxati' })
  async getMissingReport(@Param('id') id: string) {
    return this.campaignsService.getMissingReport(id);
  }
}
