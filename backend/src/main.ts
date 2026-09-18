import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression = require('compression');
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    console.error('FATAL ERROR: JWT_SECRET muhit o‘zgaruvchisi aniqlanmagan! Xavfsizlik tufayli backend to‘xtatildi.');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const knownInsecureSecrets = [
    'uwms_jwt_secret_dev_key_2026_super_secure',
    'your_jwt_secret_key_change_in_production',
    'secret',
    'admin123',
    'change_me',
    'default_secret',
  ];

  if (isProduction) {
    if (knownInsecureSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
      console.error(
        'FATAL SECURITY ERROR: Production muhitida standart yoki zaif JWT_SECRET ishlatish qat’iyan taqiqlanadi!\n' +
        'Iltimos, kamida 64 belgidan iborat tasodifiy kriptografik kalit o‘rnating (masalan: npm run generate:secret).',
      );
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
