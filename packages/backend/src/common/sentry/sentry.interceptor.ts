import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import * as Sentry from '@sentry/node';
import type { Request } from 'express';

/**
 * Interceptor that adds Sentry breadcrumbs for each request
 * and captures unexpected exceptions.
 *
 * Expected HTTP errors (401, 403, 404, 422) are NOT reported to Sentry
 * to reduce noise. Only 5xx and unexpected errors are captured.
 *
 * When SENTRY_DSN is not configured, this interceptor is a graceful no-op.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  /** HTTP status codes that should NOT be reported to Sentry */
  private readonly ignoredStatusCodes = new Set([
    HttpStatus.BAD_REQUEST, // 400
    HttpStatus.UNAUTHORIZED, // 401
    HttpStatus.FORBIDDEN, // 403
    HttpStatus.NOT_FOUND, // 404
    HttpStatus.CONFLICT, // 409
    HttpStatus.UNPROCESSABLE_ENTITY, // 422
    HttpStatus.TOO_MANY_REQUESTS, // 429
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Graceful no-op when Sentry is not initialized
    const client = Sentry.getClient();
    if (!client) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, query } = request;
    const user = request.user as { id?: string; email?: string } | undefined;

    // Set user context if available
    if (user?.id) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
      });
    }

    // Add breadcrumb for request tracking
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${method} ${url}`,
      level: 'info',
      data: {
        method,
        url,
        query: Object.keys(query).length > 0 ? query : undefined,
        userId: user?.id ?? 'anonymous',
      },
    });

    const start = Date.now();

    return next.handle().pipe(
      tap({
        error: (exception: unknown) => {
          this.captureException(exception, request, start);
        },
      }),
    );
  }

  private captureException(exception: unknown, request: Request, startTime: number): void {
    // Don't report expected HTTP errors
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (this.ignoredStatusCodes.has(status)) {
        return;
      }
    }

    const duration = Date.now() - startTime;
    const user = request.user as { id?: string; email?: string } | undefined;

    Sentry.withScope((scope) => {
      // Add request context
      scope.setTag('http.method', request.method);
      scope.setTag('http.url', request.url);
      scope.setTag('transaction', `${request.method} ${request.route?.path || request.url}`);

      // Add user context (userId and email for identification)
      if (user?.id) {
        scope.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // Add request metadata
      scope.setExtra('request.duration_ms', duration);
      scope.setExtra('request.ip', request.ip);
      scope.setExtra('request.user_agent', request.get('user-agent'));
      scope.setExtra('request.method', request.method);
      scope.setExtra('request.path', request.url);

      // Add query params (safe to include -- no auth tokens in query strings)
      if (request.query && Object.keys(request.query).length > 0) {
        scope.setExtra('request.query', request.query);
      }

      // Add breadcrumb for the failed request
      scope.addBreadcrumb({
        category: 'http.error',
        message: `Request failed after ${duration}ms`,
        level: 'error',
        data: {
          method: request.method,
          url: request.url,
          duration,
        },
      });

      if (exception instanceof Error) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureException(new Error(String(exception)));
      }
    });
  }
}
