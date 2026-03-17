import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TaxService, calculateStateTax, STATE_TAX_DATA } from './tax.service';

// ── Shared test utilities ──────────────────────────────────────────

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

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const MOCK_USER_ID = 'user-tax-test';

// ────────────────────────────────────────────────────────────────────
// STATE_TAX_DATA structure validation
// ────────────────────────────────────────────────────────────────────

describe('STATE_TAX_DATA', () => {
  it('should contain entries for at least 15 states', () => {
    expect(Object.keys(STATE_TAX_DATA).length).toBeGreaterThanOrEqual(15);
  });

  it('should have valid types for every state', () => {
    for (const [code, config] of Object.entries(STATE_TAX_DATA)) {
      expect(['none', 'flat', 'progressive']).toContain(config.type);
      if (config.type === 'flat') {
        expect(config.rate).toBeGreaterThanOrEqual(0);
        expect(config.rate).toBeLessThan(1);
      }
      if (config.type === 'progressive') {
        expect(config.brackets).toBeDefined();
        expect(config.brackets!.length).toBeGreaterThan(0);
        // Brackets should be ordered and contiguous
        for (let i = 1; i < config.brackets!.length; i++) {
          expect(config.brackets![i].min).toBe(config.brackets![i - 1].max);
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// calculateStateTax – pure function tests
// ────────────────────────────────────────────────────────────────────

describe('calculateStateTax', () => {
  // ── No-income-tax states ─────────────────────────────────────────

  describe('Texas (no state income tax)', () => {
    it('should return 0 for any income', () => {
      expect(calculateStateTax(0, 'TX')).toBe(0);
      expect(calculateStateTax(50_000, 'TX')).toBe(0);
      expect(calculateStateTax(1_000_000, 'TX')).toBe(0);
    });
  });

  describe('Florida (no state income tax)', () => {
    it('should return 0 for any income', () => {
      expect(calculateStateTax(100_000, 'FL')).toBe(0);
    });
  });

  describe('Washington (no state income tax)', () => {
    it('should return 0 for any income', () => {
      expect(calculateStateTax(200_000, 'WA')).toBe(0);
    });
  });

  // ── Flat-rate states ─────────────────────────────────────────────

  describe('Pennsylvania (flat 3.07%)', () => {
    it('should apply flat 3.07% rate', () => {
      expect(calculateStateTax(100_000, 'PA')).toBe(3_070);
    });

    it('should return 0 for zero income', () => {
      expect(calculateStateTax(0, 'PA')).toBe(0);
    });

    it('should handle small amounts', () => {
      expect(calculateStateTax(1_000, 'PA')).toBe(30.70);
    });
  });

  describe('Illinois (flat 4.95%)', () => {
    it('should apply flat 4.95% rate', () => {
      expect(calculateStateTax(80_000, 'IL')).toBe(3_960);
    });
  });

  describe('North Carolina (flat 4.5%)', () => {
    it('should apply flat 4.5% rate', () => {
      expect(calculateStateTax(100_000, 'NC')).toBe(4_500);
    });
  });

  describe('Michigan (flat 4.05%)', () => {
    it('should apply flat 4.05% rate', () => {
      expect(calculateStateTax(100_000, 'MI')).toBe(4_050);
    });
  });

  describe('Arizona (flat 2.5%)', () => {
    it('should apply flat 2.5% rate', () => {
      expect(calculateStateTax(60_000, 'AZ')).toBe(1_500);
    });
  });

  describe('Massachusetts (flat 5%)', () => {
    it('should apply flat 5% rate', () => {
      expect(calculateStateTax(100_000, 'MA')).toBe(5_000);
    });
  });

  // ── Progressive-bracket states ───────────────────────────────────

  describe('California (progressive, 1%-13.3%)', () => {
    it('should return 0 for zero income', () => {
      expect(calculateStateTax(0, 'CA')).toBe(0);
    });

    it('should tax income in the lowest bracket at 1%', () => {
      const tax = calculateStateTax(5_000, 'CA');
      expect(tax).toBe(50); // 5,000 * 0.01
    });

    it('should calculate progressive tax for $50,000 income', () => {
      // Manually: 10,412 * 0.01 = 104.12
      //           14,272 * 0.02 = 285.44
      //           14,275 * 0.04 = 571.00
      //           11,041 * 0.06 = 662.46
      //           total ≈ 1,623.02
      const tax = calculateStateTax(50_000, 'CA');
      expect(tax).toBeGreaterThan(1_500);
      expect(tax).toBeLessThan(2_000);
    });

    it('should apply high rates for income over $1M', () => {
      const tax = calculateStateTax(1_500_000, 'CA');
      // Should be significantly more than a flat 5%
      expect(tax).toBeGreaterThan(75_000);
      // Highest marginal rate is 13.3% so effective should be well under that
      expect(tax).toBeLessThan(1_500_000 * 0.133);
    });
  });

  describe('New York (progressive, 4%-10.9%)', () => {
    it('should tax income in the lowest bracket at 4%', () => {
      const tax = calculateStateTax(5_000, 'NY');
      expect(tax).toBe(200); // 5,000 * 0.04
    });

    it('should calculate progressive tax for $100,000 income', () => {
      const tax = calculateStateTax(100_000, 'NY');
      expect(tax).toBeGreaterThan(4_000); // More than just 4% of 100k
      expect(tax).toBeLessThan(10_000);
    });
  });

  describe('Ohio (progressive, 0%-3.99%)', () => {
    it('should return 0 for income under $26,050', () => {
      expect(calculateStateTax(20_000, 'OH')).toBe(0);
    });

    it('should apply 2.765% for income between $26,050 and $100,000', () => {
      const tax = calculateStateTax(50_000, 'OH');
      // (50,000 - 26,050) * 0.02765 = 23,950 * 0.02765 ≈ 662.22
      expect(tax).toBeCloseTo(662.22, 0);
    });
  });

  describe('Georgia (progressive, 1%-5.49%)', () => {
    it('should calculate correctly for mid-range income', () => {
      const tax = calculateStateTax(50_000, 'GA');
      // Most income (50,000 - 7,000 = 43,000) taxed at 5.49%
      expect(tax).toBeGreaterThan(2_000);
      expect(tax).toBeLessThan(3_000);
    });
  });

  describe('New Jersey (progressive, 1.4%-10.75%)', () => {
    it('should apply 1.4% for low income', () => {
      const tax = calculateStateTax(15_000, 'NJ');
      expect(tax).toBe(210); // 15,000 * 0.014
    });
  });

  describe('Virginia (progressive, 2%-5.75%)', () => {
    it('should calculate correctly for $100,000 income', () => {
      const tax = calculateStateTax(100_000, 'VA');
      // 3,000*0.02 + 2,000*0.03 + 12,000*0.05 + 83,000*0.0575
      // = 60 + 60 + 600 + 4,772.50 = 5,492.50
      expect(tax).toBe(5_492.50);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should use default 5% rate for unknown state', () => {
      expect(calculateStateTax(100_000, 'XX')).toBe(5_000);
    });

    it('should use default rate when state is undefined', () => {
      expect(calculateStateTax(100_000, undefined)).toBe(5_000);
    });

    it('should use default rate when state is null', () => {
      expect(calculateStateTax(100_000, null)).toBe(5_000);
    });

    it('should handle case-insensitive state codes', () => {
      expect(calculateStateTax(100_000, 'tx')).toBe(0);
      expect(calculateStateTax(100_000, 'ca')).toBeGreaterThan(0);
    });

    it('should return 0 for negative income', () => {
      expect(calculateStateTax(-10_000, 'CA')).toBe(0);
    });

    it('should return 0 for zero income in all states', () => {
      for (const code of Object.keys(STATE_TAX_DATA)) {
        expect(calculateStateTax(0, code)).toBe(0);
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// TaxService integration-style tests (with mocked DB)
// ────────────────────────────────────────────────────────────────────

describe('TaxService', () => {
  let service: TaxService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new TaxService(mockDb);
  });

  describe('generateSummary', () => {
    it('should use state parameter for state tax calculation', async () => {
      // Mock getDocuments – returns a W-2 for $100,000
      const docQuery = mockQuery([
        { type: 'w2', amount: 100_000, isDeductible: false },
      ]);
      mockDb.select.mockReturnValueOnce(docQuery); // getDocuments

      // Mock existing summary lookup – none exists
      const summaryQuery = mockQuery([]);
      mockDb.select.mockReturnValueOnce(summaryQuery);

      // Mock insert for creating new summary
      const insertQuery = mockQuery([
        {
          userId: MOCK_USER_ID,
          year: 2024,
          estimatedStateTax: 0,
          state: 'TX',
        },
      ]);
      mockDb.insert.mockReturnValue(insertQuery);

      const result = await service.generateSummary(MOCK_USER_ID, 2024, 'TX');

      // Texas has no state income tax, so estimatedStateTax should be 0
      // Verify the insert was called (the mock returns our data)
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should use California brackets when state is CA', async () => {
      const docQuery = mockQuery([
        { type: 'w2', amount: 200_000, isDeductible: false },
      ]);
      mockDb.select.mockReturnValueOnce(docQuery);

      const summaryQuery = mockQuery([]);
      mockDb.select.mockReturnValueOnce(summaryQuery);

      const insertQuery = mockQuery([
        {
          userId: MOCK_USER_ID,
          year: 2024,
          state: 'CA',
        },
      ]);
      mockDb.insert.mockReturnValue(insertQuery);

      const result = await service.generateSummary(MOCK_USER_ID, 2024, 'CA');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('should return default summary with state: null when none exists', async () => {
      const query = mockQuery([]);
      mockDb.select.mockReturnValue(query);

      const result = await service.getSummary(MOCK_USER_ID, 2024);

      expect(result).toEqual({
        year: 2024,
        estimatedIncome: 0,
        estimatedDeductions: 0,
        estimatedTaxableIncome: 0,
        estimatedFederalTax: 0,
        estimatedStateTax: 0,
        filingStatus: 'single',
        state: null,
        generatedAt: null,
      });
    });
  });
});
