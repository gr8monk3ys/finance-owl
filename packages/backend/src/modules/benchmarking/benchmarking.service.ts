import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// Default benchmark data seeded per income/age cohort
const DEFAULT_BENCHMARKS: Record<
  string,
  { averageSpending: number; averageSavingsRate: number; averageDebtRatio: number }
> = {
  'under_25k': { averageSpending: 1800, averageSavingsRate: 5, averageDebtRatio: 45 },
  '25k_50k': { averageSpending: 2800, averageSavingsRate: 10, averageDebtRatio: 38 },
  '50k_75k': { averageSpending: 3800, averageSavingsRate: 14, averageDebtRatio: 30 },
  '75k_100k': { averageSpending: 4800, averageSavingsRate: 18, averageDebtRatio: 25 },
  '100k_150k': { averageSpending: 6200, averageSavingsRate: 22, averageDebtRatio: 20 },
  '150k_plus': { averageSpending: 8500, averageSavingsRate: 28, averageDebtRatio: 15 },
};

export interface BenchmarkComparison {
  metric: string;
  userValue: number;
  peerAverage: number;
  difference: number;
  percentDifference: number;
  status: 'better' | 'worse' | 'similar';
}

@Injectable()
export class BenchmarkingService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getProfile(userId: string) {
    const [profile] = await this.db
      .select()
      .from(schema.benchmarkProfiles)
      .where(eq(schema.benchmarkProfiles.userId, userId))
      .limit(1);

