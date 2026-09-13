import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto, ChangePasswordDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Tizimga kirish (Login - Rate Limited: 15 ta/min)' })
  async login(@Body() body: LoginDto) {
    return this.authService.login({
      username: body.username,
      pass: body.password,
    });
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
