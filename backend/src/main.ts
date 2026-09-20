import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression = require('compression');
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnvironmentSecretsOnStartup } from './common/constants';

async function bootstrap() {
  // Pre-flight security validation of environment variables and cryptographic secrets
  validateEnvironmentSecretsOnStartup();

  const app = await NestFactory.create(AppModule);

  // Trust proxy for accurate client IP identification and rate limiting behind reverse proxy (Nginx)
  const expressInstance = app.getHttpAdapter().getInstance();
  if (expressInstance && typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', true);
  }

  // 1. HTTP Response Compression (Gzip / Deflate for fast JSON payloads)
  app.use(compression());

  // 2. Helmet Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 3. Strict CORS Policy
  const clientOriginEnv = process.env.CLIENT_URL || '';
  const configuredOrigins = clientOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // 1. Agar origin bo'lmasa (server-to-server yoki same-origin Nginx proksi)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Localhost ishlab chiqish muhitlari
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://localhost:')
      ) {
        return callback(null, true);
      }

      // 3. Konfiguratsiyada ko'rsatilgan domenlar
      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 4. Railway domenlari (*.up.railway.app, *.railway.app)
      try {
        const url = new URL(origin);
        if (
          url.hostname.endsWith('.railway.app') ||
          url.hostname.endsWith('.up.railway.app') ||
          url.hostname === 'localhost'
        ) {
          return callback(null, true);
        }
      } catch {
        // Invalid URL format
      }

      callback(new Error(`CORS xavfsizlik cheklovi: "${origin}" domenidan kirish taqiqlangan`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Idempotency-Key', 'idempotency-key', 'X-Requested-With'],
  });

  // 4. Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // 5. Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // DTO da yo'q maydonlar yuborilganda 400 xatolik qaytaradi
      transform: true,
    }),
  );

  // Swagger OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('UWMS API')
    .setDescription('University Warehouse and Asset Management System Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`UWMS Backend is running on: http://localhost:${port}`);
  console.log(`Swagger Docs available on: http://localhost:${port}/api/docs`);
}

bootstrap();
