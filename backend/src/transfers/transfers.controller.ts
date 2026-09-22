import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import {
  CreateResponsibilityHandoverDto,
  QueryHandoversDto,
  SignHandoverDto,
  RejectHandoverDto,
  CancelHandoverDto,
} from './dto/handover.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';

import { DocumentArchivesService } from '../document-archives/document-archives.service';
import { SigningSessionsService } from '../signing-sessions/signing-sessions.service';

@ApiTags('Transfers & Handovers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/transfers')
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly documentArchivesService: DocumentArchivesService,
    private readonly signingSessionsService: SigningSessionsService,
  ) {}

  @Post('handovers')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.MOL,
    RoleType.COMMENDANT,
    RoleType.HEAD_WAREHOUSE,
    RoleType.VICE_RECTOR_FINANCE,
  )
  @ApiOperation({ summary: 'Yangi Moddiy Javobgarlikni Topshirish (Handover) arizasini yaratish' })
  async createHandover(
    @Body() dto: CreateResponsibilityHandoverDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.createResponsibilityHandover(dto, user?.id);
  }

  @Get('handovers')
  @ApiOperation({ summary: 'Moddiy topshirish dalolatnomalari ro‘yxatini olish (Filtr va sahifalash bilan)' })
  async getHandovers(@Query() query: QueryHandoversDto) {
    return this.transfersService.getResponsibilityHandovers(query);
  }

  @Get('handovers/:id')
  @ApiOperation({ summary: 'Bitta topshirish dalolatnomasining to‘liq tafsilotlarini olish' })
  async getHandoverById(@Param('id') id: string) {
    return this.transfersService.getResponsibilityHandoverById(id);
  }

  @Get('handovers/:id/document')
  @ApiOperation({ summary: 'Moddiy topshirish dalolatnomasining rasmiy OS-1 elektron hujjatini olish' })
  async getHandoverDocument(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentArchivesService.getHandoverDocument(id, user?.id);
  }

  @Get('handovers/:id/audit')
  @ApiOperation({ summary: 'Bitta topshirish dalolatnomasining audit jurnali va imzo xronologiyasini olish' })
  async getHandoverAudit(@Param('id') id: string) {
    return this.transfersService.getHandoverAudit(id);
  }

  @Post('handovers/:id/initiate-signing')
  @ApiOperation({ summary: 'Dalolatnoma ishtirokchisi uchun dinamik mobil imzolash sessiyasini ochish' })
  async initiateHandoverSigning(
    @Param('id') id: string,
    @Body() body: { signatoryRole: 'DEPARTING' | 'TARGET' | 'COMMANDANT' | 'ACCOUNTANT' },
    @CurrentUser() user: any,
  ) {
    return this.signingSessionsService.initHandoverSession(
      {
        handoverId: id,
        signatoryRole: body.signatoryRole,
      },
      user?.id,
    );
  }

  @Post('handovers/:id/sign')
  @ApiOperation({ summary: 'Topshirish dalolatnomasini tasdiqlash/imzolash va tranzaksiyani bajarish' })
  async signHandover(
    @Param('id') id: string,
    @Body() dto: SignHandoverDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.signResponsibilityHandover(id, dto, user?.id);
  }

  @Post('handovers/:id/reject')
  @ApiOperation({ summary: 'Topshirish dalolatnomasini rad etish' })
  async rejectHandover(
    @Param('id') id: string,
    @Body() dto: RejectHandoverDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.rejectResponsibilityHandover(id, dto, user?.id);
  }

  @Post('handovers/:id/submit')
  @ApiOperation({ summary: 'Qoralama (DRAFT) dalolatnomani topshirishga yuborish' })
  async submitHandover(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.submitResponsibilityHandover(id, user?.id);
  }

  @Post('handovers/:id/cancel')
  @ApiOperation({ summary: 'Dalolatnomani bekor qilish' })
  async cancelHandover(
    @Param('id') id: string,
    @Body() dto: CancelHandoverDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.cancelResponsibilityHandover(id, dto, user?.id);
  }
}
