import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { IdentityService } from './identity.service';
import { CheckEmailDto, CheckPasswordDto } from './dto';

@Controller('identity')
export class IdentityController {
  constructor(private identityService: IdentityService) {}

  @Post('check-email')
  checkEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckEmailDto,
  ) {
    return this.identityService.checkEmail(userId, dto.email);
  }

  @Post('check-password')
  checkPassword(@Body() dto: CheckPasswordDto) {
    return this.identityService.checkPassword(dto.sha1Hash);
  }

  @Get('breaches')
  getBreaches(@CurrentUser('id') userId: string) {
    return this.identityService.getBreaches(userId);
  }

  @Get('summary')
  getBreachSummary(@CurrentUser('id') userId: string) {
    return this.identityService.getBreachSummary(userId);
  }

  @Patch('breaches/:id/acknowledge')
  acknowledgeBreach(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.identityService.acknowledgeBreach(userId, id);
  }

  @Get('monitored-emails')
  getMonitoredEmails(@CurrentUser('id') userId: string) {
    return this.identityService.getMonitoredEmails(userId);
  }

  @Post('monitored-emails')
  addMonitoredEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckEmailDto,
  ) {
    return this.identityService.addMonitoredEmail(userId, dto.email);
  }

  @Delete('monitored-emails/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMonitoredEmail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.identityService.removeMonitoredEmail(userId, id);
  }

  @Post('run-check')
  runPeriodicCheck(@CurrentUser('id') userId: string) {
    return this.identityService.runPeriodicCheck(userId);
  }
}
