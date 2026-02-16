import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CryptoService } from './crypto.service';
import { AddHoldingDto } from './dto/add-holding.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { RecordTransactionDto } from './dto/record-transaction.dto';
import { AddWatchlistDto } from './dto/add-watchlist.dto';

@Controller('crypto')
export class CryptoController {
  constructor(private cryptoService: CryptoService) {}

  // ─── Holdings ───────────────────────────────────────────

  @Get('holdings')
  getHoldings(@CurrentUser('id') userId: string) {
    return this.cryptoService.getHoldings(userId);
  }

  @Post('holdings')
  addHolding(
    @CurrentUser('id') userId: string,
    @Body() dto: AddHoldingDto,
  ) {
    return this.cryptoService.addHolding(userId, dto);
  }

  @Patch('holdings/:id')
  updateHolding(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHoldingDto,
  ) {
    return this.cryptoService.updateHolding(userId, id, dto);
  }

  @Delete('holdings/:id')
  removeHolding(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cryptoService.removeHolding(userId, id);
  }

  // ─── Portfolio ──────────────────────────────────────────

  @Get('portfolio')
  getPortfolioSummary(@CurrentUser('id') userId: string) {
    return this.cryptoService.getPortfolioSummary(userId);
  }

  @Post('holdings/refresh-prices')
  refreshPrices(@CurrentUser('id') userId: string) {
    return this.cryptoService.refreshPrices(userId);
  }

  // ─── Transactions ──────────────────────────────────────

  @Get('transactions')
  getTransactions(
    @CurrentUser('id') userId: string,
    @Query('holdingId') holdingId?: string,
  ) {
    return this.cryptoService.getTransactions(userId, holdingId);
  }

  @Post('transactions')
  recordTransaction(
    @CurrentUser('id') userId: string,
    @Body() dto: RecordTransactionDto,
  ) {
    return this.cryptoService.recordTransaction(userId, dto);
  }

  // ─── Prices ─────────────────────────────────────────────

  @Get('prices')
  async getPrices(@Query('symbols') symbols: string) {
    const symbolList = symbols
      ? symbols.split(',').map((s) => s.trim())
      : [];
    return this.cryptoService.getPrices(symbolList);
  }

  @Get('price-history/:symbol')
  getPriceHistory(
    @Param('symbol') symbol: string,
    @Query('days') days?: string,
  ) {
    return this.cryptoService.getPriceHistory(
      symbol,
      days ? parseInt(days, 10) : 30,
    );
  }

  // ─── Watchlist ──────────────────────────────────────────

  @Get('watchlist')
  getWatchlist(@CurrentUser('id') userId: string) {
    return this.cryptoService.getWatchlist(userId);
  }

  @Post('watchlist')
  addToWatchlist(
    @CurrentUser('id') userId: string,
    @Body() dto: AddWatchlistDto,
  ) {
    return this.cryptoService.addToWatchlist(userId, dto.symbol, dto.name);
  }

  @Delete('watchlist/:id')
  removeFromWatchlist(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cryptoService.removeFromWatchlist(userId, id);
  }

  // ─── Supported Coins ───────────────────────────────────

  @Get('coins')
  getSupportedCoins() {
    return this.cryptoService.getSupportedCoins();
  }
}
