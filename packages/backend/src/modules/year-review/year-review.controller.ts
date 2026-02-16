import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { YearReviewService } from './year-review.service';

@Controller('year-review')
export class YearReviewController {
  constructor(private yearReviewService: YearReviewService) {}

  @Get('years')
  getAvailableYears(@CurrentUser('id') userId: string) {
    return this.yearReviewService.getAvailableYears(userId);
  }

  @Get(':year')
  getReview(
    @CurrentUser('id') userId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.yearReviewService.getReview(userId, year);
  }

  @Post(':year/generate')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentUser('id') userId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.yearReviewService.generate(userId, year);
  }
}
