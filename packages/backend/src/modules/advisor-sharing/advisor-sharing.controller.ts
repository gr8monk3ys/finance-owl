import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser, Public } from '../../common/decorators';
import { AdvisorSharingService } from './advisor-sharing.service';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  advisorEmail!: string;

  @IsString()
  @IsNotEmpty()
  advisorName!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

@Controller('advisor-sharing')
export class AdvisorSharingController {
  constructor(private advisorSharingService: AdvisorSharingService) {}

  @Get('shares')
  getShares(@CurrentUser('id') userId: string) {
    return this.advisorSharingService.getShares(userId);
  }

  @Post('shares')
  createShare(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.advisorSharingService.createShare(userId, dto);
  }

  @Delete('shares/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.advisorSharingService.revokeShare(userId, id);
  }

  @Get('shares/:id/logs')
  getAccessLogs(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.advisorSharingService.getAccessLogs(userId, id);
  }

  @Public()
  @Get('portal/:token')
  async getPortal(@Param('token') token: string, @Req() req: any) {
    const share = await this.advisorSharingService.getShareByToken(token);
    const ip = req.headers['x-forwarded-for'] || req.ip;
    await this.advisorSharingService.logAccess(share.id, 'portal_view', ip);
    return share;
  }
}
