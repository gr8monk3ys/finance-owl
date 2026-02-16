import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { FlaggingService } from './flagging.service';
import { IsString, IsOptional } from 'class-validator';

class CreateFlagDto {
  @IsString()
  transactionId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('flags')
export class FlaggingController {
  constructor(private flaggingService: FlaggingService) {}

  @Post()
  flag(@CurrentUser('id') userId: string, @Body() dto: CreateFlagDto) {
    return this.flaggingService.flag(userId, dto.transactionId, dto.reason);
  }

  @Patch(':id/resolve')
  resolve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.flaggingService.resolve(userId, id);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.flaggingService.findByUser(userId);
  }

  @Get('household/:householdId')
  findByHousehold(
    @CurrentUser('id') userId: string,
    @Param('householdId') householdId: string,
    @Query('status') status?: 'open' | 'resolved',
  ) {
    return this.flaggingService.findByHousehold(userId, householdId, status);
  }
}
