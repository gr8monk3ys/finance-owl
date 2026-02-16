import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { EducationService } from './education.service';
import { IsOptional, IsString } from 'class-validator';

class ArticleFilterDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('education')
export class EducationController {
  constructor(private educationService: EducationService) {}

  @Get('topics')
  getTopics() {
    return this.educationService.getTopics();
  }

  @Get('articles')
  getArticles(@Query() filters: ArticleFilterDto) {
    return this.educationService.getArticles(filters);
  }

  @Get('articles/:slug')
  getArticle(@Param('slug') slug: string) {
    return this.educationService.getArticle(slug);
  }

  @Get('articles/:slug/related')
  getRelatedArticles(@Param('slug') slug: string) {
    return this.educationService.getRelatedArticles(slug);
  }

  @Get('recommended')
  getRecommended(@CurrentUser('id') userId: string) {
    return this.educationService.getPersonalizedRecommendations(userId);
  }

  @Post('progress/:slug')
  trackProgress(
    @CurrentUser('id') userId: string,
    @Param('slug') slug: string,
  ) {
    return this.educationService.trackProgress(userId, slug);
  }

  @Get('progress')
  getProgress(@CurrentUser('id') userId: string) {
    return this.educationService.getProgress(userId);
  }

  @Post('bookmark/:slug')
  toggleBookmark(
    @CurrentUser('id') userId: string,
    @Param('slug') slug: string,
  ) {
    return this.educationService.toggleBookmark(userId, slug);
  }
}
