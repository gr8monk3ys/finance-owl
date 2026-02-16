import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ReferralsService } from './referrals.service';
import { IsString, IsNotEmpty } from 'class-validator';

class ApplyReferralCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

@Controller('referrals')
export class ReferralsController {
  constructor(private referralsService: ReferralsService) {}

  @Get('code')
  getOrCreateCode(@CurrentUser('id') userId: string) {
    return this.referralsService.getOrCreateCode(userId);
  }

  @Get('stats')
  getReferralStats(@CurrentUser('id') userId: string) {
    return this.referralsService.getReferralStats(userId);
  }

  @Get('referrals')
  getReferrals(@CurrentUser('id') userId: string) {
    return this.referralsService.getReferrals(userId);
  }

  @Post('apply')
  applyReferralCode(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyReferralCodeDto,
  ) {
    return this.referralsService.applyReferralCode(userId, dto.code);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.referralsService.getLeaderboard();
  }
}
