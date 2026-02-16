import { z } from 'zod';

export const budgetPeriodEnum = z.enum(['monthly', 'quarterly', 'yearly']);

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  period: budgetPeriodEnum,
  rollover: z.boolean().default(false),
  rolloverCap: z.number().positive().optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export type BudgetPeriod = z.infer<typeof budgetPeriodEnum>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
