import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordTransactionDto {
  @IsString()
  holdingId!: string;

  @IsString()
  @IsIn(['buy', 'sell', 'transfer', 'staking_reward', 'airdrop'])
  type!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  pricePerUnit!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  txHash?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
