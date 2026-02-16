import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { RecommendationsService } from './recommendations.service';
import { IsOptional, IsString } from 'class-validator';

class RecommendationsQueryDto {
  @IsOptional()
  @IsString()
  type?: string;
}

@Controller('recommendations')
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @Get()
  getRecommendations(
    @CurrentUser('id') userId: string,
    @Query() query: RecommendationsQueryDto,
  ) {
    return this.recommendationsService.getRecommendations(userId, query.type);
  }

  @Post('generate')
  generateRecommendations(@CurrentUser('id') userId: string) {
    return this.recommendationsService.generateRecommendations(userId);
  }

  @Patch(':id/dismiss')
  dismissRecommendation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.recommendationsService.dismissRecommendation(userId, id);
  }

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.recommendationsService.getProfile(userId);
  }
}
