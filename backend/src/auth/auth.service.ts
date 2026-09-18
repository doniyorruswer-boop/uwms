import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private systemAuditService: SystemAuditService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { department: true },
    });

    if (user && user.isActive) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user;
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

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        position: user.position,
        mustChangePassword: user.mustChangePassword,
        departmentName: user.department?.name,
      },
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
