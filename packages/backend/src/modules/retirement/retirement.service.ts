import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { retirementProfiles } from './retirement.schema';

// Risk tolerance return distributions
const RISK_PROFILES: Record<
  string,
  { mean: number; std: number }
> = {
  conservative: { mean: 0.06, std: 0.08 },
  moderate: { mean: 0.08, std: 0.12 },
  aggressive: { mean: 0.10, std: 0.16 },
};

const MONTE_CARLO_ITERATIONS = 1000;
const SAFE_WITHDRAWAL_RATE = 0.04;
const RETIREMENT_DURATION_YEARS = 30;

export interface YearByYearEntry {
  age: number;
  balanceMedian: number;
  balanceLow: number;
  balanceHigh: number;
  contributions: number;
  returns: number;
}

export interface ProjectionResult {
  projectedBalance: {
    median: number;
    p10: number;
    p90: number;
  };
  monthlyIncomeAtRetirement: {
    median: number;
    p10: number;
    p90: number;
  };
  successRate: number;
  yearByYear: YearByYearEntry[];
  shortfallAmount: number;
  recommendedContribution: number;
  retirementReadinessScore: number;
  yearsToRetirement: number;
}

export interface FeeAnalysisResult {
  totalFeesPaid: number;
  balanceWithFees: number;
  balanceWithoutFees: number;
  balanceImpact: number;
  feeOptimizedBalance: number;
  lowFeePercent: number;
}

export interface ScenarioResult {
  label: string;
  projectedBalance: number;
  monthlyIncome: number;
  successRate: number;
  readinessScore: number;
}

