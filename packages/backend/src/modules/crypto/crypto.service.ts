import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import {
  cryptoHoldings,
  cryptoTransactions,
  cryptoWatchlist,
} from './crypto.schema';
import type { AddHoldingDto } from './dto/add-holding.dto';
import type { UpdateHoldingDto } from './dto/update-holding.dto';
import type { RecordTransactionDto } from './dto/record-transaction.dto';

// CoinGecko symbol → id mapping for popular coins
const COIN_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  SHIB: 'shiba-inu',
  UNI: 'uniswap',
  LTC: 'litecoin',
  ATOM: 'cosmos',
  XLM: 'stellar',
  NEAR: 'near',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  FIL: 'filecoin',
  AAVE: 'aave',
  MKR: 'maker',
  GRT: 'the-graph',
  IMX: 'immutable-x',
  INJ: 'injective-protocol',
  FTM: 'fantom',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  ALGO: 'algorand',
  VET: 'vechain',
  HBAR: 'hedera-hashgraph',
  EOS: 'eos',
  EGLD: 'elrond-erd-2',
  THETA: 'theta-token',
  ICP: 'internet-computer',
  RUNE: 'thorchain',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  STX: 'blockstack',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  RENDER: 'render-token',
  FET: 'fetch-ai',
  TAO: 'bittensor',
  TRX: 'tron',
};

const SUPPORTED_COINS = Object.entries(COIN_ID_MAP).map(([symbol, id]) => ({
  symbol,
  id,
  name: id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}));

// Friendly name overrides
const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  MATIC: 'Polygon',
  LINK: 'Chainlink',
  SHIB: 'Shiba Inu',
  UNI: 'Uniswap',
  LTC: 'Litecoin',
  ATOM: 'Cosmos',
  XLM: 'Stellar',
  NEAR: 'NEAR Protocol',
  APT: 'Aptos',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  FIL: 'Filecoin',
  AAVE: 'Aave',
  MKR: 'Maker',
  GRT: 'The Graph',
  IMX: 'Immutable X',
  INJ: 'Injective',
  FTM: 'Fantom',
  SAND: 'The Sandbox',
  MANA: 'Decentraland',
  AXS: 'Axie Infinity',
  ALGO: 'Algorand',
  VET: 'VeChain',
  HBAR: 'Hedera',
  EOS: 'EOS',
  EGLD: 'MultiversX',
  THETA: 'Theta Network',
  ICP: 'Internet Computer',
  RUNE: 'THORChain',
  CRV: 'Curve DAO',
  LDO: 'Lido DAO',
  SUI: 'Sui',
  SEI: 'Sei',
  TIA: 'Celestia',
  STX: 'Stacks',
  PEPE: 'Pepe',
  WIF: 'dogwifhat',
  RENDER: 'Render',
  FET: 'Fetch.ai',
  TAO: 'Bittensor',
  TRX: 'TRON',
};

interface PriceCache {
  prices: Record<string, { usd: number; usd_24h_change?: number }>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private priceCache: PriceCache | null = null;

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  // ─── Holdings ───────────────────────────────────────────

  async getHoldings(userId: string) {
    const holdings = await this.db
      .select()
      .from(cryptoHoldings)
      .where(eq(cryptoHoldings.userId, userId))
      .orderBy(desc(cryptoHoldings.createdAt));

    return holdings.map((h) => ({
      ...h,
      currentValue: h.currentPrice ? h.quantity * h.currentPrice : null,
      totalCost: h.quantity * h.averageCostBasis,
      gainLoss: h.currentPrice
        ? h.quantity * h.currentPrice - h.quantity * h.averageCostBasis
        : null,
      gainLossPercent: h.currentPrice
        ? ((h.currentPrice - h.averageCostBasis) / h.averageCostBasis) * 100
        : null,
    }));
  }

  async addHolding(userId: string, dto: AddHoldingDto) {
    const symbol = dto.symbol.toUpperCase();

    const [holding] = await this.db
      .insert(cryptoHoldings)
      .values({
        userId,
        symbol,
        name: dto.name,
        quantity: dto.quantity,
        averageCostBasis: dto.averageCostBasis,
        exchange: dto.exchange || 'manual',
        walletAddress: dto.walletAddress,
        notes: dto.notes,
      })
      .returning();

    // Try to fetch current price
    try {
      const coinId = COIN_ID_MAP[symbol];
      if (coinId) {
        const prices = await this.getPrices([coinId]);
        if (prices[coinId]) {
          await this.db
            .update(cryptoHoldings)
            .set({
              currentPrice: prices[coinId].usd,
              lastPriceUpdate: new Date().toISOString(),
            })
            .where(eq(cryptoHoldings.id, holding.id));
        }
      }
    } catch {
      // Price fetch failure is non-critical
    }

    return holding;
  }

