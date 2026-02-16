import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { HibpProvider } from './hibp.provider';

@Module({
  providers: [IdentityService, HibpProvider],
  controllers: [IdentityController],
  exports: [IdentityService],
})
export class IdentityModule {}