@Injectable()
export class RetirementService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Box-Muller transform for generating normally distributed random numbers
   */
  private gaussianRandom(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  /**
   * Get percentile value from a sorted array
   */
  private percentile(sortedArr: number[], p: number): number {
    const index = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedArr[lower];
    const fraction = index - lower;
    return sortedArr[lower] * (1 - fraction) + sortedArr[upper] * fraction;
  }

  async getProfile(userId: string) {
    const [existing] = await this.db
      .select()
      .from(retirementProfiles)
      .where(eq(retirementProfiles.userId, userId))
      .limit(1);

    if (existing) return existing;

    // Create default profile
    const [profile] = await this.db
      .insert(retirementProfiles)
      .values({ userId })
      .returning();

    return profile;
  }

  async updateProfile(
    userId: string,
    data: {
      currentAge?: number;
      retirementAge?: number;
      currentSavings?: number;
      monthlyContribution?: number;
      employerMatch?: number;
      expectedReturn?: number;
      inflationRate?: number;
      desiredMonthlyIncome?: number;
      socialSecurityEstimate?: number;
      pensionAmount?: number;
      riskTolerance?: string;
    },
  ) {
    // Ensure profile exists
    await this.getProfile(userId);

    const [updated] = await this.db
      .update(retirementProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(retirementProfiles.userId, userId))
      .returning();

    return updated;
  }

  async calculateProjection(userId: string): Promise<ProjectionResult> {
    const profile = await this.getProfile(userId);

    const yearsToRetirement = Math.max(
      0,
      profile.retirementAge - profile.currentAge,
    );
    const riskProfile =
      RISK_PROFILES[profile.riskTolerance] || RISK_PROFILES.moderate;
    const monthlyContributionWithMatch =
      profile.monthlyContribution *
      (1 + profile.employerMatch / 100);
    const annualContribution = monthlyContributionWithMatch * 12;
    const inflationRate = profile.inflationRate / 100;

    // Monte Carlo simulation
    // finalBalances[i] = final balance at retirement for simulation i
    const finalBalances: number[] = [];
    // yearBalances[year][sim] = balance at that year across all sims
    const yearBalances: number[][] = Array.from(
      { length: yearsToRetirement + 1 },
      () => [],
    );
    // Track contributions and returns per year (deterministic contributions, averaged returns)
    const yearContributions: number[] = new Array(
      yearsToRetirement + 1,
    ).fill(0);
    const yearReturnsAccum: number[][] = Array.from(
      { length: yearsToRetirement + 1 },
      () => [],
    );

    // Track how many simulations have money lasting 30 years
    let successCount = 0;

    for (let sim = 0; sim < MONTE_CARLO_ITERATIONS; sim++) {
      let balance = profile.currentSavings;
      yearBalances[0].push(balance);

      for (let year = 1; year <= yearsToRetirement; year++) {
        // Randomized annual return
        const annualReturn = this.gaussianRandom(
          riskProfile.mean,
          riskProfile.std,
        );

        // Contributions for this year (inflation-adjusted)
        const inflationAdjustedContribution =
          annualContribution * Math.pow(1 + inflationRate, year - 1);

        const investmentReturn = balance * annualReturn;
        balance =
          balance + inflationAdjustedContribution + investmentReturn;

        // Prevent negative balances during accumulation
        if (balance < 0) balance = 0;

        yearBalances[year].push(balance);
        yearContributions[year] = inflationAdjustedContribution;
        yearReturnsAccum[year].push(investmentReturn);
      }

      finalBalances.push(balance);

      // Simulate retirement drawdown to check success
      const annualDesiredIncome =
        profile.desiredMonthlyIncome * 12 *
        Math.pow(1 + inflationRate, yearsToRetirement);
      const annualOtherIncome =
        (profile.socialSecurityEstimate + profile.pensionAmount) * 12;
      const annualDrawdown = Math.max(
        0,
        annualDesiredIncome - annualOtherIncome,
      );

      let retirementBalance = balance;
      let survived = true;

      for (let year = 0; year < RETIREMENT_DURATION_YEARS; year++) {
        const retirementReturn = this.gaussianRandom(
          riskProfile.mean * 0.7, // More conservative in retirement
          riskProfile.std * 0.7,
        );
        retirementBalance =
          retirementBalance * (1 + retirementReturn) -
          annualDrawdown * Math.pow(1 + inflationRate, year);

        if (retirementBalance <= 0) {
          survived = false;
          break;
        }
      }

      if (survived) successCount++;
    }

    // Sort final balances for percentile calculations
    const sortedBalances = [...finalBalances].sort((a, b) => a - b);

    const medianBalance = this.percentile(sortedBalances, 50);
    const p10Balance = this.percentile(sortedBalances, 10);
    const p90Balance = this.percentile(sortedBalances, 90);

    // Monthly income using 4% rule
    const medianMonthlyIncome =
      (medianBalance * SAFE_WITHDRAWAL_RATE) / 12 +
      profile.socialSecurityEstimate +
      profile.pensionAmount;
    const p10MonthlyIncome =
      (p10Balance * SAFE_WITHDRAWAL_RATE) / 12 +
      profile.socialSecurityEstimate +
      profile.pensionAmount;
    const p90MonthlyIncome =
      (p90Balance * SAFE_WITHDRAWAL_RATE) / 12 +
      profile.socialSecurityEstimate +
      profile.pensionAmount;

    // Inflate desired income to retirement dollars
    const inflatedDesiredIncome =
      profile.desiredMonthlyIncome *
      Math.pow(1 + inflationRate, yearsToRetirement);

    const shortfallAmount = Math.max(
      0,
      inflatedDesiredIncome - medianMonthlyIncome,
    );

    // Calculate recommended contribution to eliminate shortfall
    let recommendedContribution = profile.monthlyContribution;
    if (shortfallAmount > 0 && yearsToRetirement > 0) {
      // Additional annual savings needed:
      // shortfall * 12 / 0.04 = additional balance needed
      const additionalBalanceNeeded = (shortfallAmount * 12) / SAFE_WITHDRAWAL_RATE;
      // Future value of annuity: FV = PMT * [((1+r)^n - 1) / r]
      const r = riskProfile.mean;
      const n = yearsToRetirement;
      const annuityFactor = r > 0 ? (Math.pow(1 + r, n) - 1) / r : n;
      const additionalAnnualNeeded = additionalBalanceNeeded / annuityFactor;
      const matchMultiplier = 1 + profile.employerMatch / 100;
      recommendedContribution =
        profile.monthlyContribution +
        additionalAnnualNeeded / 12 / matchMultiplier;
    }

    // Success rate
    const successRate = (successCount / MONTE_CARLO_ITERATIONS) * 100;

    // Retirement readiness score (0-100)
    const incomeRatio = medianMonthlyIncome / Math.max(inflatedDesiredIncome, 1);
    const successComponent = successRate * 0.5; // 50% weight
    const incomeComponent = Math.min(incomeRatio, 1) * 100 * 0.35; // 35% weight
    const savingsComponent =
      Math.min(profile.currentSavings / Math.max(medianBalance, 1), 1) *
      100 *
      0.15; // 15% weight
    const retirementReadinessScore = Math.round(
      Math.min(100, successComponent + incomeComponent + savingsComponent),
    );

    // Build year-by-year data
    const yearByYear: YearByYearEntry[] = [];
    for (let year = 0; year <= yearsToRetirement; year++) {
      const sortedYear = [...yearBalances[year]].sort((a, b) => a - b);
      const medianReturns =
        yearReturnsAccum[year].length > 0
          ? yearReturnsAccum[year].reduce((a, b) => a + b, 0) /
            yearReturnsAccum[year].length
          : 0;

      yearByYear.push({
        age: profile.currentAge + year,
        balanceMedian: Math.round(this.percentile(sortedYear, 50) * 100) / 100,
        balanceLow: Math.round(this.percentile(sortedYear, 10) * 100) / 100,
        balanceHigh: Math.round(this.percentile(sortedYear, 90) * 100) / 100,
        contributions: Math.round(yearContributions[year] * 100) / 100,
        returns: Math.round(medianReturns * 100) / 100,
      });
    }

    return {
      projectedBalance: {
        median: Math.round(medianBalance * 100) / 100,
        p10: Math.round(p10Balance * 100) / 100,
        p90: Math.round(p90Balance * 100) / 100,
      },
      monthlyIncomeAtRetirement: {
        median: Math.round(medianMonthlyIncome * 100) / 100,
        p10: Math.round(p10MonthlyIncome * 100) / 100,
        p90: Math.round(p90MonthlyIncome * 100) / 100,
      },
      successRate: Math.round(successRate * 10) / 10,
      yearByYear,
      shortfallAmount: Math.round(shortfallAmount * 100) / 100,
      recommendedContribution:
        Math.round(Math.max(0, recommendedContribution) * 100) / 100,
      retirementReadinessScore,
      yearsToRetirement,
    };
  }

  async analyzeFees(
    _userId: string,
    data: {
      currentBalance: number;
      annualFeePercent: number;
      yearsToRetirement: number;
    },
  ): Promise<FeeAnalysisResult> {
    const { currentBalance, annualFeePercent, yearsToRetirement } = data;
    const feeRate = annualFeePercent / 100;
    const growthRate = 0.07; // Assume 7% nominal return

    // Balance with current fees
    let balanceWithFees = currentBalance;
    let totalFeesPaid = 0;

    for (let year = 0; year < yearsToRetirement; year++) {
      const growth = balanceWithFees * growthRate;
      balanceWithFees += growth;
      const fee = balanceWithFees * feeRate;
      totalFeesPaid += fee;
      balanceWithFees -= fee;
    }

    // Balance without fees
    const balanceWithoutFees =
      currentBalance * Math.pow(1 + growthRate, yearsToRetirement);

    // Fee-optimized balance (assume 0.1% low-cost index fund)
    const lowFeeRate = 0.001;
    let feeOptimizedBalance = currentBalance;
    for (let year = 0; year < yearsToRetirement; year++) {
      const growth = feeOptimizedBalance * growthRate;
      feeOptimizedBalance += growth;
      const fee = feeOptimizedBalance * lowFeeRate;
      feeOptimizedBalance -= fee;
    }

    return {
      totalFeesPaid: Math.round(totalFeesPaid * 100) / 100,
      balanceWithFees: Math.round(balanceWithFees * 100) / 100,
      balanceWithoutFees: Math.round(balanceWithoutFees * 100) / 100,
      balanceImpact:
        Math.round((balanceWithoutFees - balanceWithFees) * 100) / 100,
      feeOptimizedBalance: Math.round(feeOptimizedBalance * 100) / 100,
      lowFeePercent: 0.1,
    };
  }

  async compareScenarios(
    userId: string,
    scenarios: Array<{
      label: string;
      retirementAge?: number;
      monthlyContribution?: number;
      employerMatch?: number;
      riskTolerance?: string;
      currentSavings?: number;
    }>,
  ): Promise<ScenarioResult[]> {
    const profile = await this.getProfile(userId);
    const inflationRate = profile.inflationRate / 100;
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      const retirementAge = scenario.retirementAge ?? profile.retirementAge;
      const monthlyContribution =
        scenario.monthlyContribution ?? profile.monthlyContribution;
      const employerMatch = scenario.employerMatch ?? profile.employerMatch;
      const riskTolerance =
        scenario.riskTolerance ?? profile.riskTolerance;
      const currentSavings = scenario.currentSavings ?? profile.currentSavings;

      const yearsToRetirement = Math.max(0, retirementAge - profile.currentAge);
      const riskProfile =
        RISK_PROFILES[riskTolerance] || RISK_PROFILES.moderate;
      const monthlyWithMatch = monthlyContribution * (1 + employerMatch / 100);
      const annualContribution = monthlyWithMatch * 12;

      const finalBalances: number[] = [];
      let successCount = 0;

      for (let sim = 0; sim < MONTE_CARLO_ITERATIONS; sim++) {
        let balance = currentSavings;

        for (let year = 1; year <= yearsToRetirement; year++) {
          const annualReturn = this.gaussianRandom(
            riskProfile.mean,
            riskProfile.std,
          );
          const inflationAdjustedContribution =
            annualContribution * Math.pow(1 + inflationRate, year - 1);
          balance =
            balance + inflationAdjustedContribution + balance * annualReturn;
          if (balance < 0) balance = 0;
        }

        finalBalances.push(balance);

        // Retirement drawdown check
        const annualDesiredIncome =
          profile.desiredMonthlyIncome * 12 *
          Math.pow(1 + inflationRate, yearsToRetirement);
        const annualOtherIncome =
          (profile.socialSecurityEstimate + profile.pensionAmount) * 12;
        const annualDrawdown = Math.max(0, annualDesiredIncome - annualOtherIncome);

        let retirementBalance = balance;
        let survived = true;
        for (let year = 0; year < RETIREMENT_DURATION_YEARS; year++) {
          const retReturn = this.gaussianRandom(
            riskProfile.mean * 0.7,
            riskProfile.std * 0.7,
          );
          retirementBalance =
            retirementBalance * (1 + retReturn) -
            annualDrawdown * Math.pow(1 + inflationRate, year);
          if (retirementBalance <= 0) {
            survived = false;
            break;
          }
        }
        if (survived) successCount++;
      }

      const sorted = [...finalBalances].sort((a, b) => a - b);
      const medianBalance = this.percentile(sorted, 50);
      const monthlyIncome =
        (medianBalance * SAFE_WITHDRAWAL_RATE) / 12 +
        profile.socialSecurityEstimate +
        profile.pensionAmount;
      const successRate = (successCount / MONTE_CARLO_ITERATIONS) * 100;

      const inflatedDesired =
        profile.desiredMonthlyIncome *
        Math.pow(1 + inflationRate, yearsToRetirement);
      const incomeRatio = monthlyIncome / Math.max(inflatedDesired, 1);
      const readinessScore = Math.round(
        Math.min(
          100,
          successRate * 0.5 +
            Math.min(incomeRatio, 1) * 100 * 0.35 +
            Math.min(currentSavings / Math.max(medianBalance, 1), 1) *
              100 *
              0.15,
        ),
      );

      results.push({
        label: scenario.label,
        projectedBalance: Math.round(medianBalance * 100) / 100,
        monthlyIncome: Math.round(monthlyIncome * 100) / 100,
        successRate: Math.round(successRate * 10) / 10,
        readinessScore,
      });
    }

    return results;
  }
}
