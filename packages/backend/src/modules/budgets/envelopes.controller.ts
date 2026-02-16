import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { EnvelopesService } from './envelopes.service';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── DTOs ──────────────────────────────────────────────────────────────

class CreateEnvelopeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetedAmount?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  @IsOptional()
  @IsBoolean()
  isGoal?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'weekly', 'yearly'])
  period?: string;
}

class UpdateEnvelopeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetedAmount?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  @IsOptional()
  @IsBoolean()
  isGoal?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'weekly', 'yearly'])
  period?: string;
}

class AllocationItemDto {
  @IsString()
  envelopeId!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;
}

class AllocateFundsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations!: AllocationItemDto[];
}

class TransferDto {
  @IsString()
  fromEnvelopeId!: string;

  @IsString()
  toEnvelopeId!: string;

  @IsNumber()
  @Type(() => Number)
  amount!: number;
}

// ── Controller ────────────────────────────────────────────────────────

@Controller('envelopes')
export class EnvelopesController {
  constructor(private envelopesService: EnvelopesService) {}

  @Get()
  getEnvelopes(@CurrentUser('id') userId: string) {
    return this.envelopesService.getEnvelopes(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.envelopesService.getSummary(userId);
  }

  @Post()
  createEnvelope(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEnvelopeDto,
  ) {
    return this.envelopesService.createEnvelope(userId, dto);
  }

  @Patch(':id')
  updateEnvelope(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEnvelopeDto,
  ) {
    return this.envelopesService.updateEnvelope(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEnvelope(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.envelopesService.deleteEnvelope(userId, id);
  }

  @Post('allocate')
  allocateFunds(
    @CurrentUser('id') userId: string,
    @Body() dto: AllocateFundsDto,
  ) {
    return this.envelopesService.allocateFunds(userId, dto.allocations);
  }

  @Post('transfer')
  transferBetweenEnvelopes(
    @CurrentUser('id') userId: string,
    @Body() dto: TransferDto,
  ) {
    return this.envelopesService.transferBetweenEnvelopes(
      userId,
      dto.fromEnvelopeId,
      dto.toEnvelopeId,
      dto.amount,
    );
  }

  @Post('rollover')
  rolloverEnvelopes(@CurrentUser('id') userId: string) {
    return this.envelopesService.rolloverEnvelopes(userId);
  }
}
