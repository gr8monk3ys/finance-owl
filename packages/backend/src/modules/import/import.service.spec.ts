import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportService } from './import.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 */
function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('ImportService', () => {
  let service: ImportService;
  let mockDb: any;
  let mockCategorizationService: any;

  const mockUserId = 'user-123';
  const mockAccountId = 'acct-456';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockCategorizationService = {
      categorize: vi.fn(),
    };

    service = new ImportService(mockDb, mockCategorizationService);
  });

  // ===========================================================================
  // CSV Parsing
  // ===========================================================================
  describe('parseCSV', () => {
    it('should parse a generic CSV with date, description, and amount columns', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee Shop,4.50',
        '2026-01-16,Grocery Store,52.30',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toMatchObject({
        date: '2026-01-15',
        name: 'Coffee Shop',
        amount: 4.50,
      });
      expect(result.transactions[1]).toMatchObject({
        date: '2026-01-16',
        name: 'Grocery Store',
        amount: 52.30,
      });
    });

    it('should detect the generic format', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee Shop,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.detectedFormat).toBe('generic');
      expect(result.mapping).toEqual(
        expect.objectContaining({
          date: 0,
          description: 1,
          amount: 2,
        }),
      );
    });

    it('should detect Mint CSV format', () => {
      const csv = [
        'Date,Description,Original Description,Amount,Transaction Type,Category,Account Name',
        '01/15/2026,Starbucks,STARBUCKS #123,4.50,debit,Food & Drink,Chase Checking',
        '01/16/2026,Paycheck,EMPLOYER DIRECT DEP,2500.00,credit,Income,Chase Checking',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.detectedFormat).toBe('mint');
      expect(result.transactions).toHaveLength(2);
      // Mint debit = positive (expense)
      expect(result.transactions[0].amount).toBe(4.50);
      // Mint credit = negative (income)
      expect(result.transactions[1].amount).toBe(-2500.00);
    });

    it('should detect YNAB CSV format', () => {
      const csv = [
        'Account,Date,Payee,Category,Memo,Outflow,Inflow',
        'Checking,2026-01-15,Coffee Shop,Food,Morning latte,4.50,0',
        'Checking,2026-01-16,Salary,Income,Monthly paycheck,0,3000.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.detectedFormat).toBe('ynab');
      expect(result.transactions).toHaveLength(2);
      // YNAB mapping picks Memo (index 4) as description since Math.max(payee=2, memo=4) = 4
      expect(result.transactions[0].name).toBe('Morning latte');
      // YNAB: outflow - inflow
      expect(result.transactions[0].amount).toBe(4.50);
      expect(result.transactions[1].amount).toBe(-3000.00);
    });

    it('should detect bank debit/credit format', () => {
      const csv = [
        'Date,Description,Debit,Credit',
        '2026-01-15,ATM Withdrawal,200.00,',
        '2026-01-16,Direct Deposit,,3500.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.detectedFormat).toBe('bank_debit_credit');
      expect(result.transactions).toHaveLength(2);
      // Debit is positive
      expect(result.transactions[0].amount).toBe(200.00);
      // Credit is negative
      expect(result.transactions[1].amount).toBe(-3500.00);
    });

    it('should use a custom column mapping when provided', () => {
      const csv = [
        'When,What,How Much',
        '2026-03-01,Rent Payment,1200.00',
      ].join('\n');

      const mapping = { date: 0, description: 1, amount: 2 };
      const result = service.parseCSV(Buffer.from(csv), mapping);

      expect(result.detectedFormat).toBe('custom');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        date: '2026-03-01',
        name: 'Rent Payment',
        amount: 1200.00,
      });
    });

    it('should handle quoted fields containing commas', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,"Smith, John - Payment",150.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].name).toBe('Smith, John - Payment');
    });

    it('should handle escaped double quotes in CSV fields', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,"Payment ""Ref #42""",75.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].name).toBe('Payment "Ref #42"');
    });

    it('should handle Windows-style CRLF line endings', () => {
      const csv = 'Date,Description,Amount\r\n2026-01-15,Coffee,4.50\r\n2026-01-16,Lunch,12.00';

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(2);
    });

    it('should include category when CSV has a category column', () => {
      const csv = [
        'Date,Description,Amount,Category',
        '2026-01-15,Coffee Shop,4.50,Food & Drink',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].category).toBe('Food & Drink');
    });

    it('should limit preview rows to 100', () => {
      const headerLine = 'Date,Description,Amount';
      const dataLines = Array.from(
        { length: 150 },
        (_, i) => `2026-01-01,Item ${i},${(i + 1).toFixed(2)}`,
      );
      const csv = [headerLine, ...dataLines].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.rows.length).toBeLessThanOrEqual(100);
      expect(result.transactions).toHaveLength(150);
    });

    it('should skip rows with fewer than 2 cells', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee Shop,4.50',
        'orphan',
        '2026-01-16,Lunch,12.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(2);
    });

    it('should skip rows with missing or invalid date', () => {
      const csv = [
        'Date,Description,Amount',
        ',Coffee Shop,4.50',
        '2026-01-16,Lunch,12.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].name).toBe('Lunch');
    });

    it('should skip rows where amount is NaN', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee Shop,not_a_number',
        '2026-01-16,Lunch,12.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].name).toBe('Lunch');
    });

    it('should skip blank/empty rows', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee Shop,4.50',
        '  ,  ,  ',
        '2026-01-16,Lunch,12.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(2);
    });
  });

  // ===========================================================================
  // CSV Validation / Error Handling
  // ===========================================================================
  describe('parseCSV - error handling', () => {
    it('should throw BadRequestException for a file with only a header row', () => {
      const csv = 'Date,Description,Amount';

      expect(() => service.parseCSV(Buffer.from(csv))).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for an empty file', () => {
      expect(() => service.parseCSV(Buffer.from(''))).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for a single-line file', () => {
      const csv = 'just-one-line';

      expect(() => service.parseCSV(Buffer.from(csv))).toThrow(
        BadRequestException,
      );
    });

    it('should return zero transactions if all data rows are invalid', () => {
      const csv = [
        'Date,Description,Amount',
        ',,,',
        ',,,',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Date Normalization
  // ===========================================================================
  describe('parseCSV - date normalization', () => {
    it('should parse MM/DD/YYYY dates', () => {
      const csv = [
        'Date,Description,Amount',
        '01/15/2026,Coffee,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].date).toBe('2026-01-15');
    });

    it('should parse MM-DD-YYYY dates', () => {
      const csv = [
        'Date,Description,Amount',
        '01-15-2026,Coffee,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].date).toBe('2026-01-15');
    });

    it('should parse YYYY/MM/DD dates', () => {
      const csv = [
        'Date,Description,Amount',
        '2026/01/15,Coffee,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].date).toBe('2026-01-15');
    });

    it('should preserve YYYY-MM-DD dates', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].date).toBe('2026-01-15');
    });

    it('should pad single-digit month and day in MM/DD/YYYY', () => {
      const csv = [
        'Date,Description,Amount',
        '1/5/2026,Coffee,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].date).toBe('2026-01-05');
    });
  });

  // ===========================================================================
  // Number Parsing
  // ===========================================================================
  describe('parseCSV - number parsing', () => {
    it('should strip dollar sign from amounts', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Coffee,$4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(4.50);
    });

    it('should strip commas from amounts', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Rent,"1,200.00"',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(1200.00);
    });

    it('should handle parenthetical negative notation', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Refund,(50.00)',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(-50.00);
    });

    it('should handle euro symbol in amounts', () => {
      const csv = [
        'Date,Description,Amount',
        "2026-01-15,Coffee,\u20AC4.50",
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(4.50);
    });

    it('should handle pound symbol in amounts', () => {
      const csv = [
        'Date,Description,Amount',
        "2026-01-15,Coffee,\u00A34.50",
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(4.50);
    });
  });

  // ===========================================================================
  // OFX/QFX Parsing
  // ===========================================================================
  describe('parseOFX', () => {
    it('should parse OFX 1.x (SGML) format', () => {
      const ofx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115120000
<TRNAMT>-42.50
<FITID>TXN001
<NAME>STARBUCKS COFFEE
<MEMO>Purchase at store #123
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260116120000
<TRNAMT>2500.00
<FITID>TXN002
<NAME>EMPLOYER PAYROLL
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(2);
      // OFX negative (debit) -> stored as positive (expense, Plaid convention)
      expect(result[0]).toMatchObject({
        date: '2026-01-15',
        name: 'STARBUCKS COFFEE',
        amount: 42.50,
        fitId: 'TXN001',
        memo: 'Purchase at store #123',
      });
      // OFX positive (credit) -> stored as negative (income)
      expect(result[1]).toMatchObject({
        date: '2026-01-16',
        name: 'EMPLOYER PAYROLL',
        amount: -2500.00,
        fitId: 'TXN002',
      });
    });

    it('should parse OFX 2.x (XML) format', () => {
      const ofx = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260115</DTPOSTED>
<TRNAMT>-15.99</TRNAMT>
<FITID>XML001</FITID>
<NAME>NETFLIX</NAME>
<MEMO>Monthly subscription</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2026-01-15',
        name: 'NETFLIX',
        amount: 15.99,
        fitId: 'XML001',
        memo: 'Monthly subscription',
      });
    });

    it('should handle OFX dates with timezone brackets', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260115120000[-5:EST]
<TRNAMT>-10.00
<FITID>TZ001
<NAME>Test Purchase
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-01-15');
    });

    it('should fall back to MEMO when NAME is missing', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260115
<TRNAMT>-25.00
<FITID>MEMO001
<MEMO>ATM WITHDRAWAL
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ATM WITHDRAWAL');
    });

    it('should skip transactions with missing DTPOSTED', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNAMT>-10.00
<FITID>NO_DATE
<NAME>Missing Date
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260116
<TRNAMT>-20.00
<FITID>HAS_DATE
<NAME>Has Date
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(1);
      expect(result[0].fitId).toBe('HAS_DATE');
    });

    it('should skip transactions with missing TRNAMT', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260115
<FITID>NO_AMT
<NAME>No Amount
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(0);
    });

    it('should return empty array for OFX with no transactions', () => {
      const ofx = `
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(0);
    });

    it('should handle OFX date with invalid year/month/day and skip that transaction', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>00001320
<TRNAMT>-10.00
<FITID>BAD_DATE
<NAME>Bad Date
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(0);
    });

    it('should parse multiple transactions from SGML OFX', () => {
      const transactions = Array.from(
        { length: 5 },
        (_, i) => `
<STMTTRN>
<DTPOSTED>2026011${i + 1}
<TRNAMT>-${(i + 1) * 10}.00
<FITID>MULTI${i}
<NAME>Transaction ${i}
</STMTTRN>`,
      ).join('\n');

      const ofx = `<OFX><BANKTRANLIST>${transactions}</BANKTRANLIST></OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(5);
    });
  });

  // ===========================================================================
  // Field Mapping
  // ===========================================================================
  describe('field mapping', () => {
    it('should map non-standard column names with auto-detection', () => {
      const csv = [
        'Transaction Date,Payee,Total Amount',
        '2026-01-15,Coffee Shop,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        date: '2026-01-15',
        name: 'Coffee Shop',
        amount: 4.50,
      });
    });

    it('should support custom mapping with non-sequential column indices', () => {
      const csv = [
        'ID,Notes,Amount,Name,Date',
        '1,Monthly bill,99.99,Electric Company,2026-02-01',
      ].join('\n');

      const mapping = { date: 4, description: 3, amount: 2 };
      const result = service.parseCSV(Buffer.from(csv), mapping);

      expect(result.transactions[0]).toMatchObject({
        date: '2026-02-01',
        name: 'Electric Company',
        amount: 99.99,
      });
    });

    it('should map debit and credit columns in custom mapping', () => {
      const csv = [
        'Date,Memo,Debit,Credit',
        '2026-01-15,Purchase,100.00,',
        '2026-01-16,Refund,,50.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(100.00); // debit
      expect(result.transactions[1].amount).toBe(-50.00); // credit
    });

    it('should use column index 0 for date when no date header found', () => {
      const csv = [
        'Col A,Col B,Amount',
        '2026-01-15,Something,50.00',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      // autoMapColumns falls back to index 0 for date
      expect(result.mapping.date).toBe(0);
    });
  });

  // ===========================================================================
  // Duplicate Detection (previewImport)
  // ===========================================================================
  describe('previewImport', () => {
    it('should flag duplicates based on date/amount/name', async () => {
      const existingTxs = [
        { date: '2026-01-15', amount: 4.50, name: 'Coffee Shop' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(existingTxs));

      const parsed = [
        { date: '2026-01-15', name: 'Coffee Shop', amount: 4.50 },
        { date: '2026-01-16', name: 'Lunch', amount: 12.00 },
      ];

      const result = await service.previewImport(
        mockUserId,
        parsed,
        mockAccountId,
      );

      expect(result).toHaveLength(2);
      expect(result[0].isDuplicate).toBe(true);
      expect(result[0].selected).toBe(false);
      expect(result[1].isDuplicate).toBe(false);
      expect(result[1].selected).toBe(true);
    });

    it('should use case-insensitive comparison for duplicate detection', async () => {
      const existingTxs = [
        { date: '2026-01-15', amount: 4.50, name: 'COFFEE SHOP' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(existingTxs));

      const parsed = [
        { date: '2026-01-15', name: 'coffee shop', amount: 4.50 },
      ];

      const result = await service.previewImport(
        mockUserId,
        parsed,
        mockAccountId,
      );

      expect(result[0].isDuplicate).toBe(true);
    });

    it('should not flag transactions with different amounts as duplicates', async () => {
      const existingTxs = [
        { date: '2026-01-15', amount: 4.50, name: 'Coffee Shop' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(existingTxs));

      const parsed = [
        { date: '2026-01-15', name: 'Coffee Shop', amount: 5.00 },
      ];

      const result = await service.previewImport(
        mockUserId,
        parsed,
        mockAccountId,
      );

      expect(result[0].isDuplicate).toBe(false);
      expect(result[0].selected).toBe(true);
    });

    it('should assign rowIndex to each preview row', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const parsed = [
        { date: '2026-01-15', name: 'A', amount: 1 },
        { date: '2026-01-16', name: 'B', amount: 2 },
        { date: '2026-01-17', name: 'C', amount: 3 },
      ];

      const result = await service.previewImport(
        mockUserId,
        parsed,
        mockAccountId,
      );

      expect(result[0].rowIndex).toBe(0);
      expect(result[1].rowIndex).toBe(1);
      expect(result[2].rowIndex).toBe(2);
    });

    it('should handle preview with no existing transactions', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const parsed = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
      ];

      const result = await service.previewImport(
        mockUserId,
        parsed,
        mockAccountId,
      );

      expect(result[0].isDuplicate).toBe(false);
      expect(result[0].selected).toBe(true);
    });
  });

  // ===========================================================================
  // Execute Import
  // ===========================================================================
  describe('executeImport', () => {
    const baseOptions = { skipDuplicates: true };

    it('should import transactions and return counts', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // Existing transactions query (empty - no duplicates)
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert two transactions
      const insertChain1 = mockQuery([{ id: 'txn-1' }]);
      const insertChain2 = mockQuery([{ id: 'txn-2' }]);
      mockDb.insert
        .mockReturnValueOnce(insertChain1)
        .mockReturnValueOnce(insertChain2);

      // Categorization returns null for both
      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history insert
      const historyChain = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(historyChain);

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
        { date: '2026-01-16', name: 'Lunch', amount: 12.00 },
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'test.csv',
        'csv',
      );

      expect(result).toEqual({
        importedCount: 2,
        skippedCount: 0,
        duplicateCount: 0,
        totalRows: 2,
      });
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // Existing transactions
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ date: '2026-01-15', amount: 4.50, name: 'Coffee' }]),
      );

      // Insert for the non-duplicate transaction
      const insertChain = mockQuery([{ id: 'txn-1' }]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history insert
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 }, // duplicate
        { date: '2026-01-16', name: 'Lunch', amount: 12.00 }, // new
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        { skipDuplicates: true },
        'test.csv',
        'csv',
      );

      expect(result.importedCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should import duplicates when skipDuplicates is false', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // Existing transactions
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ date: '2026-01-15', amount: 4.50, name: 'Coffee' }]),
      );

      // Insert for both transactions (even the duplicate)
      mockDb.insert
        .mockReturnValueOnce(mockQuery([{ id: 'txn-1' }]))
        .mockReturnValueOnce(mockQuery([{ id: 'txn-2' }]));

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history insert
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
        { date: '2026-01-16', name: 'Lunch', amount: 12.00 },
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        { skipDuplicates: false },
        'test.csv',
        'csv',
      );

      expect(result.importedCount).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.skippedCount).toBe(0);
    });

    it('should throw BadRequestException when account does not exist', async () => {
      // Account lookup returns empty
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.executeImport(
          mockUserId,
          [{ date: '2026-01-15', name: 'Test', amount: 10 }],
          'non-existent-account',
          baseOptions,
          'test.csv',
          'csv',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-categorize imported transactions', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert transaction
      mockDb.insert.mockReturnValueOnce(mockQuery([{ id: 'txn-1' }]));

      // Categorization succeeds
      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: 'cat-food',
        source: 'ai',
      });

      // Update with category
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
      ];

      await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'test.csv',
        'csv',
      );

      expect(mockCategorizationService.categorize).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ name: 'Coffee' }),
      );
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should continue import when auto-categorization fails', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert transaction
      mockDb.insert.mockReturnValueOnce(mockQuery([{ id: 'txn-1' }]));

      // Categorization throws error
      mockCategorizationService.categorize.mockRejectedValue(
        new Error('AI service unavailable'),
      );

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'test.csv',
        'csv',
      );

      // Should still succeed - categorization failure is non-fatal
      expect(result.importedCount).toBe(1);
    });

    it('should set fitId in notes when provided', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert transaction
      const insertChain = mockQuery([{ id: 'txn-1' }]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        {
          date: '2026-01-15',
          name: 'Coffee',
          amount: 4.50,
          fitId: 'OFX123',
        },
      ];

      await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'test.ofx',
        'ofx',
      );

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Imported (FITID: OFX123)',
        }),
      );
    });

    it('should record import history after import', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert transaction
      mockDb.insert.mockReturnValueOnce(mockQuery([{ id: 'txn-1' }]));

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history insert
      const historyChain = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(historyChain);

      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
      ];

      await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'myfile.csv',
        'csv',
      );

      expect(historyChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          fileName: 'myfile.csv',
          fileType: 'csv',
          accountId: mockAccountId,
          totalRows: 1,
          importedCount: 1,
        }),
      );
    });

    it('should prevent within-batch duplicates by updating existingSet', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions in DB
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert for first instance only (second should be skipped as duplicate)
      mockDb.insert.mockReturnValueOnce(mockQuery([{ id: 'txn-1' }]));

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      // Two identical transactions in the same batch
      const transactions = [
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
        { date: '2026-01-15', name: 'Coffee', amount: 4.50 },
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        { skipDuplicates: true },
        'test.csv',
        'csv',
      );

      expect(result.importedCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should handle empty transaction array', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.executeImport(
        mockUserId,
        [],
        mockAccountId,
        baseOptions,
        'empty.csv',
        'csv',
      );

      expect(result).toEqual({
        importedCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        totalRows: 0,
      });
    });

    it('should skip and count a transaction when insert fails', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // First insert fails
      const failChain: any = {};
      const methods = [
        'select', 'from', 'where', 'leftJoin', 'innerJoin', 'orderBy',
        'limit', 'offset', 'set', 'values', 'returning', 'groupBy',
      ];
      for (const m of methods) {
        failChain[m] = vi.fn().mockReturnValue(failChain);
      }
      failChain.then = (_resolve: any, reject?: any) => {
        const err = new Error('DB constraint violation');
        if (reject) return reject(err);
        return Promise.reject(err);
      };
      mockDb.insert.mockReturnValueOnce(failChain);

      // Second insert succeeds
      mockDb.insert.mockReturnValueOnce(mockQuery([{ id: 'txn-2' }]));

      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      // Import history
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const transactions = [
        { date: '2026-01-15', name: 'Bad Txn', amount: 1.00 },
        { date: '2026-01-16', name: 'Good Txn', amount: 2.00 },
      ];

      const result = await service.executeImport(
        mockUserId,
        transactions,
        mockAccountId,
        baseOptions,
        'test.csv',
        'csv',
      );

      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should store columnMapping as JSON string in import history', async () => {
      // Account lookup
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: mockAccountId, userId: mockUserId }]),
      );

      // No existing transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Import history
      const historyChain = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(historyChain);

      const columnMapping = { date: 0, description: 1, amount: 2 };

      await service.executeImport(
        mockUserId,
        [],
        mockAccountId,
        baseOptions,
        'test.csv',
        'csv',
        columnMapping,
      );

      expect(historyChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          columnMapping: JSON.stringify(columnMapping),
        }),
      );
    });
  });

  // ===========================================================================
  // Import History
  // ===========================================================================
  describe('getImportHistory', () => {
    it('should return import history for user', async () => {
      const historyRecords = [
        {
          id: 'hist-1',
          fileName: 'test.csv',
          fileType: 'csv',
          accountId: mockAccountId,
          totalRows: 10,
          importedCount: 8,
          skippedCount: 2,
          duplicateCount: 2,
          columnMapping: null,
          importedAt: '2026-01-15T10:00:00Z',
          accountName: 'Checking',
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(historyRecords));

      const result = await service.getImportHistory(mockUserId);

      expect(result).toEqual(historyRecords);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when user has no imports', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getImportHistory(mockUserId);

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // Supported Formats
  // ===========================================================================
  describe('getSupportedFormats', () => {
    it('should return all supported file formats', () => {
      const formats = service.getSupportedFormats();

      expect(formats).toHaveLength(5);
      const keys = formats.map((f) => f.key);
      expect(keys).toContain('generic');
      expect(keys).toContain('mint');
      expect(keys).toContain('ynab');
      expect(keys).toContain('bank_debit_credit');
      expect(keys).toContain('ofx');
    });

    it('should include expected columns for each format', () => {
      const formats = service.getSupportedFormats();

      for (const format of formats) {
        expect(format.expectedColumns).toBeDefined();
        expect(format.expectedColumns.length).toBeGreaterThan(0);
        expect(format.name).toBeDefined();
        expect(format.description).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle a large CSV (1000 rows) without error', () => {
      const headerLine = 'Date,Description,Amount';
      const dataLines = Array.from(
        { length: 1000 },
        (_, i) => `2026-01-01,Transaction ${i},${(i * 1.5).toFixed(2)}`,
      );
      const csv = [headerLine, ...dataLines].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1000);
      expect(result.rows.length).toBeLessThanOrEqual(100); // Preview capped
    });

    it('should handle CSV with extra trailing commas', () => {
      const csv = [
        'Date,Description,Amount,',
        '2026-01-15,Coffee,4.50,',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
    });

    it('should handle zero-amount transactions in CSV', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Balance Inquiry,0',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(0);
    });

    it('should handle negative amounts in generic CSV', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,Refund,-25.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].amount).toBe(-25.50);
    });

    it('should handle OFX with very short date (less than 8 chars) and skip', () => {
      const ofx = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>2026
<TRNAMT>-10.00
<FITID>SHORT
<NAME>Short Date
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = service.parseOFX(Buffer.from(ofx));

      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from descriptions', () => {
      const csv = [
        'Date,Description,Amount',
        '2026-01-15,  Coffee Shop  ,4.50',
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv));

      expect(result.transactions[0].name).toBe('Coffee Shop');
    });

    it('should handle UTF-8 encoded file content', () => {
      const csv = [
        'Date,Description,Amount',
        "2026-01-15,Caf\u00E9 au Lait,4.50",
      ].join('\n');

      const result = service.parseCSV(Buffer.from(csv, 'utf-8'));

      expect(result.transactions[0].name).toBe('Caf\u00E9 au Lait');
    });
  });
});
