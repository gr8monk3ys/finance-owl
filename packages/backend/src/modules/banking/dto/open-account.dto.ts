import { IsString, IsIn, IsOptional, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  postalCode!: string;

  @IsString()
  country!: string;
}

export class OpenAccountDto {
  @IsIn(['checking', 'savings'])
  type!: 'checking' | 'savings';

  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  dateOfBirth!: string;

  @IsString()
  ssn!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['unit', 'treasury_prime'])
  provider?: 'unit' | 'treasury_prime';
}
