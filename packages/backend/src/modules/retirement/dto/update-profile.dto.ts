import {
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRetirementProfileDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(18)
  @Max(80)
  currentAge?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(50)
  @Max(80)
  retirementAge?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentSavings?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyContribution?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  employerMatch?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  expectedReturn?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(15)
  inflationRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  desiredMonthlyIncome?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  socialSecurityEstimate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  pensionAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['conservative', 'moderate', 'aggressive'])
  riskTolerance?: string;
}
