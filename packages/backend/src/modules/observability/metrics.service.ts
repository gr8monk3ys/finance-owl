import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private readonly maxSamples = 1000;

  recordRequest(duration: number, isError: boolean) {
    this.requestCount++;
    if (isError) this.errorCount++;
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }
  }

  getMetrics() {
    const sorted = [...this.responseTimes].sort((a, b) => a - b);

    return {
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      errorRate:
        this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      avgResponseTime:
        sorted.length > 0
          ? sorted.reduce((a, b) => a + b, 0) / sorted.length
          : 0,
      p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  reset() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
}
