import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
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
  @IsIn(['primary_residence', 'rental', 'vacation', 'investment', 'land'])
  propertyType?: string;

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
  mortgageAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  annualPropertyTax?: number;

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
