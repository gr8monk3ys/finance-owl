import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Headers,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiExcludeEndpoint,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { CurrentUser, Public } from '../../common/decorators';
import { PlaidService, type PlaidLinkMetadata } from './plaid.service';
import type { Request } from 'express';

class ExchangeTokenDto {
  @ApiProperty({
    description: 'Public token received from Plaid Link on the client',
    example: 'public-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  })
  @IsString()
  publicToken!: string;

  @ApiPropertyOptional({
    description: 'Metadata from Plaid Link (institution info, accounts selected, etc.)',
  })
  @IsOptional()
  @IsObject()
  metadata?: PlaidLinkMetadata;
}

@ApiTags('Plaid')
@ApiBearerAuth('bearer')
@Controller('plaid')
export class PlaidController {
  constructor(private plaidService: PlaidService) {}

  @ApiOperation({ summary: 'Create a Plaid Link token for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Link token returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('link-token')
  async createLinkToken(@CurrentUser('id') userId: string) {
    return this.plaidService.createLinkToken(userId);
  }

  @ApiOperation({
    summary: 'Exchange a Plaid public token for a persistent access token',
    description:
      'Stores the encrypted access token, creates the Plaid item, and links accounts.',
  })
  @ApiResponse({ status: 200, description: 'Token exchanged, accounts linked' })
  @ApiResponse({ status: 400, description: 'Invalid public token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('exchange-token')
  @HttpCode(HttpStatus.OK)
  async exchangeToken(
    @CurrentUser('id') userId: string,
    @Body() dto: ExchangeTokenDto,
  ) {
    return this.plaidService.exchangePublicToken(
      userId,
      dto.publicToken,
      dto.metadata,
    );
  }

  @ApiExcludeEndpoint()
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() _body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    // Use raw body for signature verification; fall back to stringified body
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(_body);
    return this.plaidService.handleWebhook(rawBody, headers);
  }

  @ApiOperation({ summary: 'Trigger a manual transaction sync for a Plaid item' })
  @ApiParam({ name: 'itemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 200, description: 'Sync statistics returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plaid item not found' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('sync/:itemId')
  @HttpCode(HttpStatus.OK)
  async syncTransactions(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
  ) {
    const stats = await this.plaidService.syncTransactions(itemId, userId);
    return {
      synced: true,
      ...stats,
    };
  }

  @ApiOperation({ summary: 'Disconnect a Plaid item and remove associated accounts' })
  @ApiParam({ name: 'itemId', description: 'Plaid item ID' })
  @ApiResponse({ status: 204, description: 'Plaid item disconnected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plaid item not found' })
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.plaidService.removeItem(userId, itemId);
  }

  @ApiOperation({ summary: 'List all connected Plaid items (institutions)' })
  @ApiResponse({ status: 200, description: 'List of connected Plaid items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('items')
  async listItems(@CurrentUser('id') userId: string) {
    return this.plaidService.getItems(userId);
  }
}
