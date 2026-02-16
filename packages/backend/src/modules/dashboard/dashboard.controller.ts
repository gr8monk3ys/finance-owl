import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { DashboardService, type WidgetConfig } from './dashboard.service';
import { IsArray, ValidateNested, IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class WidgetPositionDto {
  @ApiProperty({ description: 'X position on the grid', example: 0 })
  @IsNumber()
  x!: number;

  @ApiProperty({ description: 'Y position on the grid', example: 0 })
  @IsNumber()
  y!: number;

  @ApiProperty({ description: 'Width in grid units', example: 4 })
  @IsNumber()
  w!: number;

  @ApiProperty({ description: 'Height in grid units', example: 3 })
  @IsNumber()
  h!: number;
}

class WidgetConfigDto {
  @ApiProperty({ description: 'Unique widget ID', example: 'widget-spending-chart' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Widget type', example: 'spending-chart' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Widget grid position', type: WidgetPositionDto })
  @ValidateNested()
  @Type(() => WidgetPositionDto)
  position!: WidgetPositionDto;

  @ApiPropertyOptional({ description: 'Widget-specific configuration' })
  @IsOptional()
  config?: Record<string, unknown>;

  @ApiProperty({ description: 'Whether the widget is visible', example: true })
  @IsBoolean()
  visible!: boolean;
}

class SaveLayoutDto {
  @ApiProperty({ description: 'Array of widget configurations', type: [WidgetConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetConfigDto)
  widgets!: WidgetConfigDto[];
}

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get the user dashboard layout' })
  @ApiResponse({ status: 200, description: 'Dashboard layout with widget positions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('layout')
  getLayout(@CurrentUser('id') userId: string) {
    return this.dashboardService.getLayout(userId);
  }

  @ApiOperation({ summary: 'Save the user dashboard layout' })
  @ApiResponse({ status: 200, description: 'Layout saved' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Put('layout')
  saveLayout(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveLayoutDto,
  ) {
    return this.dashboardService.saveLayout(userId, dto.widgets as WidgetConfig[]);
  }

  @ApiOperation({ summary: 'Reset dashboard layout to defaults' })
  @ApiResponse({ status: 200, description: 'Layout reset to defaults' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('layout/reset')
  @HttpCode(HttpStatus.OK)
  resetLayout(@CurrentUser('id') userId: string) {
    return this.dashboardService.resetLayout(userId);
  }
}
