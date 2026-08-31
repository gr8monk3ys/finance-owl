import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CancellationService } from './cancellation.service';
import { CancellationProvidersService, type ProviderEntry } from './cancellation-providers.service';
import { IsString, IsOptional } from 'class-validator';

class InitiateCancellationDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  method?: string;
}

@Controller('subscriptions/cancellation')
export class CancellationEnhancedController {
  constructor(
    private cancellationService: CancellationService,
    private providersService: CancellationProvidersService,
  ) {}

  /**
   * POST /subscriptions/cancellation/initiate/:subscriptionId
   * Start the cancellation process for a subscription.
   */
  @Post('initiate/:subscriptionId')
  initiate(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: InitiateCancellationDto,
  ) {
    return this.cancellationService.requestCancellation(userId, subscriptionId, dto.reason);
  }

  /**
   * GET /subscriptions/cancellation/status/:cancellationId
   * Check the status of a cancellation request.
   */
  @Get('status/:cancellationId')
  getStatus(@CurrentUser('id') userId: string, @Param('cancellationId') cancellationId: string) {
    return this.cancellationService.getCancellationRequest(userId, cancellationId);
  }

  /**
   * GET /subscriptions/cancellation/history
   * Get all past cancellation requests for the user.
   */
  @Get('history')
  getHistory(@CurrentUser('id') userId: string) {
    return this.cancellationService.getCancellationRequests(userId);
  }

  /**
   * GET /subscriptions/cancellation/savings
   * Get detailed savings breakdown from all completed cancellations.
   */
  @Get('savings')
  getSavings(@CurrentUser('id') userId: string) {
    return this.providersService.trackSavings(userId);
  }

  /**
   * GET /subscriptions/cancellation/provider/:name
   * Get cancellation info for a specific provider.
   * Also returns generated email template and phone script.
   */
  @Get('provider/:name')
  getProvider(@Param('name') name: string): {
    provider: ProviderEntry | null;
    emailTemplate: string;
    phoneScript: string;
  } {
    const provider = this.providersService.getProviderInfo(name);
    const displayName = provider?.name ?? name;

    return {
      provider,
      emailTemplate: this.providersService.generateCancellationEmail(displayName, null),
      phoneScript: this.providersService.generateCancellationScript(displayName, name),
    };
  }

  /**
   * GET /subscriptions/cancellation/providers
   * List all known providers with cancellation info.
   * Supports optional ?search= query parameter.
   */
  @Get('providers')
  getProviders(@Query('search') search?: string): ProviderEntry[] {
    if (search) {
      return this.providersService.searchProviders(search);
    }
    return this.providersService.getAllProviders();
  }

  /**
   * GET /subscriptions/cancellation/email-template/:name
   * Get a pre-written cancellation email for a provider.
   */
  @Get('email-template/:name')
  getEmailTemplate(@Param('name') name: string): { template: string } {
    return {
      template: this.providersService.generateCancellationEmail(name, null),
    };
  }

  /**
   * GET /subscriptions/cancellation/phone-script/:name
   * Get a phone cancellation script for a provider.
   */
  @Get('phone-script/:name')
  getPhoneScript(@Param('name') name: string): { script: string } {
    return {
      script: this.providersService.generateCancellationScript(name, name),
    };
  }
}
