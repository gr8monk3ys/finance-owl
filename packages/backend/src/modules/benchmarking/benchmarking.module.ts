import { Module } from '@nestjs/common';
import { BenchmarkingService } from './benchmarking.service';
import { BenchmarkingController } from './benchmarking.controller';

@Module({
  providers: [BenchmarkingService],
  controllers: [BenchmarkingController],
  exports: [BenchmarkingService],
})
export class BenchmarkingModule {}
