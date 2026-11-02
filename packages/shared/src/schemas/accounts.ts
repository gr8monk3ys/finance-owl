import { z } from 'zod';

export const accountTypeEnum = z.enum([
  'checking',
  'savings',
  'credit_card',
  'investment',
  'loan',
  'mortgage',
  'other',
]);

// Defaults live only on the create schema. Zod 4 applies defaults inside
// optional fields, so deriving the update schema from a defaulted one would
// fill omitted fields of a partial update with their defaults.
const accountFields = z.object({
  name: z.string().min(1).max(255),
  type: accountTypeEnum,
  institutionName: z.string().max(255).optional(),
  balance: z.number(),
  currency: z.string().length(3),
  isManual: z.boolean(),
});

export const createAccountSchema = accountFields.extend({
  balance: accountFields.shape.balance.default(0),
  currency: accountFields.shape.currency.default('USD'),
  isManual: accountFields.shape.isManual.default(true),
});

export const updateAccountSchema = accountFields.partial();

export type AccountType = z.infer<typeof accountTypeEnum>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
