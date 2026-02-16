import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { PrivacyService } from './privacy.service';
import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';
import type { Request } from 'express';

class UpdateConsentDto {
  @IsString()
  @IsIn(['data_processing', 'marketing', 'analytics', 'third_party'])
  consentType!: string;

  @IsBoolean()
  isGranted!: boolean;
}

class RequestExportDto {
  @IsOptional()
  @IsString()
  @IsIn(['json', 'csv'])
  format?: string;
}

class RequestDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('privacy')
export class PrivacyController {
  constructor(private privacyService: PrivacyService) {}

  @Get('consents')
  getConsents(@CurrentUser('id') userId: string) {
    return this.privacyService.getConsents(userId);
  }

  @Patch('consents')
  updateConsent(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.privacyService.updateConsent(
      userId,
      dto.consentType,
      dto.isGranted,
      ipAddress,
    );
  }

  @Post('export')
  requestExport(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestExportDto,
  ) {
    return this.privacyService.requestDataExport(userId, dto.format);
  }

  @Get('export/:id')
  getExportStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.privacyService.getExportStatus(userId, id);
  }

  @Post('deletion')
  requestDeletion(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestDeletionDto,
  ) {
    return this.privacyService.requestDeletion(userId, dto.reason);
  }

  @Post('deletion/:id/confirm')
  confirmDeletion(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.privacyService.confirmDeletion(userId, id);
  }

  @Get('deletion/:id')
  getDeletionStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.privacyService.getDeletionStatus(userId, id);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.privacyService.getPrivacyDashboard(userId);
  }
}
