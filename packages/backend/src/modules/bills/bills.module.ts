import { Module } from '@nestjs/common';
import { BillsCalendarService } from './bills-calendar.service';
import { BillsCalendarController } from './bills-calendar.controller';

@Module({
  providers: [BillsCalendarService],
  controllers: [BillsCalendarController],
  exports: [BillsCalendarService],
})
export class BillsModule {}
