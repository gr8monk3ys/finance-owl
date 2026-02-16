import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// ---------- Types ----------

export interface HoldingFeeDetail {
  holdingId: string;
  tickerSymbol: string | null;
  securityName: string;
  securityType: string | null;
  currentValue: number;
  expenseRatio: number;
  annualFee: number;
}

export interface FeeAnalysis {
  totalAnnualFees: number;
  weightedExpenseRatio: number;
  holdings: HoldingFeeDetail[];
  feesByCategory: {
    category: string;
    avgExpenseRatio: number;
    totalFees: number;
  }[];
}

export interface FeeComparison {
  category: string;
  userAvgExpenseRatio: number;
  benchmarkAvgExpenseRatio: number;
  difference: number;
  verdict: 'low' | 'average' | 'high';
}

export interface FeeImpact {
  currentPortfolioValue: number;
  projectedWithCurrentFees: number;
  projectedWithLowCostFees: number;
  lifetimeSavings: number;
  years: number;
}

export interface Alternative {
  currentHolding: string;
  currentExpenseRatio: number;
  suggestedSymbol: string;
  suggestedName: string;
  suggestedExpenseRatio: number;
  annualSavings: number;
}

export interface FeeSummary {
  totalPortfolioValue: number;
  totalAnnualFees: number;
  weightedExpenseRatio: number;
  feeScore: 'A' | 'B' | 'C' | 'D' | 'F';
  feeScoreDescription: string;
  holdingCount: number;
  highFeeCount: number;
}

// ---------- Built-in expense ratio database ----------

interface FundInfo {
  symbol: string;
  name: string;
  expenseRatio: number;
  category: string;
  isLowCost: boolean;
}

const FUND_DATABASE: FundInfo[] = [
  // Low-cost index funds / ETFs
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', expenseRatio: 0.0003, category: 'US Large Cap', isLowCost: true },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', expenseRatio: 0.0003, category: 'US Total Market', isLowCost: true },
  { symbol: 'VXUS', name: 'Vanguard Total Intl Stock ETF', expenseRatio: 0.0007, category: 'International', isLowCost: true },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', expenseRatio: 0.0005, category: 'International Developed', isLowCost: true },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', expenseRatio: 0.0008, category: 'Emerging Markets', isLowCost: true },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', expenseRatio: 0.0003, category: 'US Bonds', isLowCost: true },
  { symbol: 'BNDX', name: 'Vanguard Total Intl Bond ETF', expenseRatio: 0.0007, category: 'International Bonds', isLowCost: true },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', expenseRatio: 0.0012, category: 'Real Estate', isLowCost: true },
  { symbol: 'VGSH', name: 'Vanguard Short-Term Treasury ETF', expenseRatio: 0.0004, category: 'Short-Term Bonds', isLowCost: true },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', expenseRatio: 0.0003, category: 'US Large Cap', isLowCost: true },
  { symbol: 'ITOT', name: 'iShares Core S&P Total US Stock ETF', expenseRatio: 0.0003, category: 'US Total Market', isLowCost: true },
  { symbol: 'IXUS', name: 'iShares Core MSCI Total Intl Stock ETF', expenseRatio: 0.0007, category: 'International', isLowCost: true },
  { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', expenseRatio: 0.0003, category: 'US Bonds', isLowCost: true },
  { symbol: 'SCHB', name: 'Schwab US Broad Market ETF', expenseRatio: 0.0003, category: 'US Total Market', isLowCost: true },
  { symbol: 'SCHX', name: 'Schwab US Large-Cap ETF', expenseRatio: 0.0003, category: 'US Large Cap', isLowCost: true },
  { symbol: 'SCHA', name: 'Schwab US Small-Cap ETF', expenseRatio: 0.0004, category: 'US Small Cap', isLowCost: true },
  { symbol: 'SCHF', name: 'Schwab Intl Equity ETF', expenseRatio: 0.0006, category: 'International Developed', isLowCost: true },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', expenseRatio: 0.0009, category: 'US Large Cap', isLowCost: true },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', expenseRatio: 0.0020, category: 'US Large Cap Growth', isLowCost: false },
  { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', expenseRatio: 0.00015, category: 'US Large Cap', isLowCost: true },
  { symbol: 'FSKAX', name: 'Fidelity Total Market Index Fund', expenseRatio: 0.00015, category: 'US Total Market', isLowCost: true },

  // Target-date funds (typical range)
  { symbol: 'VFIFX', name: 'Vanguard Target Retirement 2050', expenseRatio: 0.0008, category: 'Target Date', isLowCost: true },
  { symbol: 'VFORX', name: 'Vanguard Target Retirement 2040', expenseRatio: 0.0008, category: 'Target Date', isLowCost: true },
  { symbol: 'FFFHX', name: 'Fidelity Freedom 2040 Fund', expenseRatio: 0.0075, category: 'Target Date', isLowCost: false },

  // Actively managed (higher cost)
  { symbol: 'AIVSX', name: 'American Funds Inv Co of Am', expenseRatio: 0.0059, category: 'US Large Cap', isLowCost: false },
  { symbol: 'AGTHX', name: 'American Funds Growth Fund', expenseRatio: 0.0064, category: 'US Large Cap Growth', isLowCost: false },
  { symbol: 'FCNTX', name: 'Fidelity Contrafund', expenseRatio: 0.0039, category: 'US Large Cap Growth', isLowCost: false },
  { symbol: 'VWELX', name: 'Vanguard Wellington Fund', expenseRatio: 0.0025, category: 'Balanced', isLowCost: false },
  { symbol: 'PIMIX', name: 'PIMCO Income Fund Inst', expenseRatio: 0.0050, category: 'US Bonds', isLowCost: false },
];

