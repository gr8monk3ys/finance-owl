import { describe, expect, it } from 'vitest';
import {
  getBudgetCategoryIcon,
  getBudgetCategoryTree,
  getBudgetProgressGradient,
  getBudgetProgressTextColor,
  getBudgetStatusBadge,
} from './budgets';

describe('budget utils', () => {
  it('builds a parent-child category tree', () => {
    const tree = getBudgetCategoryTree([
      { id: 'housing', name: 'Housing' },
      { id: 'rent', name: 'Rent', parentId: 'housing' },
      { id: 'utilities', name: 'Utilities', parentId: 'housing' },
      { id: 'travel', name: 'Travel' },
    ]);

    expect(tree).toEqual([
      {
        id: 'housing',
        name: 'Housing',
        children: [
          { id: 'rent', name: 'Rent', parentId: 'housing' },
          { id: 'utilities', name: 'Utilities', parentId: 'housing' },
        ],
      },
      {
        id: 'travel',
        name: 'Travel',
        children: [],
      },
    ]);
  });

  it('returns consistent budget badges by utilization tier', () => {
    expect(getBudgetStatusBadge(110).label).toBe('Over Budget');
    expect(getBudgetStatusBadge(85).label).toBe('Near Limit');
    expect(getBudgetStatusBadge(60).label).toBe('On Track');
    expect(getBudgetStatusBadge(25).label).toBe('Under Budget');
  });

  it('maps utilization tiers to text colors and gradients', () => {
    expect(getBudgetProgressTextColor(101)).toBe('text-red-400');
    expect(getBudgetProgressTextColor(85)).toBe('text-accent-400');
    expect(getBudgetProgressTextColor(40)).toBe('text-primary-400');

    expect(getBudgetProgressGradient(110)).toContain('var(--fo-danger-500)');
    expect(getBudgetProgressGradient(85)).toContain('var(--fo-accent-500)');
    expect(getBudgetProgressGradient(60)).toContain('var(--fo-primary-500)');
    expect(getBudgetProgressGradient(30)).toContain('var(--fo-primary-600)');
  });

  it('derives category icons from common names', () => {
    expect(getBudgetCategoryIcon('Groceries')).toBe('F');
    expect(getBudgetCategoryIcon('Transportation')).toBe('T');
    expect(getBudgetCategoryIcon('Shopping')).toBe('S');
    expect(getBudgetCategoryIcon('Travel')).toBe('V');
    expect(getBudgetCategoryIcon('Misc')).toBe('M');
    expect(getBudgetCategoryIcon(null)).toBe('?');
  });
});
