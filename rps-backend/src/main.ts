import 'dotenv/config';
import type { Server } from 'http';
import express, { NextFunction, Request, Response } from 'express';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';
import { AppModule } from './app.module';
import { WinstonLoggerService } from './common/winston-logger.service';

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger: new WinstonLoggerService(),
  });
  const expressInstance = app.getHttpAdapter().getInstance() as express.Express;
  expressInstance.set('trust proxy', 1);
  const apiPrefix = 'api';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CSRF protection - disable for API routes that don't use cookies for auth
  // We'll enable it selectively for form-based submissions if needed
  // app.use(csurf({ cookie: true }));

  // Rate limiting - stricter for auth endpoints
  const isProduction = process.env.NODE_ENV === 'production';
  const authRateLimitMax = readPositiveInt(
    process.env.AUTH_RATE_LIMIT_MAX,
    isProduction ? 20 : 100,
  );
  const generalRateLimitMax = readPositiveInt(
    process.env.RATE_LIMIT_MAX,
    isProduction ? 1000 : 5000,
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: authRateLimitMax,
    message: 'Trop de tentatives de connexion. Veuillez reessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: generalRateLimitMax,
    message: 'Trop de requetes. Veuillez reessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting before other middleware
  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use(generalLimiter);

  // Body size limits for CSV imports
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global headers
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.originalUrl.startsWith(`/${swaggerPath}`) ||
      request.originalUrl.startsWith(`/${apiPrefix}/${swaggerPath}`)
    ) {
      next();
      return;
    }

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('RPS Backend API')
      .setDescription('Documentation des endpoints du backend NestJS.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT ?? 3000;

  await app.listen(port, '0.0.0.0');

  const server = app.getHttpServer() as Server & {
    keepAliveTimeout: number;
    headersTimeout: number;
    requestTimeout: number;
  };
  server.keepAliveTimeout = 90000;
  server.headersTimeout = 100000;
  server.requestTimeout = 120000;

  console.log(`Backend running on http://0.0.0.0:${port}`);
}

void bootstrap();
