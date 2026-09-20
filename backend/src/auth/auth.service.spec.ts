import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SystemAuditService } from '../system-audit/system-audit.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let configService: any;
  let systemAuditService: any;

  const mockUser: any = {
    id: 'user-uuid-123',
    username: 'admin',
    fullName: 'Bosh Administrator',
    email: 'admin@university.uz',
    password: '', // will be hashed in beforeAll
    hashedRefreshToken: '',
    role: RoleType.SUPER_ADMIN,
    isActive: true,
    department: { name: 'IT Markazi' },
  };

  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('admin123', 10);
    mockUser.hashedRefreshToken = await bcrypt.hash('valid-refresh-token', 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token-xyz'),
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token-xyz'),
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return 'test_secret_key_123';
      }),
    };

    systemAuditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: configService },
        { provide: SystemAuditService, useValue: systemAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('to‘g‘ri parol kiritilganda foydalanuvchini muvaffaqiyatli tekshirishi kerak (validateUser)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.validateUser('admin', 'admin123');
    expect(result).toBeDefined();
    expect(result.username).toBe('admin');
    expect(result.password).toBeUndefined();
  });

  it('noto‘g‘ri parol kiritilganda null qaytarishi kerak', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.validateUser('admin', 'wrongpassword');
    expect(result).toBeNull();
  });

  it('nofaol (isActive: false) foydalanuvchi kiritilganda null qaytarishi kerak', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

    const result = await service.validateUser('admin', 'admin123');
    expect(result).toBeNull();
  });

  it('muvaffaqiyatli loginda access_token va refresh_token qaytarishi hamda DB ga xeshni saqlashi kerak', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.login({ username: 'admin', pass: 'admin123' });
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.user.username).toBe('admin');
    expect(result.user.role).toBe(RoleType.SUPER_ADMIN);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          hashedRefreshToken: expect.any(String),
        }),
      }),
    );
  });

  it('xato login yoki parolda UnauthorizedException otishi kerak', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ username: 'mavjud_emas', pass: 'parol' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('to‘g‘ri refresh token bilan yangi access_token va refresh_token olinishi kerak (refreshToken)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: mockUser.id });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.refreshToken('valid-refresh-token');
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('noto‘g‘ri refresh tokenda UnauthorizedException otishi kerak', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: mockUser.id });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('logout qilinganda DB dagi hashedRefreshToken null qilinishi kerak', async () => {
    const result = await service.logout(mockUser.id);
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { hashedRefreshToken: null },
    });
  });
});
