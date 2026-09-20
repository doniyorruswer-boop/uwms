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
  const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
  const allowedOrigins = [clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS xavfsizlik cheklovi: "${origin}" domenidan kirish taqiqlangan`));
      }
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
