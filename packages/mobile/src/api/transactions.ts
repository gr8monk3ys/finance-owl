import client from './client';
import type {
  Transaction,
  TransactionFilters,
  PaginatedResponse,
  CreateTransactionRequest,
} from '../types';

/**
 * List transactions with optional filters and pagination.
 */
export async function listTransactions(
  filters?: TransactionFilters,
): Promise<PaginatedResponse<Transaction>> {
  const { data } = await client.get<PaginatedResponse<Transaction>>('/transactions', {
    params: filters,
  });
  return data;
}

/**
 * Get a single transaction by ID.
 */
export async function getTransaction(id: string): Promise<Transaction> {
  const { data } = await client.get<Transaction>(`/transactions/${id}`);
  return data;
}

/**
 * Create a new manual transaction.
 */
export async function createTransaction(req: CreateTransactionRequest): Promise<Transaction> {
  const { data } = await client.post<Transaction>('/transactions', req);
  return data;
}

/**
 * Update a transaction (category, notes, name).
 */
export async function updateTransaction(
  id: string,
  updates: { categoryId?: string; notes?: string; name?: string },
): Promise<Transaction> {
  const { data } = await client.patch<Transaction>(`/transactions/${id}`, updates);
  return data;
}

/**
 * Delete a manual transaction.
 */
export async function deleteTransaction(id: string): Promise<void> {
  await client.delete(`/transactions/${id}`);
}