// Category average expense ratios for benchmarking
const CATEGORY_BENCHMARKS: Record<string, number> = {
  'US Large Cap': 0.0050,
  'US Large Cap Growth': 0.0070,
  'US Total Market': 0.0045,
  'US Small Cap': 0.0080,
  'International': 0.0065,
  'International Developed': 0.0060,
  'Emerging Markets': 0.0090,
  'US Bonds': 0.0045,
  'International Bonds': 0.0055,
  'Short-Term Bonds': 0.0040,
  'Real Estate': 0.0075,
  'Target Date': 0.0060,
  'Balanced': 0.0060,
  'Other': 0.0065,
};

// Low-cost alternatives by category
const LOW_COST_ALTERNATIVES: Record<string, FundInfo[]> = {};
for (const fund of FUND_DATABASE) {
  if (fund.isLowCost) {
    if (!LOW_COST_ALTERNATIVES[fund.category]) {
      LOW_COST_ALTERNATIVES[fund.category] = [];
    }
    LOW_COST_ALTERNATIVES[fund.category].push(fund);
  }
}

// Assumed annual growth rate for projections
const ASSUMED_ANNUAL_GROWTH = 0.07;
const LOW_COST_EXPENSE_RATIO = 0.0003; // 0.03% (e.g., VOO/VTI)

