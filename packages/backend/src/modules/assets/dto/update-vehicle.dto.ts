import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1900)
  @Max(2100)
  year?: number;

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
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsString()
  @IsIn(['excellent', 'good', 'fair', 'poor'])
  condition?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsString()
  loanAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyPayment?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  annualInsurance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
