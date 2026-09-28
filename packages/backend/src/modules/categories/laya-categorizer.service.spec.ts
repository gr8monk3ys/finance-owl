import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LayaCategorizerService } from './laya-categorizer.service';
import { ImportService } from '../import/import.service';
import { TransactionsService } from '../transactions/transactions.service';

/** Chainable Drizzle stand-in: every builder method returns the chain; awaiting yields `data`. */
function mockQuery(data: any) {
  const chain: any = {};
  for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'values', 'returning']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as any;
}

const CATEGORIES = [
  { id: 'sys-food', name: 'Food & Dining', userId: null },
  { id: 'sys-travel', name: 'Travel', userId: null },
  { id: 'user-food', name: 'Food & Dining', userId: 'user-1' },
];

function layaReply(choice: string, confidence: number, ok = true) {
  return {
    ok,
    json: async () => ({ answers: { category: { choice, answer_confidence: confidence } } }),
  };
}

describe('LayaCategorizerService', () => {
  const fetchMock = vi.fn();
  let db: any;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    db = { select: vi.fn().mockReturnValue(mockQuery(CATEGORIES)) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is disabled and never calls out when LAYA_URL is unset', async () => {
    const service = new LayaCategorizerService(db, config({}));

    expect(service.enabled).toBe(false);
    expect(await service.suggest('user-1', { name: 'UBER TRIP' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("asks one choice question over the user's categories and maps the answer to an id", async () => {
    fetchMock.mockResolvedValue(layaReply('Food & Dining', 0.9));
    const service = new LayaCategorizerService(
      db,
      config({ LAYA_URL: 'http://laya.test:8000/', LAYA_API_KEY: 'secret' }),
    );

    const result = await service.suggest('user-1', {
      name: 'SQ *BLUE BOTTLE',
      merchantName: 'Blue Bottle Coffee',
      amount: 6.5,
    });

    // The user's own "Food & Dining" wins over the system default of the same name.
    expect(result).toEqual({
      categoryId: 'user-food',
      categoryName: 'Food & Dining',
      confidence: 0.9,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://laya.test:8000/v1/systemone');
    expect(init.headers.Authorization).toBe('Bearer secret');
    const body = JSON.parse(init.body);
    expect(body.state).toContain('Blue Bottle Coffee');
    expect(body.questions.category.type).toBe('choice');
    expect(Object.keys(body.questions.category.criteria)).toEqual(['Food & Dining', 'Travel']);
  });

  it('returns nothing below the confidence floor', async () => {
    fetchMock.mockResolvedValue(layaReply('Travel', 0.75));
    const service = new LayaCategorizerService(
      db,
      config({ LAYA_URL: 'http://laya.test', LAYA_CATEGORIZE_MIN_CONFIDENCE: '0.8' }),
    );

    expect(await service.suggest('user-1', { name: 'DELTA AIR' })).toBeNull();
  });

  it('returns nothing for an answer outside the options, an error status or a network failure', async () => {
    const service = new LayaCategorizerService(db, config({ LAYA_URL: 'http://laya.test' }));

    fetchMock.mockResolvedValueOnce(layaReply('Groceries', 0.99));
    expect(await service.suggest('user-1', { name: 'x' })).toBeNull();

    fetchMock.mockResolvedValueOnce(layaReply('Travel', 0.99, false));
    expect(await service.suggest('user-1', { name: 'x' })).toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await service.suggest('user-1', { name: 'x' })).toBeNull();
  });
});

describe('laya wiring', () => {
  const suggestion = { categoryId: 'cat-travel', categoryName: 'Travel', confidence: 0.9 };

  it('createManual stores a laya suggestion as source "ai" when no category is given', async () => {
    const insertChain = mockQuery([{ id: 'txn-1' }]);
    const db: any = {
      select: vi.fn().mockReturnValueOnce(mockQuery([{ id: 'acct-1' }])),
      insert: vi.fn().mockReturnValueOnce(insertChain),
    };
    const cache: any = { delPattern: vi.fn().mockResolvedValue(0), del: vi.fn() };
    const laya: any = { enabled: true, suggest: vi.fn().mockResolvedValue(suggestion) };
    const service = new TransactionsService(db, cache, laya);

    await service.createManual('user-1', {
      accountId: 'acct-1',
      amount: 120,
      name: 'DELTA AIR LINES',
      date: '2026-09-01',
    });

    expect(laya.suggest).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'DELTA AIR LINES' }),
    );
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-travel', categorizationSource: 'ai' }),
    );
  });

  it('createManual never asks laya when the client chose a category', async () => {
    const db: any = {
      select: vi
        .fn()
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1' }]))
        .mockReturnValueOnce(mockQuery([{ id: 'cat-1' }])),
      insert: vi.fn().mockReturnValueOnce(mockQuery([{ id: 'txn-1' }])),
    };
    const cache: any = { delPattern: vi.fn().mockResolvedValue(0), del: vi.fn() };
    const laya: any = { enabled: true, suggest: vi.fn() };
    const service = new TransactionsService(db, cache, laya);

    await service.createManual('user-1', {
      accountId: 'acct-1',
      amount: 5,
      name: 'Coffee',
      categoryId: 'cat-1',
      date: '2026-09-01',
    });

    expect(laya.suggest).not.toHaveBeenCalled();
  });

  it('executeImport asks once per merchant and tags the rows it categorised', async () => {
    const insertA = mockQuery([{ id: 'txn-1' }]);
    const insertB = mockQuery([{ id: 'txn-2' }]);
    const db: any = {
      select: vi
        .fn()
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1', userId: 'user-1' }]))
        .mockReturnValueOnce(mockQuery([])),
      insert: vi
        .fn()
        .mockReturnValueOnce(insertA)
        .mockReturnValueOnce(insertB)
        .mockReturnValueOnce(mockQuery(undefined)),
    };
    const laya: any = { enabled: true, suggest: vi.fn().mockResolvedValue(suggestion) };
    const service = new ImportService(db, laya);

    await service.executeImport(
      'user-1',
      [
        { date: '2026-09-01', name: 'DELTA AIR 123', amount: 120, merchantName: 'Delta' },
        { date: '2026-09-02', name: 'DELTA AIR 456', amount: 80, merchantName: 'Delta' },
      ],
      'acct-1',
      { skipDuplicates: true } as any,
      'statement.csv',
      'csv',
    );

    expect(laya.suggest).toHaveBeenCalledTimes(1);
    for (const chain of [insertA, insertB]) {
      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-travel', categorizationSource: 'ai' }),
      );
    }
  });

  it('executeImport leaves rows untouched when laya is disabled', async () => {
    const insertA = mockQuery([{ id: 'txn-1' }]);
    const db: any = {
      select: vi
        .fn()
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1', userId: 'user-1' }]))
        .mockReturnValueOnce(mockQuery([])),
      insert: vi.fn().mockReturnValueOnce(insertA).mockReturnValueOnce(mockQuery(undefined)),
    };
    const laya: any = { enabled: false, suggest: vi.fn() };
    const service = new ImportService(db, laya);

    await service.executeImport(
      'user-1',
      [{ date: '2026-09-01', name: 'Coffee', amount: 4.5 }],
      'acct-1',
      { skipDuplicates: true } as any,
      'statement.csv',
      'csv',
    );

    expect(laya.suggest).not.toHaveBeenCalled();
    expect(insertA.values).toHaveBeenCalledWith(
      expect.not.objectContaining({ categoryId: expect.anything() }),
    );
  });
});
