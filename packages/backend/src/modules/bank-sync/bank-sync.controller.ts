import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BankSyncService } from './bank-sync.service';
import { PlaidSyncService } from './plaid-sync.service';
import { PlaidSandboxService } from './plaid-sandbox.service';
import { TransactionSyncScheduler } from '../jobs/transaction-sync.scheduler';
import { CurrentUser } from '../../common/decorators';
import { IsString, IsOptional } from 'class-validator';

class ExchangeTokenDto {
  @ApiProperty({
    description: 'Public token from Plaid Link',
    example: 'public-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  })
  @IsString()
  publicToken!: string;

  @ApiPropertyOptional({ description: 'Bank provider identifier', example: 'plaid' })
  @IsOptional()
  @IsString()
  provider?: string;
}

// Rate limit bank-sync endpoints: 10 per minute (sensitive financial operations)
@ApiTags('Bank Sync')
@ApiBearerAuth('bearer')
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('bank-sync')
export class BankSyncController {
  constructor(
    private bankSyncService: BankSyncService,
    private plaidSyncService: PlaidSyncService,
    private plaidSandboxService: PlaidSandboxService,
    private transactionSyncScheduler: TransactionSyncScheduler,
  ) {}

  @ApiOperation({ summary: 'Create a link token for Plaid Link' })
  @ApiQuery({ name: 'provider', required: false, description: 'Bank provider' })
  @ApiResponse({ status: 201, description: 'Link token created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('link-token')
  async createLinkToken(@CurrentUser('id') userId: string, @Query('provider') provider?: string) {
    return this.bankSyncService.createLinkToken(userId, provider);
  }

  @ApiOperation({ summary: 'Create an update link token for re-authentication' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID to update' })
  @ApiResponse({ status: 201, description: 'Update link token created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('link-token/update/:plaidItemId')
  async createUpdateLinkToken(
    @CurrentUser('id') userId: string,
    @Param('plaidItemId') plaidItemId: string,
  ) {
    return this.bankSyncService.createUpdateLinkToken(userId, plaidItemId);
  }

  @ApiOperation({ summary: 'Exchange a public token for an access token and store it' })
  @ApiResponse({ status: 200, description: 'Token exchanged and accounts linked' })
  @ApiResponse({ status: 400, description: 'Invalid public token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  // Rate limit: 5 token exchanges per minute
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeToken(@CurrentUser('id') userId: string, @Body() dto: ExchangeTokenDto) {
    return this.bankSyncService.exchangeAndStore(userId, dto.publicToken, dto.provider);
  }

  @ApiOperation({ summary: 'Refresh account balances for a Plaid item' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 200, description: 'Balances refreshed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('refresh/:plaidItemId')
  @HttpCode(HttpStatus.OK)
  async refreshBalances(
    @CurrentUser('id') userId: string,
    @Param('plaidItemId') plaidItemId: string,
  ) {
    const count = await this.bankSyncService.refreshBalances(userId, plaidItemId);
    return { refreshed: count };
  }

  // ---------------------------------------------------------------------------
  // Transaction sync
  // ---------------------------------------------------------------------------

  @ApiOperation({ summary: 'Trigger a manual transaction sync for a Plaid item' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 200, description: 'Sync statistics returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('sync/:plaidItemId')
  @HttpCode(HttpStatus.OK)
  async syncTransactions(
    @CurrentUser('id') userId: string,
    @Param('plaidItemId') plaidItemId: string,
  ) {
    const stats = await this.plaidSyncService.syncTransactionsForItem(plaidItemId, userId);
    return {
      synced: true,
      added: stats.added,
      modified: stats.modified,
      removed: stats.removed,
    };
  }

  @ApiOperation({ summary: 'Queue a background transaction sync (async via BullMQ)' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 202, description: 'Sync job queued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('sync/:plaidItemId/queue')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueSync(@CurrentUser('id') userId: string, @Param('plaidItemId') plaidItemId: string) {
    await this.transactionSyncScheduler.queueSyncForItem(plaidItemId, userId, 'manual');
    return { queued: true };
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  @ApiOperation({ summary: 'List all connected Plaid items for the user' })
  @ApiResponse({ status: 200, description: 'List of connected bank items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('items')
  async getItems(@CurrentUser('id') userId: string) {
    return this.bankSyncService.getPlaidItems(userId);
  }

  @ApiOperation({ summary: 'List available bank providers' })
  @ApiResponse({ status: 200, description: 'Available providers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('providers')
  getProviders(@CurrentUser('id') _userId: string) {
    return this.bankSyncService.getAvailableProviders();
  }

  @ApiOperation({ summary: 'Disconnect a Plaid item and remove linked accounts' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID to unlink' })
  @ApiResponse({ status: 200, description: 'Item unlinked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @Delete('items/:plaidItemId')
  async unlinkItem(@CurrentUser('id') userId: string, @Param('plaidItemId') plaidItemId: string) {
    await this.bankSyncService.unlinkItem(userId, plaidItemId);
    return { message: 'Item unlinked' };
  }

  // ---------------------------------------------------------------------------
  // Sandbox test helpers (only available when PLAID_ENV=sandbox)
  // ---------------------------------------------------------------------------

  @ApiOperation({ summary: '[Sandbox] Create a test public token' })
  @ApiResponse({ status: 200, description: 'Sandbox public token created' })
  @Get('sandbox/create-test-link')
  async createSandboxTestLink(@CurrentUser('id') _userId: string) {
    return this.plaidSandboxService.createSandboxPublicToken();
  }

  @ApiOperation({ summary: '[Sandbox] Fire a test webhook' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 200, description: 'Webhook fired' })
  @Post('sandbox/fire-webhook/:plaidItemId')
  @HttpCode(HttpStatus.OK)
  async fireSandboxWebhook(
    @CurrentUser('id') userId: string,
    @Param('plaidItemId') plaidItemId: string,
  ) {
    const item = await this.bankSyncService.getPlaidItemRaw(userId, plaidItemId);
    const accessToken = this.bankSyncService.getDecryptedAccessToken(item.accessToken);
    return this.plaidSandboxService.fireSandboxWebhook(accessToken);
  }

  @ApiOperation({ summary: '[Sandbox] Reset item login to test re-authentication' })
  @ApiParam({ name: 'plaidItemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 200, description: 'Login reset' })
  @Post('sandbox/reset-login/:plaidItemId')
  @HttpCode(HttpStatus.OK)
  async resetSandboxLogin(
    @CurrentUser('id') userId: string,
    @Param('plaidItemId') plaidItemId: string,
  ) {
    const item = await this.bankSyncService.getPlaidItemRaw(userId, plaidItemId);
    const accessToken = this.bankSyncService.getDecryptedAccessToken(item.accessToken);
    return this.plaidSandboxService.resetSandboxLogin(accessToken);
  }
}
