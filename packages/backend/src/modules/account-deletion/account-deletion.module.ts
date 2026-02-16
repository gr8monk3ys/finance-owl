import { Module } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [AccountDeletionService],
  controllers: [AccountDeletionController],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
