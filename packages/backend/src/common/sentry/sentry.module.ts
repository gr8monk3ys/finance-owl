import { Global, Module, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

/**
 * Global Sentry module for error monitoring.
 * Sentry is completely optional - if SENTRY_DSN is not set, no-ops silently.
 */
@Global()
@Module({})
export class SentryModule implements OnModuleInit {
  private readonly logger = new Logger(SentryModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');

    if (!dsn) {
      this.logger.log(
        'SENTRY_DSN not configured - Sentry error monitoring disabled',
      );
      return;
    }

    const environment =
      this.configService.get<string>('NODE_ENV') || 'development';
    const release = this.configService.get<string>('SENTRY_RELEASE');

    Sentry.init({
      dsn,
      environment,
      release: release || `finance-owl-backend@${process.env.npm_package_version || '0.0.0'}`,

      // Sampling rates - conservative defaults for production
      tracesSampleRate: environment === 'production' ? 0.2 : 1.0,

      // Scrub sensitive data before sending to Sentry
      beforeSend(event) {
        return scrubSensitiveData(event);
      },

      beforeBreadcrumb(breadcrumb) {
        // Remove sensitive headers from HTTP breadcrumbs
        if (breadcrumb.category === 'http' && breadcrumb.data) {
          const headers = breadcrumb.data.headers;
          if (headers) {
            delete headers.authorization;
            delete headers.cookie;
            delete headers['x-api-key'];
          }
        }
        return breadcrumb;
      },

      // Filter known non-actionable errors
      ignoreErrors: [
        'ECONNREFUSED',
        'ECONNRESET',
        'EPIPE',
        'ENOTFOUND',
        // Health check timeouts
        'HealthCheckError',
      ],

      integrations: [
        Sentry.httpIntegration(),
      ],
    });

    this.logger.log(
      `Sentry initialized (env=${environment}, tracing=${environment === 'production' ? '20%' : '100%'})`,
    );
  }
}

/**
 * Scrub PII and sensitive financial data from Sentry events.
 * Never send passwords, tokens, account numbers, or financial details.
 */
function scrubSensitiveData(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const sensitiveKeys = [
    'password',
    'newPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'access_token',
    'refresh_token',
    'authorization',
    'cookie',
    'plaidAccessToken',
    'plaid_access_token',
    'accountNumber',
    'account_number',
    'routingNumber',
    'routing_number',
    'ssn',
    'socialSecurityNumber',
    'encryptionKey',
    'apiKey',
    'api_key',
    'secret',
    'creditCardNumber',
    'cvv',
    'cardNumber',
    'stripeToken',
    'totpSecret',
  ];

  // Scrub request data
  if (event.request) {
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (
          sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
        ) {
          event.request.headers[key] = '[Filtered]';
        }
      }
      // Always filter these headers
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    if (event.request.data && typeof event.request.data === 'object') {
      event.request.data = scrubObject(
        event.request.data as Record<string, unknown>,
        sensitiveKeys,
      );
    }

    if (event.request.query_string && typeof event.request.query_string === 'string') {
      // Remove tokens from query strings
      event.request.query_string = event.request.query_string.replace(
        /(token|key|secret|password)=[^&]*/gi,
        '$1=[Filtered]',
      );
    }
  }

  // Scrub extra context
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(
      event.extra as Record<string, unknown>,
      sensitiveKeys,
    );
  }

  return event;
}

function scrubObject(
  obj: Record<string, unknown>,
  sensitiveKeys: string[],
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (
      sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
    ) {
      scrubbed[key] = '[Filtered]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      scrubbed[key] = scrubObject(
        value as Record<string, unknown>,
        sensitiveKeys,
      );
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}
