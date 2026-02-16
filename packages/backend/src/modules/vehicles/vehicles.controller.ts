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
import { VehiclesService } from './vehicles.service';
import { CurrentUser } from '../../common/decorators';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateVehicleDto {
  @IsInt()
  @Type(() => Number)
  year!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  make!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  mileage?: number;

  @IsOptional()
  @IsString()
  @IsIn(['excellent', 'good', 'fair', 'poor'])
  condition?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentEstimate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class UpdateVehicleDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  mileage?: number;

  @IsOptional()
  @IsString()
  @IsIn(['excellent', 'good', 'fair', 'poor'])
  condition?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentEstimate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class AddVehicleEstimateDto {
  @IsNumber()
  @Type(() => Number)
  estimatedValue!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  source!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  mileageAtEstimate?: number;

  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.vehiclesService.findAll(userId);
  }

  @Get('summary')
  getFleetSummary(@CurrentUser('id') userId: string) {
    return this.vehiclesService.getFleetSummary(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.vehiclesService.findById(userId, id);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.vehiclesService.remove(userId, id);
  }

  @Post(':id/estimate')
  addEstimate(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddVehicleEstimateDto,
  ) {
    return this.vehiclesService.addValueEstimate(userId, id, dto);
  }

  @Get(':id/history')
  getValueHistory(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.vehiclesService.getValueHistory(userId, id);
  }

  @Get(':id/depreciation')
  getDepreciation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.vehiclesService.estimateDepreciation(userId, id);
  }
}
