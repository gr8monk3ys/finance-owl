import { IsNumber, Min, Max } from 'class-validator';

export class RefinanceDto {
  @IsNumber()
  @Min(1)
  currentBalance!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  currentRate!: number;

  @IsNumber()
  @Min(1)
  currentMonthlyPayment!: number;

  @IsNumber()
  @Min(1)
  @Max(600)
  currentRemainingMonths!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  newRate!: number;

  @IsNumber()
  @Min(1)
  @Max(50)
  newTermYears!: number;

  @IsNumber()
  @Min(0)
  closingCosts!: number;
}
