import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ChallengesService } from './challenges.service';
import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class CreateChallengeDto {
  @IsString()
  @IsIn(['no_spend', 'round_up', '52_week', 'penny', 'custom'])
  type!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetAmount?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

class AddEntryDto {
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('challenges')
export class ChallengesController {
  constructor(private challengesService: ChallengesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.challengesService.findAll(userId);
  }

  @Get('templates')
  getTemplates() {
    return this.challengesService.getTemplates();
  }

  @Get('stats')
  getLeaderboard(@CurrentUser('id') userId: string) {
    return this.challengesService.getLeaderboard(userId);
  }

  @Get(':id')
  findById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.challengesService.findById(userId, id);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChallengeDto,
  ) {
    return this.challengesService.create(userId, dto);
  }

  @Post(':id/entries')
  addEntry(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddEntryDto,
  ) {
    return this.challengesService.addEntry(userId, id, dto);
  }

  @Patch(':id/abandon')
  @HttpCode(HttpStatus.OK)
  abandon(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.challengesService.abandon(userId, id);
  }
}
