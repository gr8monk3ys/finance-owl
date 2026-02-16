import {
  IsString,
  IsObject,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class AuthenticatorResponseDto {
  @IsString()
  @IsNotEmpty()
  clientDataJSON!: string;

  @IsString()
  @IsOptional()
  attestationObject?: string;

  @IsString()
  @IsOptional()
  authenticatorData?: string;

  @IsString()
  @IsOptional()
  signature?: string;

  @IsString()
  @IsOptional()
  userHandle?: string;

  @IsArray()
  @IsOptional()
  transports?: string[];
}

export class WebAuthnRegistrationDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  rawId!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AuthenticatorResponseDto)
  response!: AuthenticatorResponseDto;

  @IsString()
  @IsOptional()
  authenticatorAttachment?: string;

  @IsObject()
  @IsOptional()
  clientExtensionResults?: Record<string, unknown>;
}

export class WebAuthnAuthenticationDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  rawId!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AuthenticatorResponseDto)
  response!: AuthenticatorResponseDto;

  @IsString()
  @IsOptional()
  authenticatorAttachment?: string;

  @IsObject()
  @IsOptional()
  clientExtensionResults?: Record<string, unknown>;
}
