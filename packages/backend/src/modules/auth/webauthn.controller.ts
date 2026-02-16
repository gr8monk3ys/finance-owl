import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '../../common/decorators';
import {
  WebAuthnRegistrationDto,
  WebAuthnAuthenticationDto,
} from './dto/webauthn.dto';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(
    private webAuthnService: WebAuthnService,
    private authService: AuthService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('register/options')
  async registrationOptions(
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.webAuthnService.generateRegistrationOptions(
      user.id,
      user.email,
    );
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verifyRegistration(
    @CurrentUser('id') userId: string,
    @Body() body: WebAuthnRegistrationDto,
  ) {
    return this.webAuthnService.verifyRegistration(userId, body);
  }

  // Rate limit: 5 attempts per minute (authentication endpoint)
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('login/options')
  async authenticationOptions() {
    return this.webAuthnService.generateAuthenticationOptions();
  }

  // Rate limit: 5 attempts per minute (authentication endpoint)
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  async verifyAuthentication(@Body() body: WebAuthnAuthenticationDto) {
    const result = await this.webAuthnService.verifyAuthentication(body);
    return this.authService.createTokensForUser(result.userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get('credentials')
  async listCredentials(@CurrentUser('id') userId: string) {
    return this.webAuthnService.getCredentials(userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Delete('credentials/:id')
  async removeCredential(
    @CurrentUser('id') userId: string,
    @Param('id') credentialId: string,
  ) {
    await this.webAuthnService.removeCredential(userId, credentialId);
    return { message: 'Credential removed' };
  }
}
