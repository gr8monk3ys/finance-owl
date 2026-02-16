import { IsString, IsNumber, IsOptional, IsIn, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CalculatePayoffDto {
  @IsString()
  @IsIn(['snowball', 'avalanche', 'custom'])
  strategy!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  extraMonthlyPayment?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customOrder?: string[];
}
