import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  Length,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User display name',
    minLength: 1,
    maxLength: 100,
    example: 'Jane Doe',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiProperty({
    description: 'User email address',
    maxLength: 255,
    example: 'jane@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({
    description: 'Password (min 8 chars, must include uppercase, lowercase, and a digit)',
    minLength: 8,
    maxLength: 128,
    example: 'SecurePass1',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  password!: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    maxLength: 255,
    example: 'jane@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({
    description: 'User password',
    maxLength: 128,
    example: 'SecurePass1',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    description: 'TOTP code for two-factor authentication (6-8 digits)',
    minLength: 6,
    maxLength: 8,
    example: '123456',
  })
  @IsString()
  @IsOptional()
  @Length(6, 8)
  @Matches(/^\d+$/, { message: 'TOTP code must be numeric' })
  totpCode?: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token (64-character hex string)',
    minLength: 64,
    maxLength: 64,
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'refreshToken must be a 64-character lowercase hex string',
  })
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (min 8 chars, must include uppercase, lowercase, and a digit)',
    minLength: 8,
    maxLength: 128,
    example: 'NewSecurePass1',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  newPassword!: string;
}
