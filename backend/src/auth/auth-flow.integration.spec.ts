import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SystemAuditService } from '../system-audit/system-audit.service';
import { RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('Auth Flow & JWT Lifecycle Integration Tests', () => {
  let authService: AuthService;
  let jwtStrategy: JwtStrategy;
  let jwtAuthGuard: JwtAuthGuard;
  let jwtService: JwtService;
  let prisma: any;

  const JWT_SECRET = 'super_secure_jwt_secret_key_at_least_32_characters_long_123';
  const REFRESH_SECRET = 'super_secure_refresh_secret_key_at_least_32_chars_456';

  const mockUser: any = {
    id: 'user-auth-uuid-1',
    username: 'komendant_user',
    fullName: 'Anvar Sodiqov',
    email: 'anvar@university.uz',
    role: RoleType.COMMENDANT,
    isActive: true,
    mustChangePassword: false,
    hashedRefreshToken: null,
    department: { name: 'Bino boshqaruvi' },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockUser.id || where.username === mockUser.username) {
            return Promise.resolve(mockUser);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          Object.assign(mockUser, data);
          return Promise.resolve(mockUser);
        }),
      },
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
        if (key === 'JWT_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return null;
      }),
    };

    const systemAudit = {
      log: jest.fn().mockResolvedValue({}),
    };

    const realJwt = new JwtService({ secret: JWT_SECRET });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        { provide: JwtService, useValue: realJwt },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: SystemAuditService, useValue: systemAudit },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('Token Expiry & Signature Verification', () => {
    it('should successfully validate an active, unexpired access token with correct tokenType', async () => {
      const payload: JwtPayload = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        tokenType: 'access',
      };

      const validToken = jwtService.sign(payload, { expiresIn: '15m' });
      const decoded = jwtService.verify(validToken);

      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.tokenType).toBe('access');

      const user = await jwtStrategy.validate(decoded);
      expect(user.id).toBe(mockUser.id);
      expect(user.username).toBe(mockUser.username);
    });

    it('should reject an expired access token during verification', () => {
      const payload: JwtPayload = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        tokenType: 'access',
      };

      // Generate token already expired (-1s)
      const expiredToken = jwtService.sign(payload, { expiresIn: -1 });

      expect(() => {
        jwtService.verify(expiredToken);
      }).toThrow();
    });

    it('should reject access token signed with wrong secret key', () => {
      const payload: JwtPayload = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        tokenType: 'access',
      };

      const foreignJwt = new JwtService({ secret: 'completely_different_attacker_secret_key_32_chars' });
      const forgedToken = foreignJwt.sign(payload);

      expect(() => {
        jwtService.verify(forgedToken);
      }).toThrow();
    });
  });

  describe('Refresh Token Misuse Prevention (Token Type Guard)', () => {
    it('should strictly throw UnauthorizedException when a refresh token is sent to an access-protected endpoint', async () => {
      const refreshPayload: JwtPayload = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        tokenType: 'refresh',
      };

      await expect(jwtStrategy.validate(refreshPayload)).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if tokenType is completely missing from payload', async () => {
      const malformedPayload: any = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      };

      await expect(jwtStrategy.validate(malformedPayload)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Refresh Token Rotation & Security', () => {
    it('should issue new access_token and rotated refresh_token when valid refresh token is submitted', async () => {
      const rawRefreshToken = 'valid_raw_refresh_token_string_123';
      mockUser.hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

      // Mock verifyAsync on refresh token
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUser.id });

      const result = await authService.refreshToken(rawRefreshToken);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(mockUser.hashedRefreshToken).toBeDefined();
      // Ensure the token hash was updated/rotated in DB
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
        }),
      );
    });

    it('should reject refresh when provided refresh token does not match stored hash (tampered or already rotated)', async () => {
      mockUser.hashedRefreshToken = await bcrypt.hash('legitimate_token_abc', 10);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUser.id });

      await expect(
        authService.refreshToken('stolen_outdated_token_xyz'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('mustChangePassword Security Gate Enforcement', () => {
    const createMockContext = (url: string): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ url, originalUrl: url }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it('should block access to /api/requests with ForbiddenException when user.mustChangePassword is true', () => {
      const context = createMockContext('/api/requests');
      const user = { id: mockUser.id, mustChangePassword: true };

      expect(() => {
        jwtAuthGuard.handleRequest(null, user, null, context);
      }).toThrow(ForbiddenException);
    });

    it('should block access to /api/warehouse with ForbiddenException when user.mustChangePassword is true', () => {
      const context = createMockContext('/api/warehouse/inventory');
      const user = { id: mockUser.id, mustChangePassword: true };

      expect(() => {
        jwtAuthGuard.handleRequest(null, user, null, context);
      }).toThrow(ForbiddenException);
    });

    it('should allow access to /api/auth/change-password when user.mustChangePassword is true', () => {
      const context = createMockContext('/api/auth/change-password');
      const user = { id: mockUser.id, mustChangePassword: true };

      const result = jwtAuthGuard.handleRequest(null, user, null, context);
      expect(result).toEqual(user);
    });

    it('should allow access to all routes when user.mustChangePassword is false', () => {
      const context = createMockContext('/api/requests');
      const user = { id: mockUser.id, mustChangePassword: false };

      const result = jwtAuthGuard.handleRequest(null, user, null, context);
      expect(result).toEqual(user);
    });
  });
});
