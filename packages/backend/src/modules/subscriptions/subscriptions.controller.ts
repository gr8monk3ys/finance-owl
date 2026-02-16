import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { SubscriptionsService } from './subscriptions.service';
import { DetectionService } from './detection.service';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateSubscriptionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsNumber()
  @Type(() => Number)
  estimatedAmount!: number;

  @IsString()
  @IsIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'])
  frequency!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  nextExpectedDate?: string;
}

class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimatedAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'])
  frequency?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  nextExpectedDate?: string;
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private subscriptionsService: SubscriptionsService,
    private detectionService: DetectionService,
  ) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.findAll(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getSummary(userId);
  }

  @Get('upcoming')
  getUpcoming(
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.subscriptionsService.getUpcomingBills(userId, daysNum);
  }

  @Get('price-changes')
  getPriceChanges(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.detectPriceChanges(userId);
  }

  @Post('detect')
  detect(@CurrentUser('id') userId: string) {
    return this.detectionService.detectForUser(userId);
  }

  @Get('duplicates')
  getDuplicates(@CurrentUser('id') userId: string) {
    return this.detectionService.detectDuplicates(userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.findOne(userId, id);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(userId, id, dto);
  }

  @Patch(':id/confirm')
  confirm(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.confirm(userId, id);
  }

  @Patch(':id/dismiss')
  dismiss(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.dismiss(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.subscriptionsService.remove(userId, id);
  }
}
