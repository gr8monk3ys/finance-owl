import type { PlanTier } from '@finance-owl/shared';

export type BillingInterval = 'month' | 'year';

/** Every tier we actually sell through Stripe. `free` has no price. */
export type PaidPlanTier = Exclude<PlanTier, 'free'>;

export interface StripePriceSlot {
  readonly plan: PaidPlanTier;
  readonly interval: BillingInterval;
  readonly envVar: string;
}

/**
 * The single source of truth for the plan <-> Stripe price relationship.
 *
 * Both directions (plan+interval -> price ID for checkout, price ID -> plan for
 * webhooks) and the startup env validation read this one table, so they cannot
 * drift apart or disagree about which price means which plan.
 */
export const STRIPE_PRICE_SLOTS: readonly StripePriceSlot[] = [
  { plan: 'pro', interval: 'month', envVar: 'STRIPE_PRICE_PRO_MONTHLY' },
  { plan: 'pro', interval: 'year', envVar: 'STRIPE_PRICE_PRO_YEARLY' },
  { plan: 'premium', interval: 'month', envVar: 'STRIPE_PRICE_PREMIUM_MONTHLY' },
  { plan: 'premium', interval: 'year', envVar: 'STRIPE_PRICE_PREMIUM_YEARLY' },
];

export const STRIPE_PRICE_ENV_VARS: readonly string[] = STRIPE_PRICE_SLOTS.map(
  (slot) => slot.envVar,
);

export type StripePriceLookup = (envVar: string) => string | undefined | null;

function slotKey(plan: PlanTier, interval: BillingInterval): string {
  return `${plan}:${interval}`;
}

/**
 * Resolved view of {@link STRIPE_PRICE_SLOTS} for the current environment.
 *
 * A price ID that is not configured (or that is configured for two different
 * plans) resolves to `undefined` rather than to a plan, so callers are forced
 * to treat it as an error instead of silently downgrading a paying customer.
 */
export class StripePriceCatalog {
  /** price ID -> plan, or `null` when two different plans claim the same price. */
  private readonly planByPriceId = new Map<string, PaidPlanTier | null>();
  private readonly priceIdBySlot = new Map<string, string>();
  private readonly configured: string[] = [];

  constructor(lookup: StripePriceLookup) {
    for (const slot of STRIPE_PRICE_SLOTS) {
      const priceId = lookup(slot.envVar)?.trim();
      if (!priceId) continue;

      this.configured.push(slot.envVar);
      this.priceIdBySlot.set(slotKey(slot.plan, slot.interval), priceId);

      const existing = this.planByPriceId.get(priceId);
      if (existing !== undefined && existing !== slot.plan) {
        // Same price ID configured for two different plans: refuse to guess.
        this.planByPriceId.set(priceId, null);
      } else {
        this.planByPriceId.set(priceId, slot.plan);
      }
    }
  }

  /** Stripe price ID to charge for a plan + interval, or undefined if unconfigured. */
  priceIdFor(plan: PlanTier, interval: BillingInterval): string | undefined {
    return this.priceIdBySlot.get(slotKey(plan, interval));
  }

  /** Plan a Stripe price ID belongs to, or undefined when it is unknown/ambiguous. */
  planForPriceId(priceId: string): PaidPlanTier | undefined {
    return this.planByPriceId.get(priceId) ?? undefined;
  }

  /** Env vars that actually carry a price ID, for diagnostics. */
  configuredEnvVars(): readonly string[] {
    return this.configured;
  }
}

/**
 * Thrown when a Stripe price ID cannot be mapped to a plan.
 *
 * This is deliberately an error and not a `free` fallback: a mis-configured or
 * newly created price must fail the webhook (Stripe retries, we get alerted)
 * rather than downgrade a customer who is being charged.
 */
export class UnknownStripePriceError extends Error {
  constructor(
    readonly priceId: string | null,
    configuredEnvVars: readonly string[],
  ) {
    super(
      `Cannot map Stripe price ${priceId ? `"${priceId}"` : '(missing)'} to a plan. ` +
        `Configured price env vars: ${configuredEnvVars.length ? configuredEnvVars.join(', ') : '(none)'}. ` +
        'Refusing to guess a plan — set the correct STRIPE_PRICE_* variable and replay the event.',
    );
    this.name = 'UnknownStripePriceError';
  }
}
