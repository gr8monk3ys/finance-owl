import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { TransactionsService } from './transactions.service';
import { TransactionSplitService, type SplitInput } from './transaction-split.service';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class TransactionFilterDto {
  @ApiPropertyOptional({ description: 'Filter by account ID', example: 'acc_abc123' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID', example: 'cat_food' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum transaction amount', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum transaction amount', example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Full-text search on name/merchant/description',
    example: 'coffee',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by pending status', example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  pending?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

class CreateTransactionDto {
  @ApiProperty({
    description: 'Account ID to associate the transaction with',
    example: 'acc_abc123',
  })
  @IsString()
  accountId!: string;

  @ApiProperty({
    description: 'Transaction amount (positive = income, negative = expense)',
    example: -42.5,
  })
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ description: 'Transaction name / payee', example: 'Starbucks Coffee' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Merchant name', example: 'Starbucks' })
  @IsOptional()
  @IsString()
  merchantName?: string;

  @ApiPropertyOptional({ description: 'Transaction description or memo' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category ID', example: 'cat_food' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Transaction date (YYYY-MM-DD)', example: '2025-06-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional({ description: 'Whether the transaction is pending', default: false })
  @IsOptional()
  @IsBoolean()
  pending?: boolean;

  @ApiPropertyOptional({ description: 'User notes for the transaction' })
  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateTransactionDto {
  @ApiPropertyOptional({ description: 'New category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'User notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Updated transaction name' })
  @IsOptional()
  @IsString()
  name?: string;
}

class SplitItemDto {
  @ApiPropertyOptional({ description: 'Category ID for this split portion' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Amount for this split portion', example: 15.0 })
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ description: 'Note for this split portion' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Household member ID for shared expenses' })
  @IsOptional()
  @IsString()
  householdMemberId?: string;
}

class SplitTransactionDto {
  @ApiProperty({ description: 'Array of split portions', type: [SplitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  splits!: SplitItemDto[];
}

@ApiTags('Transactions')
@ApiBearerAuth('bearer')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    private splitService: TransactionSplitService,
  ) {}

  @ApiOperation({ summary: 'List transactions with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() filters: TransactionFilterDto) {
    return this.transactionsService.findAll(userId, filters);
  }

  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.transactionsService.findById(userId, id);
  }

  @ApiOperation({ summary: 'Create a manual transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.createManual(userId, dto);
  }

  @ApiOperation({ summary: 'Update a transaction (category, notes, name)' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.transactionsService.remove(userId, id);
  }

  // --- Transaction Split Endpoints ---

  @ApiOperation({ summary: 'Split a transaction into multiple categories' })
  @ApiParam({ name: 'id', description: 'Transaction ID to split' })
  @ApiResponse({ status: 201, description: 'Transaction split created' })
  @ApiResponse({ status: 400, description: 'Validation error (amounts must equal original)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post(':id/split')
  splitTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SplitTransactionDto,
  ) {
    return this.splitService.splitTransaction(userId, id, dto.splits);
  }

  @ApiOperation({ summary: 'Get splits for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'List of transaction splits' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Get(':id/splits')
  getSplits(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.splitService.getSplits(userId, id);
  }

  @ApiOperation({ summary: 'Replace all splits for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Splits replaced' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Put(':id/split')
  updateSplits(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SplitTransactionDto,
  ) {
    return this.splitService.updateSplits(userId, id, dto.splits);
  }

  @ApiOperation({ summary: 'Remove all splits from a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 204, description: 'Splits removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Delete(':id/split')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSplits(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.splitService.removeSplits(userId, id);
  }
}
