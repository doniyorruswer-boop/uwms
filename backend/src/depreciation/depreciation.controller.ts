import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepreciationService } from './depreciation.service';
import {
  RunDepreciationDto,
  PreviewDepreciationDto,
  DepreciationQueryDto,
} from './depreciation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@ApiTags('Amortizatsiya & Qoldiq Qiymat (Depreciation Engine)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/depreciation')
export class DepreciationController {
  constructor(private readonly depreciationService: DepreciationService) {}

  @Get('preview')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE, RoleType.AUDITOR)
  @ApiOperation({
    summary: 'Oylik amortizatsiyani oldindan hisoblash (Dry-run / Preview)',
    description:
      'Bazani o‘zgartirmagan holda belgilangan davr bo‘yicha eskirish summasi va qoldiq qiymat prognozini beradi.',
  })
  async previewDepreciation(@Query() dto: PreviewDepreciationDto) {
    return this.depreciationService.previewDepreciation(dto);
  }

  @Post('run')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE)
  @ApiOperation({
    summary: 'Oylik amortizatsiyani rasmiy hisoblash va tasdiqlash',
    description:
      'Belgilangan davr uchun har bir asosiy vosita balans qiymatini yangilaydi, partiya va har bir ashyo jurnallarini yaratadi.',
  })
  async runDepreciation(@Body() dto: RunDepreciationDto, @Request() req: any) {
    return this.depreciationService.runDepreciation(dto, req.user?.id);
  }

  @Get('runs')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE, RoleType.AUDITOR)
  @ApiOperation({
    summary: 'O‘tkazilgan amortizatsiya partiyalari ro‘yxati (Paginatsiya bilan)',
  })
  async getRuns(@Query() query: DepreciationQueryDto) {
    return this.depreciationService.getRuns(query);
  }

  @Get('runs/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE, RoleType.AUDITOR)
  @ApiOperation({
    summary: 'Bitta amortizatsiya partiyasi tafsilotlari va unga kiritilgan barcha aktivlar',
  })
  async getRunDetails(@Param('id') id: string) {
    return this.depreciationService.getRunDetails(id);
  }

  @Get('asset/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE, RoleType.AUDITOR, RoleType.MOL)
  @ApiOperation({
    summary: 'Alohida asosiy vosita bo‘yicha oylar kesimidagi amortizatsiya daftari (Asset Ledger)',
  })
  async getAssetHistory(@Param('id') id: string) {
    return this.depreciationService.getAssetDepreciationHistory(id);
  }

  @Get('statement/:period')
  @Roles(RoleType.SUPER_ADMIN, RoleType.CHIEF_ACCOUNTANT, RoleType.VICE_RECTOR_FINANCE, RoleType.AUDITOR)
  @ApiOperation({
    summary: 'Davlat OTM rasmiy Amortizatsiya Qaydnomasi shakli (Kategoriya va moliyalashtirish kesimida)',
  })
  async getOfficialStatement(@Param('period') period: string) {
    return this.depreciationService.getOfficialStatement(period);
  }
}
