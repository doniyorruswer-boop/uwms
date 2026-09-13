import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditsService } from './audits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { StartAuditDto, ScanCodeDto } from './dto/audit.dto';

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
  @Roles(RoleType.AUDITOR, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xona bo‘yicha inventarizatsiya jarayonini boshlash (Auditor / Admin)' })
  async startAudit(@Body() dto: StartAuditDto, @CurrentUser() user: any) {
    return this.auditsService.startAudit(dto.roomId, user?.id);
  }

  @Post('scan')
  @Roles(RoleType.AUDITOR, RoleType.HEAD_WAREHOUSE, RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'QR-kodni skanerlash va bazadagi joylashuvi bilan solishtirish' })
  async scanCode(@Body() dto: ScanCodeDto) {
    return this.auditsService.scanCode(dto.roomId, dto.qrCode);
  }
}

