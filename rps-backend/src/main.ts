import 'dotenv/config';
import type { Server } from 'http';
import express, { NextFunction, Request, Response } from 'express';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { WinstonLoggerService } from './common/winston-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger: new WinstonLoggerService(),
  });
  const apiPrefix = 'api';
  const swaggerPath = process.env.SWAGGER_PATH ?? 'api-docs';
  app.setGlobalPrefix(apiPrefix);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // CSRF protection - disable for API routes that don't use cookies for auth
  // We'll enable it selectively for form-based submissions if needed
  // app.use(csurf({ cookie: true }));

  // Rate limiting - stricter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting before other middleware
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use(generalLimiter);

  // Body size limits for CSV imports
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global headers
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.originalUrl.startsWith(`/${apiPrefix}/${swaggerPath}`)) {
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
