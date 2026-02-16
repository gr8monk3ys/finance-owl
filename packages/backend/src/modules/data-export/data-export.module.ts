import { Module } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [DataExportService],
  controllers: [DataExportController],
  exports: [DataExportService],
})
export class DataExportModule {}
