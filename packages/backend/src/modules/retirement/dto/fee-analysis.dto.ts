import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeAnalysisDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentBalance!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  annualFeePercent!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  yearsToRetirement!: number;
}
