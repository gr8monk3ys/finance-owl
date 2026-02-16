import {
  IsInt,
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditFactorDto {
  @IsString()
  @IsIn([
    'payment_history',
    'credit_utilization',
    'credit_age',
    'total_accounts',
    'hard_inquiries',
    'derogatory_marks',
  ])
  factor!: string;

  @IsString()
  value!: string;

  @IsString()
  @IsIn(['high', 'medium', 'low'])
  impact!: string;

  @IsString()
  @IsIn(['good', 'fair', 'poor', 'needs_work'])
  status!: string;
}

export class AddScoreDto {
  @IsInt()
  @Min(300)
  @Max(850)
  score!: number;

  @IsString()
  @IsIn(['manual', 'transunion', 'equifax', 'experian'])
  source!: string;

  @IsString()
  @IsIn(['vantage3', 'fico8', 'fico9'])
  scoreType!: string;

  @IsOptional()
  @IsString()
  reportDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditFactorDto)
  factors?: CreditFactorDto[];
}
