import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SystemAuditService } from '../system-audit/system-audit.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let systemAuditService: any;

  const mockUser = {
    id: 'user-uuid-123',
    username: 'admin',
    fullName: 'Bosh Administrator',
    email: 'admin@university.uz',
    password: '', // will be hashed in beforeAll
    role: RoleType.SUPER_ADMIN,
    isActive: true,
    department: { name: 'IT Markazi' },
  };

  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('admin123', 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token-xyz'),
    };

    systemAuditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
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
    expect(result.password).toBeUndefined(); // parol obyektdan chiqarilgan
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

  it('muvaffaqiyatli loginda JWT token va foydalanuvchi profilini qaytarishi kerak (login)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.login({ username: 'admin', pass: 'admin123' });
    expect(result.access_token).toBe('mock-jwt-token-xyz');
    expect(result.user.username).toBe('admin');
    expect(result.user.role).toBe(RoleType.SUPER_ADMIN);
  });

  it('xato login yoki parolda UnauthorizedException otishi kerak', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ username: 'mavjud_emas', pass: 'parol' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