@Injectable()
export class FeeAnalyzerService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Analyze expense ratios for all holdings of a user.
   */
  async analyzeExpenseRatios(userId: string): Promise<FeeAnalysis> {
    const holdings = await this.getHoldingsWithValues(userId);

    if (holdings.length === 0) {
      return {
        totalAnnualFees: 0,
        weightedExpenseRatio: 0,
        holdings: [],
        feesByCategory: [],
      };
    }

    let totalValue = 0;
    let weightedERSum = 0;
    let totalAnnualFees = 0;

    const holdingDetails: HoldingFeeDetail[] = [];
    const categoryMap = new Map<string, { totalValue: number; totalFees: number; count: number; erSum: number }>();

    for (const h of holdings) {
      const currentValue = h.institutionValue ?? h.quantity * (h.closePrice ?? 0);
      const expenseRatio = this.lookupExpenseRatio(h.tickerSymbol, h.securityType);
      const annualFee = currentValue * expenseRatio;
      const category = this.categorize(h.tickerSymbol, h.securityType);

      holdingDetails.push({
        holdingId: h.holdingId,
        tickerSymbol: h.tickerSymbol,
        securityName: h.securityName,
        securityType: h.securityType,
        currentValue,
        expenseRatio,
        annualFee,
      });

      totalValue += currentValue;
      weightedERSum += currentValue * expenseRatio;
      totalAnnualFees += annualFee;

      const cat = categoryMap.get(category) ?? { totalValue: 0, totalFees: 0, count: 0, erSum: 0 };
      cat.totalValue += currentValue;
      cat.totalFees += annualFee;
      cat.count += 1;
      cat.erSum += expenseRatio;
      categoryMap.set(category, cat);
    }

    const weightedExpenseRatio = totalValue > 0 ? weightedERSum / totalValue : 0;

    const feesByCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        avgExpenseRatio: data.count > 0 ? data.erSum / data.count : 0,
        totalFees: Math.round(data.totalFees * 100) / 100,
      }))
      .sort((a, b) => b.totalFees - a.totalFees);

    // Sort holdings by expense ratio descending (highest fees first)
    holdingDetails.sort((a, b) => b.expenseRatio - a.expenseRatio);

    return {
      totalAnnualFees: Math.round(totalAnnualFees * 100) / 100,
      weightedExpenseRatio: Math.round(weightedExpenseRatio * 10000) / 10000,
      holdings: holdingDetails,
      feesByCategory,
    };
  }

  /**
   * Compare user's fees against category average benchmarks.
   */
  async compareToBenchmark(userId: string): Promise<FeeComparison[]> {
    const analysis = await this.analyzeExpenseRatios(userId);

    return analysis.feesByCategory.map((cat) => {
      const benchmark = CATEGORY_BENCHMARKS[cat.category] ?? CATEGORY_BENCHMARKS['Other'];
      const diff = cat.avgExpenseRatio - benchmark;

      let verdict: 'low' | 'average' | 'high';
      if (diff < -0.001) {
        verdict = 'low';
      } else if (diff > 0.002) {
        verdict = 'high';
      } else {
        verdict = 'average';
      }

      return {
        category: cat.category,
        userAvgExpenseRatio: cat.avgExpenseRatio,
        benchmarkAvgExpenseRatio: benchmark,
        difference: Math.round(diff * 10000) / 10000,
        verdict,
      };
    });
  }

  /**
   * Calculate the lifetime fee impact showing how fees compound
   * and erode returns over the given number of years.
   */
  async calculateLifetimeFeeImpact(
    userId: string,
    years: number,
  ): Promise<FeeImpact> {
    const analysis = await this.analyzeExpenseRatios(userId);

    const totalValue = analysis.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0,
    );

    if (totalValue === 0) {
      return {
        currentPortfolioValue: 0,
        projectedWithCurrentFees: 0,
        projectedWithLowCostFees: 0,
        lifetimeSavings: 0,
        years,
      };
    }

    const currentER = analysis.weightedExpenseRatio;
    const lowCostER = LOW_COST_EXPENSE_RATIO;

    // Project portfolio value: value * (1 + growth - fees)^years
    const netGrowthCurrent = ASSUMED_ANNUAL_GROWTH - currentER;
    const netGrowthLowCost = ASSUMED_ANNUAL_GROWTH - lowCostER;

    const projectedWithCurrentFees =
      totalValue * Math.pow(1 + netGrowthCurrent, years);
    const projectedWithLowCostFees =
      totalValue * Math.pow(1 + netGrowthLowCost, years);
    const lifetimeSavings = projectedWithLowCostFees - projectedWithCurrentFees;

    return {
      currentPortfolioValue: Math.round(totalValue * 100) / 100,
      projectedWithCurrentFees: Math.round(projectedWithCurrentFees * 100) / 100,
      projectedWithLowCostFees: Math.round(projectedWithLowCostFees * 100) / 100,
      lifetimeSavings: Math.round(lifetimeSavings * 100) / 100,
      years,
    };
  }

  /**
   * Suggest lower-cost alternatives for a specific holding.
   */
  async suggestAlternatives(holdingId: string): Promise<Alternative[]> {
    const [holding] = await this.db
      .select({
        holdingId: schema.investmentHoldings.id,
        tickerSymbol: schema.securities.tickerSymbol,
        securityName: schema.securities.name,
        securityType: schema.securities.type,
        quantity: schema.investmentHoldings.quantity,
        institutionValue: schema.investmentHoldings.institutionValue,
        closePrice: schema.securities.closePrice,
      })
      .from(schema.investmentHoldings)
      .innerJoin(
        schema.securities,
        eq(schema.investmentHoldings.securityId, schema.securities.id),
      )
      .where(eq(schema.investmentHoldings.id, holdingId))
      .limit(1);

    if (!holding) return [];

    const currentValue =
      holding.institutionValue ?? holding.quantity * (holding.closePrice ?? 0);
    const currentER = this.lookupExpenseRatio(
      holding.tickerSymbol,
      holding.securityType,
    );
    const category = this.categorize(holding.tickerSymbol, holding.securityType);

    // If already low-cost, no suggestions needed
    if (currentER <= LOW_COST_EXPENSE_RATIO + 0.0001) return [];

    const alternatives = LOW_COST_ALTERNATIVES[category] ?? LOW_COST_ALTERNATIVES['US Total Market'] ?? [];

    return alternatives
      .filter((alt) => alt.symbol !== holding.tickerSymbol)
      .filter((alt) => alt.expenseRatio < currentER)
      .slice(0, 3)
      .map((alt) => ({
        currentHolding: holding.tickerSymbol ?? holding.securityName,
        currentExpenseRatio: currentER,
        suggestedSymbol: alt.symbol,
        suggestedName: alt.name,
        suggestedExpenseRatio: alt.expenseRatio,
        annualSavings:
          Math.round(currentValue * (currentER - alt.expenseRatio) * 100) / 100,
      }));
  }

  /**
   * Suggest lower-cost alternatives for all holdings of a user.
   */
  async suggestAllAlternatives(userId: string): Promise<Alternative[]> {
    const holdings = await this.getHoldingsWithValues(userId);
    const allAlternatives: Alternative[] = [];

    for (const h of holdings) {
      const currentValue = h.institutionValue ?? h.quantity * (h.closePrice ?? 0);
      const currentER = this.lookupExpenseRatio(h.tickerSymbol, h.securityType);
      const category = this.categorize(h.tickerSymbol, h.securityType);

      if (currentER <= LOW_COST_EXPENSE_RATIO + 0.0001) continue;

      const alternatives = LOW_COST_ALTERNATIVES[category] ?? LOW_COST_ALTERNATIVES['US Total Market'] ?? [];

      const best = alternatives
        .filter((alt) => alt.symbol !== h.tickerSymbol)
        .filter((alt) => alt.expenseRatio < currentER)
        .sort((a, b) => a.expenseRatio - b.expenseRatio)[0];

      if (best) {
        allAlternatives.push({
          currentHolding: h.tickerSymbol ?? h.securityName,
          currentExpenseRatio: currentER,
          suggestedSymbol: best.symbol,
          suggestedName: best.name,
          suggestedExpenseRatio: best.expenseRatio,
          annualSavings:
            Math.round(currentValue * (currentER - best.expenseRatio) * 100) / 100,
        });
      }
    }

    return allAlternatives.sort((a, b) => b.annualSavings - a.annualSavings);
  }

  /**
   * Get a quick fee summary with a letter grade for the portfolio.
   */
  async getPortfolioFeeSummary(userId: string): Promise<FeeSummary> {
    const analysis = await this.analyzeExpenseRatios(userId);

    const totalValue = analysis.holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0,
    );

    const highFeeCount = analysis.holdings.filter(
      (h) => h.expenseRatio > 0.005,
    ).length;

    const wr = analysis.weightedExpenseRatio;
    let feeScore: 'A' | 'B' | 'C' | 'D' | 'F';
    let feeScoreDescription: string;

    if (wr <= 0.0010) {
      feeScore = 'A';
      feeScoreDescription =
        'Excellent! Your portfolio fees are very low. You are keeping more of your returns.';
    } else if (wr <= 0.0030) {
      feeScore = 'B';
      feeScoreDescription =
        'Good. Your fees are below average, but there may be room for small improvements.';
    } else if (wr <= 0.0060) {
      feeScore = 'C';
      feeScoreDescription =
        'Average. Consider switching some holdings to lower-cost index fund alternatives.';
    } else if (wr <= 0.0100) {
      feeScore = 'D';
      feeScoreDescription =
        'Below average. High fees are significantly impacting your long-term returns.';
    } else {
      feeScore = 'F';
      feeScoreDescription =
        'Very high fees. Switching to low-cost index funds could save you thousands over time.';
    }

    return {
      totalPortfolioValue: Math.round(totalValue * 100) / 100,
      totalAnnualFees: analysis.totalAnnualFees,
      weightedExpenseRatio: analysis.weightedExpenseRatio,
      feeScore,
      feeScoreDescription,
      holdingCount: analysis.holdings.length,
      highFeeCount,
    };
  }

  // ---------- Private helpers ----------

  private async getHoldingsWithValues(userId: string) {
    return this.db
      .select({
        holdingId: schema.investmentHoldings.id,
        tickerSymbol: schema.securities.tickerSymbol,
        securityName: schema.securities.name,
        securityType: schema.securities.type,
        quantity: schema.investmentHoldings.quantity,
        institutionValue: schema.investmentHoldings.institutionValue,
        closePrice: schema.securities.closePrice,
      })
      .from(schema.investmentHoldings)
      .innerJoin(
        schema.securities,
        eq(schema.investmentHoldings.securityId, schema.securities.id),
      )
      .where(eq(schema.investmentHoldings.userId, userId));
  }

  /**
   * Look up the expense ratio for a given ticker. Falls back to a
   * default based on security type if the ticker is not in our database.
   */
  private lookupExpenseRatio(
    ticker: string | null,
    securityType: string | null,
  ): number {
    if (ticker) {
      const found = FUND_DATABASE.find(
        (f) => f.symbol.toUpperCase() === ticker.toUpperCase(),
      );
      if (found) return found.expenseRatio;
    }

    // Default expense ratios by security type
    const normalizedType = (securityType ?? '').toLowerCase();
    if (normalizedType === 'etf') return 0.0020; // 0.20% average ETF
    if (normalizedType === 'mutual fund') return 0.0075; // 0.75% average MF
    if (normalizedType === 'equity' || normalizedType === 'stock') return 0; // Individual stocks have no ER
    if (normalizedType === 'fixed income' || normalizedType === 'bond')
      return 0.0040;
    if (normalizedType === 'cash' || normalizedType === 'cash equivalent')
      return 0;

    return 0.0050; // Default for unknown fund types
  }

  /**
   * Categorize a holding into a fee-comparison category.
   */
  private categorize(
    ticker: string | null,
    securityType: string | null,
  ): string {
    if (ticker) {
      const found = FUND_DATABASE.find(
        (f) => f.symbol.toUpperCase() === ticker.toUpperCase(),
      );
      if (found) return found.category;
    }

    const normalizedType = (securityType ?? '').toLowerCase();
    if (normalizedType === 'equity' || normalizedType === 'stock')
      return 'US Large Cap';
    if (normalizedType === 'etf') return 'US Total Market';
    if (normalizedType === 'mutual fund') return 'US Large Cap';
    if (normalizedType === 'fixed income' || normalizedType === 'bond')
      return 'US Bonds';

    return 'Other';
  }
}
