import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoCategorizationService } from './auto-categorization.service';
import { CategorizationEngineService } from './categorization.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 */
function mockQuery(data: any) {
  const chain: any = {};
  const methods = ['select', 'from', 'where', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('AutoCategorizationService', () => {
  let service: AutoCategorizationService;
  let mockDb: any;
  const mockUserId = 'user-123';

  beforeEach(() => {
    mockDb = { select: vi.fn() };
    service = new AutoCategorizationService(mockDb, new CategorizationEngineService());
  });

  it('resolves a category id from the matching parent + child category rows', async () => {
    // Netflix matches the merchant database exactly: category "Entertainment",
    // subcategory "Streaming Services".
    mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'parent-entertainment' }]));
    mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'child-streaming' }]));

    const result = await service.categorize({
      userId: mockUserId,
      description: 'Monthly billing',
      merchantName: 'Netflix',
    });

    expect(result).toEqual({ categoryId: 'child-streaming', source: 'rule' });
  });

  it('falls back to the parent category id when no matching child row exists', async () => {
    mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'parent-entertainment' }]));
    mockDb.select.mockReturnValueOnce(mockQuery([])); // no child row

    const result = await service.categorize({
      userId: mockUserId,
      description: 'Monthly billing',
      merchantName: 'Netflix',
    });

    expect(result).toEqual({ categoryId: 'parent-entertainment', source: 'rule' });
  });

  it('returns null when no parent category row matches', async () => {
    mockDb.select.mockReturnValueOnce(mockQuery([])); // no parent row

    const result = await service.categorize({
      userId: mockUserId,
      description: 'Monthly billing',
      merchantName: 'Netflix',
    });

    expect(result).toEqual({ categoryId: null, source: null });
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('returns null without touching the database when the engine cannot categorize', async () => {
    const result = await service.categorize({
      userId: mockUserId,
      description: 'zzz totally unknown merchant string qqq',
    });

    expect(result).toEqual({ categoryId: null, source: null });
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
