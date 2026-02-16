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
import { RealEstateService } from './real-estate.service';
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

class CreatePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2)
  state!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  zipCode!: string;

  @IsOptional()
  @IsString()
  @IsIn(['single_family', 'condo', 'townhouse', 'multi_family', 'land'])
  propertyType?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  squareFeet?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  yearBuilt?: number;

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
  @MaxLength(1000)
  zestimateUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(['single_family', 'condo', 'townhouse', 'multi_family', 'land'])
  propertyType?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  squareFeet?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  yearBuilt?: number;

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
  @MaxLength(1000)
  zestimateUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class AddEstimateDto {
  @IsNumber()
  @Type(() => Number)
  estimatedValue!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  source!: string;

  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('real-estate')
export class RealEstateController {
  constructor(private realEstateService: RealEstateService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.realEstateService.findAll(userId);
  }

  @Get('summary')
  getPortfolioSummary(@CurrentUser('id') userId: string) {
    return this.realEstateService.getPortfolioSummary(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.realEstateService.findById(userId, id);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.realEstateService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.realEstateService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.realEstateService.remove(userId, id);
  }

  @Post(':id/estimate')
  addEstimate(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddEstimateDto,
  ) {
    return this.realEstateService.addValueEstimate(userId, id, dto);
  }

  @Get(':id/history')
  getValueHistory(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.realEstateService.getValueHistory(userId, id);
  }
}
