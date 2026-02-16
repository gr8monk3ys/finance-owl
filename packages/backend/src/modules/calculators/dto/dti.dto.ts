import { IsNumber, IsOptional, Min } from 'class-validator';

export class DtiDto {
  @IsNumber()
  @Min(1)
  monthlyIncome!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mortgage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carPayment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  studentLoans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditCards?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDebts?: number;
}
