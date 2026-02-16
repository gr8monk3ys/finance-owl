import {
  pgTable,
  text,
  real,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

/**
 * Stores computed financial health scores over time.
 * Each row is a point-in-time snapshot of a user's financial health,
 * broken down by the six scoring components (0-100 overall).
 */
export const financialHealthScores = pgTable(
  'financial_health_scores',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Overall composite score, 0-100. */
    overallScore: integer('overall_score').notNull(),

    // ── Component scores (max points shown in comment) ──────────────
    /** Emergency fund coverage: 0-20 */
    emergencyFundScore: integer('emergency_fund_score').notNull(),
    /** Debt-to-income ratio: 0-20 */
    debtToIncomeScore: integer('debt_to_income_score').notNull(),
    /** Savings rate as % of income: 0-20 */
    savingsRateScore: integer('savings_rate_score').notNull(),
    /** Budget adherence: 0-15 */
    budgetAdherenceScore: integer('budget_adherence_score').notNull(),
    /** On-time bill payment rate: 0-15 */
    billPaymentScore: integer('bill_payment_score').notNull(),
    /** Net worth growth trend: 0-10 */
    netWorthTrendScore: integer('net_worth_trend_score').notNull(),

    // ── Raw metrics (stored for transparency / debugging) ───────────
    /** Months of expenses covered by liquid savings. */
    emergencyFundMonths: real('emergency_fund_months'),
    /** Monthly debt payments / monthly gross income. */
    debtToIncomeRatio: real('debt_to_income_ratio'),
    /** (Income - Spending) / Income for the month. */
    savingsRatePercent: real('savings_rate_percent'),
    /** Average budget over/under percent (negative = under). */
    budgetVariancePercent: real('budget_variance_percent'),
    /** On-time bill payment rate 0-1. */
    billPaymentRate: real('bill_payment_rate'),
    /** Net worth change over trailing 3 months (dollar amount). */
    netWorthChangeAmount: numeric('net_worth_change_amount', {
      precision: 19,
      scale: 4,
    }).$type<number>(),
    /** Net worth monthly growth rate (decimal, e.g. 0.02 = 2%). */
    netWorthGrowthRate: real('net_worth_growth_rate'),

    // ── Breakdown JSON (component explanations + recommendations) ───
    /** JSON: per-component explanation strings. */
    breakdown: text('breakdown'),
    /** JSON: actionable recommendations based on weakest areas. */
    recommendations: text('recommendations'),

    // ── Peer comparison ─────────────────────────────────────────────
    /** Percentile rank among peers in the same demographic. */
    percentileRank: integer('percentile_rank'),
    /** Demographic cohort key used for percentile (e.g. "25-34:50k_75k"). */
    peerCohort: text('peer_cohort'),

    calculatedAt: text('calculated_at').notNull().default('now()'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('fhs_user_calculated_idx').on(table.userId, table.calculatedAt),
  ],
);

/**
 * User-defined financial health improvement goals tied to score components.
 */
export const financialHealthGoals = pgTable('financial_health_goals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // emergency_fund, debt_to_income, savings_rate, budget_adherence, bill_payment, net_worth_trend
  targetValue: numeric('target_value', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull(),
  currentValue: numeric('current_value', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull()
    .default(0),
  description: text('description'),
  isAchieved: boolean('is_achieved').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Tracks significant score changes to power notifications.
 * A row is inserted whenever the overall score changes by >= threshold.
 */
export const financialHealthAlerts = pgTable('financial_health_alerts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  previousScore: integer('previous_score').notNull(),
  newScore: integer('new_score').notNull(),
  changeAmount: integer('change_amount').notNull(),
  direction: text('direction').notNull(), // 'improved' | 'declined'
  /** JSON: which components drove the change. */
  drivers: text('drivers'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
