import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from '../../modules/audit/audit.service';

// ---------------------------------------------------------------------------
// Metadata key & decorator
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_KEY = 'auditAction';

export interface AuditActionOptions {
  /** Human-readable action name, e.g. "user.login", "account.link". */
  action: string;
  /** Broad category for filtering. */
  resource: string;
}

/**
 * Decorator that marks a handler as auditable.
 *
 * Usage:
 *   @AuditAction({ action: 'user.login', resource: 'auth' })
 *   @Post('login')
 *   async login() { ... }
 */
export function AuditAction(options: AuditActionOptions) {
  return SetMetadata(AUDIT_ACTION_KEY, options);
}

// ---------------------------------------------------------------------------
// Interceptor
// ---------------------------------------------------------------------------

/**
 * Global interceptor that writes an audit log entry for every request
 * decorated with @AuditAction.
 *
 * Recorded fields:
 *   - timestamp (server-side, via DB default)
 *   - userId    (from JWT payload or 'anonymous')
 *   - ipAddress (client IP, respecting X-Forwarded-For)
 *   - action    (from decorator)
 *   - resource  (from decorator, used as entityType)
 *   - outcome   (success / failure)
 *   - details   (method, path, status code, duration, error message if any)
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.getAllAndOverride<AuditActionOptions | undefined>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @AuditAction decorator -> pass through
    if (!opts) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id?: string } | undefined;
    const userId = user?.id ?? 'anonymous';
    const ip = this.extractIp(request);
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.writeAuditLog(userId, opts, ip, request, 'success', duration);
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.writeAuditLog(userId, opts, ip, request, 'failure', duration, errorMessage);
        throw error;
      }),
    );
  }

  // ---------- internal ----------

  private writeAuditLog(
    userId: string,
    opts: AuditActionOptions,
    ip: string,
    request: Request,
    outcome: 'success' | 'failure',
    durationMs: number,
    errorMessage?: string,
  ): void {
    const details: Record<string, unknown> = {
      method: request.method,
      path: request.url,
      outcome,
      durationMs,
    };

    if (errorMessage) {
      details.error = errorMessage;
    }

    // Fire-and-forget: audit logging should never block or crash the request.
    this.auditService
      .log(userId, opts.action, opts.resource, undefined, JSON.stringify(details), ip)
      .catch((err) => {
        this.logger.error(
          `Failed to write audit log: action=${opts.action} userId=${userId}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
