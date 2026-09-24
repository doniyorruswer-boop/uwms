import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditsService } from './audits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { StartAuditDto, ScanCodeDto, BatchScanDto, CompleteAuditDto } from './dto/audit.dto';

@ApiTags('Audits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/audits')
export class AuditsController {
  constructor(private auditsService: AuditsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha audit sessiyalari ro‘yxati' })
  async getAllAudits() {
    return this.auditsService.getAllAudits();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta audit tafsilotlari va solishtirma jurnali' })
  async getAuditById(@Param('id') id: string) {
    return this.auditsService.getAuditById(id);
  }

  @Post('start')
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Xona bo‘yicha inventarizatsiya jarayonini boshlash (Auditor / Admin / Bosh Omborchi)' })
  async startAudit(@Body() dto: StartAuditDto, @CurrentUser() user: any) {
    return this.auditsService.startAudit(dto.roomId, user?.id, dto.campaignId);
  }

  @Post('scan')
  @Roles(RoleType.AUDITOR, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'QR-kodni skanerlash va bazadagi joylashuvi bilan solishtirish' })
  async scanCode(@Body() dto: ScanCodeDto) {
    return this.auditsService.scanCode(dto.roomId, dto.qrCode, dto.campaignId);
  }

  @Post('batch-scan')
  @Roles(RoleType.AUDITOR, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Oflayn to‘plangan QR-kodlar navbatini tranzaksiya bilan bir vaqtda sinxronlash' })
  async batchScan(@Body() dto: BatchScanDto, @CurrentUser() user: any) {
    return this.auditsService.batchScan(dto.items, user?.id);
  }

  @Post(':id/batch-scan')
  @Roles(RoleType.AUDITOR, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Audit sessiyasi bo‘yicha oflayn QR-kodlar navbatini tranzaksiya bilan bir vaqtda sinxronlash' })
  async batchScanForAudit(
    @Param('id') auditId: string,
    @Body() dto: BatchScanDto,
    @CurrentUser() user: any,
  ) {
    return this.auditsService.batchScanByAudit(auditId, dto.items, user?.id);
  }

  @Post(':id/complete')
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Audit sessiyasini yakunlash, kamomadlarni (MISSING) qayd etish va INV-19 shakllantirish' })
  async completeAudit(
    @Param('id') id: string,
    @Body() dto: CompleteAuditDto,
    @CurrentUser() user: any,
  ) {
    return this.auditsService.completeAudit(id, dto?.notes, user?.id);
  }
}

