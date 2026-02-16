import { Module } from '@nestjs/common';
import { FlaggingService } from './flagging.service';
import { FlaggingController } from './flagging.controller';

@Module({
  providers: [FlaggingService],
  controllers: [FlaggingController],
  exports: [FlaggingService],
})
export class FlaggingModule {}
