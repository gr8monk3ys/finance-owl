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
import { AccountsService } from './accounts.service';
import { CurrentUser } from '../../common/decorators';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';

class CreateManualAccountDto {
  @ApiProperty({ description: 'Account display name', example: 'Chase Checking' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Account type',
    enum: ['checking', 'savings', 'credit_card', 'investment', 'loan', 'mortgage', 'other'],
    example: 'checking',
  })
  @IsString()
  @IsIn([
    'checking',
    'savings',
    'credit_card',
    'investment',
    'loan',
    'mortgage',
    'other',
  ])
  type!: string;

  @ApiPropertyOptional({ description: 'Financial institution name', example: 'Chase' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  institutionName?: string;

  @ApiPropertyOptional({ description: 'Initial account balance', example: 5000.00 })
  @IsNumber()
  @IsOptional()
  balance?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;
}

class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Updated account name', example: 'My Checking' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated account type' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Updated institution name' })
  @IsString()
  @IsOptional()
  institutionName?: string;

  @ApiPropertyOptional({ description: 'Updated current balance', example: 4250.00 })
  @IsNumber()
  @IsOptional()
  currentBalance?: number;

  @ApiPropertyOptional({ description: 'Hide account from dashboard', example: false })
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}

@ApiTags('Accounts')
@ApiBearerAuth('bearer')
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @ApiOperation({ summary: 'List all accounts for the current user' })
  @ApiResponse({ status: 200, description: 'List of accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.accountsService.findAll(userId);
  }

  @ApiOperation({ summary: 'Get aggregated net worth across all accounts' })
  @ApiResponse({ status: 200, description: 'Net worth breakdown' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('net-worth')
  async getNetWorth(@CurrentUser('id') userId: string) {
    return this.accountsService.getNetWorth(userId);
  }

  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.accountsService.findById(userId, id);
  }

  @ApiOperation({ summary: 'Create a manual (non-Plaid) account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('manual')
  async createManual(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateManualAccountDto,
  ) {
    return this.accountsService.createManual(userId, dto);
  }

  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete an account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.accountsService.remove(userId, id);
  }
}