  async updateHolding(userId: string, id: string, dto: UpdateHoldingDto) {
    const [existing] = await this.db
      .select()
      .from(cryptoHoldings)
      .where(and(eq(cryptoHoldings.id, id), eq(cryptoHoldings.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Holding not found');
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.quantity !== undefined) updates.quantity = dto.quantity;
    if (dto.averageCostBasis !== undefined)
      updates.averageCostBasis = dto.averageCostBasis;
    if (dto.exchange !== undefined) updates.exchange = dto.exchange;
    if (dto.walletAddress !== undefined)
      updates.walletAddress = dto.walletAddress;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    await this.db
      .update(cryptoHoldings)
      .set(updates)
      .where(eq(cryptoHoldings.id, id));

    const [updated] = await this.db
      .select()
      .from(cryptoHoldings)
      .where(eq(cryptoHoldings.id, id));

    return updated;
  }

  async removeHolding(userId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(cryptoHoldings)
      .where(and(eq(cryptoHoldings.id, id), eq(cryptoHoldings.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Holding not found');
    }

    await this.db
      .delete(cryptoHoldings)
      .where(eq(cryptoHoldings.id, id));

    return { success: true };
  }

  // ─── Transactions ───────────────────────────────────────

  async recordTransaction(userId: string, dto: RecordTransactionDto) {
    const [holding] = await this.db
      .select()
      .from(cryptoHoldings)
      .where(
        and(
          eq(cryptoHoldings.id, dto.holdingId),
          eq(cryptoHoldings.userId, userId),
        ),
      );

    if (!holding) {
      throw new NotFoundException('Holding not found');
    }

    const totalValue = dto.quantity * dto.pricePerUnit;
    const date = dto.date || new Date().toISOString().split('T')[0];

    const [transaction] = await this.db
      .insert(cryptoTransactions)
      .values({
        userId,
        holdingId: dto.holdingId,
        type: dto.type,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        totalValue,
        fee: dto.fee || 0,
        date,
        exchange: dto.exchange || holding.exchange,
        txHash: dto.txHash,
        notes: dto.notes,
      })
      .returning();

    // Update holding quantity and cost basis based on transaction type
    if (dto.type === 'buy' || dto.type === 'staking_reward' || dto.type === 'airdrop') {
      const newTotalQty = holding.quantity + dto.quantity;
      const newTotalCost =
        holding.quantity * holding.averageCostBasis + totalValue;
      const newAvgCost = newTotalQty > 0 ? newTotalCost / newTotalQty : 0;

      await this.db
        .update(cryptoHoldings)
        .set({
          quantity: newTotalQty,
          averageCostBasis: newAvgCost,
          updatedAt: new Date(),
        })
        .where(eq(cryptoHoldings.id, dto.holdingId));
    } else if (dto.type === 'sell') {
      const newQty = Math.max(0, holding.quantity - dto.quantity);
      await this.db
        .update(cryptoHoldings)
        .set({
          quantity: newQty,
          updatedAt: new Date(),
        })
        .where(eq(cryptoHoldings.id, dto.holdingId));
    }

    return transaction;
  }

  async getTransactions(userId: string, holdingId?: string) {
    if (holdingId) {
      return this.db
        .select()
        .from(cryptoTransactions)
        .where(
          and(
            eq(cryptoTransactions.userId, userId),
            eq(cryptoTransactions.holdingId, holdingId),
          ),
        )
        .orderBy(desc(cryptoTransactions.date));
    }

    return this.db
      .select()
      .from(cryptoTransactions)
      .where(eq(cryptoTransactions.userId, userId))
      .orderBy(desc(cryptoTransactions.date));
  }

  // ─── Portfolio ──────────────────────────────────────────

  async getPortfolioSummary(userId: string) {
    const holdings = await this.getHoldings(userId);

    let totalValue = 0;
    let totalCost = 0;
    const allocation: Array<{
      symbol: string;
      name: string;
      value: number;
      percentage: number;
    }> = [];

    for (const h of holdings) {
      const value = h.currentValue ?? h.totalCost;
      totalValue += value;
      totalCost += h.totalCost;
    }

    for (const h of holdings) {
      const value = h.currentValue ?? h.totalCost;
      allocation.push({
        symbol: h.symbol,
        name: h.name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      });
    }

    // Sort allocation by value descending
    allocation.sort((a, b) => b.value - a.value);

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent =
      totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      numberOfAssets: holdings.length,
      allocation,
    };
  }

  // ─── Prices ─────────────────────────────────────────────

  async getPrices(
    coinIds: string[],
  ): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
    // Check cache first
    if (
      this.priceCache &&
      Date.now() - this.priceCache.timestamp < CACHE_TTL_MS
    ) {
      const cached: Record<string, { usd: number; usd_24h_change?: number }> =
        {};
      let allCached = true;
      for (const id of coinIds) {
        if (this.priceCache.prices[id]) {
          cached[id] = this.priceCache.prices[id];
        } else {
          allCached = false;
        }
      }
      if (allCached) return cached;
    }

    try {
      const ids = coinIds.join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`CoinGecko price fetch failed: ${res.status}`);
        return {};
      }

      const data = await res.json();

      // Update cache
      if (!this.priceCache || Date.now() - this.priceCache.timestamp >= CACHE_TTL_MS) {
        this.priceCache = { prices: {}, timestamp: Date.now() };
      }

      const result: Record<
        string,
        { usd: number; usd_24h_change?: number }
      > = {};

      for (const id of coinIds) {
        if (data[id]) {
          result[id] = {
            usd: data[id].usd,
            usd_24h_change: data[id].usd_24h_change,
          };
          this.priceCache.prices[id] = result[id];
        }
      }

      this.priceCache.timestamp = Date.now();
      return result;
    } catch (err) {
      this.logger.error('Failed to fetch prices from CoinGecko', err);
      return {};
    }
  }

