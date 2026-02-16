import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
} from 'class-validator';

export class InitiateTransferDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toAccountId!: string;

  @IsNumber()
  @Min(1)
  amount!: number; // in cents

  @IsOptional()
  @IsString()
  memo?: string;

  /** 'internal' = between two banking accounts, 'external' = ACH to outside bank */
  @IsOptional()
  @IsIn(['internal', 'external'])
  transferType?: 'internal' | 'external';

  /** Required for external transfers. */
  @IsOptional()
  @IsString()
  routingNumber?: string;

  /** Required for external transfers. */
  @IsOptional()
  @IsString()
  accountNumber?: string;
}
