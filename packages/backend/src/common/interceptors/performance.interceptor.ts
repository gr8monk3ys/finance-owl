import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * Performance interceptor that tracks request duration and response size.
 *
 * Behaviour:
 * - Adds an `X-Response-Time` header to every response (in milliseconds).
 * - Logs a warning for any request that exceeds the slow threshold (default 1000ms).
 * - Tracks approximate response content-length when available.
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  /** Requests slower than this (in ms) are logged as warnings */
  private readonly slowThresholdMs: number;

  constructor() {
    const configuredThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '1000', 10);
    this.slowThresholdMs = isNaN(configuredThreshold) ? 1000 : configuredThreshold;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, response, start);
        },
        error: () => {
          // Still record timing even on error responses
          this.recordMetrics(request, response, start);
        },
      }),
    );
  }

  private recordMetrics(request: Request, response: Response, startTime: number): void {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = request;
    const user = request.user as { id?: string } | undefined;
    const userId = user?.id ?? 'anonymous';

    // Set the X-Response-Time header
    // Guard against headers already sent (e.g. streaming or SSE)
    if (!response.headersSent) {
      response.setHeader('X-Response-Time', `${duration}ms`);
    }

    // Log slow requests as warnings
    if (duration > this.slowThresholdMs) {
      const contentLength = response.get('content-length') || 'unknown';
      this.logger.warn(
        `Slow request: ${method} ${originalUrl} took ${duration}ms ` +
          `(threshold=${this.slowThresholdMs}ms) ` +
          `userId=${userId} ` +
          `contentLength=${contentLength} ` +
          `status=${response.statusCode}`,
      );
    }
  }
}
