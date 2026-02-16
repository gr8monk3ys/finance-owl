import { IsNumber, IsOptional, Min } from 'class-validator';

export class NetWorthDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashAndSavings?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  investments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  propertyValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vehicleValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherAssets?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mortgageBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoLoans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  studentLoans?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditCardDebt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherLiabilities?: number;
}
