import { Module } from '@nestjs/common';
import { UnclaimedService } from './unclaimed.service';
import { UnclaimedController } from './unclaimed.controller';

@Module({
  providers: [UnclaimedService],
  controllers: [UnclaimedController],
  exports: [UnclaimedService],
})
export class UnclaimedModule {}
