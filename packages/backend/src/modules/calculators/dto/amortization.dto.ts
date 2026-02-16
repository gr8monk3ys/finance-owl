import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class AmortizationDto {
  @IsNumber()
  @Min(1)
  principal!: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  interestRate!: number;

  @IsNumber()
  @Min(1)
  @Max(600)
  termMonths!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPayment?: number;
}
