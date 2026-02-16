import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { CategoriesService } from './categories.service';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Groceries' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Parent category ID for sub-categories' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Icon identifier', example: 'shopping-cart' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Display color (hex)', example: '#4CAF50' })
  @IsOptional()
  @IsString()
  color?: string;
}

class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Updated category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated parent category ID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Updated icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Updated display color (hex)' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Sort order for display', example: 1 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class CreateRuleDto {
  @ApiProperty({ description: 'Category ID to auto-assign', example: 'cat_groceries' })
  @IsString()
  categoryId!: string;

  @ApiProperty({
    description: 'Rule match type',
    enum: ['merchant', 'description', 'amount_range', 'regex'],
    example: 'merchant',
  })
  @IsString()
  @IsIn(['merchant', 'description', 'amount_range', 'regex'])
  matchType!: string;

  @ApiProperty({ description: 'Value to match against', example: 'Whole Foods' })
  @IsString()
  matchValue!: string;

  @ApiPropertyOptional({ description: 'Rule priority (lower = higher priority)', example: 10 })
  @IsOptional()
  @IsNumber()
  priority?: number;
}

@ApiTags('Categories')
@ApiBearerAuth('bearer')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'List all categories (including user-defined and defaults)' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @ApiOperation({ summary: 'Get a single category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.categoriesService.findById(userId, id);
  }

  @ApiOperation({ summary: 'Create a custom category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.categoriesService.remove(userId, id);
  }

  // Categorization rules

  @ApiOperation({ summary: 'List auto-categorization rules' })
  @ApiResponse({ status: 200, description: 'List of categorization rules' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('rules/list')
  getRules(@CurrentUser('id') userId: string) {
    return this.categoriesService.getRules(userId);
  }

  @ApiOperation({ summary: 'Create an auto-categorization rule' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('rules')
  createRule(@CurrentUser('id') userId: string, @Body() dto: CreateRuleDto) {
    return this.categoriesService.createRule(userId, dto);
  }

  @ApiOperation({ summary: 'Delete an auto-categorization rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  @Delete('rules/:id')
  deleteRule(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.categoriesService.deleteRule(userId, id);
  }
}
