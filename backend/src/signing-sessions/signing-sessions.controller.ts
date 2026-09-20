import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { Request } from 'express';
import { SigningSessionsService } from './signing-sessions.service';
import { InitSigningSessionDto, ConfirmBiometricSignDto, InitHandoverSigningSessionDto } from './signing-session.dto';

@ApiTags('signing-sessions')
@Controller('api')
export class SigningSessionsController {
  constructor(private readonly signingSessionsService: SigningSessionsService) {}

  @Post('signing-sessions/init')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.COMMENDANT,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
  )
  @ApiOperation({ summary: 'Desktopda 60 soniyalik dinamik QR imzolash sessiyasini boshlash' })
  async initSession(
    @Body() dto: InitSigningSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.signingSessionsService.initSession(dto, user?.userId || user?.id);
  }

  @Post('signing-sessions/handover-init')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.HEAD_WAREHOUSE,
    RoleType.MOL,
    RoleType.AUDITOR,
    RoleType.EMPLOYEE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.COMMENDANT,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
  )
  @ApiOperation({ summary: 'Moddiy topshirish arizasi bo‘yicha tomonlarga dinamik QR sessiya ochish' })
  async initHandoverSession(
    @Body() dto: InitHandoverSigningSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.signingSessionsService.initHandoverSession(dto, user?.userId || user?.id);
  }

  // PUBLIC ENDPOINT - Mobil telefon kameradan ochishi uchun
  @Get('public/signing-sessions/:token')
  @ApiOperation({ summary: 'Mobil qurilma orqali imzolash sessiyasi tafsilotlarini olish' })
  async getSessionPublic(@Param('token') token: string) {
    return this.signingSessionsService.getSessionPublic(token);
  }

  // PUBLIC ENDPOINT - Mobil qurilmadan TouchID/FaceID biometrik tasdiqlash
  @Post('public/signing-sessions/:token/confirm')
  @ApiOperation({ summary: 'Mobil qurilmadan biometrik tasdiqlash va hujjatni muhrlash' })
  async confirmBiometricSign(
    @Param('token') token: string,
    @Body() dto: ConfirmBiometricSignDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    return this.signingSessionsService.confirmBiometricSign(token, dto, ip);
  }

  @Get('signing-sessions/:sessionId/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desktop modal uchun sessiya holatini so‘rash (Polling)' })
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    return this.signingSessionsService.getSessionStatus(sessionId);
  }

  @Post('signing-sessions/:sessionId/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Imzolash sessiyasini bekor qilish' })
  async cancelSession(@Param('sessionId') sessionId: string) {
    return this.signingSessionsService.cancelSession(sessionId);
  }
}
