import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware.
 *
 * Logs every HTTP request with method, path, status code, response time,
 * and authenticated user ID.
 *
 * Behaviour:
 * - Skips health check endpoints (/api/health*) to avoid log noise from
 *   load balancers and orchestrators.
 * - Uses structured JSON logging in production (parseable by Datadog,
 *   CloudWatch, Railway logs, etc.).
 * - Uses colorized human-readable output in development.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  /** Path prefixes that should not be logged */
  private readonly skipPaths = ['/api/health', '/health'];

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip health check endpoints to keep logs clean
    if (this.shouldSkip(req.originalUrl || req.url)) {
      return next();
    }

    const start = Date.now();
    const { method, originalUrl } = req;

    // Capture the finish event to log after response is sent
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const user = req.user as { id?: string } | undefined;
      const userId = user?.id ?? 'anonymous';
      const contentLength = res.get('content-length') || '-';

      if (this.isProduction) {
        this.logStructured({
          method,
          path: originalUrl,
          statusCode,
          durationMs: duration,
          userId,
          contentLength,
          ip: this.extractIp(req),
          userAgent: req.get('user-agent') || '-',
        });
      } else {
        this.logColorized(method, originalUrl, statusCode, duration, userId);
      }
    });

    next();
  }

  private shouldSkip(url: string): boolean {
    return this.skipPaths.some((prefix) => url.startsWith(prefix));
  }

  private logStructured(data: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId: string;
    contentLength: string;
    ip: string;
    userAgent: string;
  }): void {
    const level = data.statusCode >= 500 ? 'error' : data.statusCode >= 400 ? 'warn' : 'log';

    const logEntry = {
      level,
      type: 'http_request',
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Use the appropriate NestJS logger level
    if (level === 'error') {
      this.logger.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      this.logger.warn(JSON.stringify(logEntry));
    } else {
      this.logger.log(JSON.stringify(logEntry));
    }
  }

  private logColorized(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId: string,
  ): void {
    const statusColor = this.getStatusColor(statusCode);
    const durationColor = duration > 1000 ? '\x1b[33m' : '\x1b[32m'; // yellow if slow, green otherwise
    const reset = '\x1b[0m';

    const message =
      `${method} ${url} ${statusColor}${statusCode}${reset} ` +
      `${durationColor}${duration}ms${reset} ` +
      `userId=${userId}`;

    if (statusCode >= 500) {
      this.logger.error(message);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }

  private getStatusColor(statusCode: number): string {
    if (statusCode >= 500) return '\x1b[31m'; // red
    if (statusCode >= 400) return '\x1b[33m'; // yellow
    if (statusCode >= 300) return '\x1b[36m'; // cyan
    if (statusCode >= 200) return '\x1b[32m'; // green
    return '\x1b[0m'; // reset
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