  async refreshPrices(userId: string) {
    const holdings = await this.db
      .select()
      .from(cryptoHoldings)
      .where(eq(cryptoHoldings.userId, userId));

    if (holdings.length === 0) return { updated: 0 };

    // Collect unique coin IDs
    const coinIds = new Set<string>();
    for (const h of holdings) {
      const coinId = COIN_ID_MAP[h.symbol];
      if (coinId) coinIds.add(coinId);
    }

    if (coinIds.size === 0) return { updated: 0 };

    // Force fresh fetch by clearing cache
    this.priceCache = null;
    const prices = await this.getPrices([...coinIds]);

    let updated = 0;
    const now = new Date().toISOString();

    for (const h of holdings) {
      const coinId = COIN_ID_MAP[h.symbol];
      if (coinId && prices[coinId]) {
        await this.db
          .update(cryptoHoldings)
          .set({
            currentPrice: prices[coinId].usd,
            lastPriceUpdate: now,
            updatedAt: new Date(),
          })
          .where(eq(cryptoHoldings.id, h.id));
        updated++;
      }
    }

    return { updated, timestamp: now };
  }

  async getPriceHistory(
    symbol: string,
    days: number = 30,
  ): Promise<{ prices: Array<[number, number]> }> {
    const coinId =
      COIN_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase();

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
      const res = await fetch(url);

      if (!res.ok) {
        this.logger.warn(
          `CoinGecko price history fetch failed: ${res.status}`,
        );
        return { prices: [] };
      }

      const data = await res.json();
      return { prices: data.prices || [] };
    } catch (err) {
      this.logger.error('Failed to fetch price history from CoinGecko', err);
      return { prices: [] };
    }
  }

  // ─── Watchlist ──────────────────────────────────────────

  async getWatchlist(userId: string) {
    const items = await this.db
      .select()
      .from(cryptoWatchlist)
      .where(eq(cryptoWatchlist.userId, userId))
      .orderBy(desc(cryptoWatchlist.addedAt));

    // Fetch current prices for watchlist items
    const coinIds: string[] = [];
    for (const item of items) {
      const coinId = COIN_ID_MAP[item.symbol];
      if (coinId) coinIds.push(coinId);
    }

    let prices: Record<string, { usd: number; usd_24h_change?: number }> = {};
    if (coinIds.length > 0) {
      prices = await this.getPrices(coinIds);
    }

    return items.map((item) => {
      const coinId = COIN_ID_MAP[item.symbol];
      const priceData = coinId ? prices[coinId] : null;
      return {
        ...item,
        currentPrice: priceData?.usd ?? null,
        change24h: priceData?.usd_24h_change ?? null,
      };
    });
  }

  async addToWatchlist(userId: string, symbol: string, name: string) {
    const upperSymbol = symbol.toUpperCase();

    // Check if already watched
    const [existing] = await this.db
      .select()
      .from(cryptoWatchlist)
      .where(
        and(
          eq(cryptoWatchlist.userId, userId),
          eq(cryptoWatchlist.symbol, upperSymbol),
        ),
      );

    if (existing) {
      return existing;
    }

    const [item] = await this.db
      .insert(cryptoWatchlist)
      .values({
        userId,
        symbol: upperSymbol,
        name,
      })
      .returning();

    return item;
  }

  async removeFromWatchlist(userId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(cryptoWatchlist)
      .where(
        and(
          eq(cryptoWatchlist.id, id),
          eq(cryptoWatchlist.userId, userId),
        ),
      );

    if (!existing) {
      throw new NotFoundException('Watchlist item not found');
    }

    await this.db
      .delete(cryptoWatchlist)
      .where(eq(cryptoWatchlist.id, id));

    return { success: true };
  }

  // ─── Supported Coins ───────────────────────────────────

  getSupportedCoins() {
    return SUPPORTED_COINS.map((c) => ({
      ...c,
      name: COIN_NAMES[c.symbol] || c.name,
    }));
  }
}
