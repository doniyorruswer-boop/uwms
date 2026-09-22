import { Injectable, UnauthorizedException, BadRequestException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { EventsGateway } from '../events/events.gateway';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private systemAuditService: SystemAuditService,
    @Optional() private eventsGateway?: EventsGateway,
  ) {}

  private async generateTokens(user: { id: string; username: string; role: any }) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessSecret = this.configService.get<string>('JWT_SECRET') || 'uwms_super_secret_jwt_key_2026';
    const accessExpiresIn = (this.configService.get<string>('JWT_EXPIRES_IN') || '15m') as any;

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || accessSecret;
    const refreshExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, tokenType: 'access' },
        {
          secret: accessSecret,
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, tokenType: 'refresh' },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { department: true },
    });

    if (user && user.isActive) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, hashedRefreshToken, ...result } = user as any;
        return result;
      }
    }
    return null;
  }

  async login(loginDto: { username: string; pass: string }) {
    const user = await this.validateUser(loginDto.username, loginDto.pass);
    if (!user) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri kiritildi!');
    }

    const { accessToken, refreshToken } = await this.generateTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    // Refresh tokenni bcrypt bilan xeshlash va bazaga saqlash
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    if (this.eventsGateway) {
      this.eventsGateway.emitToUser(user.id, 'security:concurrent_login', {
        message: 'Diqqat: Hisobingizga boshqa IP manzildan ulanish amalga oshirildi',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        position: user.position,
        mustChangePassword: user.mustChangePassword,
        departmentName: user.department?.name,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token kiritilishi shart!');
    }

    const accessSecret = this.configService.get<string>('JWT_SECRET') || 'uwms_super_secret_jwt_key_2026';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || accessSecret;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token yaroqsiz yoki muddati tugagan!');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });

    if (!user || !user.isActive || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi yoki sessiya bekor qilingan!');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token xavfsizlik tekshiruvidan o‘tmadi!');
    }

    const tokens = await this.generateTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const newHashed = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: newHashed },
    });

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });

    return {
      success: true,
      message: 'Tizimdan muvaffaqiyatli chiqildi',
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    if (!user) throw new UnauthorizedException();
    const { password, ...result } = user;
    return result;
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Eski parol noto‘g‘ri kiritildi');
    }

    if (oldPass === newPass) {
      throw new BadRequestException('Yangi parol eski paroldan farq qilishi kerak!');
    }

    if (newPass.toLowerCase().includes('admin123')) {
      throw new BadRequestException("Standart 'admin123' parolidan foydalanish taqiqlanadi! Yangi kuchli parol o‘rnating.");
    }

    const newHashed = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHashed,
        mustChangePassword: false,
      },
    });

    await this.systemAuditService.log({
      action: 'USER_PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
      userId,
      details: {
        username: user.username,
        reason: 'Foydalanuvchi tomonidan yangi xavfsiz parol o‘rnatildi',
      },
    });

    return {
      success: true,
      message: 'Parol muvaffaqiyatli yangilandi',
      mustChangePassword: false,
    };
  }
}
