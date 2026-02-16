import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRuleDto {
  @IsString()
  name!: string;

  @IsString()
  @IsIn(['round_up', 'percentage', 'fixed', 'surplus'])
  ruleType!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsIn([1, 5, 10])
  roundUpTo?: number;

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  targetGoalId?: string;
}
