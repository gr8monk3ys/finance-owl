import { IsString, IsIn, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class SimulateDto {
  @IsString()
  @IsIn([
    'open_credit_card',
    'pay_down_debt',
    'close_account',
    'late_payment',
    'increase_credit_limit',
    'apply_for_mortgage',
  ])
  scenario!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  currentUtilization?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetUtilization?: number;
}
