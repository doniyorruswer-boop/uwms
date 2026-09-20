import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('Phase 0 Security & RBAC Guards', () => {
  let strategy: JwtStrategy;
  let guard: JwtAuthGuard;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test_jwt_secret_key_at_least_32_characters_long_for_security';
        return null;
      }),
    };

    strategy = new JwtStrategy(mockPrisma as any, mockConfigService as any);
    guard = new JwtAuthGuard();
  });

  describe('JwtStrategy tokenType enforcement', () => {
    it('should strictly reject refresh token passed as access token', async () => {
      const refreshPayload: JwtPayload = {
        sub: 'user-uuid-1',
        username: 'testuser',
        role: 'EMPLOYEE',
        tokenType: 'refresh',
      };

      await expect(strategy.validate(refreshPayload)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should allow valid access token', async () => {
      const accessPayload: JwtPayload = {
        sub: 'user-uuid-1',
        username: 'testuser',
        role: 'EMPLOYEE',
        tokenType: 'access',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'testuser',
        role: 'EMPLOYEE',
        isActive: true,
        mustChangePassword: false,
      });

      const user = await strategy.validate(accessPayload);
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });
  });

  describe('JwtAuthGuard server-side mustChangePassword enforcement', () => {
    it('should block business routes when user.mustChangePassword is true', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/requests',
            originalUrl: '/api/requests',
          }),
        }),
      } as unknown as ExecutionContext;

      const user = { id: 'user-1', mustChangePassword: true };

      expect(() => {
        // simulate handleRequest with super returning user
        guard.handleRequest(null, user, null, mockContext);
      }).toThrow(ForbiddenException);
    });

    it('should allow change-password route when user.mustChangePassword is true', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: '/api/auth/change-password',
            originalUrl: '/api/auth/change-password',
          }),
        }),
      } as unknown as ExecutionContext;

      const user = { id: 'user-1', mustChangePassword: true };

      const result = guard.handleRequest(null, user, null, mockContext);
      expect(result).toEqual(user);
    });
  });
});
