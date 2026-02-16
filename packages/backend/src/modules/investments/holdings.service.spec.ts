import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HoldingsService } from './holdings.service';

function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('HoldingsService', () => {
  let service: HoldingsService;
  let mockDb: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new HoldingsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // getHoldings
  // ---------------------------------------------------------------------------
  describe('getHoldings', () => {
    it('should return enriched holdings grouped by account', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: 'Fidelity',
          securityId: 'sec-1',
          tickerSymbol: 'AAPL',
          securityName: 'Apple Inc.',
          securityType: 'equity',
          quantity: 10,
          costBasis: 1500,
          institutionValue: null,
          closePrice: 175,
        },
        {
          holdingId: 'h-2',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: 'Fidelity',
          securityId: 'sec-2',
          tickerSymbol: 'GOOG',
          securityName: 'Alphabet Inc.',
          securityType: 'equity',
          quantity: 5,
          costBasis: 600,
          institutionValue: null,
          closePrice: 140,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);

      expect(result).toHaveLength(1); // One account
      const account = result[0];
      expect(account.accountId).toBe('acct-1');
      expect(account.holdings).toHaveLength(2);

      // AAPL: 10 * 175 = 1750 value, cost 1500, gain 250
      const appleHolding = account.holdings.find(
        (h) => h.tickerSymbol === 'AAPL',
      );
      expect(appleHolding!.currentValue).toBe(1750);
      expect(appleHolding!.costBasis).toBe(1500);
      expect(appleHolding!.gainLoss).toBe(250);
      expect(appleHolding!.gainLossPercent).toBeCloseTo(16.67, 1);

      // GOOG: 5 * 140 = 700 value, cost 600, gain 100
      const googHolding = account.holdings.find(
        (h) => h.tickerSymbol === 'GOOG',
      );
      expect(googHolding!.currentValue).toBe(700);
      expect(googHolding!.gainLoss).toBe(100);
    });

    it('should group holdings across multiple accounts', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: 'Fidelity',
          securityId: 'sec-1',
          tickerSymbol: 'AAPL',
          securityName: 'Apple Inc.',
          securityType: 'equity',
          quantity: 10,
          costBasis: 1500,
          institutionValue: null,
          closePrice: 175,
        },
        {
          holdingId: 'h-2',
          accountId: 'acct-2',
          accountName: '401(k)',
          institutionName: 'Vanguard',
          securityId: 'sec-3',
          tickerSymbol: 'VTI',
          securityName: 'Vanguard Total Stock Market ETF',
          securityType: 'etf',
          quantity: 20,
          costBasis: 4000,
          institutionValue: null,
          closePrice: 220,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].accountId).toBe('acct-1');
      expect(result[1].accountId).toBe('acct-2');
    });

    it('should use institutionValue when available instead of computed value', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: 'Fidelity',
          securityId: 'sec-1',
          tickerSymbol: 'AAPL',
          securityName: 'Apple Inc.',
          securityType: 'equity',
          quantity: 10,
          costBasis: 1500,
          institutionValue: 1800, // Institution-reported value
          closePrice: 175, // closePrice would give 1750
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);
      const holding = result[0].holdings[0];

      expect(holding.currentValue).toBe(1800); // Uses institutionValue
      expect(holding.gainLoss).toBe(300); // 1800 - 1500
    });

    it('should handle null costBasis as zero', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: null,
          securityId: 'sec-1',
          tickerSymbol: 'AAPL',
          securityName: 'Apple Inc.',
          securityType: 'equity',
          quantity: 10,
          costBasis: null,
          institutionValue: null,
          closePrice: 175,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);
      const holding = result[0].holdings[0];

      expect(holding.costBasis).toBe(0);
      expect(holding.gainLossPercent).toBe(0); // costBasis is 0, so percent is 0
    });

    it('should handle null closePrice as zero', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: null,
          securityId: 'sec-1',
          tickerSymbol: null,
          securityName: 'Unknown Security',
          securityType: null,
          quantity: 10,
          costBasis: 1000,
          institutionValue: null,
          closePrice: null,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);
      const holding = result[0].holdings[0];

      expect(holding.currentValue).toBe(0); // 10 * 0
      expect(holding.gainLoss).toBe(-1000); // 0 - 1000
    });

    it('should return empty array when user has no holdings', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getHoldings(mockUserId);

      expect(result).toEqual([]);
    });

    it('should calculate correct account-level totals and gainLossPercent', async () => {
      const rows = [
        {
          holdingId: 'h-1',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: null,
          securityId: 'sec-1',
          tickerSymbol: 'AAPL',
          securityName: 'Apple Inc.',
          securityType: 'equity',
          quantity: 10,
          costBasis: 1000,
          institutionValue: null,
          closePrice: 150, // value = 1500
        },
        {
          holdingId: 'h-2',
          accountId: 'acct-1',
          accountName: 'Brokerage',
          institutionName: null,
          securityId: 'sec-2',
          tickerSymbol: 'MSFT',
          securityName: 'Microsoft',
          securityType: 'equity',
          quantity: 5,
          costBasis: 2000,
          institutionValue: null,
          closePrice: 300, // value = 1500
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getHoldings(mockUserId);
      const account = result[0];

      expect(account.totalValue).toBe(3000); // 1500 + 1500
      expect(account.totalCostBasis).toBe(3000); // 1000 + 2000
      expect(account.totalGainLoss).toBe(0); // 3000 - 3000
      expect(account.totalGainLossPercent).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getPortfolioSummary
  // ---------------------------------------------------------------------------
  describe('getPortfolioSummary', () => {
    it('should calculate portfolio summary across all holdings', async () => {
      const rows = [
        {
          quantity: 10,
          costBasis: 1500,
          institutionValue: null,
          closePrice: 175, // value = 1750
        },
        {
          quantity: 20,
          costBasis: 4000,
          institutionValue: null,
          closePrice: 220, // value = 4400
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getPortfolioSummary(mockUserId);

      expect(result.totalValue).toBe(6150); // 1750 + 4400
      expect(result.totalCostBasis).toBe(5500); // 1500 + 4000
      expect(result.totalGainLoss).toBe(650); // 6150 - 5500
      expect(result.totalGainLossPercent).toBeCloseTo(11.82, 1);
      expect(result.holdingCount).toBe(2);
    });

    it('should handle empty portfolio', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getPortfolioSummary(mockUserId);

      expect(result.totalValue).toBe(0);
      expect(result.totalCostBasis).toBe(0);
      expect(result.totalGainLoss).toBe(0);
      expect(result.totalGainLossPercent).toBe(0);
      expect(result.holdingCount).toBe(0);
    });

    it('should use institutionValue when available', async () => {
      const rows = [
        {
          quantity: 10,
          costBasis: 1000,
          institutionValue: 1200, // Takes precedence
          closePrice: 150, // Would give 1500 if used
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getPortfolioSummary(mockUserId);

      expect(result.totalValue).toBe(1200);
      expect(result.totalGainLoss).toBe(200); // 1200 - 1000
    });

    it('should handle null costBasis as zero', async () => {
      const rows = [
        {
          quantity: 10,
          costBasis: null,
          institutionValue: null,
          closePrice: 100,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getPortfolioSummary(mockUserId);

      expect(result.totalCostBasis).toBe(0);
      expect(result.totalGainLoss).toBe(1000); // 1000 - 0
      expect(result.totalGainLossPercent).toBe(0); // 0 cost basis => 0%
    });

    it('should handle portfolio with losses', async () => {
      const rows = [
        {
          quantity: 10,
          costBasis: 2000,
          institutionValue: null,
          closePrice: 100, // value = 1000
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getPortfolioSummary(mockUserId);

      expect(result.totalGainLoss).toBe(-1000);
      expect(result.totalGainLossPercent).toBe(-50); // -1000/2000 * 100
    });
  });
});
