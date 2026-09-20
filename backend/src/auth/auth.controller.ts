import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto, ChangePasswordDto, RefreshTokenDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Tizimga kirish (Login - Qat’iy Rate Limited: 10 ta/min)' })
  async login(@Body() body: LoginDto) {
    return this.authService.login({
      username: body.username,
      pass: body.password,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
}
