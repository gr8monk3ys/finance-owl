import { Module } from '@nestjs/common';
import { YearReviewService } from './year-review.service';
import { YearReviewController } from './year-review.controller';

@Module({
  providers: [YearReviewService],
  controllers: [YearReviewController],
  exports: [YearReviewService],
})
export class YearReviewModule {}
