import client from './client';
import type { Account, NetWorth } from '../types';

/**
 * List all accounts for the current user.
 */
export async function listAccounts(): Promise<Account[]> {
  const { data } = await client.get<Account[]>('/accounts');
  return data;
}

/**
 * Get net worth summary.
 */
export async function getNetWorth(): Promise<NetWorth> {
  const { data } = await client.get<NetWorth>('/accounts/net-worth');
  return data;
}

/**
 * Get a single account by ID.
 */
export async function getAccount(id: string): Promise<Account> {
  const { data } = await client.get<Account>(`/accounts/${id}`);
  return data;
}
