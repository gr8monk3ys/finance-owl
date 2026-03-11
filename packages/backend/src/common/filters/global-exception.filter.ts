import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ExceptionConstructor = Function;

/**
 * Maps well-known NestJS exception classes to their HTTP status codes
 * for cleaner error reporting.
 */
const KNOWN_EXCEPTION_MAP = new Map<ExceptionConstructor, number>([
  [BadRequestException, HttpStatus.BAD_REQUEST],
  [UnauthorizedException, HttpStatus.UNAUTHORIZED],
  [ForbiddenException, HttpStatus.FORBIDDEN],
  [NotFoundException, HttpStatus.NOT_FOUND],
  [ConflictException, HttpStatus.CONFLICT],
  [UnprocessableEntityException, HttpStatus.UNPROCESSABLE_ENTITY],
]);

/** HTTP status codes that should NOT be reported to Sentry */
const NON_REPORTABLE_STATUSES = new Set([
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
  HttpStatus.CONFLICT,
  HttpStatus.UNPROCESSABLE_ENTITY,
  HttpStatus.TOO_MANY_REQUESTS,
]);

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path?: string;
  requestId?: string;
  stack?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.extractErrorInfo(exception, request);

    // Log based on severity
    this.logException(exception, request, statusCode, message);

    // Report to Sentry if configured and the error is reportable
    this.reportToSentry(exception, request, statusCode);

    // Build sanitized response
    const responseBody: ErrorResponseBody = {
      statusCode,
      error,
      message: this.sanitizeMessage(statusCode, message),
      timestamp: new Date().toISOString(),
    };

    // Development-only fields
    if (!this.isProduction) {
      responseBody.path = request.url;

      if (exception instanceof Error && statusCode >= 500) {
        responseBody.stack = exception.stack;
      }
    }

    response.status(statusCode).json(responseBody);
  }

  // ---------------------------------------------------------------------------
  // Error extraction
  // ---------------------------------------------------------------------------

  private extractErrorInfo(
    exception: unknown,
    _request: Request,
  ): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    // HttpException (NestJS built-in or user-thrown)
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string | string[] = exception.message;
      let error = HttpStatus[statusCode] || 'Error';

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;

        // Handle class-validator validation errors (arrays of messages)
        if (Array.isArray(resp.message)) {
          message = resp.message as string[];
        } else if (resp.message) {
          message = resp.message as string;
        }

        if (resp.error) {
          error = resp.error as string;
        }
      }

      return { statusCode, message, error };
    }

    // Map well-known exception types via class prototype chain
    for (const [ExceptionClass, code] of KNOWN_EXCEPTION_MAP) {
      if (exception instanceof ExceptionClass) {
        return {
          statusCode: code,
          message: exception instanceof Error ? exception.message : 'Unknown error',
          error: HttpStatus[code] || 'Error',
        };
      }
    }

    // TypeErrors and RangeErrors are typically bugs
    if (exception instanceof TypeError || exception instanceof RangeError) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        error: 'InternalServerError',
      };
    }

    // Fallback: completely unknown exception
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        exception instanceof Error
          ? exception.message
          : 'Internal server error',
      error: 'InternalServerError',
    };
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  private logException(
    exception: unknown,
    request: Request,
    statusCode: number,
    message: string | string[],
  ): void {
    const user = request.user as { id?: string } | undefined;
    const userId = user?.id ?? 'anonymous';
    const formattedMessage = Array.isArray(message) ? message.join('; ') : message;
    const logContext = `${request.method} ${request.url} userId=${userId}`;

    if (statusCode >= 500) {
      // Log full stack trace for server errors
      const err =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${statusCode}] ${logContext} -- ${formattedMessage}`,
        err.stack,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(`[${statusCode}] ${logContext} -- ${formattedMessage}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Sentry reporting
  // ---------------------------------------------------------------------------

  private reportToSentry(
    exception: unknown,
    request: Request,
    statusCode: number,
  ): void {
    // Only report if Sentry is initialized
    const client = Sentry.getClient();
    if (!client) return;

    // Don't report expected client errors
    if (NON_REPORTABLE_STATUSES.has(statusCode)) return;

    const user = request.user as { id?: string } | undefined;

    Sentry.withScope((scope) => {
      scope.setTag('http.method', request.method);
      scope.setTag('http.url', request.url);
      scope.setTag('http.status_code', String(statusCode));

      const route = request.route?.path;
      if (route) {
        scope.setTag('route', `${request.method} ${route}`);
      }

      if (user?.id) {
        scope.setUser({ id: user.id });
      }

      scope.setExtra('request.ip', request.ip);
      scope.setExtra('request.user_agent', request.get('user-agent'));

      if (statusCode >= 500) {
        scope.setLevel('error');
      } else {
        scope.setLevel('warning');
      }

      if (exception instanceof Error) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureException(
          new Error(`Non-Error exception: ${String(exception)}`),
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Response sanitization
  // ---------------------------------------------------------------------------

  /**
   * In production, 500-level errors are sanitized to avoid leaking
   * internal implementation details (stack traces, DB errors, etc.).
   */
  private sanitizeMessage(
    statusCode: number,
    message: string | string[],
  ): string | string[] {
    if (statusCode >= 500 && this.isProduction) {
      return 'An unexpected error occurred';
    }
    return message;
  }
}
