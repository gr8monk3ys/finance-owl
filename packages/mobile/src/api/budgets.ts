import client from './client';
import type { Budget, BudgetSummary, CreateBudgetRequest, UpdateBudgetRequest } from '../types';

/**
 * List all budgets with spending progress for the current period.
 */
export async function listBudgets(): Promise<Budget[]> {
  const { data } = await client.get<Budget[]>('/budgets');
  return data;
}

/**
 * Get a combined budget summary.
 */
export async function getBudgetSummary(): Promise<BudgetSummary> {
  const { data } = await client.get<BudgetSummary>('/budgets/summary');
  return data;
}

/**
 * Get a single budget by ID.
 */
export async function getBudget(id: string): Promise<Budget> {
  const { data } = await client.get<Budget>(`/budgets/${id}`);
  return data;
}

/**
 * Create a new budget.
 */
export async function createBudget(req: CreateBudgetRequest): Promise<Budget> {
  const { data } = await client.post<Budget>('/budgets', req);
  return data;
}

/**
 * Update an existing budget.
 */
export async function updateBudget(id: string, updates: UpdateBudgetRequest): Promise<Budget> {
  const { data } = await client.patch<Budget>(`/budgets/${id}`, updates);
  return data;
}

/**
 * Delete a budget.
 */
export async function deleteBudget(id: string): Promise<void> {
  await client.delete(`/budgets/${id}`);
}
