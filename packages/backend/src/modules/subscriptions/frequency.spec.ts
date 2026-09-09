import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_FREQUENCIES,
  DEFAULT_FREQUENCY,
  isSubscriptionFrequency,
  frequencyDays,
  annualMultiplier,
  monthlyMultiplier,
  frequencyForInterval,
  addOneCycle,
} from './frequency';

describe('frequency', () => {
  describe('SUBSCRIPTION_FREQUENCIES', () => {
    it('covers every cadence detection can emit', () => {
      expect([...SUBSCRIPTION_FREQUENCIES]).toEqual([
        'weekly',
        'biweekly',
        'monthly',
        'bimonthly',
        'quarterly',
        'semiannual',
        'annual',
      ]);
    });

    it('includes the cadences the DTOs used to reject', () => {
      // The regression this module exists to prevent: detection emitted these
      // two, then @IsIn refused to let the user edit what it had created.
      expect(SUBSCRIPTION_FREQUENCIES).toContain('bimonthly');
      expect(SUBSCRIPTION_FREQUENCIES).toContain('semiannual');
    });
  });

  describe('isSubscriptionFrequency', () => {
    it.each(SUBSCRIPTION_FREQUENCIES)('accepts %s', (frequency) => {
      expect(isSubscriptionFrequency(frequency)).toBe(true);
    });

    it('rejects unknown strings and non-strings', () => {
      expect(isSubscriptionFrequency('fortnightly')).toBe(false);
      expect(isSubscriptionFrequency('')).toBe(false);
      expect(isSubscriptionFrequency(null)).toBe(false);
      expect(isSubscriptionFrequency(undefined)).toBe(false);
      expect(isSubscriptionFrequency(30)).toBe(false);
    });

    it('is not fooled by inherited Object properties', () => {
      expect(isSubscriptionFrequency('constructor')).toBe(false);
      expect(isSubscriptionFrequency('toString')).toBe(false);
    });
  });

  describe('frequencyDays', () => {
    it('returns the nominal cycle length', () => {
      expect(frequencyDays('weekly')).toBe(7);
      expect(frequencyDays('biweekly')).toBe(14);
      expect(frequencyDays('monthly')).toBe(30);
      expect(frequencyDays('bimonthly')).toBe(60);
      expect(frequencyDays('quarterly')).toBe(90);
      expect(frequencyDays('semiannual')).toBe(182);
      expect(frequencyDays('annual')).toBe(365);
    });

    it('falls back to monthly for unknown cadences', () => {
      expect(frequencyDays('nonsense')).toBe(frequencyDays(DEFAULT_FREQUENCY));
    });
  });

  describe('annualMultiplier', () => {
    it('returns charges per year', () => {
      expect(annualMultiplier('weekly')).toBe(52);
      expect(annualMultiplier('biweekly')).toBe(26);
      expect(annualMultiplier('monthly')).toBe(12);
      expect(annualMultiplier('bimonthly')).toBe(6);
      expect(annualMultiplier('quarterly')).toBe(4);
      expect(annualMultiplier('semiannual')).toBe(2);
      expect(annualMultiplier('annual')).toBe(1);
    });

    it('falls back to monthly for unknown cadences', () => {
      expect(annualMultiplier('nonsense')).toBe(12);
    });
  });

  describe('monthlyMultiplier', () => {
    it('is exactly one twelfth of the annual multiplier for every cadence', () => {
      // The old tables disagreed here: weekly was 4.33/month in one place and
      // 52/year in another, so the same user saw two different savings numbers.
      for (const frequency of SUBSCRIPTION_FREQUENCIES) {
        expect(monthlyMultiplier(frequency) * 12).toBeCloseTo(annualMultiplier(frequency), 10);
      }
    });

    it('leaves monthly untouched', () => {
      expect(monthlyMultiplier('monthly')).toBe(1);
    });

    it('falls back to monthly for unknown cadences', () => {
      expect(monthlyMultiplier('nonsense')).toBe(1);
    });
  });

  describe('frequencyForInterval', () => {
    it.each([
      [7, 'weekly'],
      [14, 'biweekly'],
      [30, 'monthly'],
      [31, 'monthly'],
      [60, 'bimonthly'],
      [91, 'quarterly'],
      [182, 'semiannual'],
      [365, 'annual'],
    ])('maps a %d-day median interval to %s', (days, expected) => {
      expect(frequencyForInterval(days)).toBe(expected);
    });

    it('returns null for intervals that match no cadence', () => {
      expect(frequencyForInterval(2)).toBeNull();
      expect(frequencyForInterval(22)).toBeNull();
      expect(frequencyForInterval(45)).toBeNull();
      expect(frequencyForInterval(130)).toBeNull();
      expect(frequencyForInterval(500)).toBeNull();
    });

    it('has no overlapping detection windows', () => {
      const hits = new Map<number, string[]>();
      for (let days = 1; days <= 420; days++) {
        const match = frequencyForInterval(days);
        if (match) {
          hits.set(days, [...(hits.get(days) ?? []), match]);
        }
      }
      for (const matches of hits.values()) {
        expect(matches).toHaveLength(1);
      }
    });
  });

  describe('addOneCycle', () => {
    it('adds whole days for sub-monthly cadences', () => {
      expect(addOneCycle(new Date(Date.UTC(2024, 0, 1)), 'weekly').toISOString()).toBe(
        new Date(Date.UTC(2024, 0, 8)).toISOString(),
      );
      expect(addOneCycle(new Date(Date.UTC(2024, 0, 1)), 'biweekly').toISOString()).toBe(
        new Date(Date.UTC(2024, 0, 15)).toISOString(),
      );
    });

    it('is calendar-aware for monthly and longer cadences', () => {
      const feb = addOneCycle(new Date(Date.UTC(2024, 0, 15)), 'monthly');
      expect(feb.getUTCMonth()).toBe(1);
      expect(feb.getUTCDate()).toBe(15);

      const nextYear = addOneCycle(new Date(Date.UTC(2024, 5, 30)), 'annual');
      expect(nextYear.getUTCFullYear()).toBe(2025);
      expect(nextYear.getUTCMonth()).toBe(5);
      expect(nextYear.getUTCDate()).toBe(30);

      const semi = addOneCycle(new Date(Date.UTC(2024, 0, 31)), 'semiannual');
      expect(semi.getUTCMonth()).toBe(6);
      expect(semi.getUTCDate()).toBe(31);
    });

    it('does not mutate the input date', () => {
      const start = new Date(Date.UTC(2024, 0, 1));
      addOneCycle(start, 'annual');
      expect(start.toISOString()).toBe(new Date(Date.UTC(2024, 0, 1)).toISOString());
    });

    it('advances unknown cadences by the monthly fallback in days', () => {
      const next = addOneCycle(new Date(Date.UTC(2024, 0, 1)), 'nonsense');
      expect(next.toISOString()).toBe(new Date(Date.UTC(2024, 0, 31)).toISOString());
    });
  });
});
