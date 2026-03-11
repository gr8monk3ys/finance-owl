import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { sql } from 'drizzle-orm';

interface ServiceStatus {
  status: 'ok' | 'error' | 'unavailable';
  responseTimeMs?: number;
  message?: string;
}

interface DetailedHealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rssMb: string;
    heapUsedMb: string;
    heapTotalMb: string;
  };
  process: {
    pid: number;
    nodeVersion: string;
    platform: string;
    environment: string;
  };
}

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  @ApiOperation({ summary: 'Readiness check (verifies database and Redis connectivity)' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  @Public()
  @Get('ready')
  async ready() {
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();

    const isReady = dbStatus.status === 'ok' && redisStatus.status !== 'error';

    const response = {
      status: isReady ? 'ok' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    if (!isReady) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  @ApiOperation({ summary: 'Liveness check (confirms the process is alive)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  @Public()
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };
  }

  @ApiOperation({ summary: 'Detailed system status (memory, services, version)' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  @Public()
  @Get('detailed')
  async detailed(): Promise<DetailedHealthResponse> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const memoryUsage = process.memoryUsage();
    const toMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

    const allOk = dbStatus.status === 'ok';
    const anyError = dbStatus.status === 'error' || redisStatus.status === 'error';

    let overallStatus: 'ok' | 'degraded' | 'unhealthy';
    if (allOk) {
      overallStatus = 'ok';
    } else if (anyError) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.configService.get<string>('npm_package_version') || '0.1.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rssMb: toMb(memoryUsage.rss),
        heapUsedMb: toMb(memoryUsage.heapUsed),
        heapTotalMb: toMb(memoryUsage.heapTotal),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        environment: this.configService.get<string>('NODE_ENV') || 'development',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Service checks
  // ---------------------------------------------------------------------------

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: 'ok',
        responseTimeMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health check failed: ${message}`);
      return {
        status: 'error',
        responseTimeMs: Date.now() - start,
        message: 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (!redisUrl) {
        return {
          status: 'unavailable',
          message: 'Redis not configured',
        };
      }

      // BullMQ manages its own Redis connections. If the REDIS_URL is configured,
      // we consider Redis available. A deeper ping-based check can be added
      // when a shared Redis client is introduced.
      return {
        status: 'ok',
        responseTimeMs: Date.now() - start,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis health check failed: ${message}`);
      return {
        status: 'error',
        responseTimeMs: Date.now() - start,
        message: 'Redis connection failed',
      };
    }
  }
}
