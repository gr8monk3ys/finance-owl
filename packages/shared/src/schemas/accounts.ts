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

export const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: accountTypeEnum,
  institutionName: z.string().max(255).optional(),
  balance: z.number().default(0),
  currency: z.string().length(3).default('USD'),
  isManual: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial();

export type AccountType = z.infer<typeof accountTypeEnum>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
