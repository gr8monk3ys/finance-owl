import { IsNumber, IsString, IsIn, Min, Max } from 'class-validator';

export class CompoundInterestDto {
  @IsNumber()
  @Min(0)
  initialDeposit!: number;

  @IsNumber()
  @Min(0)
  monthlyContribution!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  annualRate!: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  years!: number;

  @IsString()
  @IsIn(['daily', 'monthly', 'quarterly', 'annually'])
  compoundingFrequency!: string;
}