    return profile ?? null;
  }

  async upsertProfile(
    userId: string,
    data: {
      ageRange: string;
      incomeRange: string;
      region?: string;
      householdSize?: number;
      isOptedIn?: boolean;
    },
  ) {
    const existing = await this.getProfile(userId);

    if (existing) {
      const [updated] = await this.db
        .update(schema.benchmarkProfiles)
        .set({
          ageRange: data.ageRange,
          incomeRange: data.incomeRange,
          region: data.region ?? existing.region,
          householdSize: data.householdSize ?? existing.householdSize,
          isOptedIn: data.isOptedIn ?? existing.isOptedIn,
          updatedAt: new Date(),
        })
        .where(eq(schema.benchmarkProfiles.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.benchmarkProfiles)
      .values({
        userId,
        ageRange: data.ageRange,
        incomeRange: data.incomeRange,
        region: data.region,
        householdSize: data.householdSize ?? 1,
        isOptedIn: data.isOptedIn ?? false,
      })
      .returning();

    return created;
  }

  async getBenchmarks(userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) throw new NotFoundException('Benchmark profile not found. Please set up your profile first.');

    // Look for stored benchmark data matching the user's cohort
    const storedBenchmarks = await this.db
      .select()
      .from(schema.benchmarkData)
      .where(
        and(
          eq(schema.benchmarkData.ageRange, profile.ageRange),
          eq(schema.benchmarkData.incomeRange, profile.incomeRange),
        ),
      );

    // If no stored data, return defaults for this income range
    if (storedBenchmarks.length === 0) {
      const defaults = DEFAULT_BENCHMARKS[profile.incomeRange] ?? DEFAULT_BENCHMARKS['50k_75k'];
      return {
        ageRange: profile.ageRange,
        incomeRange: profile.incomeRange,
        averageSpending: defaults.averageSpending,
        averageSavingsRate: defaults.averageSavingsRate,
        averageDebtRatio: defaults.averageDebtRatio,
        sampleSize: 0,
        source: 'default' as const,
      };
    }

    // Aggregate stored benchmarks
    const totalSampleSize = storedBenchmarks.reduce((sum, b) => sum + b.sampleSize, 0);
    const weightedSpending = storedBenchmarks.reduce(
      (sum, b) => sum + b.averageSpending * b.sampleSize,
      0,
    );
    const weightedSavingsRate = storedBenchmarks.reduce(
      (sum, b) => sum + b.averageSavingsRate * b.sampleSize,
      0,
    );
    const weightedDebtRatio = storedBenchmarks.reduce(
      (sum, b) => sum + b.averageDebtRatio * b.sampleSize,
      0,
    );

    return {
      ageRange: profile.ageRange,
      incomeRange: profile.incomeRange,
      averageSpending: totalSampleSize > 0
        ? Math.round((weightedSpending / totalSampleSize) * 100) / 100
        : 0,
      averageSavingsRate: totalSampleSize > 0
        ? Math.round((weightedSavingsRate / totalSampleSize) * 100) / 100
        : 0,
      averageDebtRatio: totalSampleSize > 0
        ? Math.round((weightedDebtRatio / totalSampleSize) * 100) / 100
        : 0,
      sampleSize: totalSampleSize,
      source: 'aggregated' as const,
    };
  }

  async getComparison(userId: string): Promise<BenchmarkComparison[]> {
    const profile = await this.getProfile(userId);
    if (!profile) throw new NotFoundException('Benchmark profile not found. Please set up your profile first.');

    const benchmarks = await this.getBenchmarks(userId);

    // Calculate user's actual monthly spending (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const [spendingResult] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END), 0)`.as('total'),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} >= ${startDate}`,
          eq(schema.transactions.pending, false),
        ),
      );

    const userSpending = spendingResult?.total ?? 0;

    // Calculate user's savings rate from income vs spending
    const [incomeResult] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} < 0 THEN ABS(${schema.transactions.amount}) ELSE 0 END), 0)`.as('total'),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} >= ${startDate}`,
          eq(schema.transactions.pending, false),
        ),
      );

    const userIncome = incomeResult?.total ?? 0;
    const userSavingsRate = userIncome > 0
      ? Math.round(((userIncome - userSpending) / userIncome) * 100 * 100) / 100
      : 0;

    // Calculate user's debt ratio from account balances
    const accounts = await this.db
      .select({
        type: schema.accounts.type,
        balance: schema.accounts.currentBalance,
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      );

    const totalAssets = accounts
      .filter((a) => a.type !== 'credit' && a.type !== 'loan')
      .reduce((sum, a) => sum + Math.abs(a.balance ?? 0), 0);
    const totalDebt = accounts
      .filter((a) => a.type === 'credit' || a.type === 'loan')
      .reduce((sum, a) => sum + Math.abs(a.balance ?? 0), 0);
    const userDebtRatio = totalAssets > 0
      ? Math.round((totalDebt / totalAssets) * 100 * 100) / 100
      : 0;

    return [
      buildComparison('Monthly Spending', userSpending, benchmarks.averageSpending, 'lower'),
      buildComparison('Savings Rate (%)', userSavingsRate, benchmarks.averageSavingsRate, 'higher'),
      buildComparison('Debt Ratio (%)', userDebtRatio, benchmarks.averageDebtRatio, 'lower'),
    ];
  }
}

function buildComparison(
  metric: string,
  userValue: number,
  peerAverage: number,
  betterWhen: 'higher' | 'lower',
): BenchmarkComparison {
  const difference = Math.round((userValue - peerAverage) * 100) / 100;
  const percentDifference = peerAverage > 0
    ? Math.round((difference / peerAverage) * 100 * 100) / 100
    : 0;

  const threshold = 5; // percent difference threshold for "similar"
  let status: 'better' | 'worse' | 'similar';

  if (Math.abs(percentDifference) <= threshold) {
    status = 'similar';
  } else if (betterWhen === 'lower') {
    status = difference < 0 ? 'better' : 'worse';
  } else {
    status = difference > 0 ? 'better' : 'worse';
  }

  return {
    metric,
    userValue: Math.round(userValue * 100) / 100,
    peerAverage: Math.round(peerAverage * 100) / 100,
    difference,
    percentDifference,
    status,
  };
}
