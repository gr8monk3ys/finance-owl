import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { BankSyncService } from './bank-sync.service';
import { PlaidProvider } from './plaid.provider';
import { TransactionSyncScheduler } from '../jobs/transaction-sync.scheduler';
import type { Request } from 'express';

interface PlaidWebhookBody {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private bankSyncService: BankSyncService,
    private plaidProvider: PlaidProvider,
    private transactionSyncScheduler: TransactionSyncScheduler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('plaid')
  @HttpCode(HttpStatus.OK)
  async handlePlaidWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: PlaidWebhookBody,
    @Headers() headers: Record<string, string>,
  ) {
    // Verify the webhook signature using Plaid's JWT verification
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(body);
    const isValid = await this.plaidProvider.verifyWebhook(rawBody, headers);
    if (!isValid) {
      this.logger.warn(`Plaid webhook verification failed for item ${body.item_id}`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    this.logger.log(
      `Plaid webhook: ${body.webhook_type}/${body.webhook_code} for item ${body.item_id}`,
    );

    switch (body.webhook_type) {
      case 'TRANSACTIONS':
        await this.handleTransactionWebhook(body);
        break;

      case 'ITEM':
        await this.handleItemWebhook(body);
        break;

      default:
        this.logger.log(`Unhandled webhook type: ${body.webhook_type}/${body.webhook_code}`);
    }

    return { received: true };
  }

  private async handleTransactionWebhook(body: PlaidWebhookBody) {
    switch (body.webhook_code) {
      case 'SYNC_UPDATES_AVAILABLE':
        this.logger.log(`Transaction sync updates available for item ${body.item_id}`);
        await this.transactionSyncScheduler.queueSyncForPlaidItemId(body.item_id, 'webhook');
        break;

      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
        this.logger.log(`Transaction ${body.webhook_code} for item ${body.item_id}`);
        await this.transactionSyncScheduler.queueSyncForPlaidItemId(body.item_id, 'webhook');
        break;

      default:
        this.logger.log(`Unhandled transaction webhook: ${body.webhook_code}`);
    }
  }

  private async handleItemWebhook(body: PlaidWebhookBody) {
    switch (body.webhook_code) {
      case 'ERROR':
        this.logger.warn(
          `Plaid item error for ${body.item_id}: ${body.error?.error_code} - ${body.error?.error_message}`,
        );
        await this.bankSyncService.updateItemStatus(body.item_id, 'error', body.error?.error_code);
        break;

      case 'LOGIN_REPAIRED':
        this.logger.log(`Login repaired for item ${body.item_id}`);
        await this.bankSyncService.updateItemStatus(body.item_id, 'active');
        break;

      case 'PENDING_EXPIRATION':
        this.logger.warn(
          `Consent expiring for item ${body.item_id} at ${body.consent_expiration_time}`,
        );
        await this.bankSyncService.updateItemStatus(body.item_id, 'pending_expiration');
        break;

      case 'USER_PERMISSION_REVOKED':
        this.logger.warn(`User revoked permission for item ${body.item_id}`);
        await this.bankSyncService.updateItemStatus(body.item_id, 'revoked');
        break;

      default:
        this.logger.log(`Unhandled item webhook: ${body.webhook_code}`);
    }
  }
}
