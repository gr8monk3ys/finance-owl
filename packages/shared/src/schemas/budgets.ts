import { z } from 'zod';

export const budgetPeriodEnum = z.enum(['monthly', 'quarterly', 'yearly']);

// Defaults live only on the create schema (see accounts.ts).
const budgetFields = z.object({
  categoryId: z.uuid(),
  amount: z.number().positive(),
  period: budgetPeriodEnum,
  rollover: z.boolean(),
  rolloverCap: z.number().positive().optional(),
});

export const createBudgetSchema = budgetFields.extend({
  rollover: budgetFields.shape.rollover.default(false),
});

export const updateBudgetSchema = budgetFields.partial();

export type BudgetPeriod = z.infer<typeof budgetPeriodEnum>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
