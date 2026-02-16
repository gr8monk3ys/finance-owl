import { IsString, IsNumber, IsOptional, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const DEBT_TYPES = [
  'credit_card',
  'student_loan',
  'auto_loan',
  'mortgage',
  'personal_loan',
  'medical',
  'other',
] as const;

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(DEBT_TYPES)
  type?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentBalance?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minimumPayment?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  originalBalance?: number;

  @IsOptional()
  @IsString()
  lender?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(31)
  dueDay?: number;
}
