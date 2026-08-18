import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} from './auth';
import { createAccountSchema, updateAccountSchema, accountTypeEnum } from './accounts';
import { createTransactionSchema, transactionFilterSchema } from './transactions';
import { createCategorySchema } from './categories';
import { createBudgetSchema, budgetPeriodEnum } from './budgets';
import { paginationSchema } from './pagination';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'Password1',
  };

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('requires at least one lowercase letter', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'PASSWORD1' }).success,
    ).toBe(false);
  });

  it('requires at least one uppercase letter', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'password1' }).success,
    ).toBe(false);
  });

  it('requires at least one digit', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'Passwordd' }).success,
    ).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const longPassword = 'A1' + 'a'.repeat(130);
    expect(
      registerSchema.safeParse({ ...valid, password: longPassword }).success,
    ).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts a valid password change', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'whatever',
      newPassword: 'NewPass1',
    });
    expect(result.success).toBe(true);
  });

  it('requires a non-empty current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPass1',
    });
    expect(result.success).toBe(false);
  });

  it('enforces complexity on the new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'whatever',
      newPassword: 'alllowercase1',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

describe('createAccountSchema', () => {
  it('applies defaults for balance, currency and isManual', () => {
    const result = createAccountSchema.parse({
      name: 'Checking',
      type: 'checking',
    });
    expect(result.balance).toBe(0);
    expect(result.currency).toBe('USD');
    expect(result.isManual).toBe(true);
  });

  it('rejects an unknown account type', () => {
    const result = createAccountSchema.safeParse({
      name: 'Mystery',
      type: 'crypto',
    });
    expect(result.success).toBe(false);
  });

  it('requires a 3-letter currency code', () => {
    const result = createAccountSchema.safeParse({
      name: 'Checking',
      type: 'checking',
      currency: 'DOLLAR',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = createAccountSchema.safeParse({ name: '', type: 'savings' });
    expect(result.success).toBe(false);
  });
});

describe('updateAccountSchema', () => {
  it('allows partial updates', () => {
    expect(updateAccountSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
    expect(updateAccountSchema.safeParse({}).success).toBe(true);
  });
});

describe('accountTypeEnum', () => {
  it('exposes every supported account type', () => {
    expect(accountTypeEnum.options).toEqual([
      'checking',
      'savings',
      'credit_card',
      'investment',
      'loan',
      'mortgage',
      'other',
    ]);
  });
});

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------

describe('createTransactionSchema', () => {
  const valid = {
    accountId: UUID,
    amount: -42.5,
    name: 'Coffee',
    date: '2026-06-24',
  };

  it('accepts a valid transaction and defaults pending to false', () => {
    const result = createTransactionSchema.parse(valid);
    expect(result.pending).toBe(false);
  });

  it('allows negative and positive amounts', () => {
    expect(createTransactionSchema.safeParse({ ...valid, amount: 100 }).success).toBe(
      true,
    );
    expect(createTransactionSchema.safeParse({ ...valid, amount: -100 }).success).toBe(
      true,
    );
  });

  it('rejects an invalid accountId', () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, accountId: 'nope' }).success,
    ).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, date: '06/24/2026' }).success,
    ).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(createTransactionSchema.safeParse({ ...valid, name: '' }).success).toBe(
      false,
    );
  });
});

describe('transactionFilterSchema', () => {
  it('coerces page/limit strings and applies defaults', () => {
    const result = transactionFilterSchema.parse({ page: '2', limit: '25' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
  });

  it('defaults page to 1 and limit to 50 when omitted', () => {
    const result = transactionFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('rejects a limit above 100', () => {
    expect(transactionFilterSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------

describe('createCategorySchema', () => {
  it('accepts a valid hex color', () => {
    expect(
      createCategorySchema.safeParse({ name: 'Food', color: '#1a2B3c' }).success,
    ).toBe(true);
  });

  it('rejects a non-hex color', () => {
    expect(
      createCategorySchema.safeParse({ name: 'Food', color: 'red' }).success,
    ).toBe(false);
  });

  it('rejects a 3-digit shorthand hex color', () => {
    expect(
      createCategorySchema.safeParse({ name: 'Food', color: '#abc' }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid parentId', () => {
    expect(
      createCategorySchema.safeParse({ name: 'Food', parentId: 'parent' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// budgets
// ---------------------------------------------------------------------------

describe('createBudgetSchema', () => {
  const valid = {
    categoryId: UUID,
    amount: 500,
    period: 'monthly' as const,
  };

  it('accepts a valid budget and defaults rollover to false', () => {
    const result = createBudgetSchema.parse(valid);
    expect(result.rollover).toBe(false);
  });

  it('rejects a non-positive amount', () => {
    expect(createBudgetSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(createBudgetSchema.safeParse({ ...valid, amount: -5 }).success).toBe(false);
  });

  it('rejects an unknown period', () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, period: 'weekly' }).success,
    ).toBe(false);
  });
});

describe('budgetPeriodEnum', () => {
  it('exposes monthly, quarterly and yearly', () => {
    expect(budgetPeriodEnum.options).toEqual(['monthly', 'quarterly', 'yearly']);
  });
});

// ---------------------------------------------------------------------------
// pagination
// ---------------------------------------------------------------------------

describe('paginationSchema', () => {
  it('applies defaults when nothing is provided', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('coerces numeric strings', () => {
    const result = paginationSchema.parse({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('rejects a non-positive page', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('caps limit at 100', () => {
    expect(paginationSchema.safeParse({ limit: 100 }).success).toBe(true);
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
