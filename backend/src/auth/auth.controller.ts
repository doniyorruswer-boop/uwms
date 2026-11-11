import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto, ChangePasswordDto, RefreshTokenDto } from './dto/auth.dto';
import { EnableTwoFactorDto, DisableTwoFactorDto } from './dto/two-factor.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 10 : 200,
      ttl: 60000,
    },
  })
  @Post('login')
  @ApiOperation({ summary: 'Tizimga kirish (Login - Rate Limited)' })
  async login(@Body() body: LoginDto) {
    return this.authService.login({
      username: body.username,
      pass: body.password,
    });
  }

  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 20 : 300,
      ttl: 60000,
    },
  })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token orqali yangi access token olish' })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tizimdan chiqish (Sessiya va refresh tokenni bekor qilish)' })
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Joriy tizimga kirgan foydalanuvchi profili' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Parolni o‘zgartirish (Kuchli murakkablik siyosati bilan)' })
  async changePassword(@Body() body: ChangePasswordDto, @Request() req: any) {
    return this.authService.changePassword(req.user.id, body.oldPassword, body.newPassword);
  }

  // =========================================================================
  // GOOGLE AUTHENTICATOR (TOTP RFC 6238) 2FA ENDPOINTS
  // =========================================================================

  @Get('2fa/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Google Authenticator 2FA holati' })
  async getTwoFactorStatus(@Request() req: any) {
    return this.authService.getTwoFactorStatus(req.user.id);
  }

  @Post('2fa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Google Authenticator 2FA ulash (Maxfiy kalit va QR-URI olish)' })
  async setupTwoFactor(@Request() req: any) {
    return this.authService.setupTwoFactor(req.user.id);
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Google Authenticator 2FA ni tasdiqlab yoqish' })
  async enableTwoFactor(@Body() body: EnableTwoFactorDto, @Request() req: any) {
    return this.authService.enableTwoFactor(req.user.id, body.secret, body.code);
  }

  @Post('2fa/disable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Google Authenticator 2FA ni o‘chirish' })
  async disableTwoFactor(@Body() body: DisableTwoFactorDto, @Request() req: any) {
    return this.authService.disableTwoFactor(req.user.id, body.password, body.code);
  }
}
