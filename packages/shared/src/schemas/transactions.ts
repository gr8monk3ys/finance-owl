import { z } from 'zod';

// Defaults live only on the create schema (see accounts.ts).
const transactionFields = z.object({
  accountId: z.uuid(),
  amount: z.number(),
  name: z.string().min(1).max(500),
  merchantName: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pending: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const createTransactionSchema = transactionFields.extend({
  pending: transactionFields.shape.pending.default(false),
});

export const updateTransactionSchema = transactionFields.partial().omit({ accountId: true });

export const transactionFilterSchema = z.object({
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  search: z.string().optional(),
  pending: z.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
