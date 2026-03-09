import client from './client';
import type { Category } from '../types';

/**
 * List all system and user categories available to the current user.
 */
export async function listCategories(): Promise<Category[]> {
  const { data } = await client.get<Category[]>('/categories');
  return data;
}
