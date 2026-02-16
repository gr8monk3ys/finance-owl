import { Module } from '@nestjs/common';
import { AdvisorSharingService } from './advisor-sharing.service';
import { AdvisorSharingController } from './advisor-sharing.controller';

@Module({
  providers: [AdvisorSharingService],
  controllers: [AdvisorSharingController],
  exports: [AdvisorSharingService],
})
export class AdvisorSharingModule {}
