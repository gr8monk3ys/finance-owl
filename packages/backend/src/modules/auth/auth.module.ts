import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnController } from './webauthn.controller';
import { TotpService } from './totp.service';
import { TotpController } from './totp.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards';
import { UsersModule } from '../users/users.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [
    UsersModule,
    CacheModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRY', '15m') as StringValue,
        },
        verifyOptions: {
          algorithms: ['HS256' as const], // Prevent algorithm confusion attacks
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    WebAuthnService,
    TotpService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  controllers: [AuthController, WebAuthnController, TotpController],
  exports: [AuthService],
})
export class AuthModule {}
