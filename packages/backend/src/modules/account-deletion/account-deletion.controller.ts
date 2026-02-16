import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { AccountDeletionService } from './account-deletion.service';
import { IsOptional, IsString } from 'class-validator';

class RequestDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('account')
export class AccountDeletionController {
  constructor(private accountDeletionService: AccountDeletionService) {}

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  requestDeletion(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestDeletionDto,
  ) {
    return this.accountDeletionService.requestDeletion(userId, dto.reason);
  }

  @Post('delete/cancel')
  @HttpCode(HttpStatus.OK)
  cancelDeletion(@CurrentUser('id') userId: string) {
    return this.accountDeletionService.cancelDeletion(userId);
  }

  @Get('delete/status')
  getDeletionStatus(@CurrentUser('id') userId: string) {
    return this.accountDeletionService.getDeletionStatus(userId);
  }
}
