/**
 * The single source of truth for subscription billing cadences.
 *
 * Six copies of this table used to live across the subscriptions module, and
 * they disagreed: the detection pipeline knew seven cadences while everything
 * downstream knew five, so a detected `bimonthly` or `semiannual` subscription
 * silently fell through to a monthly default in `/summary`, projected the wrong
 * savings, and was rejected outright by the create/update DTOs. The multipliers
 * had drifted too (weekly = 4.33/month in one table, 52/year in another), so two
 * endpoints reported different savings for the same user.
 *
 * Everything that needs to reason about a cadence -- validation, spend roll-ups,
 * savings projections, date projection, detection -- derives it from here.
 */

/** Every cadence the product understands, in ascending cycle length. */
export const SUBSCRIPTION_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
] as const;

export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];

/** Cadence assumed when a stored value is missing or unrecognised. */
export const DEFAULT_FREQUENCY: SubscriptionFrequency = 'monthly';

interface Cadence {
  /** Nominal length of one billing cycle, in days. */
  days: number;
  /** Charges per calendar year. Every multiplier is derived from this number. */
  chargesPerYear: number;
  /**
   * Median interval (in days) between charges that detection maps onto this
   * cadence. Windows are deliberately wide enough to absorb weekend shifts and
   * month-length variation, and must not overlap.
   */
  detectionRange: { min: number; max: number };
}

const CADENCES: Record<SubscriptionFrequency, Cadence> = {
  weekly: { days: 7, chargesPerYear: 52, detectionRange: { min: 5, max: 10 } },
  biweekly: { days: 14, chargesPerYear: 26, detectionRange: { min: 11, max: 18 } },
  monthly: { days: 30, chargesPerYear: 12, detectionRange: { min: 25, max: 36 } },
  bimonthly: { days: 60, chargesPerYear: 6, detectionRange: { min: 55, max: 70 } },
  quarterly: { days: 90, chargesPerYear: 4, detectionRange: { min: 80, max: 100 } },
  semiannual: { days: 182, chargesPerYear: 2, detectionRange: { min: 170, max: 200 } },
  annual: { days: 365, chargesPerYear: 1, detectionRange: { min: 340, max: 400 } },
};

/** Narrow an untrusted string (a DB column, a request body) to a known cadence. */
export function isSubscriptionFrequency(value: unknown): value is SubscriptionFrequency {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CADENCES, value);
}

function cadenceOf(frequency: string): Cadence {
  return isSubscriptionFrequency(frequency) ? CADENCES[frequency] : CADENCES[DEFAULT_FREQUENCY];
}

/** Nominal days in one billing cycle. Unknown cadences fall back to monthly. */
export function frequencyDays(frequency: string): number {
  return cadenceOf(frequency).days;
}

/** Charges per calendar year -- multiply an amount by this for annual spend. */
export function annualMultiplier(frequency: string): number {
  return cadenceOf(frequency).chargesPerYear;
}

/**
 * Multiply an amount by this for monthly spend. Derived from the annual figure
 * so a cadence can never report an annual total that disagrees with 12x its
 * monthly total.
 */
export function monthlyMultiplier(frequency: string): number {
  return cadenceOf(frequency).chargesPerYear / 12;
}

/**
 * Classify an observed median interval between charges. Returns null when the
 * interval matches no cadence, which is detection's signal to reject the group
 * rather than guess.
 */
export function frequencyForInterval(medianDays: number): SubscriptionFrequency | null {
  for (const frequency of SUBSCRIPTION_FREQUENCIES) {
    const { min, max } = CADENCES[frequency].detectionRange;
    if (medianDays >= min && medianDays <= max) {
      return frequency;
    }
  }
  return null;
}

/**
 * Advance a date by one billing cycle, calendar-aware for monthly and longer
 * cadences so a bill does not drift backwards through the year.
 */
export function addOneCycle(date: Date, frequency: string): Date {
  const next = new Date(date);

  switch (frequency) {
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'bimonthly':
      next.setUTCMonth(next.getUTCMonth() + 2);
      break;
    case 'quarterly':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'semiannual':
      next.setUTCMonth(next.getUTCMonth() + 6);
      break;
    case 'annual':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    default:
      next.setUTCDate(next.getUTCDate() + frequencyDays(frequency));
  }

  return next;
}
