import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import {
  FundingSummaryQueryDto,
  FundingMovementsQueryDto,
  FundingExportQueryDto,
} from './dto/reports.dto';
import {
  ChiefAccountantReceiptsQueryDto,
  ChiefAccountantHandoverQueryDto,
  ChiefAccountantExportDto,
} from './dto/chief-accountant.dto';
import { Response, Request } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('funding-summary')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
  )
  @ApiOperation({
    summary:
      'Moliyalashtirish manbalari (BYUDJET, KONTRAKT_RIVOJLANTIRISH, GRANT) bo‘yicha yig‘ma hisobot',
  })
  async getFundingSummary(
    @Query() query: FundingSummaryQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getFundingSummary(query, user);
  }

  @Get('funding-movements')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
  )
  @ApiOperation({
    summary: 'Moliyalashtirish manbasi bo‘yicha harakatlar jurnali (paginated)',
  })
  async getFundingMovements(
    @Query() query: FundingMovementsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getFundingMovements(query, user);
  }

  @Get('funding-export')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
  )
  @ApiOperation({
    summary:
      'Moliyalashtirish hisobotini Excel (.xlsx) yoki CSV formatida yuklab olish va audit log yozish',
  })
  async exportFundingReport(
    @Query() query: FundingExportQueryDto,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportFundingReport(query, user, req);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }

  // ==========================================
  // PHASE L2: BOSH HISOBCHI IZLARI VA HISOBOTLAR
  // ==========================================

  @Get('chief-accountant/receipts')
  @Roles(
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
  )
  @ApiOperation({
    summary: '1-IZ: Qancha kirdi? (OS-1 Kirim Reestri, manba va sub-hisoblar kesimida)',
  })
  async getChiefAccountantReceipts(
    @Query() query: ChiefAccountantReceiptsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getChiefAccountantReceipts(query, user);
  }

  @Get('chief-accountant/handover-balance')
  @Roles(
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
  )
  @ApiOperation({
    summary: '2-IZ: Qayerga ketdi va kimning bo‘ynida? (Chiqim va MOL Aylanma Balansi — OS-2)',
  })
  async getChiefAccountantHandoverBalance(
    @Query() query: ChiefAccountantHandoverQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getChiefAccountantHandoverBalance(query, user);
  }

  @Get('chief-accountant/mol-details/:userId')
  @Roles(
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
  )
  @ApiOperation({
    summary: 'Bitta Moddiy Javobgar (MOL) bo‘ynidagi ashyolarning 1 soniyalik to‘liq reestri',
  })
  async getChiefAccountantMolItems(@Param('userId') userId: string) {
    return this.reportsService.getChiefAccountantMolItems(userId);
  }

  @Get('chief-accountant/export')
  @Roles(
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
  )
  @ApiOperation({
    summary: '3-IZ: Bitta Tugmali Davlat Eksporti (Excel 3-varaq, UzASBO XML, 1C OTM)',
  })
  async exportChiefAccountantStateReport(
    @Query() query: ChiefAccountantExportDto,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportChiefAccountantStateReport(query, user, req);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }

  @Get('clearance-certificate/:userId')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.EMPLOYEE,
    RoleType.COMMENDANT,
    RoleType.AUDITOR,
  )
  @ApiOperation({
    summary: 'Elektron Aylanma Varaqa (Clearance Certificate) ma’lumotlari va OS-1 dalolatnomalar reestri',
  })
  async getClearanceCertificate(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.generateClearanceCertificate(userId);
  }

  @Get('clearance-certificate/:userId/download')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.RECTOR,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.EMPLOYEE,
    RoleType.COMMENDANT,
    RoleType.AUDITOR,
  )
  @ApiOperation({
    summary: 'Elektron Aylanma Varaqa rasmiy hujjatini chop etish (HTML/PDF ko‘rigi)',
  })
  async downloadClearanceCertificate(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const cert = await this.reportsService.generateClearanceCertificatePdf(userId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${cert.filename}"`);
    return res.send(cert.contentHtml);
  }
}

