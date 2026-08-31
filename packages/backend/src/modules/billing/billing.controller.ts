import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import type { Request } from 'express';

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(private billingService: BillingService) {}

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  @ApiOperation({ summary: 'List available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of plans with pricing' })
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('billing/plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  // -------------------------------------------------------------------------
  // Authenticated endpoints
  // -------------------------------------------------------------------------

  @ApiOperation({ summary: 'Get the current user subscription status' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get('billing/subscription')
  async getSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.getSubscription(userId);
  }

  @ApiOperation({ summary: 'Create a Stripe checkout session for subscription' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 201, description: 'Checkout session URL returned' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('billing/checkout')
  async createCheckout(@CurrentUser('id') userId: string, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSessionByPlan(userId, dto.planId, dto.interval);
  }

  @ApiOperation({ summary: 'Create a Stripe customer portal session' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 201, description: 'Portal session URL returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('billing/portal')
  async createPortal(@CurrentUser('id') userId: string) {
    return this.billingService.createPortalSession(userId);
  }

  @ApiOperation({ summary: 'Cancel the current subscription' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 201, description: 'Subscription cancellation scheduled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('billing/cancel')
  async cancelSubscription(
    @CurrentUser('id') userId: string,
    @Body() body: { atPeriodEnd?: boolean },
  ) {
    const atPeriodEnd = body.atPeriodEnd !== false; // default true
    return this.billingService.cancelSubscription(userId, atPeriodEnd);
  }

  @ApiOperation({ summary: 'Resume a previously cancelled subscription' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 201, description: 'Subscription resumed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('billing/resume')
  async resumeSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.resumeSubscription(userId);
  }

  @ApiOperation({ summary: 'Get available features for the current subscription tier' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Feature flags for the user plan' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get('billing/features')
  async getFeatures(@CurrentUser('id') userId: string) {
    return this.billingService.getUserFeatures(userId);
  }

  @ApiOperation({ summary: 'Get billing invoice history' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'List of past invoices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get('billing/invoices')
  async getInvoices(@CurrentUser('id') userId: string) {
    return this.billingService.getUserInvoices(userId);
  }

  @ApiOperation({ summary: 'Check if a specific feature is available on the current plan' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Feature access check result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('billing/check-feature')
  async checkFeature(@CurrentUser('id') userId: string, @Body() body: { feature: string }) {
    const hasAccess = await this.billingService.canAccess(userId, body.feature);
    return { feature: body.feature, hasAccess };
  }

  // -------------------------------------------------------------------------
  // Webhook (raw body required for Stripe signature verification)
  // -------------------------------------------------------------------------

  @ApiExcludeEndpoint()
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('billing/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Missing raw body for Stripe webhook verification');
    }
    return this.billingService.handleWebhook(rawBody, signature);
  }

  /**
   * Legacy webhook endpoint for backward compatibility.
   * New integrations should use POST /billing/webhook.
   */
  @ApiExcludeEndpoint()
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  async handleWebhookLegacy(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Missing raw body for Stripe webhook verification');
    }
    return this.billingService.handleWebhook(rawBody, signature);
  }
}
