import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CategorizationService } from '../ai/categorization.service';
import * as schema from '../../database/schema';
import { importHistory } from './import.schema';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  category?: string;
  merchantName?: string;
  memo?: string;
  fitId?: string; // OFX unique ID
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  category?: number;
  debit?: number;
  credit?: number;
}

export interface PreviewRow extends ParsedTransaction {
  isDuplicate: boolean;
  selected: boolean;
  rowIndex: number;
}

export interface ImportOptions {
  skipDuplicates: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private categorizationService: CategorizationService,
  ) {}

  // ── CSV Parsing ─────────────────────────────────────────────────────────

  parseCSV(
    fileBuffer: Buffer,
    mappingConfig?: ColumnMapping,
  ): {
    headers: string[];
    rows: string[][];
    detectedFormat: string;
    mapping: ColumnMapping;
    transactions: ParsedTransaction[];
  } {
    const content = fileBuffer.toString('utf-8').trim();
    const lines = content.split(/\r?\n/);

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV file must have at least a header row and one data row',
      );
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows = lines
      .slice(1)
      .map((line) => this.parseCSVLine(line))
      .filter((row) => row.length > 0 && row.some((cell) => cell.trim()));

    // Auto-detect format or use provided mapping
    let mapping: ColumnMapping;
    let detectedFormat = 'custom';

    if (mappingConfig) {
      mapping = mappingConfig;
      detectedFormat = 'custom';
    } else {
      const result = this.detectCSVFormat(headers);
      mapping = result.mapping;
      detectedFormat = result.format;
    }

    // Parse transactions using the mapping
    const transactions = this.parseCSVRows(
      headers,
      rows,
      mapping,
      detectedFormat,
    );

    return {
      headers,
      rows: rows.slice(0, 100), // Return max 100 rows for preview
      detectedFormat,
      mapping,
      transactions,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  private detectCSVFormat(headers: string[]): {
    format: string;
    mapping: ColumnMapping;
  } {
    const normalized = headers.map((h) => h.trim());
    const lower = normalized.map((h) => h.toLowerCase());

    // Mint detection
    if (
      lower.includes('date') &&
      lower.includes('description') &&
      lower.includes('transaction type') &&
      lower.includes('amount')
    ) {
      return {
        format: 'mint',
        mapping: this.buildMappingFromHeaders(normalized, 'mint'),
      };
    }

    // YNAB detection
    if (
      lower.includes('date') &&
      lower.includes('payee') &&
      (lower.includes('outflow') || lower.includes('inflow'))
    ) {
      return {
        format: 'ynab',
        mapping: this.buildMappingFromHeaders(normalized, 'ynab'),
      };
    }

    // Bank debit/credit detection
    if (
      lower.includes('date') &&
      lower.includes('description') &&
      (lower.includes('debit') || lower.includes('credit'))
    ) {
      return {
        format: 'bank_debit_credit',
        mapping: this.buildMappingFromHeaders(normalized, 'bank_debit_credit'),
      };
    }

    // Generic detection
    if (
      lower.some((c) => c.includes('date')) &&
      lower.some((c) => c.includes('amount')) &&
      lower.some(
        (c) =>
          c.includes('description') ||
          c.includes('name') ||
          c.includes('memo') ||
          c.includes('payee'),
      )
    ) {
      return {
        format: 'generic',
        mapping: this.autoMapColumns(normalized),
      };
    }

    // Fallback
    return {
      format: 'generic',
      mapping: this.autoMapColumns(normalized),
    };
  }

  private buildMappingFromHeaders(
    headers: string[],
    formatKey: string,
  ): ColumnMapping {
    const lower = headers.map((h) => h.toLowerCase().trim());

    switch (formatKey) {
      case 'mint': {
        return {
          date: lower.indexOf('date'),
          description: lower.indexOf('description'),
          amount: lower.indexOf('amount'),
          category: lower.indexOf('category'),
        };
      }
      case 'ynab': {
        return {
          date: lower.indexOf('date'),
          description: Math.max(
            lower.indexOf('payee'),
            lower.indexOf('memo'),
          ),
          amount: lower.indexOf('outflow'),
        };
      }
      case 'bank_debit_credit': {
        return {
          date: lower.indexOf('date'),
          description: lower.indexOf('description'),
          amount: -1,
          debit: lower.indexOf('debit'),
          credit: lower.indexOf('credit'),
        };
      }
      default:
        return this.autoMapColumns(headers);
    }
  }

  private autoMapColumns(headers: string[]): ColumnMapping {
    const lower = headers.map((h) => h.toLowerCase().trim());

    const dateIdx = lower.findIndex(
      (h) =>
        h === 'date' ||
        h === 'transaction date' ||
        h === 'posted date' ||
        h.includes('date'),
    );

    const descIdx = lower.findIndex(
      (h) =>
        h === 'description' ||
        h === 'name' ||
        h === 'payee' ||
        h === 'memo' ||
        h.includes('description') ||
        h.includes('payee'),
    );

    const amountIdx = lower.findIndex(
      (h) => h === 'amount' || h === 'total' || h.includes('amount'),
    );

    const categoryIdx = lower.findIndex(
      (h) => h === 'category' || h.includes('category'),
    );

    const debitIdx = lower.findIndex(
      (h) => h === 'debit' || h === 'withdrawal' || h.includes('debit'),
    );

    const creditIdx = lower.findIndex(
      (h) => h === 'credit' || h === 'deposit' || h.includes('credit'),
    );

    const mapping: ColumnMapping = {
      date: dateIdx >= 0 ? dateIdx : 0,
      description: descIdx >= 0 ? descIdx : 1,
      amount: amountIdx >= 0 ? amountIdx : 2,
    };

    if (categoryIdx >= 0) mapping.category = categoryIdx;
    if (debitIdx >= 0) mapping.debit = debitIdx;
    if (creditIdx >= 0) mapping.credit = creditIdx;

    return mapping;
  }

  private parseCSVRows(
    headers: string[],
    rows: string[][],
    mapping: ColumnMapping,
    formatKey: string,
  ): ParsedTransaction[] {
    const lower = headers.map((h) => h.toLowerCase().trim());
    const transactions: ParsedTransaction[] = [];

    for (const row of rows) {
      if (row.length < 2) continue;

      try {
        const dateRaw = row[mapping.date] || '';
        const description = row[mapping.description] || '';
        const date = this.normalizeDate(dateRaw);

        if (!date || !description) continue;

        let amount: number;

        if (formatKey === 'ynab') {
          const outflowIdx = lower.indexOf('outflow');
          const inflowIdx = lower.indexOf('inflow');
          const outflow = this.parseNumber(row[outflowIdx] || '0');
          const inflow = this.parseNumber(row[inflowIdx] || '0');
          amount = outflow - inflow;
        } else if (formatKey === 'mint') {
          const typeIdx = lower.indexOf('transaction type');
          const rawAmount = this.parseNumber(row[mapping.amount] || '0');
          const txType = (row[typeIdx] || '').toLowerCase().trim();
          amount = txType === 'credit' ? -rawAmount : rawAmount;
        } else if (
          mapping.debit !== undefined &&
          mapping.debit >= 0 &&
          mapping.credit !== undefined &&
          mapping.credit >= 0
        ) {
          const debit = this.parseNumber(row[mapping.debit] || '0');
          const credit = this.parseNumber(row[mapping.credit] || '0');
          amount = debit > 0 ? debit : -credit;
        } else {
          amount = this.parseNumber(row[mapping.amount] || '0');
        }

        if (isNaN(amount)) continue;

        const tx: ParsedTransaction = {
          date,
          name: description.trim(),
          amount,
        };

        if (
          mapping.category !== undefined &&
          mapping.category >= 0 &&
          row[mapping.category]
        ) {
          tx.category = row[mapping.category].trim();
        }

        transactions.push(tx);
      } catch (err) {
        this.logger.debug(`Skipping CSV row: ${err}`);
        continue;
      }
    }

    return transactions;
  }

  // ── OFX/QFX Parsing ────────────────────────────────────────────────────

  parseOFX(fileBuffer: Buffer): ParsedTransaction[] {
    const content = fileBuffer.toString('utf-8');

    // Determine if OFX 2.x (XML) or 1.x (SGML)
    const isXML = content.includes('<?xml') || content.includes('<?OFX');

    if (isXML) {
      return this.parseOFXXml(content);
    }

    return this.parseOFXSgml(content);
  }

  private parseOFXSgml(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const stmtTrnRegex =
      /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST))/gi;
    let match: RegExpExecArray | null;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const block = match[1];

      const dtPosted = this.extractOFXTag(block, 'DTPOSTED');
      const trnAmt = this.extractOFXTag(block, 'TRNAMT');
      const name =
        this.extractOFXTag(block, 'NAME') ||
        this.extractOFXTag(block, 'MEMO') ||
        'Unknown';
      const memo = this.extractOFXTag(block, 'MEMO');
      const fitId = this.extractOFXTag(block, 'FITID');

      if (!dtPosted || !trnAmt) continue;

      const date = this.parseOFXDate(dtPosted);
      const amount = parseFloat(trnAmt);

      if (!date || isNaN(amount)) continue;

      transactions.push({
        date,
        name: name.trim(),
        // OFX: negative = debit (expense), positive = credit (income)
        // We store expenses as positive, income as negative (same as Plaid convention)
        amount: -amount,
        memo: memo?.trim() || undefined,
        fitId: fitId?.trim() || undefined,
      });
    }

    return transactions;
  }

  private parseOFXXml(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match: RegExpExecArray | null;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const block = match[1];

      const dtPosted = this.extractXMLTag(block, 'DTPOSTED');
      const trnAmt = this.extractXMLTag(block, 'TRNAMT');
      const name =
        this.extractXMLTag(block, 'NAME') ||
        this.extractXMLTag(block, 'MEMO') ||
        'Unknown';
      const memo = this.extractXMLTag(block, 'MEMO');
      const fitId = this.extractXMLTag(block, 'FITID');

      if (!dtPosted || !trnAmt) continue;

      const date = this.parseOFXDate(dtPosted);
      const amount = parseFloat(trnAmt);

      if (!date || isNaN(amount)) continue;

      transactions.push({
        date,
        name: name.trim(),
        amount: -amount,
        memo: memo?.trim() || undefined,
        fitId: fitId?.trim() || undefined,
      });
    }

    return transactions;
  }

  private extractOFXTag(block: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
    const match = regex.exec(block);
    return match ? match[1].trim() : null;
  }

  private extractXMLTag(block: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = regex.exec(block);
    return match ? match[1].trim() : null;
  }

  private parseOFXDate(dateStr: string): string | null {
    const cleaned = dateStr.replace(/\[.*\]/, '').trim();
    if (cleaned.length < 8) return null;

    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);

    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);

    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      return null;
    }

    return `${year}-${month}-${day}`;
  }

  // ── Preview & Import ──────────────────────────────────────────────────

  async previewImport(
    userId: string,
    parsed: ParsedTransaction[],
    accountId: string,
  ): Promise<PreviewRow[]> {
    const existing = await this.db
      .select({
        date: schema.transactions.date,
        amount: schema.transactions.amount,
        name: schema.transactions.name,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.accountId, accountId),
        ),
      );

    const existingSet = new Set(
      existing.map(
        (t) => `${t.date}|${t.amount}|${t.name.toLowerCase().trim()}`,
      ),
    );

    return parsed.map((tx, idx) => {
      const key = `${tx.date}|${tx.amount}|${tx.name.toLowerCase().trim()}`;
      return {
        ...tx,
        isDuplicate: existingSet.has(key),
        selected: !existingSet.has(key),
        rowIndex: idx,
      };
    });
  }

  async executeImport(
    userId: string,
    transactions: ParsedTransaction[],
    accountId: string,
    options: ImportOptions,
    fileName: string,
    fileType: string,
    columnMapping?: ColumnMapping,
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    duplicateCount: number;
    totalRows: number;
  }> {
    // Verify account belongs to user
    const [account] = await this.db
      .select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.id, accountId),
          eq(schema.accounts.userId, userId),
        ),
      )
      .limit(1);

    if (!account) {
      throw new BadRequestException('Account not found');
    }

    // Duplicate detection
    const existing = await this.db
      .select({
        date: schema.transactions.date,
        amount: schema.transactions.amount,
        name: schema.transactions.name,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.accountId, accountId),
        ),
      );

    const existingSet = new Set(
      existing.map(
        (t) => `${t.date}|${t.amount}|${t.name.toLowerCase().trim()}`,
      ),
    );

    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    for (const tx of transactions) {
      const key = `${tx.date}|${tx.amount}|${tx.name.toLowerCase().trim()}`;
      const isDuplicate = existingSet.has(key);

      if (isDuplicate) {
        duplicateCount++;
        if (options.skipDuplicates) {
          skippedCount++;
          continue;
        }
      }

      try {
        const [inserted] = await this.db
          .insert(schema.transactions)
          .values({
            userId,
            accountId,
            amount: tx.amount,
            name: tx.name,
            merchantName: tx.merchantName || null,
            description: tx.memo || null,
            date: tx.date,
            pending: false,
            isManual: true,
            notes: tx.fitId ? `Imported (FITID: ${tx.fitId})` : 'Imported',
          })
          .returning();

        // Try auto-categorization
        try {
          const catResult = await this.categorizationService.categorize(
            userId,
            {
              id: inserted.id,
              name: tx.name,
              merchantName: tx.merchantName || null,
              description: tx.memo || null,
              amount: tx.amount,
            },
          );

          if (catResult.categoryId) {
            await this.db
              .update(schema.transactions)
              .set({
                categoryId: catResult.categoryId,
                categorizationSource: catResult.source,
              })
              .where(eq(schema.transactions.id, inserted.id));
          }
        } catch {
          // Categorization failure is non-fatal
          this.logger.debug(`Auto-categorization failed for "${tx.name}"`);
        }

        importedCount++;
        existingSet.add(key); // Prevent duplicates within the same import
      } catch (err) {
        this.logger.warn(`Failed to import transaction: ${tx.name}`, err);
        skippedCount++;
      }
    }

    // Record import history
    await this.db.insert(importHistory).values({
      userId,
      fileName,
      fileType,
      accountId,
      totalRows: transactions.length,
      importedCount,
      skippedCount,
      duplicateCount,
      columnMapping: columnMapping ? JSON.stringify(columnMapping) : null,
    });

    return {
      importedCount,
      skippedCount,
      duplicateCount,
      totalRows: transactions.length,
    };
  }

  // ── Import History ────────────────────────────────────────────────────

  async getImportHistory(userId: string) {
    return this.db
      .select({
        id: importHistory.id,
        fileName: importHistory.fileName,
        fileType: importHistory.fileType,
        accountId: importHistory.accountId,
        totalRows: importHistory.totalRows,
        importedCount: importHistory.importedCount,
        skippedCount: importHistory.skippedCount,
        duplicateCount: importHistory.duplicateCount,
        columnMapping: importHistory.columnMapping,
        importedAt: importHistory.importedAt,
        accountName: schema.accounts.name,
      })
      .from(importHistory)
      .leftJoin(
        schema.accounts,
        eq(importHistory.accountId, schema.accounts.id),
      )
      .where(eq(importHistory.userId, userId))
      .orderBy(desc(importHistory.importedAt));
  }

  // ── Supported Formats ─────────────────────────────────────────────────

  getSupportedFormats() {
    return [
      {
        key: 'generic',
        name: 'Generic CSV',
        description: 'CSV with date, description, and amount columns',
        expectedColumns: ['Date', 'Description', 'Amount'],
      },
      {
        key: 'mint',
        name: 'Mint Export',
        description: 'Exported from Mint.com or Intuit Mint',
        expectedColumns: [
          'Date',
          'Description',
          'Original Description',
          'Amount',
          'Transaction Type',
          'Category',
          'Account Name',
        ],
      },
      {
        key: 'ynab',
        name: 'YNAB Export',
        description: 'Exported from You Need A Budget',
        expectedColumns: [
          'Account',
          'Date',
          'Payee',
          'Category',
          'Memo',
          'Outflow',
          'Inflow',
        ],
      },
      {
        key: 'bank_debit_credit',
        name: 'Bank Generic (Debit/Credit)',
        description:
          'Common bank export with separate debit and credit columns',
        expectedColumns: [
          'Date',
          'Description',
          'Debit',
          'Credit',
          'Balance',
        ],
      },
      {
        key: 'ofx',
        name: 'OFX / QFX',
        description:
          'Open Financial Exchange format, supported by most banks',
        expectedColumns: ['DTPOSTED', 'TRNAMT', 'NAME', 'MEMO', 'FITID'],
      },
    ];
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private normalizeDate(dateStr: string): string | null {
    if (!dateStr || !dateStr.trim()) return null;

    const cleaned = dateStr.trim();

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned;
    }

    // MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
      const [m, d, y] = cleaned.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // MM-DD-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
      const [m, d, y] = cleaned.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
      return cleaned.replace(/\//g, '-');
    }

    // Try JS Date parsing as last resort
    try {
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // Fall through
    }

    return null;
  }

  private parseNumber(str: string): number {
    // Remove currency symbols, commas, spaces
    const cleaned = str.replace(/[$\u20AC\u00A3,\s]/g, '').trim();
    if (!cleaned) return 0;

    // Handle parenthetical notation for negative: (100.00) -> -100.00
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      return -parseFloat(cleaned.slice(1, -1));
    }

    return parseFloat(cleaned);
  }
}
