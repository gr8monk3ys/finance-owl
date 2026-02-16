import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import { SentryExceptionFilter } from './common/sentry';
import { LoggingInterceptor, PerformanceInterceptor } from './common/interceptors';
import { SentryInterceptor } from './common/sentry';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

const APP_VERSION = process.env.npm_package_version || '0.1.0';

function validateRequiredSecrets(logger: Logger) {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const isProduction = process.env.NODE_ENV === 'production';
    const message = `Missing required environment variables: ${missing.join(', ')}`;

    if (isProduction) {
      logger.error(message);
      process.exit(1);
    } else {
      logger.warn(`${message}. This is acceptable in development only.`);
    }
  }
}

/**
 * Initialize Sentry as early as possible, before the NestJS app is created.
 * This ensures unhandled exceptions during bootstrap are also captured.
 * If SENTRY_DSN is not set, this is a no-op.
 */
function initializeSentryEarly(logger: Logger) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.log('SENTRY_DSN not set - Sentry early init skipped');
    return;
  }

  const environment = process.env.NODE_ENV || 'development';

  Sentry.init({
    dsn,
    environment,
    release:
      process.env.SENTRY_RELEASE ||
      `finance-owl-backend@${APP_VERSION}`,
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
    ],
    beforeSend(event) {
      // Remove authorization headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  logger.log(`Sentry early init complete (env=${environment})`);
}

/**
 * Resolve the CORS origin(s).
 *
 * Supports:
 *  - CORS_ORIGIN env var (takes precedence, comma-separated for multiple origins)
 *  - FRONTEND_URL env var (single origin)
 *  - Falls back to http://localhost:3000 in development
 */
function resolveCorsOrigin(): string | string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    const origins = corsOrigin.split(',').map((o) => o.trim());
    return origins.length === 1 ? origins[0] : origins;
  }
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize Sentry before anything else to catch bootstrap errors
  initializeSentryEarly(logger);

  validateRequiredSecrets(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe/Plaid webhook signature verification
  });

  // Trust proxy — required for Railway / Vercel reverse proxy.
  // Ensures correct client IP in rate limiting, logging, and X-Forwarded-* headers.
  if (isProduction) {
    app.set('trust proxy', 1);
    logger.log('Trust proxy enabled for reverse proxy (Railway)');
  }

  // Security headers via helmet
  // Note: CSP allows 'unsafe-inline' for scripts/styles to support Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Register request logger middleware (applied to all routes)
  const requestLogger = new RequestLoggerMiddleware();
  app.use(requestLogger.use.bind(requestLogger));

  // CORS - reads from CORS_ORIGIN or FRONTEND_URL env vars
  const corsOrigin = resolveCorsOrigin();
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['Content-Disposition', 'X-Response-Time'],
    maxAge: 3600, // Cache preflight for 1 hour
  });

  logger.log(`CORS origin: ${Array.isArray(corsOrigin) ? corsOrigin.join(', ') : corsOrigin}`);

  app.setGlobalPrefix('api');

  // Global exception filters (Sentry filter runs first, then the standard filter)
  // SentryExceptionFilter extends BaseExceptionFilter and reports to Sentry
  // GlobalExceptionFilter handles the actual HTTP response formatting
  const httpAdapter = app.getHttpAdapter();
  app.useGlobalFilters(
    new SentryExceptionFilter(httpAdapter),
    new GlobalExceptionFilter(),
  );

  // Global interceptors
  // Order: Sentry (breadcrumbs/context) -> Performance (timing/headers) -> Logging (request log)
  app.useGlobalInterceptors(
    new SentryInterceptor(),
    new PerformanceInterceptor(),
    new LoggingInterceptor(),
  );

  // Global validation pipe with security-focused options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProduction,
      transformOptions: {
        enableImplicitConversion: false, // Prevent implicit type coercion
      },
    }),
  );

  // ── Swagger / OpenAPI documentation ──────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FinanceOwl API')
    .setDescription('Personal finance management platform API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'bearer',
    )
    .addTag('Auth', 'Authentication and session management')
    .addTag('Accounts', 'Bank account management')
    .addTag('Transactions', 'Transaction CRUD and filtering')
    .addTag('Budgets', 'Budget management and rollovers')
    .addTag('Analytics', 'Spending analytics, forecasting, and insights')
    .addTag('Billing', 'Subscription billing and Stripe integration')
    .addTag('Plaid', 'Plaid Link integration for bank connections')
    .addTag('Notifications', 'In-app notifications and SSE streaming')
    .addTag('Categories', 'Transaction category management')
    .addTag('Bank Sync', 'Bank synchronization management')
    .addTag('Dashboard', 'Dashboard summaries')
    .addTag('Reports', 'Financial reports')
    .addTag('Health', 'Application health checks')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
  });

  logger.log('Swagger documentation available at /api/docs');

  // Graceful shutdown hooks — NestJS will call onModuleDestroy / beforeApplicationShutdown
  app.enableShutdownHooks();

  // Railway sets PORT automatically; fall back to 4000 for local dev
  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');

  // Log startup info
  logger.log(
    `FinanceOwl API v${APP_VERSION} running on port ${port} ` +
      `(env=${isProduction ? 'production' : 'development'}, ` +
      `pid=${process.pid}, ` +
      `node=${process.version})`,
  );

  // Graceful shutdown logging and cleanup
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, () => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);

      // Allow Sentry to flush pending events before shutting down
      const client = Sentry.getClient();
      if (client) {
        Sentry.close(2000).then(() => {
          logger.log('Sentry flushed successfully');
        });
      }
    });
  }

  // Handle unhandled rejections (safety net)
  process.on('unhandledRejection', (reason: unknown) => {
    const message =
      reason instanceof Error ? reason.message : String(reason);
    logger.error(`Unhandled rejection: ${message}`);

    const client = Sentry.getClient();
    if (client) {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
      );
    }
  });
}

bootstrap();
