import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { SocialService } from './social.service';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

class AddReplyDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

class PostsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

@Controller('social')
export class SocialController {
  constructor(private socialService: SocialService) {}

  @Get('posts')
  getPosts(@Query() query: PostsQueryDto) {
    return this.socialService.getPosts(
      query.category,
      query.page || 1,
      query.limit || 20,
    );
  }

  @Get('posts/:id')
  getPostById(@Param('id') id: string) {
    return this.socialService.getPostById(id);
  }

  @Post('posts')
  createPost(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.socialService.createPost(userId, dto);
  }

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  likePost(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.socialService.likePost(userId, id);
  }

  @Delete('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  unlikePost(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.socialService.unlikePost(userId, id);
  }

  @Post('posts/:id/replies')
  addReply(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddReplyDto,
  ) {
    return this.socialService.addReply(userId, id, dto.content);
  }

  @Get('posts/:id/replies')
  getReplies(@Param('id') id: string) {
    return this.socialService.getReplies(id);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.socialService.deletePost(userId, id);
  }
}
