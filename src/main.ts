import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT') ?? 3000;
  const apiPrefix = configService.get<string>('API_PREFIX') ?? 'api';

  app.setGlobalPrefix(apiPrefix);
  const corsOrigins = [
    configService.get<string>('CORS_ORIGIN') ?? '',
    configService.get<string>('FRONTEND_URL') ?? '',
  ]
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
  });

  app.enableCsrfProtection({
    trustedOrigins: corsOrigins,
  });

  app.use(
    helmet({
      contentSecurityPolicy:
        configService.get<string>('NODE_ENV') === 'production'
          ? undefined
          : false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? true;
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Web application API')
      .setDescription(
        'NestJS backend API for Web application. Browser authentication uses an HttpOnly server-side session cookie.',
      )
      .setVersion('1.0')
      .addCookieAuth(
        configService.get<string>('SESSION_COOKIE_NAME') ?? 'session',
        {
          type: 'apiKey',
          in: 'cookie',
          description:
            'HttpOnly session cookie set by POST /auth/login. The cookie value is never exposed in browser JavaScript.',
        },
        'session',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Application failed to start', error);
  process.exitCode = 1;
});
