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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { BudgetsService } from './budgets.service';
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const DOCUMENTED_BUDGET_PERIODS = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
] as const;

const ACCEPTED_BUDGET_PERIODS = [...DOCUMENTED_BUDGET_PERIODS, 'yearly'] as const;

class CreateBudgetDto {
  @ApiProperty({ description: 'Category ID to budget for', example: 'cat_food' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ description: 'Budget amount limit', example: 500.00 })
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    description: 'Budget period',
    enum: DOCUMENTED_BUDGET_PERIODS,
    example: 'monthly',
  })
  @IsString()
  @IsIn(ACCEPTED_BUDGET_PERIODS)
  period!: string;

  @ApiPropertyOptional({ description: 'Enable rollover of unused budget to next period', default: false })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  @ApiPropertyOptional({ description: 'Maximum rollover cap amount', example: 200.00 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rolloverCap?: number;
}

class UpdateBudgetDto {
  @ApiPropertyOptional({ description: 'Updated budget amount', example: 600.00 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Updated budget period',
    enum: DOCUMENTED_BUDGET_PERIODS,
  })
  @IsOptional()
  @IsString()
  @IsIn(ACCEPTED_BUDGET_PERIODS)
  period?: string;

  @ApiPropertyOptional({ description: 'Enable or disable rollover' })
  @IsOptional()
  @IsBoolean()
  rollover?: boolean;

  @ApiPropertyOptional({ description: 'Updated rollover cap amount' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rolloverCap?: number;
}

@ApiTags('Budgets')
@ApiBearerAuth('bearer')
@Controller('budgets')
export class BudgetsController {
  constructor(private budgetsService: BudgetsService) {}

  @ApiOperation({ summary: 'List all budgets for the current user' })
  @ApiResponse({ status: 200, description: 'List of budgets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.budgetsService.findAll(userId);
  }

  @ApiOperation({ summary: 'Get budget summary with spending progress for all budgets' })
  @ApiResponse({ status: 200, description: 'Budget summary with spent vs. limit for each category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.budgetsService.getSummary(userId);
  }

  @ApiOperation({ summary: 'Get a single budget by ID' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.budgetsService.findById(userId, id);
  }

  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({ status: 201, description: 'Budget created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(userId, dto);
  }

  @ApiOperation({ summary: 'Update a budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 204, description: 'Budget deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.budgetsService.remove(userId, id);
  }

  @ApiOperation({ summary: 'Process budget rollovers for the current period' })
  @ApiResponse({ status: 201, description: 'Rollovers processed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('process-rollovers')
  processRollovers(@CurrentUser('id') userId: string) {
    return this.budgetsService.processRollovers(userId);
  }
}
