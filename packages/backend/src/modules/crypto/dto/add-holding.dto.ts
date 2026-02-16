import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddHoldingDto {
  @IsString()
  symbol!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  averageCostBasis!: number;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
