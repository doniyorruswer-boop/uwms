import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET')?.trim();
        const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

        if (!secret) {
          throw new Error('FATAL: JWT_SECRET muhit o‘zgaruvchisi topilmadi!');
        }

        const knownInsecureSecrets = [
          'uwms_jwt_secret_dev_key_2026_super_secure',
          'your_jwt_secret_key_change_in_production',
          'secret',
          'admin123',
          'change_me',
          'default_secret',
        ];

        if (nodeEnv === 'production') {
          if (knownInsecureSecrets.includes(secret) || secret.length < 32) {
            throw new Error(
              'FATAL SECURITY ERROR: Production muhitida standart/zaif JWT_SECRET ishlatish qat’iyan taqiqlanadi! ' +
              'Iltimos, kamida 64 belgidan iborat tasodifiy kriptografik kalit o‘rnating (masalan: npm run generate:secret).',
            );
          }
        }

        return {
          secret,
          signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PassportModule, JwtModule],
})
export class AuthModule {}

