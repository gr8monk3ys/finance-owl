import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TotpService } from './totp.service';
import { CurrentUser } from '../../common/decorators';
import { IsString, Length, Matches } from 'class-validator';

class EnableTotpDto {
  @IsString()
  secret!: string;

  @IsString()
  @Length(6, 8)
  @Matches(/^\d+$/, { message: 'TOTP code must be numeric' })
  code!: string;
}

class VerifyTotpDto {
  @IsString()
  @Length(6, 8)
  @Matches(/^\d+$/, { message: 'TOTP code must be numeric' })
  code!: string;
}

// Rate limit: 5 attempts per minute on TOTP endpoints (brute-force protection)
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Controller('auth/totp')
export class TotpController {
  constructor(private totpService: TotpService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setup(@CurrentUser('id') userId: string) {
    return this.totpService.generateSecret(userId);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @CurrentUser('id') userId: string,
    @Body() dto: EnableTotpDto,
  ) {
    return this.totpService.enableTotp(userId, dto.secret, dto.code);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTotpDto,
  ) {
    return this.totpService.disableTotp(userId, dto.code);
  }
}
