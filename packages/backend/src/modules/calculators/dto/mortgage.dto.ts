import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class MortgageDto {
  @IsNumber()
  @Min(1)
  homePrice!: number;

  @IsNumber()
  @Min(0)
  downPayment!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  interestRate!: number;

  @IsNumber()
  @Min(1)
  @Max(50)
  loanTermYears!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  propertyTax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  homeInsurance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pmi?: number;
}
