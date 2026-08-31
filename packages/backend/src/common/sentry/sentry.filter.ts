import { Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import type { Request } from 'express';

/**
 * Global exception filter that reports errors to Sentry.
 *
 * This filter extends the base exception filter to add Sentry reporting
 * before delegating to the standard exception handling pipeline.
 *
 * The following error categories are NOT reported to Sentry:
 * - Validation errors (400, 422) -- user input errors
 * - Authentication failures (401) -- expected flow
 * - Authorization failures (403) -- expected flow
 * - Not found (404) -- bots/scanners
 * - Rate limiting (429) -- expected throttling
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  /** Status codes that represent expected application behavior */
  private readonly nonReportableStatuses = new Set([
    HttpStatus.BAD_REQUEST, // 400 - validation errors
    HttpStatus.UNAUTHORIZED, // 401 - auth failures
    HttpStatus.FORBIDDEN, // 403 - authorization failures
    HttpStatus.NOT_FOUND, // 404 - missing resources
    HttpStatus.CONFLICT, // 409 - duplicate resources
    HttpStatus.UNPROCESSABLE_ENTITY, // 422 - validation errors
    HttpStatus.TOO_MANY_REQUESTS, // 429 - rate limiting
  ]);

  catch(exception: unknown, host: ArgumentsHost) {
    // Only process HTTP contexts
    if (host.getType() !== 'http') {
      return super.catch(exception, host);
    }

    const client = Sentry.getClient();
    if (client) {
      this.reportToSentry(exception, host);
    }

    // Delegate to parent (NestJS default exception handling)
    super.catch(exception, host);
  }

  private reportToSentry(exception: unknown, host: ArgumentsHost): void {
    // Determine if this error should be reported
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (this.nonReportableStatuses.has(status)) {
        return;
      }
    }

    const request = host.switchToHttp().getRequest<Request>();
    const user = request.user as { id?: string } | undefined;

    Sentry.withScope((scope) => {
      // Set request context
      scope.setTag('http.method', request.method);
      scope.setTag('http.url', request.url);

      if (exception instanceof HttpException) {
        scope.setTag('http.status_code', String(exception.getStatus()));
        scope.setLevel('error');
      } else {
        scope.setTag('http.status_code', '500');
        scope.setLevel('fatal');
      }

      // Set user context (minimal - no PII)
      if (user?.id) {
        scope.setUser({ id: user.id });
      }

      // Add request metadata (no body to avoid leaking sensitive data)
      scope.setExtra('request.method', request.method);
      scope.setExtra('request.url', request.url);
      scope.setExtra('request.ip', request.ip);
      scope.setExtra('request.user_agent', request.get('user-agent'));

      // Tag with route for grouping
      const route = request.route?.path;
      if (route) {
        scope.setTag('route', `${request.method} ${route}`);
      }

      // Capture the exception
      if (exception instanceof Error) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureException(new Error(`Non-Error exception: ${String(exception)}`));
      }
    });
  }
}
